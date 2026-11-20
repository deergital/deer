import type { Metadata,Viewport } from 'next';
import './globals.css';
import './fonts.css';
export const metadata: Metadata = { title: 'Deer - Tu trabajo, a la vista', description: 'Espacio privado para proyectos y tareas.',applicationName:'Deer',robots:{index:false,follow:false},appleWebApp:{capable:true,title:'Deer',statusBarStyle:'default'},formatDetection:{telephone:false} };
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:[{media:'(prefers-color-scheme: light)',color:'#F6F7FB'},{media:'(prefers-color-scheme: dark)',color:'#0D1026'}]};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="es" suppressHydrationWarning><body>{children}</body></html>; }
