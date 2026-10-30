/** Display names are a suggestion only; the server verifies the token for identity. */
export async function wavedashDisplayName(host:unknown=(globalThis as {Wavedash?:unknown}).Wavedash):Promise<string|undefined>{
 try{
  const sdk=await Promise.resolve(host) as {getUser?:()=>{username?:unknown}|null;getUsername?:()=>unknown}|null|undefined;
  let candidate:unknown;try{candidate=sdk?.getUser?.()?.username;}catch{}
  if(typeof candidate!=='string'||!candidate.trim())try{candidate=sdk?.getUsername?.();}catch{}
  return typeof candidate==='string'&&candidate.trim()?candidate.trim().slice(0,24):undefined;
 }catch{return undefined;}
}
