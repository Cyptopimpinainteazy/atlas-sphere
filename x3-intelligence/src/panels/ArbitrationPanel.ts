import * as vscode from 'vscode';

export class ArbitrationPanel {
  public static open(extensionUri: vscode.Uri) {
    const panel = vscode.window.createWebviewPanel('x3Arbitration', 'Multi-Agent Arbitration', vscode.ViewColumn.Five, { enableScripts: true });

    panel.webview.html = this.html();

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'refresh') this.postData(panel);
    });

    this.postData(panel);
  }

  private static html(): string {
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Arbitration</title></head>
<body>
<h2>Multi-Agent Arbitration</h2>
<div id='votesContainer'>Waiting for arbitration events...</div>
<button onclick="refresh()">Refresh</button>
<script>
const ws = new WebSocket('ws://localhost:8765');
ws.onopen = () => { 
  try { 
    const t = localStorage.getItem('x3_ws_token'); 
    if (t) ws.send(JSON.stringify({auth: t})); 
  } catch(e){} 
};
function refresh(){vscode.postMessage({command:'refresh'})}
ws.onmessage = (event) => {
  try{
    const d = JSON.parse(event.data);
    if(d.type === 'arbitration'){
      const votes = d.payload.votes || {};
      const approved = d.payload.approved;
      const container = document.getElementById('votesContainer');
      container.innerHTML = '';
      for(const agent in votes) {
        const vote = votes[agent];
        const div = document.createElement('div');
        div.innerText = agent.toUpperCase() + ': ' + (vote.approve ? '[OK] Approve' : '[WARN] Reject') + ' - Reason: ' + vote.reason + ' - Risk: ' + vote.risk;
        div.style.color = vote.approve ? 'green' : 'red';
        container.appendChild(div);
      }
      const agg = document.createElement('div');
      agg.innerHTML = '<strong>Aggregated Decision: ' + (approved ? '[OK] Approve' : '[WARN] Reject') + '</strong>';
      agg.style.fontSize = '1.1em';
      agg.style.marginTop = '8px';
      agg.style.color = approved ? 'green' : 'red';
      container.appendChild(agg);
    }
  }catch(e){console.error(e)}
};
</script>
</body>
</html>`;
    return html;
  }

  private static postData(panel: vscode.WebviewPanel) {
    panel.webview.postMessage({ message: 'Listening for arbitration events on ws://localhost:8765' });
  }
}
