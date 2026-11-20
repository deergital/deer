import {createCanvas,loadImage} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const source=await loadImage(fileURLToPath(new URL('../public/deergital-icon.png',import.meta.url)));
await mkdir(new URL('../public/icons/',import.meta.url),{recursive:true});
for(const size of [192,512]){const canvas=createCanvas(size,size),context=canvas.getContext('2d');context.fillStyle='#FFFFFF';context.fillRect(0,0,size,size);const ratio=size*.78/Math.max(source.width,source.height),width=source.width*ratio,height=source.height*ratio;context.drawImage(source,(size-width)/2,(size-height)/2,width,height);await writeFile(new URL('../public/icons/deer-'+size+'.png',import.meta.url),canvas.toBuffer('image/png'));}
