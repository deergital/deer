import {readFile,writeFile,mkdir,unlink,rmdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import PdfPrinter from 'pdfmake';
import {randomBytes} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),route=new URL('../src/app/deer-interface-review/',import.meta.url),page=new URL('page.tsx',route);
const nextEnv=new URL('../next-env.d.ts',import.meta.url),tsconfig=new URL('../tsconfig.json',import.meta.url),savedEnv=await readFile(nextEnv),savedConfig=await readFile(tsconfig);
await mkdir(new URL('../.deer-build/',import.meta.url),{recursive:true});
const font=fileURLToPath(new URL('../public/fonts/deer-text-regular.ttf',import.meta.url));
const printer=new PdfPrinter({Manrope:{normal:font,bold:font,italics:font,bolditalics:font}});
const pdf=printer.createPdfKitDocument({defaultStyle:{font:'Manrope'},content:[{text:'PDF de prueba',fontSize:24},{text:'Segunda página',pageBreak:'before'}]});
const chunks=[];pdf.on('data',c=>chunks.push(c));const complete=new Promise((resolve,reject)=>{pdf.on('end',resolve);pdf.on('error',reject);});pdf.end();await complete;await writeFile(new URL('../.deer-build/review.pdf',import.meta.url),Buffer.concat(chunks));
// A tiny, deterministic PNG fixture; never a user asset.
const {createCanvas}=await import('@napi-rs/canvas');const canvas=createCanvas(360,180),ctx=canvas.getContext('2d');ctx.fillStyle='#4228D3';ctx.fillRect(0,0,360,180);ctx.fillStyle='#FF8600';ctx.fillRect(24,24,96,96);await writeFile(new URL('../.deer-build/review.png',import.meta.url),canvas.toBuffer('image/png'));
let exists=false;try{await access(page);exists=true;}catch{}if(exists)throw Error('Review route already exists; refusing to overwrite it.');
await mkdir(route,{recursive:true});await writeFile(page,await readFile(new URL('../tests/fixtures/interface-page.tsx',import.meta.url)));
const reviewId=randomBytes(4).toString('hex');
for(const suffix of ['dev/static/chunks/app/deer-interface-review','dev/server/app/deer-interface-review','dev/types/app/deer-interface-review'])await mkdir(new URL('../.deer-build/interface-'+reviewId+'/'+suffix+'/',import.meta.url),{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3011'],{cwd:root,windowsHide:true,env:{...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',DEER_INTERFACE_REVIEW:'1',DEER_REVIEW_ID:reviewId},stdio:['ignore','pipe','pipe']});
console.log('Review server PID:',server.pid);
let logs='';server.stdout.on('data',d=>{logs+=d;});server.stderr.on('data',d=>{logs+=d;});
try{let available=false;for(let i=0;i<20;i++){if(server.exitCode!==null)throw Error(logs.slice(-3000));try{const r=await fetch('http://127.0.0.1:3011/deer-interface-review',{signal:AbortSignal.timeout(10000)});if(r.ok){available=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}if(!available)throw Error('Test server did not start. '+logs.slice(-3000));const tests=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{cwd:root,windowsHide:true,stdio:'inherit'});process.exitCode=await new Promise(resolve=>tests.on('exit',code=>resolve(code||0)));}
finally{if(process.platform==='win32'&&server.pid&&server.exitCode===null){const stop=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});await new Promise(resolve=>stop.on('exit',resolve));}else server.kill();server.stdout.destroy();server.stderr.destroy();await unlink(page);await rmdir(route);if((await readFile(nextEnv,'utf8')).includes('.deer-build/interface-'))await writeFile(nextEnv,savedEnv);if((await readFile(tsconfig,'utf8')).includes('.deer-build/interface-'))await writeFile(tsconfig,savedConfig);}

process.exit(process.exitCode||0);
