import { describe, expect, it } from 'vitest';
import { freezeVictoryRoster } from '../server/victory-roster';
import { teammateName } from '../server/teammates';
import { World } from '../server/world';

describe('victory roster', () => {
  it('freezes humans and AI teammates with their own classes and defeats', () => {
    const world=new World(), human=world.join('session','Knight'), bot=world.join('ai-teammate:0','Scout');
    human.kills=4;bot.kills=2;
    const humans=[{id:'human-id',name:'Ada',classId:'Knight',kills:human.kills,connected:true},{id:'departed',name:'Lin',classId:'Spellcaster',kills:1,connected:false}];
    const roster=freezeVictoryRoster(humans,world.players.values());
    expect(roster).toEqual([expect.objectContaining({id:'human-id',name:'Ada',kills:4}),expect.objectContaining({id:'departed',connected:false}),expect.objectContaining({id:bot.id,name:teammateName(bot.id),classId:'Scout',kills:2,connected:true})]);
    bot.kills=8;humans[0].kills=9;expect(roster[0].kills).toBe(4);expect(roster[2].kills).toBe(2);
  });
});
