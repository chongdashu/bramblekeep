import { strict as assert } from 'node:assert';
import { mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=mkdtempSync(join(tmpdir(),'castle-dev-config-'));const args=process.argv;
try{
 mkdirSync(join(root,'analytics'));mkdirSync(join(root,'server'));copyFileSync('game/vite.mjs',join(root,'vite.mjs'));copyFileSync('game/server/dev-analytics.mjs',join(root,'server/dev-analytics.mjs'));
 const dev='https://dev.convex.site',prod='https://prod.convex.site';writeFileSync(join(root,'analytics/release.json'),JSON.stringify({web:{site:dev},wavedash:{productionSite:prod}}));
 writeFileSync(join(root,'analytics/.env.local'),`CONVEX_DEPLOYMENT=dev:example\nCONVEX_SITE_URL=${dev}\n`);
 const {developmentAnalytics}=await import(pathToFileURL(join(root,'server/dev-analytics.mjs')).href);const key='k'.repeat(40),settings=developmentAnalytics(root,()=>key);assert.equal(settings.BRAMBLEKEEP_ANALYTICS_SITE,dev);assert.equal(settings.BRAMBLEKEEP_ANALYTICS_TRAFFIC,'test');assert.equal(settings.BRAMBLEKEEP_INGEST_KEY,key);
 writeFileSync(join(root,'analytics/.env.local'),`CONVEX_DEPLOYMENT=prod:example\nCONVEX_SITE_URL=${prod}\n`);assert.equal(developmentAnalytics(root,()=>key),null);
 const {default:plugins}=await import(pathToFileURL(join(root,'vite.mjs')).href);const local=plugins().find(p=>p.name==='bramblekeep-local-preview');process.argv=['node','vite','--port','5173'];const configured=local.config({}, {mode:'development'}).define;assert.equal(JSON.parse(configured['import.meta.env.VITE_COLYSEUS_URL']),'');assert.equal(JSON.parse(configured['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE']),dev);assert.equal(JSON.parse(configured['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE']),'');assert.equal(JSON.parse(configured['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_TEST']),'1');process.argv=['node','vite','--port','51986'];assert.equal(local.config({}, {mode:'development'}),undefined);assert.equal(local.config({}, {mode:'test'}),undefined);
 console.log('Local preview configuration and development-only analytics checks passed');
}finally{process.argv=args;rmSync(root,{recursive:true,force:true});}
