import * as vscode from 'vscode';
import * as path from 'path';
import { SupervisorBridge, SupervisorResult } from './supervisor_bridge';

export class SupervisorPanel {
  public static currentPanel: SupervisorPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly bridge: SupervisorBridge;

  public static createOrShow(
    extensionUri: vscode.Uri,
    bridge: SupervisorBridge
  ): SupervisorPanel {
    if (SupervisorPanel.currentPanel) {
      SupervisorPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return SupervisorPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'mdSupervisor',
      'md_supervisor Control Panel',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    SupervisorPanel.currentPanel = new SupervisorPanel(
      panel,
      extensionUri,
      bridge
    );

    return SupervisorPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    bridge: SupervisorBridge
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.bridge = bridge;

    this.panel.onDidDispose(() => this.dispose(), null);
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null
    );

    this.update();
  }

  private async update() {
    this.panel.webview.html = this.getHtmlForWebview();
  }

  private async handleMessage(message: any) {
    switch (message.command) {
      case 'run':
        await this.runCycle();
        break;
      case 'rollback':
        await this.rollback();
        break;
    }
  }

  private async runCycle() {
    try {
      const result = await this.bridge.runFullCycle();
      this.panel.webview.postMessage({
        type: 'cycle_complete',
        result,
      });
      
      if (result.success) {
        vscode.window.showInformationMessage(
          `✅ Supervisor cycle complete. Commit: ${result.commit}`
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ Supervisor cycle failed: ${result.reason}`
        );
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Error: ${err}`);
    }
  }

  private async rollback() {
    try {
      const result = await this.bridge.rollbackLastCommit();
      this.panel.webview.postMessage({
        type: 'rollback_complete',
        result,
      });

      if (result.success) {
        vscode.window.showInformationMessage('Rollback successful');
      } else {
        vscode.window.showWarningMessage(`Rollback failed: ${result.reason}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Error: ${err}`);
    }
  }

  private getHtmlForWebview(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'ui.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'ui.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>md_supervisor Control Panel</title>
</head>
<body>
    <div class="container">
        <h1>🔧 md_supervisor Control Panel</h1>
        
        <div class="panel-section">
            <h2>Actions</h2>
            <div class="button-group">
                <button id="runBtn" class="btn btn-primary">▶️ Run Full Cycle</button>
                <button id="rollbackBtn" class="btn btn-danger">↩️ Rollback</button>
            </div>
        </div>

        <div class="panel-section">
            <h2>📊 Tabs</h2>
            <div class="tabs">
                <button class="tab-btn active" data-tab="timeline">Timeline</button>
                <button class="tab-btn" data-tab="heatmap">AST Heatmap</button>
                <button class="tab-btn" data-tab="pnl">PnL Impact</button>
                <button class="tab-btn" data-tab="agents">Agent Decisions</button>
            </div>
        </div>

        <div id="timeline" class="tab-content active">
            <h3>Change Timeline</h3>
            <div id="timelineLog"></div>
        </div>

        <div id="heatmap" class="tab-content">
            <h3>AST Diff Heatmap</h3>
            <div id="heatmapPanel"></div>
        </div>

        <div id="pnl" class="tab-content">
            <h3>PnL-Aware Ranking</h3>
            <div id="pnlPanel"></div>
        </div>

        <div id="agents" class="tab-content">
            <h3>Agent Arbitration</h3>
            <div id="agentsPanel"></div>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
    </div>
</body>
</html>`;
  }

  private dispose() {
    SupervisorPanel.currentPanel = undefined;
    this.panel.dispose();
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
