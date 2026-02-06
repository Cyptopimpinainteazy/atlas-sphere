import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class AstDiffPanel {
  public static currentPanel: AstDiffPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  public static open(extensionUri: vscode.Uri): void {
    if (AstDiffPanel.currentPanel) {
      AstDiffPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel('x3AstDiff', 'X3 AST Diff', vscode.ViewColumn.Beside, {
      enableScripts: true
    });

    AstDiffPanel.currentPanel = new AstDiffPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    panel.webview.html = this.getHtml();

    panel.webview.onDidReceiveMessage((msg: any) => {
      if (msg.command === 'refresh') this.postHeatmaps();
    });

    this.postHeatmaps();
  }

  private getHtml(): string {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>AST Diff</title>
<style>
  body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; padding:12px}
  .file {margin-bottom:18px; border-bottom:1px solid #eee; padding-bottom:8px}
  .header {display:flex; justify-content:space-between; align-items:center}
  .line {display:flex; align-items:center; margin:4px 0}
  .bar {width:10px; height:14px; margin-right:8px; border-radius:2px}
  .meta {color:#666; font-size:12px}
  .tooltip {display:inline-block; margin-left:8px; color:#333}
  button {margin-top:8px}
</style>
</head>
<body>
<h2>AST Diff Heatmaps</h2>
<div id="content">Loading...</div>
<button onclick="refresh()">Refresh</button>
<script>
  const vscode = acquireVsCodeApi();
  function refresh(){vscode.postMessage({command:'refresh'})}

  function render(payload){
    const data = (Array.isArray(payload) ? {heatmaps: payload} : payload) || {heatmaps: []};
    const out = document.getElementById('content');
    out.innerHTML = '';
    if(!data.heatmaps.length){ out.innerText = 'No heatmaps available.'; return }

    data.heatmaps.forEach(h => {
      const max = Math.max(...Object.values(h.heatmap || {0:0}));
      const fileDiv = document.createElement('div'); 
      fileDiv.className='file';
      const header = document.createElement('div'); 
      header.className='header';
      const title = document.createElement('div'); 
      title.innerText = (h.file || '<memory>') + ' - total heat: ' + h.total_heat.toFixed(2);
      const meta = document.createElement('div'); 
      meta.className='meta'; 
      meta.innerText = h.time || '';
      header.appendChild(title); 
      header.appendChild(meta);
      fileDiv.appendChild(header);

      const mapping = {};
      (h.changes || []).forEach(c => {
        const ln = c.lineno || -1;
        mapping[ln] = mapping[ln] || [];
        mapping[ln].push(c);
      });

      const lines = Object.keys(h.heatmap || {}).map(k=>parseInt(k,10)).sort((a,b)=>a-b);
      lines.forEach(ln => {
        const score = h.heatmap[ln] || 0;
        const div = document.createElement('div'); 
        div.className='line';
        const bar = document.createElement('div'); 
        bar.className='bar';
        const alpha = max > 0 ? Math.min(score / max, 1) : 0;
        bar.style.background = 'rgba(255,0,0,' + alpha + ')';
        const text = document.createElement('div'); 
        text.innerText = 'Line ' + ln + ' - heat ' + score.toFixed(2);
        if(mapping[ln] && mapping[ln].length){
          const tip = document.createElement('span'); 
          tip.className='tooltip'; 
          tip.innerText='[details]';
          tip.title = JSON.stringify(mapping[ln], null, 2);
          div.appendChild(bar); 
          div.appendChild(text); 
          div.appendChild(tip);
        } else {
          div.appendChild(bar); 
          div.appendChild(text);
        }
        fileDiv.appendChild(div);
      });

      out.appendChild(fileDiv);
    });
  }

  window.addEventListener('message', e => { 
    const data = e.data; 
    try{ render(data) }catch(err){ 
      document.getElementById('content').innerText = 'Error rendering: '+err 
    } 
  });
</script>
</body>
</html>`;
    return html;
  }

  private postHeatmaps() {
    const file = '.md_supervisor/ast_heatmaps.json';
    const payload: Record<string, any> = { heatmaps: [] };
    try {
      if (fs.existsSync(file)) {
        payload.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {
      payload.error = String(e);
    }

    this.panel.webview.postMessage(payload);
  }
}
