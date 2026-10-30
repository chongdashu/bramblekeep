import {describe,expect,it} from 'vitest';
import {isNearbyHero,NEARBY_HERO_RANGE} from '../src/nearby-chat';
import {Social} from '../server/social';

describe('nearby player chat',()=>{
 it('uses world distance for nameplates and speech bubbles',()=>{expect(isNearbyHero(0,0,NEARBY_HERO_RANGE,0)).toBe(true);expect(isNearbyHero(0,0,NEARBY_HERO_RANGE+.01,0)).toBe(false);expect(isNearbyHero(5,5,5,5)).toBe(true);});
 it('retains an explicit sender identity with chat history',()=>{const social=new Social();social.add('chat','Same name','hello','session-a');social.add('chat','Same name','hi','session-b');const saved=social.snapshot(),restored=new Social();restored.restore(saved,1);expect(restored.activity.map(event=>event.actorId)).toEqual(['session-a','session-b']);});
});
