import {GET as metadata} from '../../route';
export const dynamic='force-dynamic';
export function GET(){return metadata();}
