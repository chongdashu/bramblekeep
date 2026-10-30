import { anyApi, cronJobs } from 'convex/server';
const crons = cronJobs();
crons.interval('expire analytics', { hours: 1 }, anyApi.analytics.prune, {});
export default crons;
