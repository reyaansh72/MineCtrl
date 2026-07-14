const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());

function downloadFile(url, output) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(output);

    https.get(url, response => {
      response.pipe(file);

      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", err => {
      fs.unlink(output, () => {});
      reject(err);
    });
  });
}

async function getServerJarUrl(version) {
  const manifest = await fetch(
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
  ).then(r => r.json());

  const versionInfo = manifest.versions.find(v => v.id === version);

  if (!versionInfo) {
    throw new Error("Minecraft version not found");
  }

  const versionData = await fetch(versionInfo.url)
    .then(r => r.json());

  return versionData.downloads.server.url;
}




// ── SERVER STORAGE ──
let servers = {};
if (fs.existsSync("./servers.json")) {
  servers = JSON.parse(fs.readFileSync("./servers.json", "utf-8"));
}
function saveServers() {
  fs.writeFileSync("./servers.json", JSON.stringify(servers, null, 2));
}

// ── PROCESS MAP (running java processes) ──
let processes = {};

// ── TERMINAL LOG BUFFER ──
let terminalLogs = {};

// ===================================================
// SERVE index.html (login page) at /
// ===================================================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Server Panel — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0a1f10 0%, #071009 60%, #020805 100%);
      color: #e8f5e9;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 40px 36px;
      width: 340px;
      backdrop-filter: blur(16px);
    }
    .logo {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dot {
      width: 11px; height: 11px;
      border-radius: 50%;
      background: #00e676;
      box-shadow: 0 0 10px #00e676;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 6px #00e676; }
      50%      { box-shadow: 0 0 18px #00e676, 0 0 32px rgba(0,230,118,0.3); }
    }
    label {
      display: block;
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: .07em;
    }
    input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(0,0,0,0.3);
      color: #e8f5e9;
      font-size: 14px;
      outline: none;
      margin-bottom: 16px;
      transition: border-color .2s, box-shadow .2s;
    }
    input:focus {
      border-color: #00e676;
      box-shadow: 0 0 0 3px rgba(0,230,118,0.2);
    }
    button {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: none;
      background: #00e676;
      color: #001a0a;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: background .2s, box-shadow .2s, transform .15s;
    }
    button:hover {
      background: #5dfc9d;
      box-shadow: 0 0 22px rgba(0,230,118,0.4);
      transform: translateY(-1px);
    }
    .error {
      color: #ff5252;
      font-size: 13px;
      margin-top: 12px;
      text-align: center;
      min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="dot"></span> Server Panel</div>
    <label>Username</label>
    <input type="text" id="username" placeholder="Enter username" onkeydown="if(event.key==='Enter')login()">
    <label>Password</label>
    <input type="password" id="password" placeholder="Enter password" onkeydown="if(event.key==='Enter')login()">
    <button onclick="login()">Login</button>
    <div class="error" id="err"></div>
  </div>
  <script>
    async function login() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      document.getElementById('err').textContent = '';
      try {
        const res  = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('token', data.token);
          window.location.href = '/home';
        } else {
          document.getElementById('err').textContent = '❌ ' + data.message;
        }
      } catch(e) {
        document.getElementById('err').textContent = '❌ Cannot reach server.';
      }
    }
  </script>
</body>
</html>`);
});

// ===================================================
// SERVE Home.html (dashboard) at /home
// ===================================================
app.get("/home", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Server Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --green: #00e676; --green-dim: #00c853;
      --green-glow: rgba(0,230,118,0.25);
      --surface-1: rgba(255,255,255,0.05);
      --surface-2: rgba(255,255,255,0.09);
      --border: rgba(255,255,255,0.1);
      --border-hover: rgba(0,230,118,0.45);
      --text: #e8f5e9; --text-muted: rgba(255,255,255,0.45);
      --radius-lg: 18px; --radius-md: 12px; --radius-sm: 8px;
      --t: 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg,#0a1f10 0%,#071009 60%,#020805 100%);
      color: var(--text); display: flex; height: 100vh; overflow: hidden;
    }
    /* SIDEBAR */
    .sidebar {
      width: 240px; background: var(--surface-1);
      backdrop-filter: blur(16px);
      border-right: 1px solid var(--border);
      padding: 20px 14px; display: flex;
      flex-direction: column; gap: 6px; flex-shrink: 0;
    }
    .logo {
      font-size: 17px; font-weight: 700; letter-spacing:.02em;
      padding: 6px 10px 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 6px; display: flex; align-items: center; gap: 8px;
    }
    .dot {
      width:10px;height:10px;border-radius:50%;
      background:var(--green);box-shadow:0 0 8px var(--green);
      animation:pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100%{box-shadow:0 0 6px var(--green);}
      50%{box-shadow:0 0 14px var(--green),0 0 28px var(--green-glow);}
    }
    .nav-btn {
      display:flex;align-items:center;gap:10px;
      padding:11px 14px;border-radius:var(--radius-md);
      border:1px solid transparent;background:transparent;
      color:var(--text-muted);font-size:14px;font-weight:500;
      cursor:pointer;transition:background var(--t),color var(--t),
      border-color var(--t),box-shadow var(--t),transform var(--t);
      text-align:left;width:100%;
    }
    .nav-btn .icon{font-size:17px;flex-shrink:0;}
    .nav-btn:hover {
      background:var(--surface-2);color:var(--text);
      border-color:var(--border-hover);
      box-shadow:0 0 12px var(--green-glow),inset 0 0 12px rgba(0,230,118,0.05);
      transform:translateX(3px);
    }
    .nav-btn.active {
      background:rgba(0,230,118,0.12);color:var(--green);
      border-color:rgba(0,230,118,0.35);box-shadow:0 0 14px var(--green-glow);
    }
    .nav-btn.danger{color:#ff5252;}
    .nav-btn.danger:hover {
      background:rgba(255,82,82,0.1);border-color:rgba(255,82,82,0.4);
      box-shadow:0 0 12px rgba(255,82,82,0.2);color:#ff5252;transform:translateX(3px);
    }
    .sidebar-spacer{flex:1;}
    /* MAIN */
    .main{flex:1;padding:24px;overflow-y:auto;}
    .page-title{font-size:22px;font-weight:700;margin-bottom:20px;color:var(--green);letter-spacing:-.01em;}
    .section-title{font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;}
    /* CARD */
    .card {
      background:var(--surface-1);border:1px solid var(--border);
      border-radius:var(--radius-lg);padding:24px;margin-bottom:18px;
      backdrop-filter:blur(14px);
      transition:border-color var(--t),box-shadow var(--t);
    }
    .card:hover{border-color:rgba(0,230,118,0.2);box-shadow:0 4px 32px rgba(0,230,118,0.06);}
    /* FORM */
    .row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
    .select-wrap{position:relative;flex:1;min-width:180px;}
    .select-wrap::after{
      content:'▾';position:absolute;right:12px;top:50%;
      transform:translateY(-50%);color:var(--text-muted);
      pointer-events:none;font-size:13px;transition:color var(--t);
    }
    .select-wrap:hover::after{color:var(--green);}
    select, input[type="text"] {
      padding:11px 14px;border-radius:var(--radius-md);
      border:1px solid var(--border);background:rgba(0,0,0,0.3);
      color:var(--text);font-size:14px;outline:none;width:100%;
      transition:border-color var(--t),box-shadow var(--t),background var(--t);
      cursor:pointer;appearance:none;-webkit-appearance:none;
    }
    select:hover,input[type="text"]:hover{border-color:rgba(0,230,118,0.35);background:rgba(0,230,118,0.04);}
    select:focus,input[type="text"]:focus{border-color:var(--green);box-shadow:0 0 0 3px var(--green-glow);background:rgba(0,230,118,0.06);}
    .version-status{font-size:12px;color:var(--text-muted);margin-top:6px;}
    .version-status.loading{color:var(--green-dim);}
    .version-status.error{color:#ff5252;}
    /* BUTTONS */
    .btn{
      padding:11px 22px;border-radius:var(--radius-md);border:none;
      font-size:14px;font-weight:600;cursor:pointer;
      transition:transform var(--t),box-shadow var(--t),background var(--t);
      display:inline-flex;align-items:center;gap:7px;
    }
    .btn:active{transform:scale(0.97);}
    .btn-primary{background:var(--green);color:#001a0a;}
    .btn-primary:hover{background:#5dfc9d;box-shadow:0 0 20px var(--green-glow),0 4px 16px rgba(0,0,0,0.4);transform:translateY(-1px);}
    .btn-primary:disabled{background:#1a3a25;color:#3a6a4a;cursor:not-allowed;box-shadow:none;transform:none;}
    .btn-secondary{background:var(--surface-2);color:var(--text);border:1px solid var(--border);}
    .btn-secondary:hover{border-color:var(--border-hover);box-shadow:0 0 14px var(--green-glow);background:rgba(0,230,118,0.08);transform:translateY(-1px);}
    .btn-danger{background:rgba(255,82,82,0.15);color:#ff5252;border:1px solid rgba(255,82,82,0.3);}
    .btn-danger:hover{background:rgba(255,82,82,0.25);box-shadow:0 0 14px rgba(255,82,82,0.25);transform:translateY(-1px);}
    /* STATS */
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;}
    .stat-card{
      background:rgba(0,0,0,0.25);border:1px solid var(--border);
      border-radius:var(--radius-md);padding:18px;
      transition:border-color var(--t),box-shadow var(--t),transform var(--t);
    }
    .stat-card:hover{border-color:var(--border-hover);box-shadow:0 0 18px var(--green-glow);transform:translateY(-2px);}
    .stat-label{font-size:12px;color:var(--text-muted);margin-bottom:6px;}
    .stat-value{font-size:26px;font-weight:700;color:var(--green);}
    .stat-unit{font-size:13px;color:var(--text-muted);margin-left:3px;}
    .progress-bar-track{background:rgba(255,255,255,0.08);border-radius:99px;height:6px;margin-top:8px;overflow:hidden;}
    .progress-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--green-dim),var(--green));box-shadow:0 0 6px var(--green-glow);transition:width 0.5s ease;}
    /* SERVER LIST */
    .server-row{
      display:flex;justify-content:space-between;align-items:center;
      padding:14px 16px;background:rgba(0,0,0,0.2);
      border:1px solid var(--border);border-radius:var(--radius-md);
      margin-bottom:10px;
      transition:border-color var(--t),box-shadow var(--t);
    }
    .server-row:hover{border-color:rgba(0,230,118,0.25);box-shadow:0 0 12px rgba(0,230,118,0.07);}
    .server-name{font-weight:600;margin-bottom:3px;}
    .server-meta{font-size:12px;color:var(--text-muted);}
    .status-badge{
      display:inline-block;padding:3px 10px;border-radius:99px;
      font-size:11px;font-weight:700;margin-left:8px;
    }
    .status-running{background:rgba(0,230,118,0.15);color:var(--green);}
    .status-stopped{background:rgba(255,255,255,0.07);color:var(--text-muted);}
    .server-actions{display:flex;gap:8px;}
    /* TERMINAL */
    .terminal-output{
      background:#000;border:1px solid rgba(0,230,118,0.15);
      border-radius:var(--radius-md);padding:14px;height:260px;
      overflow-y:auto;font-family:'Cascadia Code','Consolas',monospace;
      font-size:13px;line-height:1.7;
    }
    .terminal-output p{margin:0;}
    .t-info{color:#69ff9a;} .t-warn{color:#ffd54f;} .t-err{color:#ff5252;} .t-muted{color:var(--text-muted);}
    .terminal-input-row{display:flex;gap:8px;margin-top:10px;align-items:center;}
    .terminal-input-row input{flex:1;font-family:monospace;}
    /* ABOUT */
    .kv-row{
      display:flex;gap:12px;align-items:center;padding:12px 14px;
      background:rgba(0,0,0,0.2);border:1px solid var(--border);
      border-radius:var(--radius-sm);margin-bottom:8px;
      transition:border-color var(--t),box-shadow var(--t);
    }
    .kv-row:hover{border-color:rgba(0,230,118,0.3);box-shadow:0 0 10px rgba(0,230,118,0.08);}
    .kv-key{font-size:12px;color:var(--text-muted);width:90px;flex-shrink:0;}
    .kv-value{font-size:14px;} .kv-value a{color:var(--green);text-decoration:none;}
    .kv-value a:hover{text-decoration:underline;}
    /* TOAST */
    #toast{
      position:fixed;bottom:28px;left:50%;
      transform:translateX(-50%) translateY(60px);
      background:#1a3a25;border:1px solid rgba(0,230,118,0.4);
      color:var(--green);padding:10px 22px;border-radius:99px;
      font-size:14px;font-weight:600;
      box-shadow:0 4px 24px rgba(0,230,118,0.2);
      opacity:0;transition:transform 0.3s ease,opacity 0.3s ease;
      pointer-events:none;z-index:999;
    }
    #toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
    .hidden{display:none!important;}
    ::-webkit-scrollbar{width:5px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(0,230,118,0.25);border-radius:99px;}
  </style>
</head>
<body>
<div class="sidebar">
  <div class="logo"><span class="dot"></span> Server Panel</div>
  <button class="nav-btn active" onclick="showPage('create',this)"><span class="icon">🖥️</span> Create Server</button>
  <button class="nav-btn" onclick="showPage('myservers',this)"><span class="icon">📋</span> My Servers</button>
  <button class="nav-btn" onclick="showPage('stats',this)"><span class="icon">📊</span> Stats</button>
  <button class="nav-btn" onclick="showPage('terminal',this)"><span class="icon">💻</span> Terminal</button>
  <button class="nav-btn" onclick="showPage('about',this)"><span class="icon">ℹ️</span> About</button>
  <div class="sidebar-spacer"></div>
  <button class="nav-btn danger" onclick="logout()"><span class="icon">🚪</span> Logout</button>
</div>

<div class="main">

  <!-- CREATE -->
  <div id="create" class="page">
    <div class="page-title">Create Minecraft Server</div>
    <div class="card">
      <div class="section-title">Configuration</div>
      <div class="row">
        <div class="select-wrap">
          <select id="versionSelect" disabled><option>Loading versions…</option></select>
          <div class="version-status loading" id="versionStatus">Fetching from Mojang…</div>
        </div>
        <div class="select-wrap">
          <select id="typeSelect">
            <option value="vanilla">Vanilla</option>
            <option value="paper">Paper</option>
            <option value="spigot">Spigot</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <input type="text" id="serverName" placeholder="Server name (e.g. My SMP)">
      </div>
      <button class="btn btn-primary" id="createBtn" onclick="createServer()" disabled>⚡ Create Server</button>
    </div>
  </div>

  <!-- MY SERVERS -->
  <div id="myservers" class="page hidden">
    <div class="page-title">My Servers</div>
    <div id="serverList"><p style="color:var(--text-muted)">Loading…</p></div>
  </div>

  <!-- STATS -->
  <div id="stats" class="page hidden">
    <div class="page-title">Stats</div>
    <div class="card">
      <div class="section-title">System</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Servers</div>
          <div class="stat-value" id="statTotal">—</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" id="pbTotal" style="width:0%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Running</div>
          <div class="stat-value" id="statRunning">—</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" id="pbRunning" style="width:0%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Node Uptime</div>
          <div class="stat-value" id="statUptime">—</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:30%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Session Uptime</div>
          <div class="stat-value" id="sessionUptime">00:00</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:5%"></div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- TERMINAL -->
  <div id="terminal" class="page hidden">
    <div class="page-title">Terminal</div>
    <div class="card">
      <div class="section-title">Select Server</div>
      <div class="select-wrap" style="margin-bottom:14px;">
        <select id="termServerSelect"><option value="">— No servers yet —</option></select>
      </div>
      <div class="terminal-output" id="termOut">
        <p class="t-muted">[Ready] Select a server and type a command.</p>
      </div>
      <div class="terminal-input-row">
        <input type="text" id="termInput" placeholder="Type command…" onkeydown="if(event.key==='Enter')sendCommand()">
        <button class="btn btn-primary" onclick="sendCommand()">Send</button>
        <button class="btn btn-secondary" onclick="clearTerm()">Clear</button>
      </div>
    </div>
  </div>

  <!-- ABOUT -->
  <div id="about" class="page hidden">
    <div class="page-title">About</div>
    <div class="card">
      <div class="kv-row"><div class="kv-key">Author</div><div class="kv-value">Reyaansh</div></div>
      <div class="kv-row"><div class="kv-key">GitHub</div><div class="kv-value"><a href="https://github.com/reyaansh72" target="_blank">github.com/reyaansh72</a></div></div>
      <div class="kv-row"><div class="kv-key">Project</div><div class="kv-value">Minecraft Server Panel</div></div>
      <div class="kv-row"><div class="kv-key">Version API</div><div class="kv-value"><a href="https://launchermeta.mojang.com/mc/game/version_manifest.json" target="_blank">Mojang Manifest</a></div></div>
      <div class="kv-row"><div class="kv-key">Backend</div><div class="kv-value">Node.js / Express — no auth required</div></div>
    </div>
  </div>

</div>
<div id="toast"></div>

<script>
  const API = '';

  // ── PAGE NAV ──
  function showPage(page, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(page).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (page === 'myservers') loadServerList();
    if (page === 'stats') loadStats();
    if (page === 'terminal') loadTerminalServers();
  }

  // ── TOAST ──
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── MOJANG VERSIONS ──
  async function loadVersions() {
    const sel = document.getElementById('versionSelect');
    const status = document.getElementById('versionStatus');
    const btn = document.getElementById('createBtn');
    try {
      const res = await fetch('https://corsproxy.io/?url=' + encodeURIComponent('https://launchermeta.mojang.com/mc/game/version_manifest.json'));
      const data = await res.json();
      const releases = data.versions.filter(v => v.type === 'release');
      sel.innerHTML = releases.map(v => '<option value="' + v.id + '">Mojang ' + v.id + '</option>').join('');
      sel.disabled = false; btn.disabled = false;
      status.textContent = releases.length + ' release versions loaded';
      status.className = 'version-status';
    } catch(e) {
      status.textContent = 'Offline — using fallback list';
      status.className = 'version-status error';
      ['1.20.4','1.20.1','1.19.4','1.18.2','1.16.5'].forEach(v => {
        sel.innerHTML += '<option value="' + v + '">Mojang ' + v + ' (offline)</option>';
      });
      sel.disabled = false; btn.disabled = false;
    }
  }

  // ── CREATE SERVER ──
  async function createServer() {
    const name = document.getElementById('serverName').value.trim();
    const version = document.getElementById('versionSelect').value;
    const type = document.getElementById('typeSelect').value;
    if (!name) { showToast('⚠️ Enter a server name first.'); return; }
    const res = await fetch('/api/server/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version, type })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ "' + name + '" created!');
      document.getElementById('serverName').value = '';
    } else {
      showToast('❌ Failed: ' + (data.error || 'unknown error'));
    }
  }

  // ── SERVER LIST ──
  async function loadServerList() {
    const res = await fetch('/api/server/list');
    const list = await res.json();
    const container = document.getElementById('serverList');
    if (!list.length) {
      container.innerHTML = '<div class="card"><p style="color:var(--text-muted)">No servers yet — create one!</p></div>';
      return;
    }
    container.innerHTML = list.map(s => \`
      <div class="server-row">
        <div>
          <div class="server-name">\${esc(s.name)}
            <span class="status-badge \${s.status==='running'?'status-running':'status-stopped'}">\${s.status}</span>
          </div>
          <div class="server-meta">\${s.type} · \${s.version}</div>
        </div>
        <div class="server-actions">
          \${s.status==='stopped'
            ? '<button class="btn btn-primary" onclick="startServer(\\''+s.id+'\\')">▶ Start</button>'
            : '<button class="btn btn-secondary" onclick="stopServer(\\''+s.id+'\\')">■ Stop</button>'
          }
          <button class="btn btn-danger" onclick="deleteServer('\${s.id}')">🗑</button>
        </div>
      </div>
    \`).join('');
  }

  async function startServer(id) {
    const res = await fetch('/api/server/' + id + '/start', { method: 'POST' });
    const data = await res.json();
    showToast(data.success ? '▶ Server started!' : '❌ ' + (data.error || 'Failed'));
    loadServerList();
  }

  async function stopServer(id) {
    const res = await fetch('/api/server/' + id + '/stop', { method: 'POST' });
    const data = await res.json();
    showToast(data.success ? '■ Server stopped.' : '❌ ' + (data.error || 'Failed'));
    loadServerList();
  }

  async function deleteServer(id) {
    if (!confirm('Delete this server?')) return;
    const res = await fetch('/api/server/' + id, { method: 'DELETE' });
    const data = await res.json();
    showToast(data.success ? '🗑 Deleted.' : '❌ Failed.');
    loadServerList();
  }

  // ── STATS ──
  async function loadStats() {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statTotal').textContent = data.total;
    document.getElementById('statRunning').textContent = data.running;
    document.getElementById('statUptime').textContent = fmtUptime(data.uptime);
    const pct = data.total ? Math.round((data.running/data.total)*100) : 0;
    document.getElementById('pbTotal').style.width = Math.min(data.total*10,100)+'%';
    document.getElementById('pbRunning').style.width = pct+'%';
  }

  function fmtUptime(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    return h > 0 ? h+'h '+m+'m' : m+'m '+Math.floor(s%60)+'s';
  }

  // ── TERMINAL ──
  async function loadTerminalServers() {
    const res = await fetch('/api/server/list');
    const list = await res.json();
    const sel = document.getElementById('termServerSelect');
    sel.innerHTML = list.length
      ? list.map(s => '<option value="'+s.id+'">'+esc(s.name)+' ('+s.status+')</option>').join('')
      : '<option value="">— No servers —</option>';
  }

  async function sendCommand() {
    const inp = document.getElementById('termInput');
    const out = document.getElementById('termOut');
    const cmd = inp.value.trim();
    const sid = document.getElementById('termServerSelect').value;
    if (!cmd) return;
    const now = new Date().toTimeString().slice(0,8);
    out.innerHTML += '<p class="t-muted">['+now+'] &gt; '+esc(cmd)+'</p>';
    if (sid) {
      const res = await fetch('/api/terminal/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sid, command: cmd })
      });
      const data = await res.json();
      out.innerHTML += '<p class="'+(data.success?'t-info':'t-err')+'">['+now+'] '+(data.message||data.error)+'</p>';
    } else {
      out.innerHTML += '<p class="t-warn">['+now+'] No server selected.</p>';
    }
    inp.value = '';
    out.scrollTop = out.scrollHeight;
  }

  function clearTerm() {
    document.getElementById('termOut').innerHTML = '<p class="t-muted">[Cleared]</p>';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── SESSION UPTIME ──
  let secs = 0;
  setInterval(() => {
    secs++;
    const m = String(Math.floor(secs/60)).padStart(2,'0');
    const s = String(secs%60).padStart(2,'0');
    const el = document.getElementById('sessionUptime');
    if (el) el.textContent = m+':'+s;
  }, 1000);

  // ── LOGOUT ──
  function logout() { window.location.href = '/'; }

  // ── INIT ──
  loadVersions();
  setInterval(loadStats, 15000);
</script>
</body>
</html>`);
});

// ===================================================
// LOGIN API
// ===================================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync("./Users.json")) {
    return res.json({ success: false, message: "No users file found." });
  }
  const users = JSON.parse(fs.readFileSync("./Users.json", "utf-8"));
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    console.log("✅ Login:", username);
    res.json({ success: true, token: "ok" });
  } else {
    console.log("❌ Bad login:", username);
    res.json({ success: false, message: "Invalid username or password." });
  }
});

// ===================================================
// SERVER APIs (no auth needed)
// ===================================================

// CREATE
app.post("/api/server/create", async (req, res) => {
  const { name, version, type } = req.body;

  if (!name || !version || !type) {
    return res.json({ success: false, error: "Missing fields." });
  }

  try {
    const id = Date.now().toString();
    const dir = path.join(__dirname, "servers", id);

    fs.mkdirSync(dir, { recursive: true });

    console.log("⬇️ Downloading server.jar for", version);

    const jarUrl = await getServerJarUrl(version);

    await downloadFile(
      jarUrl,
      path.join(dir, "server.jar")
    );

    console.log("✅ server.jar downloaded");

    fs.writeFileSync(
      path.join(dir, "eula.txt"),
      "eula=true\n"
    );

    servers[id] = {
      id,
      name,
      version,
      type,
      status: "stopped",
      dir
    };

    saveServers();

    console.log("📦 Created server:", name, version, type);

    res.json({ success: true, id });

  } catch (err) {
    console.error("❌ Server creation failed:", err);
    res.json({
      success: false,
      error: err.message
    });
  }
});

// LIST
app.get("/api/server/list", (req, res) => {
  res.json(Object.values(servers));
});

// DELETE
app.delete("/api/server/:id", (req, res) => {
  const id = req.params.id;
  if (!servers[id]) return res.json({ success: false, error: "Not found." });
  // Stop if running
  if (processes[id]) {
    processes[id].kill();
    delete processes[id];
  }
  const dir = servers[id].dir;
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  delete servers[id];
  delete terminalLogs[id];
  saveServers();
  console.log("🗑 Deleted server:", id);
  res.json({ success: true });
});

// START
app.post("/api/server/:id/start", (req, res) => {
  const id = req.params.id;
  const server = servers[id];
  if (!server) return res.json({ success: false, error: "Server not found." });
  if (processes[id]) return res.json({ success: false, error: "Already running." });

  const dir = server.dir || path.join(__dirname, "servers", id);
  const jar = path.join(dir, "server.jar");

  if (!fs.existsSync(jar)) {
    return res.json({ success: false, error: "server.jar not found in server folder. Download it first." });
  }

  const proc = spawn("java", ["-Xmx1G", "-Xms512M", "-jar", "server.jar", "nogui"], {
    cwd: dir, stdio: ["pipe", "pipe", "pipe"]
  });

  processes[id] = proc;
  terminalLogs[id] = [];
  servers[id].status = "running";
  saveServers();

  const log = (line) => {
    const entry = "[" + new Date().toTimeString().slice(0,8) + "] " + line;
    terminalLogs[id] = terminalLogs[id] || [];
    terminalLogs[id].push(entry);
    if (terminalLogs[id].length > 200) terminalLogs[id].shift();
    console.log("[" + server.name + "]", line);
  };

  proc.stdout.on("data", d => d.toString().split("\n").filter(Boolean).forEach(log));
  proc.stderr.on("data", d => d.toString().split("\n").filter(Boolean).forEach(log));
  proc.on("close", () => {
    delete processes[id];
    if (servers[id]) { servers[id].status = "stopped"; saveServers(); }
    console.log("⏹ Server stopped:", id);
  });

  console.log("▶ Started server:", server.name);
  res.json({ success: true });
});

// STOP
app.post("/api/server/:id/stop", (req, res) => {
  const id = req.params.id;
  if (!processes[id]) return res.json({ success: false, error: "Not running." });
  processes[id].stdin.write("stop\n");
  setTimeout(() => {
    if (processes[id]) { processes[id].kill(); delete processes[id]; }
    if (servers[id]) { servers[id].status = "stopped"; saveServers(); }
  }, 5000);
  res.json({ success: true });
});

// ===================================================
// TERMINAL
// ===================================================
app.post("/api/terminal/command", (req, res) => {
  const { id, command } = req.body;
  if (!id || !command) return res.json({ success: false, error: "Missing id or command." });
  if (!processes[id]) return res.json({ success: false, error: "Server is not running." });
  processes[id].stdin.write(command + "\n");
  console.log("💬 Command [" + id + "]:", command);
  res.json({ success: true, message: "Command sent: " + command });
});

app.get("/api/terminal/logs/:id", (req, res) => {
  const logs = terminalLogs[req.params.id] || [];
  res.json({ logs });
});

// ===================================================
// STATS
// ===================================================
app.get("/api/stats", (req, res) => {
  const total   = Object.keys(servers).length;
  const running = Object.values(servers).filter(s => s.status === "running").length;
  res.json({ total, running, uptime: Math.floor(process.uptime()) });
});

// ===================================================
// START
// ===================================================
app.listen(3000, () => {
  console.log("✅ Panel running at http://localhost:3000");
  console.log("📁 Servers saved to ./servers.json");
  console.log("👤 Users loaded from ./Users.json");
});
