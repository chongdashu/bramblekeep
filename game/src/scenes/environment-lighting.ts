import camp from './camp-layout.json';
import courtyard from './courtyard-layout.json';
import outskirts from './castle-outskirts.json';
import { TORCHES } from './environment-forest';
import { terrainHeight } from './terrain';
import { CORE_X, CORE_Z } from '../castle-patrol';

export type SceneLight = { at: [number,number,number]; color: [number,number,number]; radius: number; intensity: number };
type Candidate = SceneLight & { order: number };

/** Pick the eight most relevant lights for the camera. Selection is independent
 * of the flicker clock so a lamp cannot pop in and out as its flame moves. */
export function environmentLights(x:number,z:number,time:number,fire:number,torch:number,night:number): SceneLight[] {
  const lights:Candidate[]=[];
  const flicker=(phase:number)=>.90+.07*Math.sin(time*7+phase)+.04*Math.sin(time*13+phase*2);
  const add=(lx:number,y:number,lz:number,radius:number,intensity:number,color:[number,number,number],phase:number)=>{
    lights.push({at:[lx,y,lz],radius,intensity:intensity*flicker(phase),color,order:lights.length});
  };
  add(3.5,1.1,20,8.5,fire*1.25,[1,.38,.12],0);
  camp.lights.forEach(([lx,lz],i)=>add(lx,terrainHeight(lx,lz)+1.5,lz,7.5,fire*1.18,[1,.51,.20],20+i));
  [-2.6,2.6].forEach((lx,i)=>add(lx,1.6,11.3,6,fire*.75,[1,.62,.24],1+i));
  TORCHES.forEach(([lx,lz],i)=>add(lx,1.8,lz,6.7,torch*.95,[1,.48,.16],3+i));
  [-9.2,9.2].forEach((lx,i)=>add(lx,4.65,-16.9,9.5,torch*1.4,[1,.50,.18],30+i));
  [-6.8,6.8].forEach((lx,i)=>add(lx,2.6,-16.5,7,torch*.85,[1,.56,.23],34+i));
  [...courtyard.portalSconces,...courtyard.sconces].forEach(([lx,lz],i)=>add(lx,2.8,lz,7.2,torch*1.25,[1,.53,.22],12+i));
  add(CORE_X,1.7,CORE_Z,5.5,torch*.7,[1,.58,.2],28);
  outskirts.lights.forEach(([lx,lz],i)=>add(lx,terrainHeight(lx,lz)+1.5,lz,7,torch*1.15,[1,.56,.22],40+i));
  // Daylight mutes local pools gently; bulbs and flames stay visible in daylight.
  const dayScale=.65+.35*night;
  const ranked=lights.sort((a,b)=>{
    const score=(l:Candidate)=>Math.hypot(l.at[0]-x,l.at[2]-z)-l.radius*.6;
    return score(a)-score(b) || a.order-b.order;
  });
  // The opening camp vista also looks straight at the castle. Reserve two
  // slots for its braziers so the destination doesn't disappear into darkness.
  const chosen = z>14 && Math.abs(x)<16
    ? [...ranked.filter(l=>l.at[2]!==-16.9).slice(0,6), ...ranked.filter(l=>l.at[2]===-16.9)]
    : ranked.slice(0,8);
  return chosen.map(({order:_,...light})=>({...light,intensity:light.intensity*dayScale}));
}
