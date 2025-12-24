async function fetchAndRender() {
    try {
        const base = 'http://localhost:9944';
        const [r1, r2] = await Promise.all([
            fetch(`${base}/api/readiness/testnet`).then(r => r.json()),
            fetch(`${base}/api/alerts/sigill`).then(r => r.json())
        ]);

        const scoreEl = document.getElementById('readiness-score');
        const sigillEl = document.getElementById('sigill-count');

        scoreEl.textContent = typeof r1.score === 'number' ? Math.round(r1.score).toString() : 'n/a';
        sigillEl.textContent = (r2.count || 0).toString();
    } catch (err) {
        document.getElementById('readiness-score').textContent = 'err';
        document.getElementById('sigill-count').textContent = 'err';
    }
}

fetchAndRender();
setInterval(fetchAndRender, 30000);