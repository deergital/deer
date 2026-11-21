import {OAuthConsent} from '@/components/OAuthConsent';
export default async function ConsentPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const id=typeof params.authorization_id==='string'&&params.authorization_id.length<=300?params.authorization_id:'';return <OAuthConsent authorizationId={id}/>;}
