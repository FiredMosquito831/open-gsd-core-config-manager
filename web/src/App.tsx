import { AppShell } from './components/AppShell';
import { ConfigEditor } from './components/editor/ConfigEditor';
import { TrackedConfigSidebar } from './components/sidebar/TrackedConfigSidebar';
import { ChapterNav } from './components/chapters/ChapterNav';
import { HistoryWorkspace } from './components/history/HistoryWorkspace';
import { WorkspaceHeader } from './components/common/WorkspaceHeader';
import { useUiStore } from './state/uiStore';
import { ToastHost } from './components/common/ToastHost';

export function App() {
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
    <>
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
      workspaceHeader={<WorkspaceHeader />}
      editor={<ConfigEditor workspaceMode={workspaceMode} />}
      />
      <ToastHost />
    </>
  );
}
