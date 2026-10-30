import { describe,it,expect } from 'vitest';
import { EnemyEmergence } from '../src/enemy-emergence';
describe('enemy emergence',()=>{
 it('only animates a respawn, and settles at the real position',()=>{const e=new EnemyEmergence();e.update('0',true,.1);expect(e.offset('0')).toBeCloseTo(0);e.update('0',false,.1);e.update('0',true,.1);expect(e.offset('0')).toBeCloseTo(-.8);e.update('0',true,.65);expect(e.offset('0')).toBeCloseTo(0);expect(e.update('5',true,.1)).toBe(true);expect(e.offset('5')).toBeCloseTo(-.8);});
});
