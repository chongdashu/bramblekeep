import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugins from '../vite.mjs';

const plugin=plugins().find(item=>item.name==='bramblekeep-wavedash-server');
const check=(target,url)=>plugin.configResolved({define:{
 'import.meta.env.VITE_RELEASE':JSON.stringify(target),
 'import.meta.env.VITE_COLYSEUS_URL':JSON.stringify(url),
}});

test('a Wavedash build needs a secure server origin',()=>{
 assert.doesNotThrow(()=>check('wavedash','https://world.up.railway.app'));
 for(const url of ['', 'http://world.test', 'https://world.test/health', 'https://user:pass@world.test', 'https://world.test/?x=1']){
  assert.throws(()=>check('wavedash',url),/HTTPS server origin/);
 }
 assert.doesNotThrow(()=>check('web',''));
});
