import {boundedEntry} from '../src/lib/document-package.mjs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

// Restore only into a new, isolated, in-memory database. No network credentials,
// no production writes. Backups contain operational records, never Auth secrets.
export async function verifyBackup(backup,files=new Map()){
 assert.equal(backup.format,'deer-e1-backup');
 assert.ok([1,2,3,4].includes(backup.schema_version));
 const tables=['profiles','projects','tasks',...(backup.schema_version>=2?['documents']:[]),...(backup.schema_version>=3?['document_assets','document_links']:[])];
 assert.match(backup.owner_id,/^[0-9a-f-]{36}$/i);
 assert.equal(backup.profiles?.length,1);
 assert.equal(backup.profiles[0].id,backup.owner_id);
 for(const table of tables.filter(t=>t!=='profiles')){
  assert.ok(Array.isArray(backup[table]));
  for(const row of backup[table])assert.equal(row.owner_id,backup.owner_id,'Mixed owners');
 }
 for(const asset of backup.document_assets||[]){assert.equal(asset.storage_path,backup.owner_id+'/'+asset.id);const bytes=files.get(asset.id);assert.ok(bytes,'Binary missing: '+asset.name);assert.equal(bytes.length,asset.size_bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../supabase/tests/bootstrap.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160001_deer_e1.sql',import.meta.url),'utf8'));
  if(backup.schema_version>=2){await db.exec(await readFile(new URL('../supabase/migrations/202611190001_deer_backup.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/202611190002_deer_documents.sql',import.meta.url),'utf8'));}
  if(backup.schema_version>=3){await db.exec(await readFile(new URL('../supabase/tests/storage-bootstrap.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/202611190003_deer_e2_complete.sql',import.meta.url),'utf8'));}
  if(backup.schema_version>=4)await db.exec(await readFile(new URL('../supabase/migrations/202611190004_deer_word_processor.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values ($1)',[backup.owner_id]);
  await db.exec('begin');
  try{
   for(const table of tables){
    const {rows:columns}=await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table]);
    const allowed=columns.map(c=>c.column_name).sort();
    for(const row of backup[table])assert.deepEqual(Object.keys(row).sort(),allowed,'Missing or unknown columns');
    await db.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,[JSON.stringify(backup[table])]);
   }
   await db.exec('commit');
  }catch(e){await db.exec('rollback');throw e;}
  for(const table of tables){
   const {rows}=await db.query(`select to_jsonb(t) as record from public.${table} t order by ${table==='document_links'?'source_id,target_type,target_id':'id'}`);
   const key=r=>table==='document_links'?r.source_id+'|'+r.target_type+'|'+r.target_id:r.id;
   const expected=[...backup[table]].sort((a,b)=>key(a).localeCompare(key(b)));
   assert.equal(rows.length,expected.length);
   for(let i=0;i<rows.length;i++){
    const actual={...rows[i].record},original={...expected[i]};
    for(const field of ['created_at','updated_at'].filter(f=>f in original)){
     const comparison=await db.query('select $1::timestamptz = $2::timestamptz as same',[actual[field],original[field]]);
     assert.equal(comparison.rows[0].same,true,`Timestamp mismatch: ${field}`);
     delete actual[field];delete original[field];
    }
    assert.deepEqual(actual,original,`Restore mismatch: ${table}`);
   }
  }
  for(const link of backup.document_links||[]){const targetTable={document:'documents',task:'tasks',project:'projects'}[link.target_type];assert.ok(targetTable);const r=await db.query('select count(*)::int n from public.'+targetTable+' where id=$1 and owner_id=$2',[link.target_id,backup.owner_id]);assert.equal(r.rows[0].n,1,'Broken internal link');}
  return Object.fromEntries(tables.map(t=>[t,backup[t].length]));
 }finally{await db.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(!process.argv[2])throw new Error('Provide the downloaded backup JSON path');
  let backup;const files=new Map();
  if(process.argv[2].endsWith('.zip')){const {default:JSZip}=await import('jszip');const raw=await readFile(process.argv[2]);assert.ok(raw.length<=110*1024*1024,'Backup ZIP too large');const zip=await JSZip.loadAsync(raw);const entry=zip.file('backup.json');assert.ok(entry,'backup.json missing');backup=JSON.parse(new TextDecoder().decode(await boundedEntry(entry,10*1024*1024)));let totalBytes=0;for(const asset of backup.document_assets||[]){const file=zip.file('assets/'+asset.id);assert.ok(file,'Binary missing: '+asset.name);const bytes=await boundedEntry(file,4194304);totalBytes+=bytes.length;assert.ok(totalBytes<=100*1024*1024,'Backup resources too large');files.set(asset.id,bytes);}}
  else backup=JSON.parse(await readFile(process.argv[2],'utf8'));
  const counts=await verifyBackup(backup,files);
  console.log('Restauración aislada verificada:',counts);
 }catch(e){console.error('No se pudo verificar el respaldo:',e.message);process.exitCode=1;}
}
