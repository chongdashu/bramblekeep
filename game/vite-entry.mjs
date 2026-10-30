import gamePlugins from './vite.mjs';
import { devAnalyticsPlugin } from './analytics/dev-vite.mjs';

// Keep the private report bridge game-owned and limited to the dev server.
export default async function (env) {
  return [await gamePlugins(env), devAnalyticsPlugin()];
}
