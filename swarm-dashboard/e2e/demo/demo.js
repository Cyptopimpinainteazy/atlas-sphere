async function fetchAndRender() {
  try {
    const base = 'http://localhost:9944';
    const [r1, r2] = await Promise.all([
      fetch(`${base}/api/readiness/testnet`).then(r => r.json()),
      fetch(`${base}/api/alerts/sigill`).then(r => r.json())
    ]);

    const scoreEl = document.getElementById('readiness-score');
    const statusEl = document.getElementById('readiness-status');
    const sigillEl = document.getElementById('sigill-count');
    const sigillList = document.getElementById('sigill-list');
    const ciEl = document.getElementById('ci-status');
    const testHealthEl = document.getElementById('test-health-counts');

    // Readiness
    scoreEl.textContent = typeof r1.score === 'number' ? Math.round(r1.score).toString() : 'n/a';
    const score = typeof r1.score === 'number' ? r1.score : null;
    const friendly = score === null ? 'unknown' : (score > 80 ? 'Good' : score > 50 ? 'Warning' : 'Critical');
    if (statusEl) statusEl.textContent = friendly;

    // SIGILL feed
    sigillEl.textContent = (r2.count || 0).toString();
    if (sigillList) {
      sigillList.innerHTML = '';
      (r2.alerts || []).slice(0, 10).forEach(a => {
        const li = document.createElement('li');
        li.className = 'sigill-item';
        li.innerHTML = `<div style="font-weight:600;color:#ffd700">${a.title}</div>
                        <div style="font-size:12px;color:#ccc">${a.message || ''}</div>
                        <div style="margin-top:6px">
                          ${a.link ? `<a class="sigill-issue link" href="${a.link}" target="_blank">Issue / Gist</a>` : ''}
                          ${a.artifacts ? `<a class="sigill-strace link" href="${a.artifacts.strace}" target="_blank">strace</a><span style="margin:0 6px">|</span><a class="sigill-core link" href="${a.artifacts.core}" target="_blank">core</a>` : ''}
                        </div>`;
        sigillList.appendChild(li);
      });
    }
    if (ciEl) ciEl.textContent = 'Unknown';
    if (testHealthEl) testHealthEl.textContent = '0';
  } catch (err) {
    document.getElementById('readiness-score').textContent = 'err';
    document.getElementById('sigill-count').textContent = 'err';
  }
}

fetchAndRender();
setInterval(fetchAndRender, 30000);