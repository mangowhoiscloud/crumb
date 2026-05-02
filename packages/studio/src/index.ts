/**
 * Public exports for `@crumb/studio`.
 *
 * Programmatic embedding: `import { startStudioServer } from '@crumb/studio';`
 */

export { startStudioServer } from './server.js';
export type { DashboardServer, DashboardServerOptions } from './server.js';
export { computeMetrics } from './metrics.js';
export type { SessionMetrics, ActorTotals } from './metrics.js';
export { EventBus } from './event-bus.js';
export type { LiveEvent, Subscriber } from './event-bus.js';
export { JsonlTail } from './jsonl-tail.js';
export { SessionWatcher } from './watcher.js';
export type { WatcherOptions } from './watcher.js';
export type { DashboardMessage, Verdict } from './types.js';
