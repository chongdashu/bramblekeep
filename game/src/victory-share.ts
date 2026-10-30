/** Public entry point, rather than an expiring embed or a local development URL. */
export const PLAY_URL = 'https://bramblekeep.vercel.app/';
export type ShareScore = {name:string;classId:string;kills:number;connected:boolean;bot?:boolean};
export type ShareResult = {round:number;defeats:number;scores:ShareScore[]};

/** Compose the actual captured game frame with the authoritative frozen results. */
export function renderVictoryShare(frame: HTMLCanvasElement, result: ShareResult): HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image rendering is unavailable');
  const scale=Math.max(1200/frame.width,675/frame.height),width=frame.width*scale,height=frame.height*scale;
  ctx.drawImage(frame,(1200-width)/2,(675-height)/2,width,height);
  const shade=ctx.createLinearGradient(0,0,0,675);shade.addColorStop(0,'rgba(9,23,40,.4)');shade.addColorStop(.5,'rgba(9,23,40,.2)');shade.addColorStop(.65,'rgba(9,23,40,.94)');shade.addColorStop(1,'rgba(9,23,40,.98)');ctx.fillStyle=shade;ctx.fillRect(0,0,1200,675);
  ctx.fillStyle='#f9d98e';ctx.font='bold 19px system-ui';ctx.fillText('BRAMBLEKEEP  •  ROUND '+result.round,52,56);
  ctx.fillStyle='#fff6dc';ctx.shadowColor='#07182c';ctx.shadowBlur=12;ctx.font='900 60px system-ui';ctx.fillText('CASTLE CLEARED!',48,120);ctx.shadowBlur=0;
  ctx.fillStyle='#dfeced';ctx.font='600 21px system-ui';ctx.fillText(`${result.defeats} enemies defeated  •  ${result.scores.length} heroes`,52,158);
  ctx.fillStyle='#f3d18b';ctx.font='bold 18px system-ui';ctx.fillText('THE PARTY',52,402);
  const list=result.scores.slice(0,24),columns=list.length>8?3:2,rows=Math.max(1,Math.ceil(list.length/columns)),spacing=Math.min(27,200/rows),columnWidth=1096/columns;
  ctx.font='600 17px system-ui';
  list.forEach((score,i)=>{const col=Math.floor(i/rows),row=i%rows,x=52+col*columnWidth,y=432+row*spacing;ctx.fillStyle='#fff4dc';ctx.fillText(score.name,x,y,columnWidth-125);ctx.fillStyle='#bbd7e2';ctx.textAlign='right';ctx.fillText(`${score.classId}${score.bot?" · AI":""} · ${score.kills}`,x+columnWidth-15,y,120);ctx.textAlign='left';});
  ctx.fillStyle='#f5d287';ctx.font='bold 21px system-ui';ctx.fillText('PLAY BRAMBLEKEEP',52,641);ctx.fillStyle='#e5eff1';ctx.textAlign='right';ctx.font='600 19px system-ui';ctx.fillText(PLAY_URL,1148,641);ctx.textAlign='left';
  return canvas;
}

export function xShareUrl(result:ShareResult) {
  const names=result.scores.slice(0,3).map(s=>s.name).join(', ');
  const message=`We cleared Bramblekeep${names?` with ${names}`:''}! ⚔️\nJoin the adventure:`;
  const url=new URL('https://twitter.com/intent/tweet');url.searchParams.set('text',message);url.searchParams.set('url',PLAY_URL);return url.href;
}

/** The dialog owns its snapshot so the server's round reset cannot close it. */
export class VictoryShare {
  private root:HTMLElement; private imageUrl:string|null=null; private generation=0;
  constructor(){
    this.root=document.createElement('section');this.root.className='victory-share';this.root.hidden=true;this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','Share your victory');
    this.root.innerHTML='<div class="victory-share-card"><button class="victory-share-close" type="button" aria-label="Close share preview">×</button><h2>Share your victory</h2><p class="victory-share-status" role="status">Preparing your victory image…</p><img class="victory-share-image" alt="Victory image preview" hidden><div class="victory-share-actions"><button class="victory-share-save" type="button" disabled>Save image</button><button class="victory-share-x" type="button" disabled>Share on X</button></div><p class="victory-share-help">Save the image, then attach it to your post on X.</p></div>';
    document.body.append(this.root);this.root.querySelector<HTMLButtonElement>('.victory-share-close')!.onclick=()=>this.close();
    this.root.addEventListener('click',e=>{if(e.target===this.root)this.close();});
    document.addEventListener('keydown',e=>{if(!this.root.hidden&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}},true);
  }
  private close(){this.root.hidden=true;this.generation++;if(this.imageUrl)URL.revokeObjectURL(this.imageUrl);this.imageUrl=null;}
  async open(frame:Promise<HTMLCanvasElement|null>|null,result:ShareResult){
    this.close();const generation=++this.generation;this.root.hidden=false;
    const image=this.root.querySelector<HTMLImageElement>('.victory-share-image')!,status=this.root.querySelector<HTMLElement>('.victory-share-status')!,save=this.root.querySelector<HTMLButtonElement>('.victory-share-save')!,share=this.root.querySelector<HTMLButtonElement>('.victory-share-x')!;
    image.hidden=true;save.disabled=share.disabled=true;status.textContent='Preparing your victory image…';this.root.querySelector<HTMLButtonElement>('.victory-share-close')!.focus();
    try{
      if(!frame)throw new Error('The game frame was unavailable.');
      const captured=await frame;if(!captured)throw new Error('The game frame was unavailable.');const rendered=renderVictoryShare(captured,result);
      const blob=await new Promise<Blob>((resolve,reject)=>rendered.toBlob(value=>value?resolve(value):reject(new Error('Could not create the image.')),'image/png'));
      if(generation!==this.generation)return;
      this.imageUrl=URL.createObjectURL(blob);image.src=this.imageUrl;image.hidden=false;status.textContent='Your victory is ready to share.';save.disabled=share.disabled=false;
      const download=()=>{if(!this.imageUrl)return;const a=document.createElement('a');a.href=this.imageUrl;a.download=`bramblekeep-victory-round-${result.round}.png`;document.body.append(a);a.click();a.remove();};
      save.onclick=download;
      share.onclick=()=>{window.open(xShareUrl(result),'_blank','noopener,noreferrer');download();status.textContent='Image saved. Attach it to your post on X.';};
    }catch{if(generation===this.generation)status.textContent='Could not capture this victory. Please try again next round.';}
  }
}
