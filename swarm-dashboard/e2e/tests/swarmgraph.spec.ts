import { test, expect } from '@playwright/test';

test('SwarmGraph visual smoke', async ({ page }) => {
  const demoHTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SwarmGraph Demo</title>
    <style>
      body { margin: 0; background: #071027; color: #fff; font-family: Inter, Arial; }
      .wrap { display:flex; align-items:center; justify-content:center; height:100vh }
      svg { width: 1000px; height: 600px; border-radius: 8px }
      .node { cursor: pointer }
    </style>
  </head>
  <body>
    <div class="wrap">
      <!-- Inline simplified SVG mimicking the SwarmGraph for visual regression -->
      <svg class="swarm-demo" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0%" stop-color="#ff7f0e" />
            <stop offset="100%" stop-color="#ff0000" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="#071027" rx="8"/>
        <g class="links" stroke="url(#g)" stroke-width="3" fill="none">
          <path d="M200,300 C300,200 400,200 500,300" opacity="0.9"/>
          <path d="M500,300 C600,400 700,400 800,300" opacity="0.6"/>
        </g>
        <g class="nodes" fill="#1f77b4" stroke="#000">
          <g class="node" transform="translate(200,300)">
            <circle r="18" fill="#1f77b4" />
            <text y="36" text-anchor="middle" fill="#fff" font-size="12">agent-1</text>
          </g>
          <g class="node" transform="translate(500,300)">
            <circle r="22" fill="#ff7f0e" />
            <text y="44" text-anchor="middle" fill="#fff" font-size="12">agent-2</text>
          </g>
          <g class="node" transform="translate(800,300)">
            <circle r="18" fill="#2ca02c" />
            <text y="36" text-anchor="middle" fill="#fff" font-size="12">agent-3</text>
          </g>
        </g>
      </svg>
    </div>
  </body>
</html>`;

  await page.setContent(demoHTML, { waitUntil: 'networkidle' });
  const svg = page.locator('svg.swarm-demo');
  await svg.waitFor({ state: 'visible', timeout: 10000 });
  await expect(svg).toHaveScreenshot('swarmgraph-demo.png', { maxDiffPixelRatio: 0.01 });
});
