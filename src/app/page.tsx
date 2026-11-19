'use client';
import dynamic from 'next/dynamic';
// Private workspace: render MUI once in the browser rather than hydrate
// Emotion's server style tags without an App Router cache provider.
const DeerApp = dynamic(() => import('@/components/DeerApp').then(m => m.DeerApp), {
 ssr: false,
 loading: () => <p role="status">Cargando Deer…</p>,
});
export default function Page(){ return <DeerApp/>; }
