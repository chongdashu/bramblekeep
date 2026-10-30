import type { Identity } from './identity';
export type Score={id:string;name:string;classId:string;kills:number;connected:boolean};
export type Activity={id:number;kind:'join'|'leave'|'gate'|'kill'|'victory'|'chat';name:string;text:string;sentAt:number;actorId?:string};
export type SocialSnapshot={round:number;roster:Score[];activity:Activity[];nextId:number};
/** Recent messages and a round roster survive departures, reconnects and checkpoints. */
export class Social {
 round=1;roster=new Map<string,Score>();activity:Activity[]=[];private nextId=0;
 snapshot():SocialSnapshot{return {round:this.round,roster:[...this.roster.values()].map(s=>({...s})),activity:this.activity.map(e=>({...e})),nextId:this.nextId};}
 restore(saved:SocialSnapshot|undefined,round:number){if(!saved||!Array.isArray(saved.roster)||!Array.isArray(saved.activity))return;this.nextId=Math.max(0,Number(saved.nextId)||0);this.activity=saved.activity.slice(-50).map(event=>({...event,sentAt:Number.isFinite(event.sentAt)?event.sentAt:0}));this.round=round;if(saved.round===round)for(const row of saved.roster)if(typeof row.id==='string'&&typeof row.name==='string')this.roster.set(row.id,{...row,connected:false});}
 join(identity:Identity,classId:string){const old=this.roster.get(identity.id);const row:Score=old?{...old,name:identity.name,classId,connected:true}:{id:identity.id,name:identity.name,classId,kills:0,connected:true};this.roster.set(identity.id,row);this.add('join',row.name,old?'returned to the game':'joined the game');return row;}
 leave(id:string,temporary=false){const row=this.roster.get(id);if(!row||!row.connected)return;row.connected=false;this.add('leave',row.name,temporary?'disconnected':'left the game');}
 reconnect(id:string){const row=this.roster.get(id);if(row&&!row.connected){row.connected=true;this.add('join',row.name,'reconnected');}}
 add(kind:Activity['kind'],name:string,text:string,actorId?:string){this.activity.push({id:++this.nextId,kind,name,text,sentAt:Date.now(),...(actorId?{actorId}:{})});if(this.activity.length>50)this.activity.shift();}
 reset(round:number){this.round=round;for(const [id,row] of this.roster)if(!row.connected)this.roster.delete(id);else row.kills=0;}
}
