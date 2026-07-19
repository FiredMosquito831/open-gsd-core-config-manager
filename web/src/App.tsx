import { AppShell } from './components/AppShell';
import { ConfigEditor } from './components/editor/ConfigEditor';
import { TrackedConfigSidebar } from './components/sidebar/TrackedConfigSidebar';
import { ChapterNav } from './components/chapters/ChapterNav';
import { HistoryWorkspace } from './components/history/HistoryWorkspace';
import { useUiStore } from './state/uiStore';

type AppProps = { connected: boolean };

export function App({ connected }: AppProps) {
  const {
    leftPaneOpen,
    middlePaneOpen,
    searchQuery,
    setSearchQuery,
    toggleLeftPane,
    toggleMiddlePane,
    workspaceMode,
  } = useUiStore();

  return (
    <AppShell
      mode={workspaceMode}
      leftOpen={leftPaneOpen}
      middleOpen={middlePaneOpen}
      onToggleLeft={toggleLeftPane}
      onToggleMiddle={toggleMiddlePane}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sidebar={<TrackedConfigSidebar />}
      chapterNav={<ChapterNav />}
      editor={
        connected ? (
          <ConfigEditor workspaceMode={workspaceMode} />
        ) : (
          <div className="gsd-connection-warning" role="alert">
            No launch token found. Open the URL printed by the CLI to connect.
          </div>
        )
      }
    />
  );
}
