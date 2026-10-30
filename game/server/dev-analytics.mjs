import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Configure the local world only from this game's selected development deployment. */
export function developmentAnalytics(root, readKey) {
 try {
  const settings=JSON.parse(readFileSync(new URL('../analytics/release.json',import.meta.url),'utf8'));
  const site=settings.web?.site,production=settings.wavedash?.productionSite;
  const url=new URL(site);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.convex.site')||url.origin!==site||site===production)throw Error('Invalid development analytics site');
  const dir=fileURLToPath(new URL('../analytics/',import.meta.url));
  const file=readFileSync(new URL('../analytics/.env.local',import.meta.url),'utf8');
  const values=Object.fromEntries(file.split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/\s+#.*$/,'').trim()];}));
  if(!values.CONVEX_DEPLOYMENT?.startsWith('dev:')||values.CONVEX_SITE_URL!==site)throw Error('Selected Convex deployment does not match the game development site');
  const cliEnv={...process.env};for(const name of Object.keys(cliEnv))if(name.startsWith('CONVEX_'))delete cliEnv[name];
  const key=readKey?readKey():execFileSync(process.execPath,[`${root}/node_modules/convex/bin/main.js`,'env','get','BRAMBLEKEEP_INGEST_KEY'],{cwd:dir,env:cliEnv,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim();
  if(typeof key!=='string'||key.length<32)throw Error('Development analytics credential unavailable');
  return {BRAMBLEKEEP_ANALYTICS_SITE:site,BRAMBLEKEEP_ANALYTICS_TRAFFIC:'test',BRAMBLEKEEP_INGEST_KEY:key};
 } catch {return null;}
}
