import type { GameRuntime } from '@engine/runtime';

/** Anchors other players' labels to their interpolated world positions. */
export class Nameplates {
 private root:HTMLElement;
 private labels=new Map<string,HTMLElement>();
 private seen=new Set<string>();
 private rect:DOMRect|null=null;
 constructor(private readonly runtime:GameRuntime){
  this.root=document.createElement('div');this.root.className='player-nameplates';this.root.setAttribute('aria-hidden','true');document.body.append(this.root);
 }
 begin(){this.seen.clear();this.rect=this.runtime.canvas.getBoundingClientRect();}
 place(id:string,name:string,x:number,y:number,z:number){
  if(!name)return;this.seen.add(id);
  let label=this.labels.get(id);if(!label){label=document.createElement('div');label.className='player-nameplate';label.dataset.playerId=id;this.root.append(label);this.labels.set(id,label);}
  if(label.textContent!==name)label.textContent=name;
  const rect=this.rect;if(!rect)return;const point=this.runtime.camera.project([x,y,z],rect.width,rect.height);
  const visible=!!point&&point[0]>=0&&point[0]<=rect.width&&point[1]>=0&&point[1]<=rect.height;
  label.hidden=!visible;if(visible&&point){label.style.left=`${rect.left+point[0]}px`;label.style.top=`${rect.top+point[1]}px`;}
 }
 end(){for(const [id,label] of this.labels)if(!this.seen.has(id)){label.remove();this.labels.delete(id);}}
 clear(){this.root.replaceChildren();this.labels.clear();this.seen.clear();}
}
