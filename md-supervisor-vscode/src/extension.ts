import * as vscode from 'vscode';
import { SupervisorPanel } from './panel';
import { SupervisorBridge } from './supervisor_bridge';

let superPanel: SupervisorPanel | undefined;
let bridge: SupervisorBridge;

export function activate(context: vscode.ExtensionContext) {
  bridge = new SupervisorBridge();

  // Command: Open Control Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('mdSupervisor.openPanel', () => {
      superPanel = SupervisorPanel.createOrShow(context.extensionUri, bridge);
    })
  );

  // Command: Run Full Cycle
  context.subscriptions.push(
    vscode.commands.registerCommand('mdSupervisor.runSupervisor', async () => {
      const result = await bridge.runFullCycle();
      vscode.window.showInformationMessage(`Supervisor cycle complete: ${JSON.stringify(result, null, 2)}`);
    })
  );

  // Command: Rollback
  context.subscriptions.push(
    vscode.commands.registerCommand('mdSupervisor.rollback', async () => {
      const result = await bridge.rollbackLastCommit();
      vscode.window.showInformationMessage(`Rollback executed: ${JSON.stringify(result, null, 2)}`);
    })
  );

  // Auto-open panel on startup (optional)
  // superPanel = SupervisorPanel.createOrShow(context.extensionUri, bridge);
}

export function deactivate() {}
