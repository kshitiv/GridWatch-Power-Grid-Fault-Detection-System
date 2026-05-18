let graphData     = null;
let mstResult     = null;
let memResult     = null;
let currentView   = 'all';
let requestQueue  = [];
let reqCounter    = 1;

function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'report') buildReport();
}

function toast(msg, type='info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setLoading(state, text='PROCESSING…') {
  const o = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').textContent = text;
  o.classList.toggle('active', state);
}

let uploadedFile = null;

function handleFile(input) {
  const f = input.files[0];
  if (!f) return;
  uploadedFile = f;
  document.getElementById('uploadLabel').textContent = '📄 ' + f.name;
  document.getElementById('uploadZone').style.borderColor = 'var(--amber)';
  document.getElementById('runMSTBtn').disabled = false;
  toast('File loaded: ' + f.name);
}

const uz = document.getElementById('uploadZone');
uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('drag-over'); });
uz.addEventListener('dragleave', () => uz.classList.remove('drag-over'));
uz.addEventListener('drop', e => {
  e.preventDefault(); uz.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) {
    uploadedFile = f;
    document.getElementById('uploadLabel').textContent = '📄 ' + f.name;
    document.getElementById('uploadZone').style.borderColor = 'var(--amber)';
    document.getElementById('runMSTBtn').disabled = false;
    toast('File loaded: ' + f.name);
  }
});

function downloadSample(fmt) {
  fetch('/api/sample/' + fmt)
    .then(r => r.text())
    .then(txt => {
      const blob = new Blob([txt], {type: 'text/plain'});
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'sample_graph.' + fmt;
      a.click();
    })
    .catch(() => toast('Could not download sample', 'error'));
}

async function runMST() {
  if (!uploadedFile) { toast('Please upload a graph file first', 'error'); return; }
  setLoading(true, 'COMPUTING MINIMUM SPANNING TREE…');

  const form = new FormData();
  form.append('file', uploadedFile);

  try {
    const res  = await fetch('/api/mst', { method: 'POST', body: form });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("SERVER RESPONSE:", text);
      throw new Error("Invalid JSON from backend");
    }

    if (!res.ok) { toast(data.error || 'Server error', 'error'); return; }

    mstResult  = data;
    graphData  = { nodes: data.nodes, edges: data.edges };
    currentView = 'all';

    renderMSTStats(data);
    renderTrace('primsTrace',    data.prims.steps);
    renderTrace('kruskalsTrace', data.kruskals.steps);
    renderGraph();
    renderComparison(data);

    document.getElementById('mstStatsRow').style.display = 'flex';
    document.getElementById('mstToggleRow').style.display = 'flex';
    document.getElementById('comparisonPanel').style.display = 'block';

    const sp = document.getElementById('statusMST');
    sp.className = 'status-pill active';
    sp.innerHTML = '<span class="dot"></span>MST READY';

    toast('MST analysis complete!', 'success');
  } catch(e) {
    toast('Network error: ' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function clearMST() {
  mstResult = null; graphData = null;
  document.getElementById('uploadLabel').textContent = 'DROP GRAPH FILE HERE';
  document.getElementById('uploadZone').style.borderColor = '';
  document.getElementById('runMSTBtn').disabled = true;
  document.getElementById('mstStatsRow').style.display = 'none';
  document.getElementById('mstToggleRow').style.display = 'none';
  document.getElementById('comparisonPanel').style.display = 'none';
  document.getElementById('primsTrace').innerHTML   = '<div class="empty-state">LOAD A GRAPH TO SEE TRACE</div>';
  document.getElementById('kruskalsTrace').innerHTML = '<div class="empty-state">LOAD A GRAPH TO SEE TRACE</div>';
  uploadedFile = null;
  clearCanvas();
}

function renderMSTStats(data) {
  document.getElementById('statNodes').textContent       = data.nodes.length;
  document.getElementById('statEdges').textContent       = data.edges.length;
  document.getElementById('statPrimsCost').textContent   = data.prims.total_cost.toFixed(1) + ' km';
  document.getElementById('statKruskalsCost').textContent = data.kruskals.total_cost.toFixed(1) + ' km';
  document.getElementById('statPrimsTime').textContent   = data.prims.time_ms.toFixed(4) + ' ms';
  document.getElementById('statKruskalsTime').textContent = data.kruskals.time_ms.toFixed(4) + ' ms';
}

function renderTrace(containerId, steps) {
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  steps.forEach((s, i) => {
    const div = document.createElement('div');
    const cls = s.action.toLowerCase();
    div.className = 'trace-step ' + cls;
    div.style.animationDelay = (i * 18) + 'ms';
    div.innerHTML = `
      <span class="trace-step-num mono">${String(s.step).padStart(3,'0')}</span>
      <span class="trace-step-badge ${cls}">${s.action}</span>
      <span class="trace-step-detail">${s.detail}</span>
    `;
    c.appendChild(div);
  });
  setTimeout(() => { c.scrollTop = c.scrollHeight; }, steps.length * 20 + 100);
}

function renderComparison(data) {
  const r = data.report;
  const p = data.prims.time_ms, k = data.kruskals.time_ms;
  const maxT = Math.max(p, k);
  const scale = maxT > 0 ? 180 : 90;

  document.getElementById('primsBar').style.width     = Math.max(8, p/maxT*scale) + 'px';
  document.getElementById('kruskalsBar').style.width  = Math.max(8, k/maxT*scale) + 'px';
  document.getElementById('primsBarLabel').textContent = p.toFixed(4) + ' ms';
  document.getElementById('kruskalsBarLabel').textContent = k.toFixed(4) + ' ms';

  document.getElementById('densityVal').textContent   = (r.graph_stats.density * 100).toFixed(1) + '%';
  document.getElementById('densityLabel').textContent = r.graph_stats.density_label + ' graph';

  const cm = document.getElementById('costMatchLabel');
  cm.textContent      = r.cost_match ? '✔ MATCH' : '✗ MISMATCH';
  cm.style.color      = r.cost_match ? 'var(--green)' : 'var(--red)';
}

function clearCanvas() {
  const c = document.getElementById('graphCanvas');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
}

function setMSTView(v) {
  currentView = v;
  renderGraph();
  ['viewPrims','viewKruskals'].forEach(id => {
    document.getElementById(id).style.opacity = '0.6';
  });
  if (v === 'prims')    document.getElementById('viewPrims').style.opacity = '1';
  if (v === 'kruskals') document.getElementById('viewKruskals').style.opacity = '1';
}

function renderGraph() {
  if (!graphData) return;
  const canvas  = document.getElementById('graphCanvas');
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const nodes = graphData.nodes;
  const edges = graphData.edges;
  const n     = nodes.length;

  const cx = W/2, cy = H/2;
  const r  = Math.min(W, H) * 0.36;
  const pos = {};
  nodes.forEach((nd, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI/2;
    pos[nd] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  let hlEdges = new Set();
  let hlColor = 'var(--amber)';
  if (currentView === 'prims' && mstResult) {
    mstResult.prims.mst_edges.forEach(e => {
      hlEdges.add(e.from + '|' + e.to);
      hlEdges.add(e.to + '|' + e.from);
    });
    hlColor = '#1565c0';
  } else if (currentView === 'kruskals' && mstResult) {
    mstResult.kruskals.mst_edges.forEach(e => {
      hlEdges.add(e.from + '|' + e.to);
      hlEdges.add(e.to + '|' + e.from);
    });
    hlColor = '#0288d1';
  }

  edges.forEach(e => {
    const p1 = pos[e.from], p2 = pos[e.to];
    if (!p1 || !p2) return;
    const key = e.from + '|' + e.to;
    const isHL = hlEdges.has(key) || currentView === 'all';

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = isHL ? (currentView === 'all' ? '#c8d8e8' : hlColor) : '#111d26';
    ctx.lineWidth   = isHL && currentView !== 'all' ? 3 : 1;
    ctx.stroke();

    if (isHL || currentView === 'all') {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      ctx.font      = '11px Share Tech Mono';
      ctx.fillStyle = isHL && currentView !== 'all' ? hlColor : '#90b8d8';
      ctx.textAlign = 'center';
      ctx.fillText(e.weight, mx, my - 4);
    }
  });

  if (currentView !== 'all' && hlEdges.size > 0) {
    const mstArr = currentView === 'prims' ? mstResult.prims.mst_edges : mstResult.kruskals.mst_edges;
    mstArr.forEach(e => {
      const p1 = pos[e.from], p2 = pos[e.to];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = hlColor;
      ctx.lineWidth   = 3;
      ctx.shadowColor = hlColor;
      ctx.shadowBlur  = 10;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      const mx = (p1.x + p2.x)/2, my = (p1.y + p2.y)/2;
      ctx.font      = '11px Share Tech Mono';
      ctx.fillStyle = hlColor;
      ctx.textAlign = 'center';
      ctx.fillText(e.weight, mx, my - 4);
    });
  }

  nodes.forEach(nd => {
    const {x, y} = pos[nd];
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, 2*Math.PI);
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = '#90b8d8';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();

    ctx.font      = 'bold 13px Barlow Condensed';
    ctx.fillStyle = '#1a2a3a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nd, x, y);
  });
}

function addRequest(type) {
  if (type === 'alloc') {
    const label = document.getElementById('reqLabel').value.trim();
    const size  = parseInt(document.getElementById('reqSize').value);
    if (!label) { toast('Enter a neighbourhood label', 'error'); return; }
    if (!size || size < 1) { toast('Enter a valid size (KB)', 'error'); return; }
    requestQueue.push({ action: 'alloc', label, size });
    const match = label.match(/^(.*?)(\d+)$/);
    if (match) document.getElementById('reqLabel').value = match[1] + (parseInt(match[2]) + 1);
  } else {
    const label = document.getElementById('freeLabel').value.trim();
    if (!label) { toast('Enter label to free', 'error'); return; }
    requestQueue.push({ action: 'free', label });
  }
  renderReqList();
}

function renderReqList() {
  const el = document.getElementById('reqList');
  const em = document.getElementById('reqEmpty');
  if (requestQueue.length === 0) {
    el.innerHTML = '';
    el.appendChild(em);
    em.style.display = 'block';
    return;
  }
  em.style.display = 'none';
  el.innerHTML = '';
  requestQueue.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'req-item';
    div.innerHTML = r.action === 'alloc'
      ? `<span class="alloc-badge">ALLOC</span>
         <span class="mono text-white">${r.label}</span>
         <span class="mono text-cyan">${r.size} KB</span>
         <button class="del-btn" onclick="removeReq(${i})">✕</button>`
      : `<span class="free-badge">FREE</span>
         <span class="mono text-white">${r.label}</span>
         <button class="del-btn" onclick="removeReq(${i})">✕</button>`;
    el.appendChild(div);
  });
}

function removeReq(i) {
  requestQueue.splice(i, 1);
  renderReqList();
}

function clearRequests() {
  requestQueue = [];
  renderReqList();
  document.getElementById('memResultsSection').style.display = 'none';
}

function loadDefaultRequests() {
  requestQueue = [
    { action:'alloc', label:'NH-A', size:80  },
    { action:'alloc', label:'NH-B', size:120 },
    { action:'alloc', label:'NH-C', size:40  },
    { action:'alloc', label:'NH-D', size:60  },
    { action:'free',  label:'NH-B'           },
    { action:'alloc', label:'NH-E', size:100 },
    { action:'alloc', label:'NH-F', size:30  },
    { action:'free',  label:'NH-A'           },
    { action:'alloc', label:'NH-G', size:90  },
  ];
  renderReqList();
  toast('Default requests loaded', 'success');
}

async function runMemory() {
  if (requestQueue.length === 0) { toast('Add memory requests first', 'error'); return; }
  const totalMem = parseInt(document.getElementById('totalMemory').value);
  if (!totalMem || totalMem < 64) { toast('Memory must be at least 64 KB', 'error'); return; }

  setLoading(true, 'SIMULATING MEMORY ALLOCATION…');

  try {
    const res  = await fetch('/api/memory', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ total_memory: totalMem, requests: requestQueue })
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("SERVER RESPONSE:", text);
      throw new Error("Invalid JSON from backend");
    }

    if (!res.ok) { toast(data.error || 'Server error', 'error'); return; }

    memResult = data;
    renderMemResults(data);
    document.getElementById('memResultsSection').style.display = 'block';

    const sp = document.getElementById('statusMEM');
    sp.className = 'status-pill active';
    sp.innerHTML = '<span class="dot"></span>MEM READY';

    toast('Memory simulation complete!', 'success');
  } catch(e) {
    toast('Network error: ' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderMemResults(data) {
  const strategies = ['first_fit', 'best_fit', 'worst_fit'];
  const total = data.total_memory;

  let bestStrat = strategies[0], bestFrag = Infinity;
  strategies.forEach(s => {
    const f = data.results[s].stats.external_frag_ratio;
    if (f < bestFrag) { bestFrag = f; bestStrat = s; }
  });

  strategies.forEach(s => {
    const res   = data.results[s];
    const stats = res.stats;
    renderMemBar('bar-' + s, stats.snapshot, total);
    const sc = document.getElementById('stats-' + s);
    sc.innerHTML = `
      <div class="stat-row" style="margin-top:10px">
        <div class="stat-box" style="padding:8px 12px;min-width:80px;flex:1">
          <div class="stat-label">USED</div>
          <div class="stat-value" style="font-size:20px;color:var(--cyan)">${stats.used} KB</div>
        </div>
        <div class="stat-box" style="padding:8px 12px;flex:1">
          <div class="stat-label">FREE</div>
          <div class="stat-value" style="font-size:20px;color:var(--muted)">${stats.free} KB</div>
        </div>
        <div class="stat-box" style="padding:8px 12px;flex:1">
          <div class="stat-label">EXT FRAG</div>
          <div class="stat-value" style="font-size:20px;color:${stats.external_frag_ratio > 0.4 ? 'var(--red)' : 'var(--green)'}">${(stats.external_frag_ratio*100).toFixed(1)}%</div>
        </div>
      </div>`;
    renderAllocLog('log-' + s, res.log);
  });

  const tbody = document.getElementById('fragTableBody');
  tbody.innerHTML = '';
  strategies.forEach(s => {
    const st  = data.results[s].stats;
    const tr  = document.createElement('tr');
    if (s === bestStrat) tr.className = 'best-row';
    tr.innerHTML = `
      <td class="bold">${s.replace(/_/g,' ').toUpperCase()} ${s===bestStrat ? '★' : ''}</td>
      <td>${st.used}</td>
      <td>${st.free}</td>
      <td>${st.num_free_blocks}</td>
      <td>${st.largest_free_block}</td>
      <td>${(st.external_frag_ratio*100).toFixed(2)}%</td>
      <td>${st.utilization_pct}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMemBar(id, snapshot, total) {
  const container = document.getElementById(id);
  container.innerHTML = '';
  snapshot.forEach(block => {
    const pct = (block.size / total) * 100;
    const seg = document.createElement('div');
    seg.className = 'mem-segment ' + (block.free ? 'free' : 'used');
    seg.style.width = pct + '%';
    if (pct > 6) {
      seg.textContent = block.free ? `FREE\n${block.size}K` : (block.label || '?');
      seg.title = (block.free ? 'FREE' : block.label) + ' — ' + block.size + ' KB @ ' + block.start;
    }
    container.appendChild(seg);
  });
}

function renderAllocLog(id, log) {
  const c = document.getElementById(id);
  c.innerHTML = '';
  log.forEach((entry, i) => {
    const div = document.createElement('div');
    const cls = entry.action === 'ALLOC' ? 'accept' : entry.action === 'FREE' ? 'start' : 'skip';
    div.className = 'trace-step ' + cls;
    div.style.animationDelay = (i * 15) + 'ms';
    div.innerHTML = `
      <span class="trace-step-badge ${cls}">${entry.action}</span>
      <span class="trace-step-detail">${entry.detail}</span>
    `;
    c.appendChild(div);
  });
}

function buildReport() {
  const rc = document.getElementById('reportContent');

  if (!mstResult && !memResult) {
    rc.innerHTML = `<div class="empty-state" style="padding:80px">
      <div style="font-size:36px;margin-bottom:16px">📋</div>
      RUN MST ANALYSIS AND MEMORY SIMULATION TO GENERATE REPORT
    </div>`;
    return;
  }

  let html = `
    <div style="font-family:var(--font-cond);font-size:11px;letter-spacing:4px;color:var(--muted);margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px">
      GRIDWATCH — SYSTEM RECOMMENDATION REPORT &nbsp;|&nbsp; GENERATED ${new Date().toLocaleString()}
    </div>`;

  if (mstResult) {
    const r = mstResult.report;
    html += `
    <div class="report-section">
      <div class="report-heading">◈ MST ALGORITHM RECOMMENDATION</div>
      <div class="report-verdict">${r.recommendation}</div>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);margin-bottom:16px">
        RECOMMENDED FOR THIS NETWORK TOPOLOGY
      </div>
      <ul class="reason-list">
        ${r.reasoning.map(line => `<li>${line}</li>`).join('')}
      </ul>
      <div class="divider"></div>
      <div class="grid-3" style="margin-top:12px">
        <div>
          <div class="stat-label">GRAPH TYPE</div>
          <div class="stat-value" style="font-size:22px">${r.graph_stats.density_label.toUpperCase()}</div>
        </div>
        <div>
          <div class="stat-label">PRIM'S COST</div>
          <div class="stat-value amber" style="font-size:22px">${mstResult.prims.total_cost.toFixed(1)} km</div>
        </div>
        <div>
          <div class="stat-label">KRUSKAL'S COST</div>
          <div class="stat-value cyan" style="font-size:22px">${mstResult.kruskals.total_cost.toFixed(1)} km</div>
        </div>
      </div>
    </div>`;
  }

  if (memResult) {
    const rec = memResult.recommendation;
    html += `
    <div class="report-section">
      <div class="report-heading">⟁ MEMORY ALLOCATION RECOMMENDATION</div>
      <div class="report-verdict">${rec.recommended}</div>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--muted);margin-bottom:16px">
        LOWEST EXTERNAL FRAGMENTATION — OPTIMAL FOR ROUTING TABLE ALLOCATION
      </div>
      <ul class="reason-list">
        ${rec.reasoning.map(line => `<li>${line}</li>`).join('')}
      </ul>
      ${rec.explanation ? `<div style="margin-top:12px;padding:12px;background:var(--bg-0);border-left:3px solid var(--green);font-size:13px;color:var(--white)">${rec.explanation}</div>` : ''}
    </div>`;
  }

  if (mstResult && memResult) {
    html += `
    <div class="report-section">
      <div class="report-heading">▣ EXECUTIVE SUMMARY</div>
      <table class="frag-table">
        <thead>
          <tr><th>DOMAIN</th><th>DECISION</th><th>RATIONALE</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="bold text-amber">CABLE ROUTING (MST)</td>
            <td class="bold text-green">${mstResult.report.recommendation}</td>
            <td>${mstResult.report.graph_stats.density_label} graph — see MST tab for full trace</td>
          </tr>
          <tr>
            <td class="bold text-cyan">MEMORY ALLOCATION</td>
            <td class="bold text-green">${memResult.recommendation.recommended}</td>
            <td>Best ext. frag ratio: ${(memResult.recommendation.scores[memResult.recommendation.recommended.toLowerCase().replace(' ','_')] * 100).toFixed(2)}%</td>
          </tr>
        </tbody>
      </table>
    </div>`;
  }

  rc.innerHTML = html;
}

window.addEventListener('resize', () => { if (graphData) renderGraph(); });
