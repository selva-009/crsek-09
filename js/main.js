/* Crsek-09 — client wiring: lobby, networking glue, role-aware touch controls. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const app = {
    name: '', pid: '', isHost: false, net: null, runner: null,
    state: null, lobby: [], format: 2, overs: 5, mode: null,
    code: '', role: null, ctrlSig: '', stick: { x: 0, y: 0, on: false },
    selLength: 'good', selType: 'pace', meterStart: 0, flightStart: 0,
    lastMoveSent: 0, view: null, chatOpen: false
  };

  function pid() {
    let p = sessionStorage.getItem('crsek09_pid');
    if (!p) { p = 'p' + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('crsek09_pid', p); }
    return p;
  }
  app.pid = pid();
  app.name = localStorage.getItem('crsek09_name') || '';

  // ---------- tiny audio ----------
  let actx = null;
  function blip(freq, dur, type) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (dur || 0.12));
      o.stop(actx.currentTime + (dur || 0.12));
    } catch (e) {}
  }

  // ---------- screens ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = $('screen-' + id);
    if (el) el.classList.add('active');
    if (id === 'match' && app.view) setTimeout(() => app.view.resize(), 30);
  }

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms || 2000);
  }

  function flash(text) {
    const f = $('flash');
    f.textContent = text;
    f.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => f.classList.remove('show'), 1500);
  }

  // ---------- name screen ----------
  if (app.name) $('nameInput').value = app.name;
  $('nameGo').onclick = () => {
    const v = $('nameInput').value.trim().slice(0, 14);
    if (!v) { $('nameInput').focus(); return; }
    app.name = v;
    localStorage.setItem('crsek09_name', v);
    $('whoami').textContent = v;
    show('home');
  };
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nameGo').click(); });

  // ---------- home ----------
  $('formatSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    app.format = parseInt(b.dataset.f, 10);
    [...$('formatSeg').children].forEach((c) => c.classList.toggle('on', c === b));
  });
  $('oversSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    app.overs = parseInt(b.dataset.o, 10);
    [...$('oversSeg').children].forEach((c) => c.classList.toggle('on', c === b));
  });

  $('helpBtn').onclick = () => $('help').classList.remove('hidden');
  $('helpClose').onclick = () => $('help').classList.add('hidden');

  // ---------- networking ----------
  function freshNet() {
    if (app.net) app.net.destroy();
    app.net = new Net();
    app.net.on('msg', onMsg);
    app.net.on('peerJoin', onPeerJoin);
    app.net.on('peerLeave', onPeerLeave);
    app.net.on('disconnected', () => banner('Lost connection to the host.'));
    return app.net;
  }

  function banner(text) {
    const b = $('netBanner');
    b.textContent = text;
    b.classList.remove('hidden');
    setTimeout(() => b.classList.add('hidden'), 6000);
  }

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }

  // ----- create room -----
  $('createBtn').onclick = () => {
    app.mode = 'host';
    freshNet();
    const code = makeCode();
    app.code = code;
    app.net.hostRoom(code, (err) => {
      if (err) {
        banner(err.message);
        if (app.net) app.net.destroy();
        app.net = null; app.isHost = false;
        return;
      }
      app.isHost = true;
      app.lobby = [{ pid: app.pid, name: app.name, peerId: 'self', bot: false }];
      $('roomCode').textContent = code;
      $('roomMeta').textContent = app.format === 1 ? 'Solo' : app.format === 2 ? 'Duo' : 'Squad';
      renderRoster();
      show('room');
    });
  };

  // ----- join room -----
  $('joinBtn').onclick = () => {
    const code = (prompt('Enter the 4-letter room code') || '').trim().toUpperCase();
    if (!code) return;
    joinRoom(code);
  };

  function joinRoom(code) {
    app.mode = 'guest';
    freshNet();
    app.code = code;
    toast('Joining ' + code + '…');
    app.net.joinRoom(code, (err, hostPeer) => {
      if (err) { banner('Could not join ' + code + '. Check the code and try again.'); return; }
      $('roomCode').textContent = code;
      $('roomMeta').textContent = 'Joining…';
      show('room');
      app.net.send(hostPeer, { t: 'hello', name: app.name, pid: app.pid });
    });
  }

  // ----- quick match: join if a public game exists, else host one -----
  $('quickBtn').onclick = () => {
    app.mode = 'quick';
    show('queue');
    $('queueTitle').textContent = 'Finding a match…';
    $('queueSub').textContent = 'Scanning public games.';
    freshNet();
    app.net.joinPublic((err, slot) => {
      if (!err) {
        $('queueTitle').textContent = 'Match found';
        $('queueSub').textContent = 'Joining…';
        const hostPeer = app.net.hostPeerId();
        if (hostPeer) app.net.send(hostPeer, { t: 'hello', name: app.name, pid: app.pid });
        return;
      }
      // nobody hosting -> become the host of a public slot
      $('queueTitle').textContent = 'Hosting a public game…';
      $('queueSub').textContent = 'Waiting for a real player to join.';
      freshNet();
      app.net.hostPublicSlot((err2, slot2) => {
        if (err2) { $('queueTitle').textContent = 'No match available'; $('queueSub').textContent = err2.message; return; }
        app.isHost = true;
        app.mode = 'quick-host';
        app.lobby = [{ pid: app.pid, name: app.name, peerId: 'self', bot: false }];
        $('queueTitle').textContent = 'Hosting a public game…';
        $('queueSub').textContent = 'Waiting for a real player to join. Match starts automatically.';
      });
    });
  };

  $('queueCancel').onclick = () => {
    if (app.net) app.net.destroy();
    app.net = null; app.isHost = false;
    show('home');
  };

  // ----- practice -----
  $('practiceBtn').onclick = () => {
    app.mode = 'practice';
    app.isHost = true;
    app.net = null;
    startMatchWithBots();
  };

  function startMatchWithBots() {
    const per = Math.max(3, app.format + 2);
    const teams = [
      { name: 'You', players: [{ id: app.pid, name: app.name, bot: false }] },
      { name: 'Bots', players: [] }
    ];
    for (let i = 1; i < per; i++) teams[0].players.push({ id: 'botA' + i, name: 'Ally ' + i, bot: true });
    for (let i = 0; i < per; i++) teams[1].players.push({ id: 'botB' + i, name: 'Bot ' + (i + 1), bot: true });
    bootRunner(teams);
  }

  function bootRunner(teams) {
    if (app.runner) { try { app.runner.stop(); } catch (e) {} }
    app.state = null;
    app.runner = new Engine.MatchRunner(
      { format: app.format, overs: app.overs, teams: teams, code: app.code, forceBatFirst: app.mode === 'practice' },
      emit
    );
    show('match');
    app.runner.start();
    $('roleBanner').textContent = 'Coin toss…';
  }

  function emit(type, payload) {
    if (type === 'state') {
      app.state = payload;
      if (app.isHost && app.net) app.net.broadcast({ t: 'state', s: payload });
      onState();
    } else {
      if (app.isHost && app.net) app.net.broadcast({ t: 'evt', type: type, payload: payload });
      handleEvent(type, payload);
    }
  }

  // ---------- host-side lobby ----------
  function onPeerJoin({ peerId }) {
    if (!app.isHost) return;
    // wait for hello; nothing else to do yet
  }

  function onPeerLeave({ peerId }) {
    if (!app.isHost) return;
    const gone = app.lobby.find((p) => p.peerId === peerId);
    if (gone) {
      app.lobby = app.lobby.filter((p) => p.peerId !== peerId);
      renderRoster();
      toast(gone.name + ' left the room');
      if (app.runner) { /* engine keeps their slot; a bot does not take over mid-match in this build */ }
    }
  }

  function addPlayer(peerId, name, theirPid) {
    if (app.lobby.some((p) => p.pid === theirPid)) return;
    const cap = Math.max(2, app.format) * 2;
    if (app.lobby.length >= cap) {
      app.net.send(peerId, { t: 'full' });
      return;
    }
    app.lobby.push({ pid: theirPid, name: name || 'Player', peerId: peerId, bot: false });
    app.net.send(peerId, { t: 'welcome', pid: theirPid, code: app.code, format: app.format, overs: app.overs });
    app.net.send(peerId, { t: 'lobby', lobby: app.lobby });
    app.net.broadcast({ t: 'lobby', lobby: app.lobby });
    renderRoster();
    toast(name + ' joined');

    // public matchmaking: start as soon as we have a real opponent
    if (app.mode === 'quick-host' || app.mode === 'quick') {
      if (app.lobby.length >= 2) hostStart();
    }
  }

  function renderRoster() {
    const per = Math.max(2, app.format);
    const rows = [];
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < per; i++) {
        const idx = team * per + i;
        const p = app.lobby[idx];
        const isMe = p && p.pid === app.pid;
        rows.push('<div class="roster-row' + (isMe ? ' me' : '') + '">' +
          '<span class="team-tag">' + (team === 0 ? 'A' : 'B') + '</span>' +
          '<span>' + (p ? escapeHtml(p.name) : '<span style="color:#5d7a6b">Open slot</span>') + '</span>' +
          '<span class="pill">' + (p ? (isMe ? 'you' : 'ready') : 'bot') + '</span></div>');
      }
    }
    $('roster').innerHTML = rows.join('');
    $('roomHint').textContent = app.lobby.length + ' player' + (app.lobby.length === 1 ? '' : 's') +
      ' in the room. Empty slots become bots.';
    $('startBtn').style.display = app.isHost ? '' : 'none';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  $('copyBtn').onclick = async () => {
    const url = location.origin + location.pathname + '?room=' + app.code;
    try {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied');
    } catch (e) {
      prompt('Copy this invite link', url);
    }
  };
  $('roomBack').onclick = () => {
    if (app.net) app.net.destroy();
    app.net = null; app.isHost = false;
    show('home');
  };

  $('startBtn').onclick = () => hostStart();

  function hostStart() {
    const per = Math.max(3, app.format + 2);   // batters per side (humans bat first)
    const humans = app.lobby.slice(0, Math.max(2, app.format) * 2);
    const teams = [
      { name: 'Squad A', players: [] },
      { name: 'Squad B', players: [] }
    ];
    humans.forEach((h, i) => {
      teams[i % 2].players.push({ id: h.pid, name: h.name, bot: false });
    });
    let botN = 1;
    teams.forEach((t) => {
      while (t.players.length < per) {
        t.players.push({ id: 'bot-' + (botN), name: 'Bot ' + botN, bot: true });
        botN++;
      }
    });
    if (app.net) app.net.broadcast({ t: 'start', format: app.format, overs: app.overs, code: app.code });
    bootRunner(teams);
  }

  // ---------- message router ----------
  function onMsg({ peerId, data }) {
    if (app.isHost) {
      if (data.t === 'hello') addPlayer(peerId, data.name, data.pid);
      else if (data.t === 'intent') applyIntent(data.pid, data.a, data);
      else if (data.t === 'chat') {
        app.net.broadcast({ t: 'chat', name: data.name, text: data.text });
        toast(data.name + ': ' + data.text);
      }
    } else {
      if (data.t === 'state') { app.state = data.s; onState(); }
      else if (data.t === 'evt') handleEvent(data.type, data.payload);
      else if (data.t === 'welcome') {
        app.myPidHost = data.pid; app.format = data.format; app.overs = data.overs;
      } else if (data.t === 'lobby') {
        app.lobby = data.lobby;
        $('roomCode').textContent = app.code;
        $('roomMeta').textContent = data.lobby.length + ' in room';
        renderRoster();
        if ($('screen-room').classList.contains('active') === false) show('room');
      } else if (data.t === 'start') {
        app.format = data.format; app.overs = data.overs;
        show('match');
      } else if (data.t === 'full') {
        banner('That room is full.');
      } else if (data.t === 'chat') {
        toast(data.name + ': ' + data.text);
      }
    }
  }

  function applyIntent(playerPid, a, p) {
    if (!app.runner) return;
    switch (a) {
      case 'delivery': app.runner.setDelivery(playerPid, { line: p.line, length: p.length, type: p.type, release: p.release }); break;
      case 'shot': app.runner.setShot(playerPid, { dir: p.dir, type: p.type }); break;
      case 'move': app.runner.fielderInput(playerPid, { x: p.x, y: p.y }); break;
      case 'action': app.runner.fielderAction(playerPid, p.kind); break;
      case 'run': app.runner.callRun(playerPid); break;
      case 'bat': if (app.runner.captainId === playerPid) app.runner.chooseBat(!!p.bat); break;
    }
  }

  function sendIntent(a, payload) {
    const body = Object.assign({ t: 'intent', a: a, pid: app.pid }, payload || {});
    if (app.isHost) applyIntent(app.pid, a, body);
    else if (app.net) app.net.send(app.net.hostPeerId(), body);
  }

  // ---------- match events ----------
  function handleEvent(type, p) {
    if (type === 'delivery') {
      app.flightStart = performance.now();
      blip(420, 0.08, 'triangle');
    } else if (type === 'shot') {
      blip(180, 0.09, 'square');
    } else if (type === 'result') {
      flash(p.text);
      if (p.kind === 'six' || p.kind === 'four') blip(680, 0.16, 'sine');
      else if (p.wicket) blip(120, 0.22, 'sawtooth');
    } else if (type === 'inningsBreak') {
      toast('Innings break — target ' + p.target, 3200);
    } else if (type === 'matchEnd') {
      showResult(p);
    }
  }

  function showResult(r) {
    $('resultTitle').textContent = r.text;
    const me = app.state ? teamOfMe() : null;
    $('resultGrid').innerHTML = r.teams.map((t, i) =>
      '<div class="result-row' + (r.winner === i ? ' win' : '') + '"><span>' + escapeHtml(t.name) + '</span><span>' +
      t.r + '/' + t.w + ' (' + Math.floor(t.balls / 6) + '.' + (t.balls % 6) + ')</span></div>'
    ).join('');
    show('result');
  }

  function teamOfMe() {
    if (!app.state) return null;
    return app.state.teams.findIndex((t) => t.players.some((p) => p.id === app.pid));
  }

  $('againBtn').onclick = () => {
    if (app.isHost) {
      if (app.mode === 'practice') startMatchWithBots();
      else if (app.lobby.length) hostStart();
    } else {
      show('home');
    }
  };
  $('homeBtn').onclick = () => {
    if (app.runner) { try { app.runner.stop(); } catch (e) {} }
    app.runner = null; app.state = null;
    if (app.net) app.net.destroy();
    app.net = null; app.isHost = false;
    show('home');
  };

  // ---------- role logic ----------
  function myRole(st) {
    if (!st) return 'none';
    const myTeam = st.teams.findIndex((t) => t.players.some((p) => p.id === app.pid));
    if (myTeam === -1) return 'spectator';
    if (st.phase === 'done') return 'done';
    if (st.phase === 'toss') return st.captainId === app.pid ? 'captain' : 'toss';
    if (myTeam === st.batTeam) {
      if (st.strikerId === app.pid) return 'bat';
      if (st.nonStrikerId === app.pid) return 'nonstriker';
      return 'waitbat';
    }
    if (st.bowlerId === app.pid) return 'bowl';
    const f = (st.fielders || []).find((x) => x.ownerId === app.pid);
    if (f) return 'field';
    return 'waitfield';
  }

  function onState() {
    const st = app.state;
    if (!st) return;
    updateHUD(st);
    const role = myRole(st);
    if (role !== app.role) { app.role = role; renderControls(role, st); }
    if (role === 'captain') {
      $('tossOverlay').classList.remove('hidden');
      $('tossSub').textContent = 'You won the toss. Bat or bowl?';
    } else {
      $('tossOverlay').classList.add('hidden');
    }
    if (role === 'bowl' && st.phase === 'delivery' && !app.meterStart) app.meterStart = performance.now();
    if (st.phase !== 'delivery') app.meterStart = 0;
    updateBanner(role, st);
  }

  function updateBanner(role, st) {
    const b = $('roleBanner');
    b.className = 'role-banner';
    const map = {
      bat: ['bat', 'You are batting'],
      nonstriker: ['bat', 'Non-striker — call the run'],
      waitbat: ['bat', 'Waiting to bat — ' + (st.batOrder ? st.batOrder.filter((x) => !x.out).length : '') + ' in the shed'],
      bowl: ['bowl', 'You are bowling'],
      field: ['field', 'Fielding — ' + (fieldName(st) || '')],
      waitfield: ['field', 'Fielding — waiting'],
      captain: ['bat', 'Toss — your call'],
      toss: ['', 'Coin toss'],
      done: ['', 'Match over']
    };
    const m = map[role] || ['', 'Waiting…'];
    if (m[0]) b.classList.add(m[0]);
    b.textContent = m[1];
  }

  function fieldName(st) {
    const f = (st.fielders || []).find((x) => x.ownerId === app.pid);
    return f ? f.name : '';
  }

  function updateHUD(st) {
    const bt = st.teams[st.batTeam];
    const ov = Math.floor(st.balls / 6) + '.' + (st.balls % 6);
    $('scoreLine').textContent = bt.score.r + '/' + bt.score.w;
    $('overLine').textContent = ov + ' / ' + st.overs;
    if (st.target) {
      const need = st.target - bt.score.r;
      const ballsLeft = st.overs * 6 - st.balls;
      $('reqLine').textContent = need > 0 ? 'Need ' + need + ' off ' + ballsLeft : 'Target reached';
    } else $('reqLine').textContent = '';
    const s = bt.players.find((p) => p.id === st.strikerId);
    const ns = bt.players.find((p) => p.id === st.nonStrikerId);
    $('batterLine').textContent = s ? s.name + ' ' + s.r + ' (' + s.b + ')' : '—';
    $('bowlerLine').textContent = st.bowlerName ? st.bowlerName : '—';
    $('overDots').innerHTML = (st.thisOver || []).map((d) =>
      '<span class="' + (d === 'W' ? 'w' : d === '4' || d === '6' ? 'b' : '') + '">' + d + '</span>'
    ).join('');
  }

  // ---------- controls ----------
  const SHOT_BTNS = [
    ['drive', 'Drive', 'along the ground'],
    ['loft', 'Loft', 'over the top'],
    ['pull', 'Pull', 'across the line'],
    ['sweep', 'Sweep', 'behind square'],
    ['defend', 'Defend', 'safe']
  ];

  function renderControls(role, st) {
    const pad = $('pad'), btns = $('buttons');
    const sig = role + ':' + st.phase;
    if (app.ctrlSig === sig) return;
    app.ctrlSig = sig;

    if (role === 'bat') {
      pad.classList.remove('hidden');
      btns.className = 'btns';
      btns.innerHTML = SHOT_BTNS.map(([k, l, s]) =>
        '<button class="gbtn" data-shot="' + k + '">' + l + '<small>' + s + '</small></button>'
      ).join('') + '<button class="gbtn" data-act="run">RUN<small>+1 risky</small></button>';
    } else if (role === 'nonstriker') {
      pad.classList.add('hidden');
      btns.className = 'btns';
      btns.innerHTML = '<button class="gbtn big hot" data-act="run">CALL THE RUN<small>press while the ball is live</small></button>';
    } else if (role === 'bowl') {
      pad.classList.remove('hidden');
      btns.className = 'btns';
      btns.innerHTML =
        '<button class="gbtn" data-len="yorker">Yorker</button>' +
        '<button class="gbtn" data-len="full">Full</button>' +
        '<button class="gbtn" data-len="good">Good</button>' +
        '<button class="gbtn" data-len="short">Short</button>' +
        '<button class="gbtn" data-type="cycle">' + app.selType.toUpperCase() + '<small>tap to change</small></button>' +
        '<button class="gbtn big hot" data-act="release">RELEASE<small>stop it in the green</small></button>';
      markSel();
    } else if (role === 'field') {
      pad.classList.remove('hidden');
      btns.className = 'btns';
      btns.innerHTML =
        '<button class="gbtn" data-act="catch">CATCH<small>when it is near</small></button>' +
        '<button class="gbtn" data-act="dive">DIVE<small>extend reach</small></button>';
    } else if (role === 'captain') {
      pad.classList.add('hidden');
      btns.innerHTML = '';
      $('tossOverlay').classList.remove('hidden');
    } else {
      pad.classList.add('hidden');
      btns.className = 'btns';
      btns.innerHTML = '<button class="gbtn" data-act="score">SCORECARD</button>' +
        '<button class="gbtn" data-act="chat">QUICK CHAT</button>';
    }
    if (role === 'bat' || role === 'nonstriker' || role === 'field' || role === 'bowl') {
      $('scorecardBtn').style.display = '';
    }
  }

  function markSel() {
    document.querySelectorAll('[data-len]').forEach((b) => b.classList.toggle('sel', b.dataset.len === app.selLength));
  }

  $('tossBat').onclick = () => { sendIntent('bat', { bat: true }); $('tossOverlay').classList.add('hidden'); };
  $('tossBowl').onclick = () => { sendIntent('bat', { bat: false }); $('tossOverlay').classList.add('hidden'); };

  $('buttons').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shot) {
      const dir = stickDir();
      sendIntent('shot', { type: b.dataset.shot, dir: dir });
      blip(300, 0.05, 'square');
      return;
    }
    if (b.dataset.len) { app.selLength = b.dataset.len; markSel(); return; }
    if (b.dataset.type) {
      const types = ['pace', 'swing', 'spin', 'slower'];
      app.selType = types[(types.indexOf(app.selType) + 1) % types.length];
      b.childNodes[0].nodeValue = app.selType.toUpperCase();
      return;
    }
    const act = b.dataset.act;
    if (act === 'release') doRelease();
    else if (act === 'run') sendIntent('run', {});
    else if (act === 'catch') sendIntent('action', { kind: 'catch' });
    else if (act === 'dive') sendIntent('action', { kind: 'dive' });
    else if (act === 'score') openScorecard();
    else if (act === 'chat') openChat();
  });

  function stickDir() {
    const s = app.stick;
    if (!s.on || (Math.abs(s.x) < 0.12 && Math.abs(s.y) < 0.12)) return 0;
    return clamp(Math.round((Math.atan2(s.x, -s.y) * 180) / Math.PI), -180, 180);
  }

  function doRelease() {
    const m = meterValue();
    sendIntent('delivery', { line: clamp(app.stick.x, -1, 1), length: app.selLength, type: app.selType, release: m });
  }

  function meterValue() {
    if (!app.meterStart) return 0.3;
    const t = (performance.now() - app.meterStart) / 1000;
    return (Math.sin(t * 3.4) + 1) / 2;   // sweeps 0..1, sweet spot near 0.55
  }

  // ---------- joystick ----------
  (function initPad() {
    const pad = $('pad'), nub = $('nub');
    let rect = null, active = false;

    function start(e) {
      active = true;
      rect = pad.getBoundingClientRect();
      move(e);
    }
    function move(e) {
      if (!active) return;
      const t = e.touches ? e.touches[0] : e;
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const max = rect.width / 2 - 8;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      app.stick.x = dx / max;
      app.stick.y = dy / max;
      app.stick.on = true;
      e.preventDefault();
    }
    function end() {
      active = false;
      nub.style.transform = 'translate(0,0)';
      app.stick.x = 0; app.stick.y = 0; app.stick.on = false;
    }
    pad.addEventListener('touchstart', start, { passive: false });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end);
    pad.addEventListener('touchcancel', end);
    pad.addEventListener('mousedown', (e) => { start(e); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (active) move(e); });
    window.addEventListener('mouseup', () => { if (active) end(); });
  })();

  // ---------- meter element ----------
  const meter = document.createElement('div');
  meter.className = 'meter hidden';
  meter.innerHTML = '<div class="zone"></div><div class="fill"></div><div class="mark"></div>';
  $('screen-match').appendChild(meter);

  // ---------- render loop ----------
  function loop() {
    requestAnimationFrame(loop);
    if (app.view && app.state) View.render(app.view, app.state, app.pid);

    const st = app.state;
    if (!st) { meter.classList.add('hidden'); return; }

    if (st.phase === 'delivery' && app.role === 'bowl') {
      meter.classList.remove('hidden');
      const v = meterValue();
      meter.querySelector('.mark').style.left = (v * 100) + '%';
      meter.querySelector('.fill').style.width = (v * 100) + '%';
    } else if (st.phase === 'flight' && app.role === 'bat') {
      meter.classList.remove('hidden');
      const t = (performance.now() - app.flightStart) / 1000;
      const p = clamp(t / 0.9, 0, 1);
      meter.querySelector('.mark').style.left = (p * 100) + '%';
      meter.querySelector('.fill').style.width = (p * 100) + '%';
      meter.querySelector('.zone').style.left = '52%';
      meter.querySelector('.zone').style.width = '16%';
    } else if (st.phase === 'delivery' && app.role === 'bat') {
      meter.classList.add('hidden');
    } else {
      meter.classList.add('hidden');
    }

    // fielder movement intents
    if (app.role === 'field' && app.stick.on && (st.phase === 'inplay' || st.phase === 'flight')) {
      const now = performance.now();
      if (now - app.lastMoveSent > 70) {
        app.lastMoveSent = now;
        sendIntent('move', { x: app.stick.x * 0.55, y: app.stick.y * 0.55 });
      }
    }
  }

  // ---------- scorecard ----------
  function openScorecard() {
    const st = app.state;
    if (!st) return;
    let html = '';
    st.teams.forEach((t, i) => {
      const active = i === st.batTeam;
      html += '<div class="sc-head"><div><div class="fine">' + escapeHtml(t.name) + '</div>' +
        '<div class="big">' + t.score.r + '/' + t.score.w + '</div></div>' +
        '<div class="fine">' + Math.floor(t.score.balls / 6) + '.' + (t.score.balls % 6) + ' ov' +
        (active ? ' • batting' : '') + '</div></div>';
      html += '<table class="sc-table"><tr><th>Batter</th><th class="n">R</th><th class="n">B</th><th class="n">4s</th><th class="n">6s</th><th class="n">SR</th></tr>';
      t.players.forEach((p) => {
        const sr = p.b ? Math.round((p.r / p.b) * 100) : 0;
        html += '<tr><td>' + escapeHtml(p.name) + (p.out ? ' <span class="fine">' + escapeHtml(p.how || 'out') + '</span>' : ' <span class="fine">not out</span>') +
          '</td><td class="n">' + p.r + '</td><td class="n">' + p.b + '</td><td class="n">' + p.fours +
          '</td><td class="n">' + p.sixes + '</td><td class="n">' + sr + '</td></tr>';
      });
      html += '</table>';
      const bowlers = t.players.filter((p) => p.bBalls > 0);
      if (bowlers.length) {
        html += '<table class="sc-table"><tr><th>Bowler</th><th class="n">O</th><th class="n">R</th><th class="n">W</th><th class="n">Econ</th></tr>';
        bowlers.forEach((p) => {
          const ec = p.bBalls ? (p.bRuns / (p.bBalls / 6)).toFixed(1) : '0.0';
          html += '<tr><td>' + escapeHtml(p.name) + '</td><td class="n">' + Math.floor(p.bBalls / 6) + '.' + (p.bBalls % 6) +
            '</td><td class="n">' + p.bRuns + '</td><td class="n">' + p.bWkts + '</td><td class="n">' + ec + '</td></tr>';
        });
        html += '</table>';
      }
      html += '<div style="height:10px"></div>';
    });
    html += '<button class="btn wide" id="scClose">Close</button>';
    $('scorecardInner').innerHTML = html;
    $('scorecard').classList.remove('hidden');
    $('scClose').onclick = () => $('scorecard').classList.add('hidden');
  }

  $('scorecardBtn').onclick = openScorecard;

  // ---------- chat ----------
  const CHAT = ['Nice shot!', 'Well bowled', 'Take one', 'Your call', "I'm next", 'Watch the slower ball'];
  function openChat() {
    $('chatGrid').innerHTML = CHAT.map((c) => '<button class="btn" data-c="' + c + '">' + c + '</button>').join('') +
      '<button class="btn ghost" id="chatClose">Close</button>';
    $('chatSheet').classList.remove('hidden');
    $('chatClose').onclick = () => $('chatSheet').classList.add('hidden');
    $('chatGrid').querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => {
        const text = b.dataset.c;
        if (app.isHost && app.net) {
          app.net.broadcast({ t: 'chat', name: app.name, text: text });
          toast(app.name + ': ' + text);
        } else if (app.net) {
          app.net.send(app.net.hostPeerId(), { t: 'chat', name: app.name, text: text });
        } else toast(app.name + ': ' + text);
        $('chatSheet').classList.add('hidden');
      };
    });
  }
  $('chatBtn').onclick = openChat;

  // ---------- boot ----------
  app.view = View.makeView($('pitch'));
  if (app.name) { $('whoami').textContent = app.name; show('home'); }

  // deep link ?room=CODE
  const params = new URLSearchParams(location.search);
  const deep = params.get('room');
  if (deep) {
    if (app.name) joinRoom(deep.toUpperCase());
    else {
      $('nameGo').addEventListener('click', () => setTimeout(() => joinRoom(deep.toUpperCase()), 50), { once: true });
    }
  }

  loop();
  // exposed for automated smoke tests and debugging
  app.joinRoom = joinRoom;
  app.hostStart = hostStart;
  app.startPractice = startMatchWithBots;
  window.__crsek = app;
})();
