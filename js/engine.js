/* Crsek-09 — authoritative cricket engine.
   Runs only on the host device. All match state, ball physics and rules live here.
   Clients send intents; the engine validates them against the current phase + role. */
(function (global) {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // Field spots in metres. Origin = centre of pitch. Batsman stands at (0, +10)
  // and faces -y (towards the bowler). Angle 0 = straight down the ground.
  const FIELD_SPOTS = [
    { key: 'keeper', name: 'Keeper', ang: 180, r: 13, keeper: true },
    { key: 'slip', name: 'Slip', ang: 158, r: 11 },
    { key: 'point', name: 'Point', ang: 112, r: 27 },
    { key: 'cover', name: 'Cover', ang: 78, r: 30 },
    { key: 'midoff', name: 'Mid-off', ang: 42, r: 25 },
    { key: 'midon', name: 'Mid-on', ang: -42, r: 25 },
    { key: 'midwicket', name: 'Mid-wicket', ang: -78, r: 30 },
    { key: 'squareleg', name: 'Square leg', ang: -112, r: 27 },
    { key: 'fineleg', name: 'Fine leg', ang: -158, r: 36 },
    { key: 'longon', name: 'Long-on', ang: -28, r: 50 },
    { key: 'longoff', name: 'Long-off', ang: 28, r: 50 },
    { key: 'deepcover', name: 'Deep cover', ang: 96, r: 52 },
    { key: 'deepmidwicket', name: 'Deep mid-wicket', ang: -96, r: 52 }
  ];

  const SHOTS = {
    drive: { power: 0.82, air: 0.05, risk: 0.03, label: 'Drive' },
    loft: { power: 1.16, air: 0.95, risk: 0.17, label: 'Loft' },
    pull: { power: 1.0, air: 0.32, risk: 0.11, label: 'Pull' },
    sweep: { power: 0.88, air: 0.2, risk: 0.08, label: 'Sweep' },
    defend: { power: 0.32, air: 0, risk: 0.01, label: 'Defend' }
  };

  const BOUNDARY = 66;
  const BATSMAN_POS = { x: 0, y: 10 };
  const BOWLER_POS = { x: 0, y: -10 };
  const STUMPS = { striker: { x: 0, y: 10 }, nonstriker: { x: 0, y: -10 } };
  const IDEAL_CONTACT = 0.60;
  const CONTACT_WINDOW = 0.30;

  function mkPlayer(o) {
    return {
      id: o.id, name: o.name, bot: !!o.bot, kit: o.kit || '#7fd1ae',
      r: 0, b: 0, fours: 0, sixes: 0, out: false, how: null,
      bBalls: 0, bRuns: 0, bWkts: 0
    };
  }

  class MatchRunner {
    constructor(cfg, emit) {
      this.emit = emit || function () {};
      this.format = cfg.format;
      this.overs = cfg.overs;
      this.code = cfg.code || '';
      this.phase = 'toss';
      this.timers = [];
      this.teams = cfg.teams.map((t, i) => ({
        name: t.name,
        idx: i,
        players: t.players.map(mkPlayer),
        score: { r: 0, w: 0, balls: 0, extras: 0 },
        battingOrder: t.players.map((p) => p.id)
      }));
      this.batTeam = 0;
      this.innings = 0;
      this.target = null;
      this.strikerIdx = 0;
      this.nonStrikerIdx = 1;
      this.bowlerIdx = 0;
      this.lastBowlerIdx = -1;
      this.balls = 0;
      this.thisOver = [];
      this.lastResult = null;
      this.ball = null;
      this.fielders = [];
      this.msg = 'Coin toss';
      this.tossWinner = Math.random() < 0.5 ? 0 : 1;
      this.captainId = null;
      this.result = null;
      this.forceBatFirst = !!cfg.forceBatFirst;
      this.pendingDelivery = null;
      this.pendingShot = null;
      this.ballStart = 0;
      this.freeHit = false;
      this.mom = null;
    }

    // ---------- helpers ----------
    bat() { return this.teams[this.batTeam]; }
    bowlTeam() { return this.teams[1 - this.batTeam]; }
    striker() { return this.bat().players[this.strikerIdx]; }
    nonStriker() { return this.bat().players[this.nonStrikerIdx]; }
    bowler() { return this.bowlTeam().players[this.bowlerIdx]; }
    playerById(id) {
      for (const t of this.teams) for (const p of t.players) if (p.id === id) return p;
      return null;
    }
    later(ms, fn) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
    stop() { this.clearTimers(); this.phase = 'done'; }

    // ---------- seat control (disconnect / reconnect) ----------
    setBot(playerId, isBot) {
      const p = this.playerById(playerId);
      if (!p) return false;
      p.bot = !!isBot;
      if (!isBot) p.left = false;
      this.broadcast();
      // a human taking over the strike should not be auto-played; a bot taking
      // over the strike must play the ball that is already in the air.
      const s = this.striker();
      if (s && s.id === playerId && isBot && (this.phase === 'flight')) this.botBat();
      const b = this.bowler();
      if (b && b.id === playerId && isBot && this.phase === 'delivery' && !this.pendingDelivery) {
        this.later(700, () => {
          if (this.phase === 'delivery' && !this.pendingDelivery) {
            this.setDelivery(playerId, { line: rand(-0.4, 0.4), length: 'good', type: 'pace', release: 0.5 });
          }
        });
      }
      return true;
    }

    // ---------- setup ----------
    start() {
      this.placeField();
      if (this.forceBatFirst) {
        this.tossWinner = 0;
        this.captainId = null;
        this.msg = 'You won the toss and will bat';
        this.broadcast();
        this.later(700, () => this.chooseBat(true));
        return;
      }
      this.msg = 'Toss won by ' + this.teams[this.tossWinner].name;
      const cap = this.teams[this.tossWinner].players.find((p) => !p.bot);
      this.captainId = cap ? cap.id : null;
      this.broadcast();
      if (!cap) this.later(1200, () => this.chooseBat(Math.random() < 0.5));
      else this.later(9000, () => { if (this.phase === 'toss') this.chooseBat(Math.random() < 0.5); });
    }

    chooseBat(batFirst) {
      if (this.phase !== 'toss') return;
      this.batTeam = batFirst ? this.tossWinner : 1 - this.tossWinner;
      this.beginInnings();
    }

    beginInnings() {
      this.clearTimers();
      const bt = this.bat();
      bt.score = { r: 0, w: 0, balls: 0, extras: 0 };
      bt.players.forEach((p) => { p.r = 0; p.b = 0; p.fours = 0; p.sixes = 0; p.out = false; p.how = null; });
      this.bowlTeam().players.forEach((p) => { p.bBalls = 0; p.bRuns = 0; p.bWkts = 0; });
      this.balls = 0;
      this.thisOver = [];
      this.freeHit = false;
      this.strikerIdx = 0;
      this.nonStrikerIdx = 1 % bt.players.length;
      this.lastBowlerIdx = -1;
      this.innings++;
      this.phase = 'ready';
      this.msg = this.innings === 1 ? 'Innings 1 begins' : 'Chasing ' + this.target + ' to win';
      this.pickBowler();
      this.placeField();
      this.broadcast();
      this.later(1000, () => this.deliverySetup());
    }

    pickBowler() {
      const bt = this.bowlTeam();
      const humans = [];
      bt.players.forEach((p, i) => { if (!p.bot) humans.push(i); });
      let chosen;
      if (humans.length) {
        const eligible = humans.filter((i) => i !== this.lastBowlerIdx);
        chosen = eligible.length ? pick(eligible) : humans[0];
      } else {
        chosen = Math.floor(Math.random() * bt.players.length);
      }
      this.bowlerIdx = chosen;
    }

    placeField() {
      const bt = this.bowlTeam();
      const humans = bt.players.filter((p) => !p.bot);
      this.fielders = FIELD_SPOTS.map((s) => ({
        key: s.key, name: s.name, keeper: !!s.keeper,
        x: Math.sin((s.ang * Math.PI) / 180) * s.r,
        y: BATSMAN_POS.y - Math.cos((s.ang * Math.PI) / 180) * s.r,
        ownerId: null, bot: true
      }));
      const free = this.fielders.filter((f) => !f.keeper).sort((a, b) => b.y - a.y);
      humans.forEach((p, i) => {
        const f = free[i % free.length];
        if (f) { f.ownerId = p.id; f.bot = false; f.name = p.name; f.kit = p.kit; }
      });
    }

    // ---------- ball cycle ----------
    deliverySetup() {
      if (this.phase === 'done') return;
      this.phase = 'delivery';
      this.pendingDelivery = null;
      this.pendingShot = null;
      this.ball = null;
      this.msg = 'Bowler runs in';
      this.broadcast();
      const b = this.bowler();
      if (!b) return;
      if (b.bot) {
        this.later(700, () => {
          const lengths = ['yorker', 'full', 'good', 'good', 'short'];
          this.setDelivery(b.id, {
            line: rand(-0.75, 0.75), length: pick(lengths),
            type: pick(['pace', 'swing', 'spin', 'slower']), release: rand(0.22, 0.88)
          });
        });
      } else {
        this.later(8000, () => {
          if (this.phase === 'delivery') this.setDelivery(b.id, { line: rand(-0.4, 0.4), length: 'good', type: 'pace', release: 0.3 });
        });
      }
    }

    setDelivery(playerId, d) {
      if (this.phase !== 'delivery') return;
      const bowler = this.bowler();
      if (!bowler || bowler.id !== playerId) return;
      const rel = clamp(d.release == null ? 0.3 : d.release, 0, 1);
      const acc = 1 - Math.abs(rel - 0.55) / 0.55;
      const overstep = rel < 0.1 || rel > 0.95;
      const wide = !overstep && (Math.abs(d.line) > 0.92 || acc < 0.2);
      this.pendingDelivery = {
        line: clamp(d.line || 0, -1, 1), length: d.length || 'good',
        type: d.type || 'pace', release: rel, accuracy: clamp(acc, 0, 1),
        wide: wide, noBall: overstep
      };
      this.phase = 'flight';
      this.ballStart = Date.now();
      this.ball = { x: BOWLER_POS.x, y: BOWLER_POS.y, z: 2, from: 'bowler' };
      this.emit('delivery', { bowlerId: playerId, d: this.pendingDelivery, t0: this.ballStart });
      this.broadcast();
      const s = this.striker();
      if (s && s.bot) this.botBat();
      this.later(1050, () => this.onArrival());
    }

    onArrival() {
      if (this.phase !== 'flight') return;
      const d = this.pendingDelivery;
      if (d && d.noBall) return this.finishBall({ kind: 'noball', runs: 1 });
      if (d && d.wide) return this.finishBall({ kind: 'wide', runs: 1 });
      const shot = this.pendingShot;
      if (!shot) {
        const atStumps = Math.abs(d.line) < 0.55 && ['yorker', 'full', 'good'].includes(d.length);
        if (atStumps) {
          const r = Math.random();
          if (r < 0.5) return this.finishBall({ kind: 'bowled', runs: 0 });
          if (r < 0.63) return this.finishBall({ kind: 'lbw', runs: 0 });
        }
        return this.finishBall({ kind: 'dot', runs: 0, text: 'Beaten!' });
      }
      this.startInPlay(shot);
    }

    setShot(playerId, s) {
      if (this.phase !== 'flight') return;
      const striker = this.striker();
      if (!striker || striker.id !== playerId) return;   // only the striker bats
      if (this.pendingShot) return;
      const t = (Date.now() - this.ballStart) / 1000;
      const shot = {
        type: SHOTS[s.type] ? s.type : 'drive',
        dir: clamp(s.dir || 0, -180, 180),
        t: t
      };
      shot.quality = clamp(1 - Math.abs(t - IDEAL_CONTACT) / CONTACT_WINDOW, 0, 1);
      this.pendingShot = shot;
      if (t > IDEAL_CONTACT + CONTACT_WINDOW) this.onArrival();
    }

    // Bot striker reads the delivery rather than swinging blind.
    botBat() {
      const s = this.striker();
      if (!s || !s.bot) return;
      const d = this.pendingDelivery || { length: 'good', line: 0 };
      let type;
      if (d.length === 'short') type = pick(['pull', 'pull', 'loft', 'drive']);
      else if (d.length === 'yorker') type = pick(['defend', 'drive', 'defend']);
      else if (d.length === 'full') type = pick(['drive', 'drive', 'loft', 'sweep']);
      else type = pick(['drive', 'drive', 'defend', 'pull', 'sweep']);
      const skill = 0.55 + Math.random() * 0.25;
      const good = Math.random() < skill;
      const t = good ? rand(0.53, 0.67) : rand(0.32, 0.95);
      const dir = pick([0, 0, 12, -12, 35, -35, 65, -65, 100, -100, 140, -140]);
      this.later(Math.max(120, t * 1000 - 40), () => {
        if (!this.pendingShot && this.phase === 'flight') this.setShot(s.id, { dir, type });
      });
    }

    startInPlay(shot) {
      this.phase = 'inplay';
      const d = this.pendingDelivery;
      const q = shot.quality;
      const def = SHOTS[shot.type];
      const power = def.power * (0.35 + 0.65 * q) * (0.85 + 0.3 * (d ? d.accuracy : 0.6));
      const dist = 12 + power * 58;
      const rad = (shot.dir * Math.PI) / 180;
      const landing = {
        x: BATSMAN_POS.x + Math.sin(rad) * dist,
        y: BATSMAN_POS.y - Math.cos(rad) * dist
      };
      const airborne = def.air > 0.5 || (def.air > 0.2 && q > 0.8 && Math.random() < 0.5);
      this.ball = {
        from: 'bat', x: BATSMAN_POS.x, y: BATSMAN_POS.y, z: 1.2,
        start: Date.now(), duration: clamp(dist / 45, 0.55, 1.3),
        landing, airborne, power, quality: q, shotType: shot.type, stopped: false,
        extraRuns: 0
      };
      if (q < 0.18) {
        this.ball.edge = true;
        this.ball.landing = { x: rand(-4, 4), y: BATSMAN_POS.y + rand(4, 12) };
        this.ball.duration = 0.7;
      }
      this.emit('shot', { strikerId: this.striker().id, shot: { type: shot.type, dir: shot.dir, quality: q }, ball: this.ball });
      this.broadcast();
      this.tickBall();
    }

    tickBall() {
      if (this.phase !== 'inplay' || !this.ball) return;
      const b = this.ball;
      const now = Date.now();
      const p = clamp((now - b.start) / (b.duration * 1000), 0, 1);
      b.x = BATSMAN_POS.x + (b.landing.x - BATSMAN_POS.x) * p;
      b.y = BATSMAN_POS.y + (b.landing.y - BATSMAN_POS.y) * p;
      b.z = b.airborne ? 1.2 + Math.sin(p * Math.PI) * (6 + b.power * 14) : 0.4;

      // AI fielders chase the ball
      this.fielders.forEach((f) => {
        if (f.ownerId) return;
        const dx = b.x - f.x, dy = b.y - f.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 0.4) {
          const step = (f.keeper ? 7.5 : 6.8) * 0.05;
          f.x += (dx / dd) * Math.min(step, dd);
          f.y += (dy / dd) * Math.min(step, dd);
        }
      });

      // catch check
      if (b.airborne && !b.caught && !b.heldBy) {
        for (const f of this.fielders) {
          const dd = Math.hypot(b.x - f.x, b.y - f.y);
          const reach = f.catchReach || 2.6;
          if (dd < reach) {
            const human = !f.bot;
            const success = human ? (f.catchPressed ? 0.94 : 0.0) : (0.5 + Math.min(0.32, (reach - dd) * 0.22));
            if (success > 0.4 && Math.random() < success) {
              b.caught = true;
              return this.finishBall({ kind: 'caught', runs: 0, fielder: f.name });
            }
          }
        }
      }
      // ground interception — remember who picked it up (they may throw it in)
      if (!b.airborne && !b.stopped) {
        for (const f of this.fielders) {
          const dd = Math.hypot(b.x - f.x, b.y - f.y);
          if (dd < (f.diveUntil > now ? 3.6 : 1.8)) {
            b.stopped = true;
            b.stoppedAt = { x: b.x, y: b.y };
            b.heldBy = f.ownerId || 'ai';
            b.heldByName = f.name;
            break;
          }
        }
      }
      // boundary
      if (Math.hypot(b.x, b.y) > BOUNDARY) {
        return this.finishBall({ kind: b.airborne ? 'six' : 'four', runs: b.airborne ? 6 : 4 });
      }
      if (b.edge && p >= 1 && !b.edgeDone) {
        b.edgeDone = true;
        const keeper = this.fielders.find((f) => f.keeper);
        const kd = keeper ? Math.hypot(b.x - keeper.x, b.y - keeper.y) : 99;
        if (kd < 4 && Math.random() < 0.5) return this.finishBall({ kind: 'caught', runs: 0, fielder: 'Keeper' });
        return this.finishBall({ kind: 'dot', runs: 0, text: 'Edged, no run' });
      }
      if ((b.stopped || p >= 1) && !b.edge) {
        if (!b.stopped) { b.stopped = true; b.stoppedAt = { x: b.x, y: b.y }; b.heldBy = 'ai'; }
        // a human fielder gets a window to throw the stumps down
        const humanHold = b.heldBy && b.heldBy !== 'ai';
        const settleFor = humanHold ? 1500 : 600;
        if (!b.settleAt) { b.settleAt = now + settleFor; this.broadcast(); }
        else if (now >= b.settleAt) return this.rollOut(b.stoppedAt || { x: b.x, y: b.y });
      }
      this.broadcast();
      this.later(50, () => this.tickBall());
    }

    rollOut(pos) {
      const d = Math.hypot(pos.x, pos.y);
      let runs = d < 20 ? 0 : d < 32 ? 1 : d < 46 ? 2 : 3;
      runs += this.ball.extraRuns || 0;
      if (this.ball.quality > 0.9 && runs < 3 && Math.random() < 0.35) runs += 1;
      if (runs >= 3 && Math.random() < 0.14) return this.finishBall({ kind: 'runout', runs: 0 });
      return this.finishBall({ kind: 'runs', runs: runs });
    }

    callRun(playerId) {
      if (this.phase !== 'inplay' || !this.ball) return;
      const s = this.striker(), ns = this.nonStriker();
      if (!s || !ns) return;
      if (playerId !== s.id && playerId !== ns.id) return;
      if ((this.ball.extraRuns || 0) >= 2) return;
      this.ball.extraRuns = (this.ball.extraRuns || 0) + 1;
      this.emit('run', { by: playerId });
    }

    fielderInput(playerId, mv) {
      const f = this.fielders.find((x) => x.ownerId === playerId);
      if (!f) return;
      if (this.phase !== 'inplay' && this.phase !== 'flight') return;
      f.x = clamp(f.x + mv.x, -70, 70);
      f.y = clamp(f.y + mv.y, -60, 80);
    }

    fielderAction(playerId, action, target) {
      const f = this.fielders.find((x) => x.ownerId === playerId);
      if (!f) return;
      if (action === 'catch') {
        f.catchPressed = true;
        this.later(700, () => { f.catchPressed = false; });
      }
      if (action === 'dive') {
        f.diveUntil = Date.now() + 700;
        f.catchReach = 3.6;
        this.later(750, () => { f.catchReach = 2.6; });
      }
      if (action === 'throw') this.throwAtStumps(playerId, target || 'striker');
      this.broadcast();
    }

    throwAtStumps(playerId, target) {
      if (this.phase !== 'inplay' || !this.ball || !this.ball.stopped) return;
      if (this.ball.heldBy !== playerId) return;
      const stumps = STUMPS[target] || STUMPS.striker;
      const pos = this.ball.stoppedAt || { x: this.ball.x, y: this.ball.y };
      const dist = Math.hypot(pos.x - stumps.x, pos.y - stumps.y);
      const runs = this.ball.extraRuns || 0;
      let chance = clamp(0.62 - dist / 90, 0.06, 0.55);
      if (runs >= 2) chance += 0.12;
      this.emit('throw', { by: playerId, target: target, hit: Math.random() < chance });
      if (Math.random() < chance) {
        return this.finishBall({ kind: 'runout', runs: runs, text: 'RUN OUT! Direct hit at the ' + (target === 'striker' ? "striker's" : "non-striker's") + ' end' });
      }
      this.ball.settleAt = Date.now() + 200;
    }

    // ---------- outcome ----------
    finishBall(res) {
      if (this.phase === 'result' || this.phase === 'done') return;
      this.clearTimers();
      this.phase = 'result';
      const bt = this.bat();
      const s = this.striker();
      const b = this.bowler();

      // no-ball: one extra, free hit next ball, the delivery is re-bowled
      if (res.kind === 'noball') {
        bt.score.r += 1; bt.score.extras += 1;
        if (b) b.bRuns += 1;
        this.freeHit = true;
        this.lastResult = { kind: 'noball', runs: 1, text: 'No ball! Free hit coming up', wicket: false, freeHit: true };
        this.emit('result', this.lastResult);
        this.broadcast();
        this.later(1300, () => { if (this.phase !== 'done') { this.phase = 'ready'; this.deliverySetup(); } });
        return;
      }
      // wide: one extra, re-bowled
      if (res.kind === 'wide') {
        bt.score.r += 1; bt.score.extras += 1;
        if (b) b.bRuns += 1;
        this.lastResult = { kind: 'wide', runs: 1, text: 'Wide — one extra, ball to be bowled again', wicket: false, freeHit: this.freeHit };
        this.emit('result', this.lastResult);
        this.broadcast();
        this.later(1200, () => { if (this.phase !== 'done') { this.phase = 'ready'; this.deliverySetup(); } });
        return;
      }

      let runs = res.runs || 0;
      let wicket = ['bowled', 'caught', 'runout', 'stumped', 'lbw'].includes(res.kind);

      // a free hit can only cost you a run out
      if (this.freeHit && wicket && res.kind !== 'runout') {
        wicket = false;
        runs = 0;
        res = { kind: 'dot', runs: 0, text: 'Free hit — no wicket can fall' };
      }
      this.freeHit = false;

      bt.score.balls += 1;
      this.balls += 1;
      s.b += 1;
      if (b) { b.bBalls += 1; b.bRuns += runs; }
      if (runs === 4) s.fours += 1;
      if (runs === 6) s.sixes += 1;
      s.r += runs;
      bt.score.r += runs;

      if (wicket) {
        bt.score.w += 1;
        s.out = true;
        s.how = res.kind === 'caught' ? 'c ' + (res.fielder || 'fielder')
          : res.kind === 'runout' ? 'run out'
          : res.kind === 'lbw' ? 'lbw b ' + (b ? b.name : '') : 'b ' + (b ? b.name : '');
        if (b && res.kind !== 'runout') b.bWkts += 1;
      }

      this.thisOver.push(res.kind === 'dot' ? '•' : wicket ? 'W' : String(runs));
      this.lastResult = {
        kind: res.kind, runs, text: res.text || this.resultText(res, s), wicket,
        batter: s.name, bowler: b ? b.name : '', freeHit: false
      };
      this.emit('result', this.lastResult);
      if (wicket || runs === 4 || runs === 6) this.emit('replay', { text: this.lastResult.text, kind: res.kind });
      this.broadcast();
      this.later(1200, () => this.afterBall(res));
    }

    resultText(res, s) {
      switch (res.kind) {
        case 'six': return 'SIX! ' + s.name + ' clears the rope';
        case 'four': return 'FOUR! Beautifully placed by ' + s.name;
        case 'caught': return 'CAUGHT by ' + (res.fielder || 'the fielder') + '! ' + s.name + ' has to go';
        case 'bowled': return 'BOWLED! ' + s.name + ' is cleaned up';
        case 'lbw': return 'LBW! ' + s.name + ' is trapped in front';
        case 'runout': return 'RUN OUT! Sharp work in the field';
        case 'dot': return res.text || 'No run';
        default: { const r = res.runs || 0; return r === 0 ? 'No run' : r + (r === 1 ? ' run' : ' runs'); }
      }
    }

    afterBall(res) {
      const bt = this.bat();
      const wicketsLeft = bt.players.length - bt.score.w;
      const targetReached = this.target != null && bt.score.r >= this.target;

      if (targetReached) return this.endMatch();
      if (wicketsLeft <= 1 || this.balls >= this.overs * 6) {
        if (this.innings === 1) return this.endInnings();
        return this.endMatch();
      }

      const runs = res.runs || 0;
      if (runs % 2 === 1) this.swapStrike();

      if (['bowled', 'caught', 'runout', 'stumped', 'lbw'].includes(res.kind)) {
        const nextIdx = this.nextAvailableBatter();
        if (nextIdx === -1) return this.endMatch();
        this.strikerIdx = nextIdx;
      }

      if (this.balls % 6 === 0) {
        this.swapStrike();
        this.thisOver = [];
        this.lastBowlerIdx = this.bowlerIdx;
        this.pickBowler();
        this.placeField();
        this.msg = 'End of over ' + Math.floor(this.balls / 6);
        this.broadcast();
        this.later(700, () => this.deliverySetup());
        return;
      }

      this.phase = 'ready';
      this.broadcast();
      this.later(300, () => this.deliverySetup());
    }

    nextAvailableBatter() {
      const bt = this.bat();
      for (let i = 0; i < bt.players.length; i++) {
        const p = bt.players[i];
        if (!p.out && i !== this.strikerIdx && i !== this.nonStrikerIdx) return i;
      }
      return -1;
    }

    swapStrike() {
      const t = this.strikerIdx;
      this.strikerIdx = this.nonStrikerIdx;
      this.nonStrikerIdx = t;
    }

    endInnings() {
      this.clearTimers();
      this.phase = 'break';
      this.target = this.bat().score.r + 1;
      this.msg = 'Innings break — target ' + this.target;
      this.emit('inningsBreak', { target: this.target });
      this.broadcast();
      this.later(2200, () => {
        this.batTeam = 1 - this.batTeam;
        this.beginInnings();
      });
    }

    endMatch() {
      this.clearTimers();
      this.phase = 'done';
      const t0 = this.teams[0].score, t1 = this.teams[1].score;
      let winner = null, text = '';
      if (this.target != null) {
        const chasing = this.batTeam;
        if (this.teams[chasing].score.r >= this.target) winner = chasing;
        else if (this.teams[chasing].score.r === this.target - 1) winner = null;
        else winner = 1 - chasing;
      } else if (t0.r > t1.r) winner = 0;
      else if (t1.r > t0.r) winner = 1;
      text = winner == null ? 'Match tied' : this.teams[winner].name + ' win';

      // player of the match: runs + 20 per wicket
      let best = null, bestVal = -1;
      this.teams.forEach((t) => t.players.forEach((p) => {
        const v = p.r + p.bWkts * 20;
        if (v > bestVal) { bestVal = v; best = p; }
      }));
      this.mom = best ? { name: best.name, r: best.r, w: best.bWkts } : null;

      this.result = {
        winner, text, mom: this.mom,
        teams: this.teams.map((t) => ({ name: t.name, r: t.score.r, w: t.score.w, balls: t.score.balls }))
      };
      this.emit('matchEnd', this.result);
      this.broadcast();
    }

    // ---------- snapshot ----------
    snapshot() {
      return {
        phase: this.phase, format: this.format, overs: this.overs, code: this.code,
        innings: this.innings, balls: this.balls, target: this.target,
        batTeam: this.batTeam, freeHit: this.freeHit,
        teams: this.teams.map((t) => ({
          name: t.name,
          score: t.score,
          players: t.players.map((p) => ({
            id: p.id, name: p.name, bot: p.bot, kit: p.kit, r: p.r, b: p.b, fours: p.fours,
            sixes: p.sixes, out: p.out, how: p.how, bBalls: p.bBalls, bRuns: p.bRuns, bWkts: p.bWkts
          }))
        })),
        strikerIdx: this.strikerIdx, nonStrikerIdx: this.nonStrikerIdx,
        strikerId: this.striker() ? this.striker().id : null,
        nonStrikerId: this.nonStriker() ? this.nonStriker().id : null,
        bowlerId: this.bowler() ? this.bowler().id : null,
        bowlerName: this.bowler() ? this.bowler().name : '',
        thisOver: this.thisOver.slice(),
        lastResult: this.lastResult, msg: this.msg, result: this.result,
        tossWinner: this.tossWinner, captainId: this.captainId, mom: this.mom,
        fielders: this.fielders.map((f) => ({
          key: f.key, name: f.name, x: f.x, y: f.y, ownerId: f.ownerId, bot: f.bot, keeper: f.keeper, kit: f.kit
        })),
        ball: this.ball, delivery: this.pendingDelivery,
        batOrder: this.teams[this.batTeam].players.map((p) => ({ name: p.name, out: p.out, r: p.r, b: p.b }))
      };
    }

    broadcast() { this.emit('state', this.snapshot()); }
  }

  global.Engine = { MatchRunner, SHOTS, FIELD_SPOTS, BOUNDARY, BATSMAN_POS };
})(window);
