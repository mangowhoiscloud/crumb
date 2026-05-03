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
import { Sidebar } from './panels/Sidebar';
import { Pipeline } from './panels/Pipeline';
import { Narrative } from './panels/Narrative';
import { Feed } from './panels/Feed';
import { DetailRail } from './panels/DetailRail';
import { useSessions, useSessionsSseBridge } from './hooks/useSessions';

const PANEL_COMPONENTS: Record<string, React.FC<IDockviewPanelProps>> = {
  sidebar: Sidebar,
  pipeline: Pipeline,
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

  // Main view pane — Pipeline (M4). Waterfall + ServiceMap join as
  // sibling tabs in the same group at M4-Waterfall + M4-Map PRs.
  const viewPane = api.addPanel({
    id: 'pipeline',
    component: 'pipeline',
    title: 'Pipeline',
    position: { referencePanel: sidebar.id, direction: 'right' },
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
        <DensityToggle />
        <ThemeToggle />
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DockviewReact
          components={PANEL_COMPONENTS}
          onReady={onReady}
          className="dockview-theme-abyss"
        />
      </div>

      <footer
        className="flex items-center gap-3 border-t px-4 py-1.5 text-xs"
        style={{
          borderColor: 'var(--hairline)',
          background: 'var(--surface-1)',
          color: 'var(--ink-subtle)',
        }}
      >
        <span>Status: M2 dockview shell</span>
        <span style={{ flex: 1 }} />
        <span>⌘B sidebar · Drag tabs to dock · Drag a tab out for popout</span>
      </footer>
    </div>
  );
}
