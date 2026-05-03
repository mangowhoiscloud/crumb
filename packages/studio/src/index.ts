/**
 * Public exports for `@crumb/studio`.
 *
 * Programmatic embedding: `import { startStudioServer } from '@crumb/studio';`
 */

export { startStudioServer } from './server/server.js';
export type { StudioServer, StudioServerOptions } from './server/server.js';
export { computeMetrics } from './server/metrics.js';
export type { SessionMetrics, ActorTotals } from './server/metrics.js';
export { EventBus } from './server/event-bus.js';
export type { LiveEvent, Subscriber } from './server/event-bus.js';
export { JsonlTail } from './server/jsonl-tail.js';
export { SessionWatcher } from './server/watcher.js';
export type { WatcherOptions } from './server/watcher.js';
export type { StudioMessage, Verdict } from './server/types.js';
