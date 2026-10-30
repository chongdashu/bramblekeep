import { CastleRoom } from '../server/room.ts';
const original=CastleRoom.prototype.onCreate;
CastleRoom.prototype.onCreate=function(...args){original.apply(this,args);this.onMessage('fixture_heal',client=>{for(const p of this.world.players.values()){p.x=0;p.z=22;p.health=3;p.invulnerability=20;}this.sync();});};
await import('../server/index.ts');
