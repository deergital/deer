import type { Metadata } from 'next';
import './globals.css';
import './fonts.css';
export const metadata: Metadata = { title: 'Deer — Tu trabajo, a la vista', description: 'Espacio privado para proyectos y tareas.' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="es" suppressHydrationWarning><body>{children}</body></html>; }
