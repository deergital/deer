import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {id:'/',name:'Deer — Tu espacio de trabajo',short_name:'Deer',description:'Proyectos, tareas y documentos de tu espacio privado.',lang:'es-MX',start_url:'/?source=homescreen',scope:'/',display:'standalone',background_color:'#F6F7FB',theme_color:'#4228D3',icons:[{src:'/icons/deer-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/deer-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]};
}
