import { AppShell } from './components/AppShell';
import { EmptyState } from './components/common/EmptyState';
import { useUiStore } from './state/uiStore';

type AppProps = { connected: boolean };

export function App({ connected }: AppProps) {
  const { leftPaneOpen, middlePaneOpen, toggleLeftPane, toggleMiddlePane } = useUiStore();

  return (
    <AppShell
      leftOpen={leftPaneOpen}
      middleOpen={middlePaneOpen}
      onToggleLeft={toggleLeftPane}
      onToggleMiddle={toggleMiddlePane}
      sidebar={<div className="gsd-placeholder">Tracked configs sidebar</div>}
      chapterNav={<div className="gsd-placeholder">Chapter navigation</div>}
      editor={
        connected ? (
          <EmptyState
            title="Select a configuration"
            description="Choose a tracked config from the sidebar to begin editing."
          />
        ) : (
          <div className="gsd-connection-warning" role="alert">
            No launch token found. Open the URL printed by the CLI to connect.
          </div>
        )
      }
    />
  );
}
