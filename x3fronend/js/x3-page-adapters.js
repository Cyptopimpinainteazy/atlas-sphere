(function (global) {
  "use strict";

  var tokenomicsChart = null;
  var whaleFilter = "all";

  function byId(id) {
    return document.getElementById(id);
  }

  function query(selector) {
    return document.querySelector(selector);
  }

  function queryAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function setText(selectorOrElement, value) {
    var element =
      typeof selectorOrElement === "string"
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
    if (!element || value === null || value === undefined) return;
    element.textContent = value;
  }

  function setHtml(selectorOrElement, value) {
    var element =
      typeof selectorOrElement === "string"
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
    if (!element || value === null || value === undefined) return;
    element.innerHTML = value;
  }

  function fmtMoney(value) {
    return "$" + Number(value || 0).toLocaleString("en-US");
  }

  function fmtCompactMoney(value) {
    var amount = Number(value || 0);
    if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(1) + "M";
    if (amount >= 1000) return "$" + Math.round(amount / 1000) + "K";
    return fmtMoney(amount);
  }

  function fmtNumber(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function fmtPct(value) {
    return Number(value || 0).toFixed(1) + "%";
  }

  function fmtX3S(value) {
    return fmtNumber(value) + " X3S";
  }

  function formatDateLabel() {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
  }

  function heartbeatClass(status) {
    if (status === "warning") return "pd-warn";
    if (status === "error") return "pd-err";
    return "pd-ok";
  }

  function cardStatusClass(status) {
    if (status === "warning") return "warn";
    if (status === "error") return "err";
    return "ok";
  }

  function tierClass(tier) {
    if (tier === "genesis") return "nt-genesis";
    if (tier === "star") return "nt-star";
    return "nt-lite";
  }

  function tierAccent(tier) {
    if (tier === "genesis") return "var(--gold)";
    if (tier === "star") return "var(--blue, var(--cyan, #00C8FF))";
    return "rgba(255,255,255,0.5)";
  }

  function countdown(closesAt, ids) {
    function tick() {
      var diff = Math.max(0, new Date(closesAt).getTime() - Date.now());
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var minutes = Math.floor((diff % 3600000) / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);
      setText(ids.days, String(days).padStart(2, "0"));
      setText(ids.hours, String(hours).padStart(2, "0"));
      setText(ids.minutes, String(minutes).padStart(2, "0"));
      setText(ids.seconds, String(seconds).padStart(2, "0"));
    }
    tick();
    return global.setInterval(tick, 1000);
  }

  function renderReservationsHeatmap(target, buckets) {
    if (!target) return;
    target.innerHTML = "";
    var maxBucket = Math.max(1, Math.max.apply(null, buckets || [0]));
    (buckets || []).forEach(function (count) {
      var cell = document.createElement("div");
      cell.className = "hm-cell";
      var intensity = count / maxBucket;
      if (target.classList.contains("heatmap")) {
        cell.style.background =
          intensity > 0
            ? "rgba(200,149,10," + (0.15 + intensity * 0.75).toFixed(2) + ")"
            : "rgba(26,18,8,0.08)";
      }
      target.appendChild(cell);
    });
  }

  function renderReservationsCards(target, cards) {
    if (!target) return;
    target.innerHTML = "";
    cards.forEach(function (cardData) {
      var card = document.createElement("div");
      var typeClass = cardData.type === "node" ? "pct-node" : "pct-token";
      var validatorClass = cardData.type === "node" ? " validator-card" : "";
      card.className = "proof-card" + validatorClass;
      card.innerHTML =
        '<div class="pc-stripe" style="background:' +
        (cardData.type === "node" ? "#1A6B3A" : "#C8950A") +
        '"></div><div class="pc-top"><div class="pc-flag">' +
        cardData.flag +
        '</div><div class="pc-type ' +
        typeClass +
        '">' +
        (cardData.type === "node" ? "VALIDATOR NODE" : "TOKEN") +
        '</div></div><div class="pc-name">' +
        cardData.name +
        '</div><div class="pc-loc">' +
        cardData.location +
        '</div><div class="pc-amount" style="color:' +
        (cardData.type === "node" ? "#3EE83E" : "#C8950A") +
        '">' +
        fmtMoney(cardData.amountUsd) +
        '</div><div class="pc-detail">' +
        cardData.detail +
        '</div><div class="pc-time">' +
        cardData.timeAgo +
        "</div>";
      target.appendChild(card);
    });
  }

  function renderTopInvestors(target, investors) {
    if (!target) return;
    target.innerHTML = "";
    investors.forEach(function (investor) {
      var row = document.createElement("tr");
      row.innerHTML =
        '<td class="it-rank">#' +
        investor.rank +
        '</td><td class="it-flag">' +
        investor.flag +
        '</td><td class="it-name">' +
        investor.name +
        '<div class="it-badge ' +
        (investor.badge === "WHALE" ? "ib-whale" : "ib-node") +
        '">' +
        investor.badge +
        '</div></td><td class="it-amount">' +
        fmtCompactMoney(investor.amountUsd) +
        "</td>";
      target.appendChild(row);
    });
  }

  async function initDashboard(api) {
    async function load() {
      var dashboardAndReservations = await Promise.all([
        api.getDashboardEnvelope({ refresh: true }),
        api.getReservationsEnvelope({ refresh: true }),
      ]);
      var envelope = dashboardAndReservations[0];
      var reservationsEnvelope = dashboardAndReservations[1];
      var data = envelope.data;
      setText("#block-num", data.blockNumber ? fmtNumber(data.blockNumber) : "unavailable");
      setText("#gas", data.gasPriceGwei ? data.gasPriceGwei + " gwei" : "unavailable");
      var kpis = queryAll(".kpi-card .kpi-value");
      if (kpis[0]) setText(kpis[0], fmtCompactMoney(data.funding.raised));
      if (kpis[1]) setText(kpis[1], fmtNumber(data.funding.activeGrants));
      if (kpis[2]) setText(kpis[2], fmtNumber(data.funding.investorCount));
      if (kpis[3]) setText(kpis[3], "$" + Number(data.token.priceUsd).toFixed(4));
      var badge = query(".kpi-card.purple .badge-up, .kpi-card.purple .badge-dn");
      if (badge) {
        var change = Number(data.token.priceChange24h || 0);
        badge.textContent = (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
        badge.className = change >= 0 ? "badge-up" : "badge-dn";
      }
      var stats = queryAll(".chart-card:nth-child(2) .metric-val");
      if (stats[0]) setText(stats[0], fmtCompactMoney(data.token.marketCapUsd));
      if (stats[1]) setText(stats[1], (data.token.circulatingSupply / 1000000).toFixed(0) + "M");
      if (stats[2]) setText(stats[2], fmtCompactMoney(data.token.volume24hUsd));
      if (stats[3]) setText(stats[3], fmtNumber(data.token.holders));
      var feed = byId("activity-feed");
      if (feed) {
        feed.innerHTML = "";
        reservationsEnvelope.data.reservations.slice(0, 4).forEach(function (reservation) {
          var row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:flex-start;gap:8px";
          row.innerHTML =
            '<span style="font-size:13px;flex-shrink:0">✅</span><div style="flex:1"><div style="font-size:11px;line-height:1.4">' +
            reservation.name +
            " reserved <b class=\"text-gold\">" +
            fmtMoney(reservation.amountUsd) +
            '</b></div><div style="font-size:10px;color:var(--muted);margin-top:2px">' +
            reservation.timeAgo +
            "</div></div>";
          feed.appendChild(row);
        });
      }
      api.renderModuleMeta(".page-head", "dashboard", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initLanding(api) {
    async function load() {
      var envelope = await api.getDashboardEnvelope({ refresh: true });
      var data = envelope.data;
      setText("#hm1", fmtCompactMoney(data.funding.raised));
      var traction = queryAll(".tr-num");
      if (traction[0]) setText(traction[0], fmtCompactMoney(data.funding.raised));
      if (traction[2]) setText(traction[2], fmtNumber(data.network.validators));
      if (traction[3]) setText(traction[3], fmtNumber(data.token.holders));
      var badge = query(".hero-badge");
      if (badge) {
        badge.innerHTML =
          '<div class="hb-pulse"></div>Round III Prefunding — ' +
          fmtCompactMoney(data.funding.raised) +
          " Raised — " +
          data.funding.daysRemaining +
          " Days Remaining";
      }
      api.renderModuleMeta(".hero-badges", "landing", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initGovernance(api) {
    async function load() {
      var envelope = await api.getGovernanceEnvelope({ refresh: true });
      var data = envelope.data;
      var stats = queryAll(".dao-stat .ds-val");
      if (stats[0]) setText(stats[0], data.proposalsCount);
      if (stats[1]) setText(stats[1], data.proposalsCount - data.activeProposals);
      if (stats[2]) setText(stats[2], fmtNumber(data.voters));
      if (stats[3]) setText(stats[3], fmtCompactMoney(data.treasury));
      setText(".tc-val", fmtCompactMoney(data.treasury));
      api.renderModuleMeta(".dao-hero", "governance", envelope);
    }
    await load();
    global.setInterval(load, 30000);
  }

  async function initNodeHealth(api) {
    async function load() {
      var envelope = await api.getNodeHealthEnvelope({ refresh: true });
      var data = envelope.data;
      var values = queryAll(".hrs-val");
      if (values[0]) setText(values[0], fmtNumber(data.activeValidators));
      if (values[1]) setText(values[1], fmtNumber(data.slashed));
      if (values[2]) setText(values[2], fmtNumber(data.warnings));
      if (values[3]) setText(values[3], data.uptime ? fmtPct(data.uptime) : "unavailable");
      if (values[4]) setText(values[4], fmtNumber(data.peers));
      var statusLight = query(".status-light");
      if (statusLight) {
        statusLight.className = "status-light " + (envelope.status === "live" ? "sl-green" : "sl-green");
        statusLight.innerHTML = '<div class="sl-dot"></div>' + (envelope.status === "live" ? "NETWORK HEALTHY" : "INDEXED SNAPSHOT");
      }
      var grid = byId("health-grid");
      if (grid) {
        grid.innerHTML = "";
        (data.nodes || []).forEach(function (node) {
          var card = document.createElement("div");
          card.className = "node-card " + cardStatusClass(node.status);
          card.innerHTML =
            '<div class="nc-head"><div class="nc-flag">' +
            node.flag +
            '</div><div class="nc-id"><div class="nc-name">' +
            node.operatorId +
            '</div><div class="nc-loc">' +
            node.location +
            '</div></div><div class="nc-tier ' +
            tierClass(node.tier) +
            '">' +
            String(node.tier).toUpperCase() +
            '</div><div class="pulse-dot ' +
            heartbeatClass(node.status) +
            '"></div></div><div class="nc-metrics"><div class="ncm"><div class="ncm-val" style="color:' +
            (node.status === "warning" ? "var(--gold)" : "var(--green)") +
            '">' +
            fmtPct(node.uptimePct) +
            '</div><div class="ncm-key">Uptime</div></div><div class="ncm"><div class="ncm-val" style="color:' +
            (node.latencyMs > 50 ? "var(--gold)" : "var(--green)") +
            '">' +
            node.latencyMs +
            'ms</div><div class="ncm-key">Latency</div></div><div class="ncm"><div class="ncm-val" style="color:var(--gold)">' +
            fmtX3S(node.stakeX3S) +
            '</div><div class="ncm-key">Stake</div></div></div><div class="nc-bars"><div class="ncb-row"><span class="ncb-label">Health</span><div class="ncb-track"><div class="ncb-fill" style="width:' +
            node.healthScore +
            '%;background:' +
            (node.status === "warning" ? "var(--gold)" : "var(--green)") +
            '"></div></div><span class="ncb-val" style="color:' +
            (node.status === "warning" ? "var(--gold)" : "var(--green)") +
            '">' +
            node.healthScore +
            '</span></div><div class="ncb-row"><span class="ncb-label">Peers</span><div class="ncb-track"><div class="ncb-fill" style="width:' +
            Math.min(100, node.peers * 2) +
            '%;background:var(--purple)"></div></div><span class="ncb-val" style="color:var(--purple)">' +
            node.peers +
            '</span></div><div class="ncb-row"><span class="ncb-label">TPS Share</span><div class="ncb-track"><div class="ncb-fill" style="width:' +
            Math.min(100, node.tps / 3) +
            '%;background:var(--blue)"></div></div><span class="ncb-val" style="color:var(--blue)">' +
            node.tps +
            '</span></div></div><div class="nc-footer"><div class="slash-badge ' +
            (node.status === "warning" ? "sb-warn" : "sb-clean") +
            '">' +
            (node.status === "warning" ? "WARNINGS" : "0 SLASHES") +
            '</div><div style="font-family:var(--rhm);font-size:10px;color:var(--blue)">' +
            node.name +
            '</div><div class="nc-time">' +
            node.heartbeatAge +
            "</div></div>";
          grid.appendChild(card);
        });
      }
      var barText = query(".bottom-bar .bb-text");
      if (barText) {
        barText.innerHTML =
          data.activeValidators +
          " indexed validators · " +
          fmtPct(data.uptime || 0) +
          " average uptime · " +
          data.warnings +
          " warnings in current telemetry snapshot";
      }
      api.renderModuleMeta(".header-row", "node health", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initStaking(api) {
    async function load() {
      var envelope = await api.getStakingEnvelope({ refresh: true });
      var data = envelope.data;
      var stats = queryAll(".ps-item .ps-val");
      if (stats[0]) setText(stats[0], fmtCompactMoney(data.totalValueLocked));
      if (stats[1]) setText(stats[1], fmtPct(data.avgApy));
      if (stats[2]) setText(stats[2], fmtNumber(data.totalStakers));
      if (stats[3]) setText(stats[3], "$" + Math.round(Number(data.dailyRewards) / 1000) + "K");
      if (stats[4]) setText(stats[4], Math.round(Number(data.totalStaked) / 1000000) + "M");
      var cards = queryAll(".pool-card");
      data.pools.forEach(function (pool, index) {
        var card = cards[index];
        if (!card) return;
        var tvl = card.querySelector(".pstat-val");
        var apy = card.querySelector(".pool-apy-val");
        if (tvl) setText(tvl, fmtCompactMoney(pool.tvlUsd));
        if (apy) setHtml(apy, pool.apy + '% <span style="font-size:14px;opacity:0.5">APY</span>');
      });
      api.renderModuleMeta(".hero", "staking", envelope);
    }
    await load();
    global.setInterval(load, 30000);
  }

  async function initNetworkPulse(api) {
    async function load() {
      var payloads = await Promise.all([
        api.getNetworkEnvelope({ refresh: true }),
        api.getDashboardEnvelope({ refresh: true }),
      ]);
      var envelope = payloads[0];
      var dashboard = payloads[1].data;
      var data = envelope.data;
      var tps = data.tps ? fmtNumber(data.tps) : "unavailable";
      setText("#tb-tps", tps);
      setText("#kpi-tps", tps);
      setText("#center-tps", tps);
      setText("#tb-block", data.blockNumber ? "#" + fmtNumber(data.blockNumber) : "unavailable");
      setText("#kpi-blocks", data.blockNumber ? "#" + fmtNumber(data.blockNumber) : "unavailable");
      setText("#kpi-vals", fmtNumber((data.validators || []).length));
      var kpis = queryAll(".kpi-grid .kpi-val");
      if (kpis[1]) setText(kpis[1], data.uptimePct ? fmtPct(data.uptimePct) : "unavailable");
      if (kpis[2]) setText(kpis[2], data.finalitySeconds ? data.finalitySeconds + "s" : "unavailable");
      if (kpis[4]) setText(kpis[4], data.avgFeeUsd ? "$" + Number(data.avgFeeUsd).toFixed(4) : "unavailable");
      var topbarValues = queryAll(".topbar .tb-val");
      if (topbarValues[3]) setText(topbarValues[3], fmtNumber((data.validators || []).length) + " indexed");
      if (topbarValues[4]) setText(topbarValues[4], "$" + Number(dashboard.token.priceUsd).toFixed(4));
      setText("#total-tx", fmtNumber(data.totalTx));
      var alertBar = byId("alert-bar");
      if (alertBar) {
        alertBar.innerHTML =
          '<div class="alert-dot"></div><strong>Network Notice:</strong> ' +
          (data.validators && data.validators.length
            ? data.validators[0].name +
              " heartbeat confirmed in " +
              data.validators[0].location +
              " · " +
              data.validators.length +
              " indexed validators on map"
            : "Indexed validator telemetry available from the site store") +
          '<span id="alert-close" onclick="document.getElementById(\'alert-bar\').style.display=\'none\'">×</span>';
      }
      var valList = byId("val-list");
      if (valList) {
        valList.innerHTML = "";
        (data.validators || []).slice(0, 12).forEach(function (validator) {
          var item = document.createElement("div");
          item.className = "val-item";
          item.innerHTML =
            '<div class="val-dot" style="background:' +
            tierAccent(validator.tier) +
            ';box-shadow:0 0 6px ' +
            tierAccent(validator.tier) +
            '"></div><div class="val-name">' +
            validator.name +
            '</div><span class="val-status ' +
            (validator.status === "warning" ? "vs-warn" : "vs-active") +
            '">' +
            String(validator.status).toUpperCase() +
            '</span><div class="val-tps" style="color:' +
            tierAccent(validator.tier) +
            '">' +
            validator.tps +
            "</div>";
          valList.appendChild(item);
        });
      }
      var feed = byId("tx-feed");
      if (feed) {
        feed.innerHTML = "";
        if (!data.transactions || data.transactions.length === 0) {
          feed.innerHTML =
            '<div class="tx-item"><div class="tx-body"><div class="tx-detail">No indexed transactions are available from the current RPC source.</div></div></div>';
        } else {
          data.transactions.slice(0, 20).forEach(function (item) {
            var row = document.createElement("div");
            row.className = "tx-item";
            row.innerHTML =
              '<div class="tx-type tt-transfer">' +
              item.type +
              '</div><div class="tx-body"><div class="tx-hash">' +
              item.hash +
              '</div><div class="tx-detail">' +
              item.detail +
              '</div><div class="tx-meta">Updated ' +
              new Date(item.timestamp).toLocaleTimeString() +
              '</div></div><div class="tx-amount" style="color:var(--cyan)">' +
              item.amount +
              "</div>";
            feed.appendChild(row);
          });
        }
      }
      var regionBars = byId("region-bars");
      if (regionBars) {
        regionBars.innerHTML = "";
        (data.regions || []).forEach(function (region) {
          var color =
            region.region === "Asia Pacific"
              ? "var(--cyan)"
              : region.region === "North America"
                ? "var(--gold)"
                : region.region === "Europe"
                  ? "var(--green)"
                  : "var(--purple)";
          var wrap = document.createElement("div");
          wrap.innerHTML =
            '<div class="tm-bar-wrap"><div class="tm-bar" style="width:' +
            region.pct +
            "%;background:" +
            color +
            '"></div></div><div class="tm-label"><span class="tm-name">' +
            region.region +
            '</span><span class="tm-val" style="color:' +
            color +
            '">' +
            region.pct +
            "% · " +
            region.count +
            "</span></div>";
          regionBars.appendChild(wrap);
        });
      }
      api.renderModuleMeta(".topbar", "network", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initLedger(api) {
    var envelope = await api.getLedgerEnvelope({ refresh: true });
    var data = envelope.data;
    setText("#sum-raised", fmtMoney(data.raisedUsd));
    setText("#r3-amount", "+" + fmtMoney(data.round3AmountUsd));
    setText("#sum-treasury", fmtMoney(data.treasuryUsd));
    setText(
      "#last-verified",
      new Date(data.lastVerified).toISOString().slice(0, 19).replace("T", " ") + " UTC",
    );
    api.renderModuleMeta(".summary-cards", "ledger", envelope);
  }

  async function initProofWall(api) {
    async function load() {
      var envelope = await api.getProofsEnvelope({ refresh: true });
      var data = envelope.data;
      setText("#join-count", fmtNumber(data.totalOperators));
      setText("#wall-count", "Showing " + fmtNumber(data.operators.length) + " reservations");
      setText("#slots-left", data.slotsLeft);
      setText("#v-slots", data.slotsLeft);
      var etaHours = Number(data.selloutEtaHours || 0);
      setText("#sellout-time", etaHours > 0 ? Math.floor(etaHours) + "h" : "n/a");
      var grid = byId("wall-grid");
      if (grid) {
        grid.innerHTML = "";
        data.operators.forEach(function (operator) {
          var tierClassName =
            operator.tier === "genesis"
              ? "pt-genesis"
              : operator.tier === "star"
                ? "pt-star"
                : "pt-lite";
          var card = document.createElement("div");
          card.className = "proof-card";
          card.innerHTML =
            '<div class="pc-top"><div class="pc-flag">' +
            operator.flag +
            '</div><div class="pc-identity"><div class="pc-name">' +
            operator.name +
            '</div><div class="pc-location">' +
            operator.location +
            '</div></div><div class="pc-tier ' +
            tierClassName +
            '">' +
            operator.tier.toUpperCase() +
            '</div></div><div class="pc-bottom"><span class="pc-amount">' +
            operator.amount +
            '</span><span class="pc-time">' +
            operator.time +
            '</span><span class="pc-action">✓ Reserved</span></div>';
          grid.appendChild(card);
        });
      }
      var pace = byId("pace-bar");
      if (pace) {
        pace.innerHTML = "";
        data.pace24h.forEach(function (count, index) {
          var segment = document.createElement("div");
          segment.className = "pb-seg" + (index === data.pace24h.length - 1 ? " current" : "");
          segment.style.height = Math.max(6, count * 8) + "%";
          pace.appendChild(segment);
        });
      }
      var ticker = byId("ticker-inner");
      if (ticker) {
        var items = data.operators
          .slice(0, 12)
          .map(function (operator) {
            return (
              '<div class="tick-item"><span class="tick-flag">' +
              operator.flag +
              "</span><span>" +
              operator.name +
              '</span><span class="tick-gold">reserved ' +
              operator.tier +
              ' node</span><span class="tick-green">✓</span></div>'
            );
          })
          .join("");
        ticker.innerHTML = items + items;
      }
      api.renderModuleMeta(".hero", "proof wall", envelope);
    }
    await load();
    global.setInterval(load, 20000);
  }

  async function initPresaleMetrics(api) {
    var envelope = await api.getPresaleEnvelope({ refresh: true });
    var data = envelope.data;
    countdown(data.closesAt, {
      days: "#cd-d",
      hours: "#cd-h",
      minutes: "#cd-m",
      seconds: "#cd-s",
    });
    setText("#raised-amt", fmtMoney(data.raisedUsd));
    var fill = byId("raise-fill");
    if (fill) {
      fill.style.width = ((data.raisedUsd / data.hardCapUsd) * 100).toFixed(1) + "%";
    }
    api.renderModuleMeta(".round-card", "presale", envelope);
  }

  async function initReservationsPages(api) {
    async function load() {
      var [presaleEnvelope, reservationsEnvelope, proofsEnvelope] = await Promise.all([
        api.getPresaleEnvelope({ refresh: true }),
        api.getReservationsEnvelope({ refresh: true }),
        api.getProofsEnvelope({ refresh: true }),
      ]);
      var presale = presaleEnvelope.data;
      var reservations = reservationsEnvelope.data;
      setText("#slots-left", presale.tiers[0].slotsLeft);
      setText("#slots-remain", presale.tiers[0].slotsLeft + " SLOTS LEFT");
      setText("#thermo-raised", fmtCompactMoney(presale.raisedUsd));
      setText("#thermo-pct", ((presale.raisedUsd / presale.hardCapUsd) * 100).toFixed(1) + "%");
      setText("#hdr-raised", fmtMoney(presale.raisedUsd));
      setText("#hdr-inv", fmtNumber(presale.investors));
      setText("#today-total", "$" + Math.round(Number(presale.todayUsd || 0) / 1000) + "K");
      setText("#sh-raised", fmtMoney(presale.raisedUsd));
      setText("#sh-inv", fmtNumber(presale.investors));
      setText("#sh-today", fmtMoney(presale.todayUsd));
      setText("#r-investors", fmtNumber(presale.investors));
      setHtml(
        "#wall-count",
        "Showing <strong>" +
          reservations.recentCards.length +
          "</strong> of " +
          fmtNumber(presale.investors) +
          " recent purchases",
      );
      setText("#join-count", fmtNumber(proofsEnvelope.data.totalOperators));
      setText("#v-slots", proofsEnvelope.data.slotsLeft);
      setText("#today-date", formatDateLabel());
      var closesLabel = byId("closes-label");
      if (closesLabel) closesLabel.textContent = "in ~" + presale.daysRemaining + " days";
      renderReservationsCards(byId("card-grid"), reservations.recentCards);
      renderTopInvestors(byId("top-investors"), reservations.topInvestors);
      renderReservationsHeatmap(byId("heatmap"), reservations.activityHeatmap);
      var eventList = byId("event-list");
      if (eventList) {
        eventList.innerHTML = "";
        reservations.recentCards.slice(0, 6).forEach(function (entry) {
          var card = document.createElement("div");
          card.className = "ev-card";
          card.innerHTML =
            '<div class="ev-top"><div class="ev-flag">' +
            entry.flag +
            '</div><div class="ev-name">' +
            entry.name +
            '</div><div class="ev-type ' +
            (entry.type === "node" ? "evt-node" : "evt-token") +
            '">' +
            (entry.type === "node" ? "NODE" : "TOKEN") +
            '</div></div><div class="ev-amount">' +
            fmtMoney(entry.amountUsd) +
            '</div><div class="ev-time">' +
            entry.timeAgo +
            "</div>";
          eventList.appendChild(card);
        });
      }
      var milestones = queryAll(".milestone");
      if (milestones.length) {
        var targets = [1000000, 5000000, 10000000, 15000000, 20000000, 25000000];
        milestones.forEach(function (milestone, index) {
          milestone.classList.remove("unlocked", "active");
          if (presale.raisedUsd >= targets[index]) {
            milestone.classList.add("unlocked");
          } else if (index === targets.findIndex(function (value) { return presale.raisedUsd < value; })) {
            milestone.classList.add("active");
          }
        });
      }
      var liquidRect = byId("liquid-rect");
      if (liquidRect) {
        var pct = presale.raisedUsd / presale.hardCapUsd;
        var fillHeight = Math.round(pct * 310);
        var fillY = 330 - fillHeight;
        liquidRect.setAttribute("y", fillY);
        liquidRect.setAttribute("height", fillHeight + 25);
        if (byId("level-line")) {
          byId("level-line").setAttribute("y1", fillY);
          byId("level-line").setAttribute("y2", fillY);
        }
        if (byId("level-arrow")) {
          byId("level-arrow").setAttribute("points", "65," + fillY + " 72," + (fillY - 4) + " 72," + (fillY + 4));
        }
        if (byId("shimmer")) {
          byId("shimmer").setAttribute("y", fillY);
          byId("shimmer").setAttribute("height", fillHeight);
        }
      }
      api.renderModuleMeta(".hero-stats, .hero-strip, .shell, .sub-header, .top-bar", "reservations", reservationsEnvelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initValidatorPresale(api) {
    async function load() {
      var envelope = await api.getPresaleEnvelope({ refresh: true });
      var data = envelope.data;
      var tiers = {};
      data.tiers.forEach(function (tier) {
        tiers[tier.name] = tier;
      });
      global.__x3PresaleTiers = tiers;
      setText("#slots-left", tiers.genesis ? tiers.genesis.slotsLeft : "0");
      setText("#slots-remain", tiers.genesis ? tiers.genesis.slotsLeft + " SLOTS LEFT" : "SOLD OUT");
      api.renderModuleMeta(".hero-shell", "validator presale", envelope);
    }

    global.handleBuy = async function () {
      var type = byId("os-type");
      var qty = byId("os-qty");
      var selectedLabel = type ? type.textContent.trim() : "GENESIS NODE";
      var quantity = qty ? Number(qty.textContent.replace(/[^\d]/g, "")) || 1 : 1;
      var tierKey =
        Object.keys(global.__x3PresaleTiers || {}).find(function (key) {
          return global.__x3PresaleTiers[key].label === selectedLabel;
        }) || "genesis";
      var tier = global.__x3PresaleTiers[tierKey];
      var name = global.prompt("Operator name for this reservation:", "X3 Operator");
      if (!name) return;
      var wallet = global.prompt("Wallet address or contact handle:", "0x");
      var location = global.prompt("Location (City, Country):", "Denver, US");
      var countryCode = ((location || "US").split(",")[1] || "US").trim().slice(0, 2).toUpperCase();
      await api.submitReservation({
        name: name,
        wallet: wallet,
        location: location,
        countryCode: countryCode || "US",
        tier: tierKey,
        quantity: quantity,
        amountUsd: tier ? tier.priceUsd : 50000,
      });
      await load();
      global.alert("Reservation submitted to the X3 site store.");
    };

    await load();
    global.setInterval(load, 15000);
  }

  async function initKyc(api) {
    global.submitApplication = async function () {
      var payload = {
        fullName: (query('input[placeholder*="Legal Name"]') || {}).value || "",
        email: (query('input[type="email"]') || {}).value || "",
        wallet: (byId("wallet-addr") || {}).value || "",
      };
      var result = await api.submitForm("kyc", payload);
      byId("panel5").classList.remove("active");
      byId("step5").className = "step-item done";
      byId("step5").querySelector(".step-circle").textContent = "✓";
      byId("panel-success").classList.add("active");
      setText("#app-id", result.data.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  async function initAffiliate(api) {
    global.registerAffiliate = async function () {
      var payload = {
        name: (query('input[placeholder*="Full Name"]') || {}).value || "Affiliate applicant",
        email: (query('input[type="email"]') || {}).value || "",
      };
      var result = await api.submitForm("affiliate", payload);
      global.alert("Affiliate application submitted.\n\nYour record id: " + result.data.id);
    };
  }

  async function initInvestorRelations(api) {
    global.submitForm = async function () {
      var fields = queryAll("input, textarea, select");
      var payload = {
        name: fields[0] ? fields[0].value : "",
        email: fields[1] ? fields[1].value : "",
        organization: fields[2] ? fields[2].value : "",
      };
      var result = await api.submitForm("investor", payload);
      global.alert("Investor inquiry submitted: " + result.data.id);
    };

    var envelope = await api.getPresaleEnvelope({ refresh: true });
    countdown(envelope.data.closesAt, {
      days: "#cd-d",
      hours: "#cd-h",
      minutes: "#cd-m",
      seconds: "#cd-s",
    });
    api.renderModuleMeta(".investor-card", "investor relations", envelope);
  }

  async function initSlotTracker(api) {
    async function load() {
      var payloads = await Promise.all([
        api.getReservationsEnvelope({ refresh: true }),
        api.getPresaleEnvelope({ refresh: true }),
      ]);
      var envelope = payloads[0];
      var presale = payloads[1].data;
      var tracker = envelope.data.slotTracker;
      setText("#avail-num", tracker.availableSlots);
      setText("#pct-fill", Math.round((tracker.reservedSlots / tracker.totalSlots) * 100) + "%");
      setText("#tb-genesis", tracker.reservedSlots);
      var bigSub = query(".big-sub");
      if (bigSub) bigSub.textContent = "Genesis slots remaining";
      var rateLabel = byId("rate-label");
      if (rateLabel) {
        rateLabel.textContent =
          "+" +
          envelope.data.activityHeatmap.slice(-1)[0] +
          " reservations in the latest hourly bucket";
      }
      var tierValues = queryAll(".tier-box .tb-val");
      if (tierValues[1]) setText(tierValues[1], presale.tiers[1].reservedSlots);
      if (tierValues[2]) setText(tierValues[2], presale.tiers[2].reservedSlots);
      if (tierValues[3]) {
        setText(
          tierValues[3],
          presale.tiers.reduce(function (sum, tier) {
            return sum + Number(tier.reservedSlots || 0);
          }, 0),
        );
      }
      var ringArc = byId("ring-arc");
      if (ringArc) {
        var circ = 201.1;
        var pct = tracker.reservedSlots / tracker.totalSlots;
        ringArc.setAttribute("stroke-dashoffset", (circ - circ * pct).toFixed(1));
      }
      var grid = byId("hex-grid");
      var tooltip = byId("tooltip");
      if (grid) {
        grid.innerHTML = "";
        tracker.slots.forEach(function (slot) {
          var hex = document.createElement("div");
          hex.className = "hex-cell " + (slot.reserved ? "reserved" : "empty");
          hex.id = "hex-" + slot.slotNumber;
          hex.innerHTML = slot.reserved
            ? '<div class="hex-flag">' +
              slot.reservation.flag +
              '</div><div class="hex-num">' +
              String(slot.slotNumber).padStart(3, "0") +
              "</div>"
            : '<div class="hex-num" style="font-size:8px">' + String(slot.slotNumber).padStart(3, "0") + "</div>";
          if (tooltip) {
            hex.addEventListener("mouseenter", function (event) {
              tooltip.style.display = "block";
              setText("#tt-num", "Slot #" + String(slot.slotNumber).padStart(3, "0"));
              if (slot.reserved) {
                setText("#tt-status", "✓ Reserved");
                byId("tt-status").style.color = "var(--green)";
                setText("#tt-op", slot.reservation.name);
                setText("#tt-country", slot.reservation.flag + " " + slot.reservation.location);
                setText("#tt-time", slot.reservation.timeAgo);
              } else {
                setText("#tt-status", "● Available");
                byId("tt-status").style.color = "var(--gold)";
                setText("#tt-op", "—");
                setText("#tt-country", "—");
                setText("#tt-time", "Unreserved");
              }
              tooltip.style.left = event.clientX + 12 + "px";
              tooltip.style.top = event.clientY - 60 + "px";
            });
            hex.addEventListener("mousemove", function (event) {
              tooltip.style.left = event.clientX + 12 + "px";
              tooltip.style.top = event.clientY - 60 + "px";
            });
            hex.addEventListener("mouseleave", function () {
              tooltip.style.display = "none";
            });
          }
          if (!slot.reserved) {
            hex.addEventListener("click", function () {
              global.location.href = "x3star-validator-presale.html";
            });
          }
          grid.appendChild(hex);
        });
      }
      var recList = byId("rec-list");
      if (recList) {
        recList.innerHTML = "";
        tracker.recentReservations.forEach(function (slot) {
          var item = document.createElement("div");
          item.className = "rec-item";
          item.innerHTML =
            '<div class="rec-num">#' +
            String(slot.slotNumber).padStart(3, "0") +
            '</div><div class="rec-flag">' +
            slot.reservation.flag +
            '</div><div class="rec-body"><div class="rec-name">' +
            slot.reservation.name +
            '</div><div class="rec-time">' +
            slot.reservation.timeAgo +
            '</div></div><div class="rec-tier" style="background:rgba(255,215,0,0.1);color:var(--gold);border:1px solid rgba(255,215,0,0.2)">GENESIS</div>';
          recList.appendChild(item);
        });
      }
      api.renderModuleMeta(".ha-header", "slot tracker", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  function whaleEventsByFilter(events) {
    if (whaleFilter === "all") return events;
    return events.filter(function (event) {
      return String(event.type || "").toLowerCase() === whaleFilter;
    });
  }

  async function initWhales(api) {
    global.setFilter = function (element, type) {
      whaleFilter = type;
      queryAll(".filter-chip").forEach(function (chip) {
        chip.classList.remove("active");
      });
      if (element && element.classList) element.classList.add("active");
      load();
    };

    global.showAlert = function () {
      var toast = byId("alert-toast");
      if (!toast) return;
      toast.style.display = "block";
      global.setTimeout(function () {
        toast.style.display = "none";
      }, 4000);
    };

    async function load() {
      var envelope = await api.getWhalesEnvelope({ refresh: true });
      var data = envelope.data;
      setText("#whale-count", data.whales.length + " wallets tracked");
      setText("#stream-count", data.events.length);
      setText("#alert-num", data.alerts);
      setText("#buy-pct", data.buyPct + "%");
      setText("#sell-pct", data.sellPct + "%");
      if (byId("buy-bar")) byId("buy-bar").style.width = data.buyPct + "%";
      if (byId("sell-bar")) byId("sell-bar").style.width = data.sellPct + "%";
      setText("#sent-dominant", data.dominantSentiment);
      setText("#accum-score", Number(data.accumulationScore).toFixed(1));
      var headPrice = query(".page-head [style*='X3S/USD']");
      if (headPrice) {
        headPrice.innerHTML =
          'X3S/USD: <span style="color:var(--gold);font-weight:700;">$' +
          Number(data.priceUsd).toFixed(4) +
          '</span> <span style="color:' +
          (data.priceChange24h >= 0 ? "var(--green)" : "var(--red)") +
          '">' +
          (data.priceChange24h >= 0 ? "▲" : "▼") +
          Number(Math.abs(data.priceChange24h)).toFixed(1) +
          "%</span>";
      }
      var whaleList = byId("whale-list");
      if (whaleList) {
        whaleList.innerHTML = "";
        data.whales.forEach(function (wallet, index) {
          var item = document.createElement("div");
          item.className = "whale-card" + (index === 0 ? " selected" : "");
          item.innerHTML =
            '<div class="wc-top"><div class="wc-rank">#' +
            wallet.rank +
            '</div><div class="wc-avatar" style="background:linear-gradient(135deg,' +
            wallet.color +
            ', rgba(85,0,204,0.9))">' +
            wallet.name[0].toUpperCase() +
            '</div><div class="wc-identity"><div class="wc-name" style="color:' +
            wallet.color +
            '">' +
            wallet.name +
            '</div><div class="wc-addr">' +
            wallet.address +
            '</div></div><div class="wc-badge ' +
            (wallet.classification === "whale"
              ? "wb-whale"
              : wallet.classification === "institution"
                ? "wb-inst"
                : "wb-val") +
            '">' +
            wallet.badge +
            '</div></div><div class="wc-bottom"><div class="wcb-stat"><div class="wcbs-val" style="color:var(--gold)">' +
            wallet.holdingsDisplay +
            '</div><div class="wcbs-key">Balance</div></div><div class="wcb-stat"><div class="wcbs-val">' +
            wallet.usdDisplay +
            '</div><div class="wcbs-key">USD Value</div></div><div class="wcb-stat"><div class="wcbs-val" style="color:' +
            (wallet.changePct24h >= 0 ? "var(--green)" : "var(--red)") +
            '">' +
            (wallet.changePct24h >= 0 ? "+" : "") +
            wallet.changePct24h.toFixed(1) +
            '%</div><div class="wcbs-key">24h Change</div></div></div><div class="wc-activity"><div class="wca-fill" style="width:' +
            wallet.activityScore +
            "%;background:" +
            wallet.color +
            '"></div></div>';
          whaleList.appendChild(item);
        });
      }
      var stream = byId("act-stream");
      if (stream) {
        stream.innerHTML = "";
        whaleEventsByFilter(data.events).forEach(function (event) {
          var typeClass =
            event.type === "BUY"
              ? "ait-buy"
              : event.type === "SELL"
                ? "ait-sell"
                : event.type === "STAKE"
                  ? "ait-stake"
                  : event.type === "MOVE"
                    ? "ait-move"
                    : "ait-vote";
          var color =
            event.type === "BUY"
              ? "var(--green)"
              : event.type === "SELL"
                ? "var(--red)"
                : event.type === "STAKE"
                  ? "var(--cyan)"
                  : event.type === "MOVE"
                    ? "var(--orange)"
                    : "var(--purple)";
          var icon =
            event.type === "BUY"
              ? "💰"
              : event.type === "SELL"
                ? "📤"
                : event.type === "STAKE"
                  ? "🔒"
                  : event.type === "MOVE"
                    ? "↔"
                    : "🗳";
          var row = document.createElement("div");
          row.className = "act-item";
          row.innerHTML =
            '<div class="ai-icon" style="background:rgba(255,255,255,0.05)">' +
            icon +
            '</div><div class="ai-body"><div class="ai-top"><span class="ai-wallet" style="color:' +
            color +
            '">' +
            event.wallet +
            '</span><span class="ai-type ' +
            typeClass +
            '">' +
            event.type +
            '</span></div><div class="ai-action">' +
            event.detail +
            '</div><div class="ai-meta">' +
            event.address +
            " · Block #" +
            event.blockNumber +
            '</div></div><div class="ai-amount"><div class="ai-val" style="color:' +
            color +
            '">' +
            event.amountDisplay +
            '</div><div class="ai-usd">' +
            event.amountUsdDisplay +
            '</div><div class="ai-time">' +
            event.timeAgo +
            "</div></div>";
          stream.appendChild(row);
        });
      }
      var toast = byId("alert-toast");
      if (toast && data.events[0]) {
        toast.innerHTML =
          '<div class="at-title">Large Move Detected</div><div class="at-body"><span class="at-val">' +
          data.events[0].wallet +
          "</span> latest event: <span class=\"at-val\" style=\"color:var(--green)\">" +
          data.events[0].amountDisplay +
          "</span> <span class=\"at-val\" style=\"color:var(--gold)\">(" +
          data.events[0].amountUsdDisplay +
          ')</span><div style="margin-top:8px;font-size:10px;">' +
          data.events[0].timeAgo +
          " · Block #" +
          data.events[0].blockNumber +
          "</div></div>";
      }
      api.renderModuleMeta(".page-head", "whales", envelope);
    }
    await load();
    global.setInterval(load, 15000);
  }

  async function initTokenomics(api) {
    async function load() {
      var envelope = await api.getTokenomicsEnvelope({ refresh: true });
      var data = envelope.data;
      setText("#em-rate", fmtX3S(data.dailyEmissionsX3S));
      setText("#burn-val", fmtNumber(data.burnedX3S));
      setText("#burn-rate", "burning ~" + fmtNumber(data.burnRateHourlyX3S) + " X3S/hr");
      setText("#ctr-supply", Math.round(data.lockedSupplyX3S / 1000000) + "M");
      setText("#mktcap", fmtCompactMoney(data.marketCapUsd));
      setText("#lock-rate", fmtPct(data.lockRatePct));
      setText("#daily-burn", fmtNumber(data.burnDailyX3S));
      setText("#circ-supply", (data.circulatingSupplyX3S / 1000000).toFixed(1) + "M");
      var fdvCell = queryAll(".bs-cell .bsc-val");
      if (fdvCell[1]) setText(fdvCell[1], fmtCompactMoney(data.fdvUsd));
      var supplyBars = queryAll(".supply-bars .sb-row");
      data.allocations.forEach(function (allocation, index) {
        var row = supplyBars[index];
        if (!row) return;
        setText(row.querySelector(".sb-name"), allocation.name);
        setText(row.querySelector(".sb-pct"), allocation.pct + "%");
        var fill = row.querySelector(".sb-fill");
        if (fill) {
          fill.style.width = allocation.pct + "%";
          fill.style.background = allocation.color;
        }
      });
      var vestList = byId("vest-list");
      if (vestList) {
        vestList.innerHTML = "";
        data.vesting.forEach(function (vesting) {
          var row = document.createElement("div");
          row.className = "vest-row";
          row.innerHTML =
            '<div class="vr-top"><span class="vr-name">' +
            vesting.name +
            '</span><span class="vr-date">' +
            vesting.unlockLabel +
            '</span></div><div class="vr-bar-track"><div class="vr-bar" style="width:' +
            vesting.progressPct +
            "%;background:" +
            vesting.color +
            '"></div></div><div class="vr-bottom"><span class="vr-amt" style="color:' +
            vesting.color +
            '">' +
            Math.round(vesting.amountX3S / 1000000) +
            'M X3S</span><span class="vr-status ' +
            (vesting.status === "locked"
              ? "vs-locked"
              : vesting.status === "cliff"
                ? "vs-cliff"
                : "vs-active") +
            '">' +
            String(vesting.status).toUpperCase() +
            "</span></div>";
          vestList.appendChild(row);
        });
      }
      if (byId("unlock-bar")) byId("unlock-bar").style.width = (data.unlock30dX3S / data.totalSupplyX3S) * 100 + "%";
      if (byId("unlock-bar2")) byId("unlock-bar2").style.width = (data.unlock90dX3S / data.totalSupplyX3S) * 100 + "%";
      var eventFeed = byId("event-feed");
      if (eventFeed) {
        eventFeed.innerHTML = "";
        data.events.forEach(function (event) {
          var row = document.createElement("div");
          row.className = "ev-item";
          row.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;"><span class="ev-type" style="color:var(--gold)">' +
            event.type +
            '</span><span class="ev-amount" style="color:var(--gold)">' +
            fmtNumber(event.amountX3S) +
            "</span></div><div class=\"ev-desc\">" +
            event.detail +
            " · " +
            new Date(event.timestamp).toLocaleTimeString() +
            "</div>";
          eventFeed.appendChild(row);
        });
      }
      if (global.Chart && byId("main-donut")) {
        var ctx = byId("main-donut").getContext("2d");
        if (tokenomicsChart) tokenomicsChart.destroy();
        tokenomicsChart = new global.Chart(ctx, {
          type: "doughnut",
          data: {
            labels: data.allocations.map(function (allocation) {
              return allocation.name;
            }),
            datasets: [
              {
                data: data.allocations.map(function (allocation) {
                  return allocation.amountX3S / 1000000;
                }),
                backgroundColor: data.allocations.map(function (allocation) {
                  return allocation.color;
                }),
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "72%",
            plugins: {
              legend: { display: false },
            },
          },
        });
      }
      api.renderModuleMeta("nav", "tokenomics", envelope);
    }
    await load();
    global.setInterval(load, 20000);
  }

  async function start() {
    if (!global.X3API) return;
    var api = await global.X3API.init();
    var page = (global.location.pathname.split("/").pop() || "x3star-landing.html").toLowerCase();
    var adapters = {
      "x3star-dashboard.html": initDashboard,
      "x3star-landing.html": initLanding,
      "x3star-governance.html": initGovernance,
      "x3star-node-health.html": initNodeHealth,
      "x3star-staking.html": initStaking,
      "x3star-network-pulse.html": initNetworkPulse,
      "x3star-transparency-ledger.html": initLedger,
      "x3star-proof-wall.html": initProofWall,
      "x3star-validator-presale.html": initValidatorPresale,
      "x3star-kyc-onboarding.html": initKyc,
      "x3star-affiliate.html": initAffiliate,
      "x3star-investor-relations.html": initInvestorRelations,
      "x3star-token-presale.html": initPresaleMetrics,
      "x3star-social-proof-wall.html": initReservationsPages,
      "x3star-fundraise-thermometer.html": initReservationsPages,
      "x3star-slot-tracker.html": initSlotTracker,
      "x3star-whale-tracker.html": initWhales,
      "x3star-tokenomics-warroom.html": initTokenomics,
    };
    if (adapters[page]) {
      await adapters[page](api);
    }
  }

  global.X3PageAdapters = {
    start: start,
  };
})(typeof window !== "undefined" ? window : globalThis);
