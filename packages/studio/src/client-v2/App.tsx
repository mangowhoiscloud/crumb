/**
 * M2 — Studio v2 dockview shell.
 *
 * Per the migration plan §0 prime directive ("preserve the visual,
 * elevate everything underneath"), this shell renders the same panel
 * arrangement the v1 vanilla bundle has today — sidebar (Brand +
 * Adapters + Sessions placeholders) on the left, main area (view-pane
 * + bottom-group with Narrative + Feed siblings) on the right, status
 * bar across the bottom.
 *
 * dockview is configured to NOT show its default Material chrome.
 * Tab bars, panel headers, and resize handles are styled to match
 * v1's hairline borders + cream surfaces (see styles/globals.css).
 *
 * Panels are intentionally empty placeholders here — M3 fills the
 * sidebar, M4 fills Pipeline / Waterfall / Map, M5 wires Narrative +
 * Feed to SSE + inbox POST, M6 fills Scorecard / Logs / Output /
 * Transcript / DesignCheck.
 */

import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react';

import { BrandMark } from './components/BrandMark';
import { ThemeToggle } from './components/ThemeToggle';
import { DensityToggle } from './components/DensityToggle';
import { HealthBadge } from './components/HealthBadge';
import { Sidebar } from './panels/Sidebar';
import { Pipeline } from './panels/Pipeline';
import { Waterfall } from './panels/Waterfall';
import { ServiceMap } from './panels/ServiceMap';
import { Logs } from './panels/Logs';
import { Output } from './panels/Output';
import { Transcript } from './panels/Transcript';
import { ToolCallTrace } from './panels/ToolCallTrace';
import { Versions } from './panels/Versions';
import { Narrative } from './panels/Narrative';
import { Feed } from './panels/Feed';
import { DetailRail } from './panels/DetailRail';
import { SlashBar } from './panels/SlashBar';
import { Scorecard } from './panels/Scorecard';
import { ErrorBudgetStrip } from './panels/ErrorBudgetStrip';
import { useSessions, useSessionsSseBridge } from './hooks/useSessions';

const PANEL_COMPONENTS: Record<string, React.FC<IDockviewPanelProps>> = {
  sidebar: Sidebar,
  pipeline: Pipeline,
  waterfall: Waterfall,
  serviceMap: ServiceMap,
  logs: Logs,
  output: Output,
  transcript: Transcript,
  toolCallTrace: ToolCallTrace,
  versions: Versions,
  narrative: Narrative,
  feed: Feed,
  detailRail: DetailRail,
};

/** dockview ready handler — assemble the v1-equivalent topology in code. */
function onReady(event: DockviewReadyEvent): void {
  const api: DockviewApi = event.api;

  // Sidebar (left column).
  const sidebar = api.addPanel({
    id: 'sidebar',
    component: 'sidebar',
    title: 'Sessions',
    initialWidth: 240,
  });

  // Main view pane — Pipeline + Waterfall + ServiceMap as sibling tabs.
  const viewPane = api.addPanel({
    id: 'pipeline',
    component: 'pipeline',
    title: 'Pipeline',
    position: { referencePanel: sidebar.id, direction: 'right' },
  });
  api.addPanel({
    id: 'waterfall',
    component: 'waterfall',
    title: 'Waterfall',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'serviceMap',
    component: 'serviceMap',
    title: 'Service Map',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'logs',
    component: 'logs',
    title: 'Logs',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'output',
    component: 'output',
    title: 'Output',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'transcript',
    component: 'transcript',
    title: 'Transcript',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'toolCallTrace',
    component: 'toolCallTrace',
    title: 'Tool Trace',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });
  api.addPanel({
    id: 'versions',
    component: 'versions',
    title: 'Versions',
    position: { referencePanel: viewPane.id, direction: 'within' },
  });

  // Narrative — bottom-left of the view pane.
  api.addPanel({
    id: 'narrative',
    component: 'narrative',
    title: 'Agent Narrative',
    position: { referencePanel: viewPane.id, direction: 'below' },
    initialHeight: 220,
  });

  // Feed — sibling of Narrative in the same group; user can drag a tab
  // out into a floating window per §6.4 (free via dockview popout).
  api.addPanel({
    id: 'feed',
    component: 'feed',
    title: 'Live Execution Feed',
    position: { referencePanel: 'narrative', direction: 'within' },
  });

  // Detail rail (right edge of the view pane). M4 swaps content based
  // on selection (event-detail / node-inspector / outlier histograms).
  api.addPanel({
    id: 'detailRail',
    component: 'detailRail',
    title: 'Detail',
    position: { referencePanel: viewPane.id, direction: 'right' },
    initialWidth: 320,
  });
}

export function App() {
  // Live sessions cache + SSE bridge. Sidebar re-reads via useSessions().
  const sessions = useSessions();
  useSessionsSseBridge();

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: 'var(--canvas)', color: 'var(--ink)' }}
    >
      <header
        className="flex items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--hairline)', background: 'var(--surface-1)' }}
      >
        <BrandMark size={26} />
        <span
          className="text-[14px] font-extrabold tracking-wide"
          style={{ fontFamily: 'var(--font-brand)' }}
        >
          CRUMB
          <span style={{ marginLeft: 4, color: 'var(--ink-subtle)', fontWeight: 700 }}>STUDIO</span>
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--ink-subtle)', fontSize: 12 }}>
          v2 preview · {sessions.data ? `${sessions.data.sessions.length} sessions` : 'loading…'}
        </span>
        <HealthBadge />
        <DensityToggle />
        <ThemeToggle />
      </header>

      <Scorecard />
      <ErrorBudgetStrip />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DockviewReact
          components={PANEL_COMPONENTS}
          onReady={onReady}
          className="dockview-theme-abyss"
        />
      </div>

      <SlashBar />

      <footer
        className="flex items-center gap-3 border-t px-4 py-1 text-xs"
        style={{
          borderColor: 'var(--hairline)',
          background: 'var(--surface-1)',
          color: 'var(--ink-subtle)',
        }}
      >
        <span>v0.4 (M7)</span>
        <span style={{ flex: 1 }} />
        <span>⌘B sidebar · Drag tabs to dock · Drag a tab out for popout</span>
      </footer>
    </div>
  );
}
