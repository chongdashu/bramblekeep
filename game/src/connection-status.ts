/** A single in-flight WebSocket round trip; old callbacks cannot revive a dropped room. */
export type ConnectionPhase='selecting'|'connecting'|'connected'|'reconnecting'|'disconnected';
export type ConnectionView={phase:ConnectionPhase;ping:number|null;players:number|null};
export type PingRoom={ping(callback:(ms:number)=>void):void};
export class ConnectionMonitor {
 private view:ConnectionView={phase:'selecting',ping:null,players:null};
 private timer:ReturnType<typeof setTimeout>|null=null;
 private generation=0;
 constructor(private readonly publish:(view:ConnectionView)=>void){}
 setPhase(phase:ConnectionPhase){this.generation++;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;this.view={phase,ping:null,players:null};this.emit();}
 start(room:PingRoom){this.setPhase('connected');const generation=this.generation;this.measure(room,generation);}
 setPlayers(players:number|null){if(this.view.players===players)return;this.view={...this.view,players};this.emit();}
 private emit(){this.publish({...this.view});}
 private measure(room:PingRoom,generation:number){
  if(generation!==this.generation)return;
  let pending=true;
  this.timer=setTimeout(()=>{if(!pending||generation!==this.generation)return;pending=false;this.view={...this.view,ping:null};this.emit();this.timer=setTimeout(()=>this.measure(room,generation),3000);},5000);
  room.ping(ms=>{if(!pending||generation!==this.generation)return;pending=false;if(this.timer!==null)clearTimeout(this.timer);this.view={...this.view,ping:Number.isFinite(ms)?Math.max(0,Math.round(ms)):null};this.emit();this.timer=setTimeout(()=>this.measure(room,generation),3000);});
 }
}
export function connectionText(view:ConnectionView):string {
 if(view.phase==='selecting')return 'Not connected';
 if(view.phase==='connecting')return 'Connecting…';
 if(view.phase==='reconnecting')return 'Reconnecting…';
 if(view.phase==='disconnected')return 'Disconnected';
 const players=view.players===null?'— players':`${view.players} ${view.players===1?'player':'players'}`;
 return `Connected · ${players} · ${view.ping===null?'—':view.ping} ms`;
}
