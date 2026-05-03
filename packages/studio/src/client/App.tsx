/**
 * Studio dockview shell.
 *
 * Per the migration plan §0 prime directive ("preserve the visual,
 * elevate everything underneath"), this shell renders the canonical
 * panel arrangement: sidebar (Brand + Adapters + Sessions) on the
 * left, main area (view-pane + bottom-group with Narrative + Feed
 * siblings) on the right, scorecard + error-budget strips above the
 * dockview frame, slash bar + status bar across the bottom.
 *
 * dockview is configured to NOT show its default Material chrome.
 * Tab bars, panel headers, and resize handles are styled to match
 * the brand's hairline borders + cream surfaces (see styles/globals.css).
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
import { InboxThread } from './panels/InboxThread';
import { Scorecard } from './panels/Scorecard';
import { ErrorBudgetStrip } from './panels/ErrorBudgetStrip';
import { useEffect } from 'react';
import { useSessions, useSessionsSseBridge } from './hooks/useSessions';
import { setActiveSession, useActiveSession } from './stores/selection';

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
  const activeSession = useActiveSession();

  // Auto-select on first load: pick the live session if any, else the
  // most-recently-active. The /api/sessions response is sorted by
  // `last_activity_at` desc server-side, so `sessions[0]` is the right
  // pick when nothing is selected yet. Without this the user lands on a
  // studio with empty panels until they click — a real complaint.
  useEffect(() => {
    if (activeSession) return;
    const list = sessions.data?.sessions ?? [];
    if (list.length === 0) return;
    const pick = list.find((s) => s.derived_state === 'live') ?? list[0];
    if (pick) setActiveSession(pick.session_id);
  }, [activeSession, sessions.data]);

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
          {sessions.data ? `${sessions.data.sessions.length} sessions` : 'loading…'}
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

      <InboxThread />
      <SlashBar />

      <footer
        className="flex items-center gap-3 border-t px-4 py-1 text-xs"
        style={{
          borderColor: 'var(--hairline)',
          background: 'var(--surface-1)',
          color: 'var(--ink-subtle)',
        }}
      >
        <span>v1.0.0</span>
        <span style={{ flex: 1 }} />
        <span>⌘B sidebar · Drag tabs to dock · Drag a tab out for popout</span>
      </footer>
    </div>
  );
}
