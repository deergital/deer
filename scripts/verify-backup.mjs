import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

// Restore only into a new, isolated, in-memory database. No network credentials,
// no production writes. Backups contain operational records, never Auth secrets.
export async function verifyBackup(backup){
 assert.equal(backup.format,'deer-e1-backup');
 assert.ok([1,2].includes(backup.schema_version));
 const tables=['profiles','projects','tasks',...(backup.schema_version===2?['documents']:[])];
 assert.match(backup.owner_id,/^[0-9a-f-]{36}$/i);
 assert.equal(backup.profiles?.length,1);
 assert.equal(backup.profiles[0].id,backup.owner_id);
 for(const table of tables.filter(t=>t!=='profiles')){
  assert.ok(Array.isArray(backup[table]));
  for(const row of backup[table])assert.equal(row.owner_id,backup.owner_id,'Mixed owners');
 }
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../supabase/tests/bootstrap.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611160001_deer_e1.sql',import.meta.url),'utf8'));
  if(backup.schema_version===2){await db.exec(await readFile(new URL('../supabase/migrations/202611190001_deer_backup.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/202611190002_deer_documents.sql',import.meta.url),'utf8'));}
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
   const {rows}=await db.query(`select to_jsonb(t) as record from public.${table} t order by id`);
   const expected=[...backup[table]].sort((a,b)=>a.id.localeCompare(b.id));
   assert.equal(rows.length,expected.length);
   for(let i=0;i<rows.length;i++){
    const actual={...rows[i].record},original={...expected[i]};
    for(const field of ['created_at','updated_at']){
     const comparison=await db.query('select $1::timestamptz = $2::timestamptz as same',[actual[field],original[field]]);
     assert.equal(comparison.rows[0].same,true,`Timestamp mismatch: ${field}`);
     delete actual[field];delete original[field];
    }
    assert.deepEqual(actual,original,`Restore mismatch: ${table}`);
   }
  }
  return Object.fromEntries(tables.map(t=>[t,backup[t].length]));
 }finally{await db.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(!process.argv[2])throw new Error('Provide the downloaded backup JSON path');
  const counts=await verifyBackup(JSON.parse(await readFile(process.argv[2],'utf8')));
  console.log('Restauración aislada verificada:',counts);
 }catch(e){console.error('No se pudo verificar el respaldo:',e.message);process.exitCode=1;}
}
