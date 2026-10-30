/** Resolve a report's dedicated Convex deployment from game-owned settings. */
export function configuredDeployment(config, traffic) {
  const site = traffic === 'live' ? config.wavedash?.productionSite : config.web?.site;
  if (typeof site !== 'string') return undefined;
  try {
    const url = new URL(site);
    if (url.protocol !== 'https:' || url.origin !== site || url.username || url.password || !/^[a-z0-9-]+\.convex\.site$/.test(url.hostname)) return undefined;
    return url.hostname.replace(/\.convex\.site$/, '');
  } catch { return undefined; }
}
