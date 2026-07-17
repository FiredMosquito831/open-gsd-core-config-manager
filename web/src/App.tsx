import { AppShell } from './components/AppShell';
import { ConfigEditor } from './components/ConfigEditor';
import { TrackedConfigSidebar } from './components/sidebar/TrackedConfigSidebar';
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
      sidebar={<TrackedConfigSidebar />}
      chapterNav={<div className="gsd-placeholder">Chapter navigation</div>}
      editor={
        connected ? (
          <ConfigEditor />
        ) : (
          <div className="gsd-connection-warning" role="alert">
            No launch token found. Open the URL printed by the CLI to connect.
          </div>
        )
      }
    />
  );
}
