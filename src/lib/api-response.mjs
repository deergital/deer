export class AccessError extends Error{constructor(message,code){super(message);this.name='AccessError';this.code=code;}}
export async function readApiResponse(response){
 const json=response.headers.get('content-type')?.includes('application/json');
 if(!json){
  if([401,403].includes(response.status)||response.redirected)throw new AccessError('Netlify está pidiendo acceso otra vez. Tu borrador se conserva. Vuelve a autorizar la entrada al sitio para continuar.','NETLIFY_ACCESS_REQUIRED');
  throw new Error('El servidor no respondió como se esperaba. Tu borrador se conserva; vuelve a intentar.');
 }
 const data=await response.json();
 if(!response.ok){if(response.status===401)throw new AccessError('Tu sesión de Deer necesita renovarse. Inicia sesión para continuar.','DEER_SESSION_REQUIRED');throw new Error(data.error||'No se pudo completar la operación.');}
 return data;
}
