import {spawn} from 'node:child_process';
import {developmentAnalytics} from './dev-analytics.mjs';

const analytics=developmentAnalytics(process.cwd());
if(!analytics)console.warn('Development Convex analytics is unavailable; the local world will continue without server analytics.');
const env={...process.env};for(const name of ['BRAMBLEKEEP_ANALYTICS_SITE','BRAMBLEKEEP_ANALYTICS_TRAFFIC','BRAMBLEKEEP_INGEST_KEY'])delete env[name];
Object.assign(env,analytics??{}, {CASTLE_DEV_DEBUG:'1'});
const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','watch','game/server/index.ts'],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exit(code??1);});
