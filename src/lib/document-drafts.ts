type Draft={form:{title:string;project_id:string;kind:string;content_md:string};version:number|null;updatedAt:string};
let connection:Promise<IDBDatabase>|undefined;
function db(){return connection??=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('deer-document-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function documentDraft(owner:string,id:string|null,action:'read'|'write'|'delete',draft?:Draft):Promise<Draft|undefined>{
 if(!owner)return;
 const database=await db(),key=owner+':'+(id||'new');
 return new Promise((resolve,reject)=>{const transaction=database.transaction('drafts',action==='read'?'readonly':'readwrite'),store=transaction.objectStore('drafts');const request=action==='read'?store.get(key):action==='delete'?store.delete(key):store.put(draft,key);let result:Draft|undefined;request.onsuccess=()=>{if(action==='read')result=request.result;};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
}
