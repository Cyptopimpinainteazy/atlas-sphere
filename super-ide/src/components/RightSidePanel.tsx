import { useIDEStore } from '../store/ideStore';
import { BoltChatPanel } from './panels/BoltChatPanel';
import { TestingPanel } from './panels/TestingPanel';
import { CoveragePanel } from './panels/CoveragePanel';
import { OutlinePanel } from './panels/OutlinePanel';
import { GitIntegrationPanel } from './panels/GitIntegrationPanel';

const rightPanelMap: Record<string, React.ComponentType> = {
  'bolt-chat': BoltChatPanel,
  testing: TestingPanel,
  coverage: CoveragePanel,
  outline: OutlinePanel,
  git: GitIntegrationPanel,
};

export function RightSidePanel() {
  const { activeRightSidebar } = useIDEStore();
  const Panel = rightPanelMap[activeRightSidebar];

  return (
    <div
      className="w-80 bg-ide-bg border-l border-ide-border flex flex-col overflow-hidden"
      data-testid="right-side-panel"
    >
      {Panel ? <Panel /> : <div className="p-4 text-ide-text-dim text-sm">Select a panel</div>}
    </div>
  );
}
