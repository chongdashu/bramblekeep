import { readFileSync } from 'node:fs';

// This game needs its own server. Other games can package for Wavedash without one.
export default function () {
  return [{
    name: 'bramblekeep-analytics-config',
    apply: 'build',
    config(config) {
      const encoded = config.define?.['import.meta.env.VITE_RELEASE'];
      const target = typeof encoded === 'string' ? JSON.parse(encoded) : null;
      if (target !== 'web' && target !== 'wavedash') return;
      const allSettings = JSON.parse(readFileSync(new URL('./analytics/release.json', import.meta.url), 'utf8'));
      const settings = allSettings[target];
      const sites = target === 'wavedash' ? settings?.sites ?? {} : {};
      if (!sites || typeof sites !== 'object' || Array.isArray(sites)) throw new Error('Invalid Bramblekeep analytics server mapping.');
      const validOrigin = value => {
        try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value && !url.username && !url.password; }
        catch { return false; }
      };
      for (const [server, site] of Object.entries(sites)) {
        if (!validOrigin(server)) throw new Error('Bramblekeep analytics requires an HTTPS server origin.');
        if (typeof site !== 'string' || !validOrigin(site) || !new URL(site).hostname.endsWith('.convex.site')) throw new Error('Bramblekeep analytics requires a dedicated HTTPS Convex site origin.');
      }
      const encodedServer = config.define?.['import.meta.env.VITE_COLYSEUS_URL'];
      const server = typeof encodedServer === 'string' ? JSON.parse(encodedServer) : '';
      // The default is always the development deployment. A Wavedash package
      // can additionally reach production only when its server is mapped to it;
      // the runtime checks the Wavedash environment before choosing that site.
      const site = allSettings.web?.site ?? '';
      const productionSite = target === 'wavedash' ? settings?.productionSite ?? '' : '';
      for (const origin of [site, productionSite]) {
        if (typeof origin !== 'string' || (origin && (!validOrigin(origin) || !new URL(origin).hostname.endsWith('.convex.site')))) throw new Error('Bramblekeep analytics requires a dedicated HTTPS Convex site origin.');
      }
      if (productionSite && !site) throw new Error('Bramblekeep production analytics requires a development fallback.');
      if (site && productionSite && site === productionSite) throw new Error('Bramblekeep development and production analytics must be separate.');
      if (Object.values(sites).some(origin => origin !== site && origin !== productionSite)) throw new Error('Bramblekeep server mapping must use its development or production analytics site.');
      const liveSite = productionSite && sites[server] === productionSite ? productionSite : '';
      const ids = [settings?.playtestGameCloudId ?? '', settings?.liveGameCloudId ?? ''];
      if (ids.some(id => typeof id !== 'string' || (id && !/^[a-z0-9]+$/.test(id)))) throw new Error('Invalid Wavedash game-cloud ID in analytics configuration.');
      if (ids[0] && ids[0] === ids[1]) throw new Error('Wavedash playtest and production game-cloud IDs must differ.');
      return { define: {
        'import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE': JSON.stringify(site),
        'import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE': JSON.stringify(liveSite),
        'import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_PLAYTEST_GCID': JSON.stringify(ids[0]),
        'import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_LIVE_GCID': JSON.stringify(ids[1]),
      } };
    },
  }, {
    name: 'bramblekeep-local-preview',
    apply: 'serve',
    config(_config, env) {
      if (env.mode === 'test') return;
      const index=process.argv.indexOf('--port');
      const inline=process.argv.find(arg=>arg.startsWith('--port='));
      const port=Number(index>=0?process.argv[index+1]:inline?inline.slice(7):5173);
      if(port!==5173)return;
      const settings=JSON.parse(readFileSync(new URL('./analytics/release.json',import.meta.url),'utf8'));
      const site=settings.web?.site,live=settings.wavedash?.productionSite;
      let valid=false;try{const url=new URL(site);valid=url.protocol==='https:'&&url.hostname.endsWith('.convex.site')&&url.origin===site&&site!==live;}catch{}
      if(!valid)return {define:{'import.meta.env.VITE_COLYSEUS_URL':JSON.stringify('')}};
      return {define:{
        'import.meta.env.VITE_COLYSEUS_URL':JSON.stringify(''),
        'import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE':JSON.stringify(site),
        'import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE':JSON.stringify(''),
        'import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_TEST':JSON.stringify('1'),
      }};
    },
  }, {
    name: 'bramblekeep-dev-world-status',
    apply: 'serve',
    configureServer(server) {
      const worlds = {
        production: process.env.BRAMBLEKEEP_PRODUCTION_WORLD_URL ?? '',
        playtest: process.env.BRAMBLEKEEP_PLAYTEST_WORLD_URL ?? '',
      };
      server.middlewares.use('/__dev/world-status', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const match = /^\/(production|playtest)\/(health|world-status)$/.exec(pathname);
        if (!match) { res.statusCode = 404; res.end(); return; }
        try {
          const upstream = await fetch(`${worlds[match[1]]}/${match[2]}`, { signal: AbortSignal.timeout(5000) });
          res.statusCode = upstream.status; res.setHeader('Content-Type', 'application/json'); res.end(await upstream.text());
        } catch { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end('{"error":"World unavailable"}'); }
      });
    },
  }, {
    name: 'bramblekeep-wavedash-server',
    apply: 'build',
    configResolved(config) {
      const value = (name) => {
        const encoded = config.define?.[`import.meta.env.${name}`];
        return typeof encoded === 'string' ? JSON.parse(encoded) : undefined;
      };
      if (value('VITE_RELEASE') !== 'wavedash') return;
      let url;
      try { url = new URL(value('VITE_COLYSEUS_URL')); } catch { /* reported below */ }
      if (!url || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Bramblekeep Wavedash packages require VITE_COLYSEUS_URL as an HTTPS server origin, e.g. https://your-service.up.railway.app.');
      }
    },
  }];
}
