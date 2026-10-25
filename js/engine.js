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

  const BOUNDARY = 66;      // metres from centre
  const BATSMAN_POS = { x: 0, y: 10 };
  const BOWLER_POS = { x: 0, y: -10 };
  const IDEAL_CONTACT = 0.60; // seconds after release
  const CONTACT_WINDOW = 0.30;

  function mkPlayer(o) {
    return {
      id: o.id, name: o.name, bot: !!o.bot,
      r: 0, b: 0, fours: 0, sixes: 0, out: false, how: null,
      bBalls: 0, bRuns: 0, bWkts: 0, bMaidens: 0
    };
  }

  class MatchRunner {
    constructor(cfg, emit) {
      this.emit = emit || function () {};
      this.format = cfg.format;          // 1 | 2 | 4
      this.overs = cfg.overs;
      this.code = cfg.code || '';
      this.phase = 'toss';
      this.timers = [];
      this.seq = 0;
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
      this.nextBatIdx = 2;
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
      this.field = [];       // human fielder assignment map
      this.pendingDelivery = null;
      this.pendingShot = null;
      this.ballStart = 0;
      this.inplayStart = 0;
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
    teamOf(id) {
      for (const t of this.teams) if (t.players.some((p) => p.id === id)) return t;
      return null;
    }
    later(ms, fn) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
    stop() { this.clearTimers(); this.phase = 'done'; }

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
      this.captainId = this.teams[this.tossWinner].players.find((p) => !p.bot) ?
        this.teams[this.tossWinner].players.find((p) => !p.bot).id : null;
      this.broadcast();
      const cap = this.teams[this.tossWinner].players.find((p) => !p.bot);
      if (!cap) {
        this.later(1200, () => this.chooseBat(Math.random() < 0.5));
      } else {
        this.later(9000, () => { if (this.phase === 'toss') this.chooseBat(Math.random() < 0.5); });
      }
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
      bt.players.forEach((p) => {
        p.r = 0; p.b = 0; p.fours = 0; p.sixes = 0; p.out = false; p.how = null;
      });
      this.bowlTeam().players.forEach((p) => { p.bBalls = 0; p.bRuns = 0; p.bWkts = 0; });
      this.balls = 0;
      this.thisOver = [];
      this.strikerIdx = 0;
      this.nonStrikerIdx = 1 % bt.players.length;
      this.nextBatIdx = bt.players.length > 2 ? 2 : -1;
      this.lastBowlerIdx = -1;
      this.innings++;
      this.phase = 'ready';
      this.msg = this.innings === 1 ? 'Innings 1 begins' : 'Chasing ' + (this.target) + ' to win';
      this.pickBowler();
      this.placeField();
      this.broadcast();
      this.later(1000, () => this.deliverySetup());
    }

    pickBowler() {
      const bt = this.bowlTeam();
      const humans = [];
      bt.players.forEach((p, i) => { if (!p.bot) humans.push(i); });
      let chosen = -1;
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
      const spots = FIELD_SPOTS.slice();
      const humans = bt.players.filter((p) => !p.bot);
      this.fielders = spots.map((s) => ({
        key: s.key, name: s.name, keeper: !!s.keeper,
        x: Math.sin((s.ang * Math.PI) / 180) * s.r,
        y: BATSMAN_POS.y - Math.cos((s.ang * Math.PI) / 180) * s.r,
        homeX: Math.sin((s.ang * Math.PI) / 180) * s.r,
        homeY: BATSMAN_POS.y - Math.cos((s.ang * Math.PI) / 180) * s.r,
        ownerId: null, bot: true
      }));
      // Keeper is never human-controlled. Other spots are handed to the fielding
      // team's human players, deepest spots first so the far field is played.
      const free = this.fielders.filter((f) => !f.keeper).sort((a, b) => b.homeY - a.homeY);
      humans.forEach((p, i) => {
        const f = free[i % free.length];
        if (f) { f.ownerId = p.id; f.bot = false; f.name = p.name; }
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
      if (b.bot) {
        this.later(700, () => {
          this.setDelivery(b.id, {
            line: rand(-0.8, 0.8), length: pick(['yorker', 'full', 'good', 'good', 'short']),
            type: pick(['pace', 'swing', 'spin', 'slower']), release: rand(0.2, 0.9)
          });
        });
      } else {
        this.later(9000, () => {
          if (this.phase === 'delivery') this.setDelivery(b.id, { line: rand(-0.4, 0.4), length: 'good', type: 'pace', release: 0.3 });
        });
      }
    }

    setDelivery(playerId, d) {
      if (this.phase !== 'delivery') return;
      if (!this.bowler() || this.bowler().id !== playerId) return;
      const rel = clamp(d.release == null ? 0.3 : d.release, 0, 1);
      const acc = 1 - Math.abs(rel - 0.55) / 0.55;       // 1 = perfect release
      const wide = Math.abs(d.line) > 0.9 || acc < 0.22;
      this.pendingDelivery = {
        line: clamp(d.line || 0, -1, 1), length: d.length || 'good',
        type: d.type || 'pace', release: rel, accuracy: clamp(acc, 0, 1), wide: wide
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
      if (this.pendingDelivery && this.pendingDelivery.wide) return this.finishBall({ kind: 'wide', runs: 1 });
      const s = this.pendingShot;
      if (!s) {
        // beaten — stumps check
        const d = this.pendingDelivery;
        const atStumps = Math.abs(d.line) < 0.55 && ['yorker', 'full', 'good'].includes(d.length);
        if (atStumps && Math.random() < 0.55) return this.finishBall({ kind: 'bowled', runs: 0 });
        return this.finishBall({ kind: 'dot', runs: 0, text: 'Beaten!' });
      }
      this.startInPlay(s);
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
      const quality = clamp(1 - Math.abs(t - IDEAL_CONTACT) / CONTACT_WINDOW, 0, 1);
      shot.quality = quality;
      this.pendingShot = shot;
      if (this.phase === 'flight' && t > IDEAL_CONTACT + CONTACT_WINDOW) this.onArrival();
      else if (this.phase === 'flight') { /* will resolve on arrival */ }
      else this.startInPlay(shot);
    }

    // bot striker auto-plays
    botBat() {
      const s = this.striker();
      if (!s || !s.bot) return;
      const good = Math.random() < 0.55;
      const t = good ? rand(0.5, 0.7) : rand(0.3, 0.95);
      const dir = pick([0, 0, 15, -15, 40, -40, 70, -70, 100, -100, 140]);
      const type = pick(['drive', 'drive', 'loft', 'pull', 'sweep', 'defend']);
      this.later(t * 1000, () => { if (!this.pendingShot) this.setShot(s.id, { dir, type }); });
    }

    startInPlay(shot) {
      this.phase = 'inplay';
      this.inplayStart = Date.now();
      const d = this.pendingDelivery;
      const q = shot.quality;
      const def = SHOTS[shot.type];
      const power = def.power * (0.35 + 0.65 * q) * (0.85 + 0.3 * (d ? d.accuracy : 0.6));
      const dist = 12 + power * 58;
      const ang = shot.dir;
      const rad = (ang * Math.PI) / 180;
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
      // edge / mishit
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

      // fielders react
      this.fielders.forEach((f) => {
        if (f.ownerId) return;                      // human-controlled
        const dx = b.x - f.x, dy = b.y - f.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 0.5) {
          const speed = f.keeper ? 7 : 6.5;
          const step = speed * 0.05;
          f.x += (dx / dd) * Math.min(step, dd);
          f.y += (dy / dd) * Math.min(step, dd);
        }
      });

      // catch check
      if (b.airborne && !b.caught) {
        for (const f of this.fielders) {
          const dd = Math.hypot(b.x - f.x, b.y - f.y);
          const reach = f.catchReach || 2.6;
          if (dd < reach) {
            const human = !f.bot;
            const success = human ? (f.catchPressed ? 0.92 : 0.0) : (0.55 + Math.min(0.3, (reach - dd) * 0.2));
            if (success > 0.4 && Math.random() < success) {
              b.caught = true;
              return this.finishBall({ kind: 'caught', runs: 0, fielder: f.name });
            }
          }
        }
      }
      // ground interception
      if (!b.airborne && !b.stopped) {
        for (const f of this.fielders) {
          const dd = Math.hypot(b.x - f.x, b.y - f.y);
          if (dd < (f.diveUntil > now ? 3.4 : 1.7)) { b.stopped = true; b.stoppedAt = { x: b.x, y: b.y }; break; }
        }
      }
      // boundary
      const r = Math.hypot(b.x, b.y);
      if (r > BOUNDARY) {
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
        if (!b.stopped) { b.stopped = true; b.stoppedAt = { x: b.x, y: b.y }; }
        if (!b.settleAt) {
          b.settleAt = now + 600;
          this.broadcast();
        } else if (now >= b.settleAt) {
          return this.rollOut(b.stoppedAt || { x: b.x, y: b.y });
        }
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

    fielderAction(playerId, action) {
      const f = this.fielders.find((x) => x.ownerId === playerId);
      if (!f) return;
      if (action === 'catch') { f.catchPressed = true; this.later(700, () => { f.catchPressed = false; }); }
      if (action === 'dive') { f.diveUntil = Date.now() + 700; f.catchReach = 3.6; this.later(750, () => { f.catchReach = 2.6; }); }
      this.broadcast();
    }

    // ---------- outcome ----------
    finishBall(res) {
      if (this.phase === 'result' || this.phase === 'done') return;
      this.clearTimers();
      this.phase = 'result';
      const bt = this.bat();
      const s = this.striker();
      const b = this.bowler();
      let runs = res.runs || 0;
      let wicket = ['bowled', 'caught', 'runout', 'stumped', 'lbw'].includes(res.kind);

      if (res.kind === 'wide') {
        bt.score.r += 1;
        bt.score.extras += 1;
        if (b) b.bRuns += 1;
        this.lastResult = { kind: 'wide', runs: 1, text: 'Wide — one extra, ball to be bowled again', wicket: false };
        this.emit('result', this.lastResult);
        this.broadcast();
        this.later(1200, () => { if (this.phase !== 'done') { this.phase = 'ready'; this.deliverySetup(); } });
        return;
      }

      // legal delivery bookkeeping
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
        s.how = res.kind === 'caught' ? 'c ' + (res.fielder || 'fielder') : res.kind === 'runout' ? 'run out' : res.kind;
        if (b && res.kind !== 'runout') b.bWkts += 1;
      }

      this.thisOver.push(res.kind === 'dot' ? '•' : wicket ? 'W' : String(runs));
      this.lastResult = {
        kind: res.kind, runs, text: this.resultText(res, s), wicket,
        batter: s.name, bowler: b ? b.name : ''
      };
      this.emit('result', this.lastResult);
      this.broadcast();

      this.later(1200, () => this.afterBall(res));
    }

    resultText(res, s) {
      switch (res.kind) {
        case 'six': return 'SIX! ' + s.name + ' clears the rope';
        case 'four': return 'FOUR! Beautifully placed by ' + s.name;
        case 'caught': return 'CAUGHT by ' + (res.fielder || 'the fielder') + '! ' + s.name + ' has to go';
        case 'bowled': return 'BOWLED! ' + s.name + ' is cleaned up';
        case 'runout': return 'RUN OUT! Sharp work in the field';
        case 'dot': return res.text || 'No run';
        default: { const r = res.runs || 0; return r === 0 ? 'No run' : r + (r === 1 ? ' run' : ' runs'); }
      }
    }

    afterBall(res) {
      const bt = this.bat();
      const oversDone = Math.floor(this.balls / 6);
      const wicketsLeft = bt.players.length - bt.score.w;
      const targetReached = this.target != null && bt.score.r >= this.target;

      if (targetReached) return this.endMatch();
      if (wicketsLeft <= 1 || this.balls >= this.overs * 6) {
        if (this.innings === 1) return this.endInnings();
        return this.endMatch();
      }

      // strike rotation on odd runs
      const runs = res.runs || 0;
      if (runs % 2 === 1) this.swapStrike();

      // new batter if wicket
      if (['bowled', 'caught', 'runout', 'stumped', 'lbw'].includes(res.kind)) {
        const outWasStriker = true;
        const nextIdx = this.nextAvailableBatter();
        if (nextIdx === -1) return this.endMatch();
        if (outWasStriker) this.strikerIdx = nextIdx; else this.nonStrikerIdx = nextIdx;
      }

      // over complete
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
      } else {
        if (t0.r > t1.r) winner = 0; else if (t1.r > t0.r) winner = 1;
      }
      if (winner == null) text = 'Match tied';
      else text = this.teams[winner].name + ' win';
      this.result = { winner, text, teams: this.teams.map((t) => ({ name: t.name, r: t.score.r, w: t.score.w, balls: t.score.balls })) };
      this.emit('matchEnd', this.result);
      this.broadcast();
    }

    // ---------- snapshot ----------
    snapshot() {
      return {
        phase: this.phase, format: this.format, overs: this.overs, code: this.code,
        innings: this.innings, balls: this.balls, target: this.target,
        batTeam: this.batTeam,
        teams: this.teams.map((t) => ({
          name: t.name,
          score: t.score,
          players: t.players.map((p) => ({
            id: p.id, name: p.name, bot: p.bot, r: p.r, b: p.b, fours: p.fours,
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
        tossWinner: this.tossWinner, captainId: this.captainId,
        fielders: this.fielders.map((f) => ({ key: f.key, name: f.name, x: f.x, y: f.y, ownerId: f.ownerId, bot: f.bot, keeper: f.keeper })),
        ball: this.ball, delivery: this.pendingDelivery,
        batOrder: this.teams[this.batTeam].players.map((p) => ({ name: p.name, out: p.out, r: p.r, b: p.b }))
      };
    }

    broadcast() {
      if (this.phase === 'done') { this.emit('state', this.snapshot()); return; }
      this.emit('state', this.snapshot());
    }
  }

  global.Engine = { MatchRunner, SHOTS, FIELD_SPOTS, BOUNDARY, BATSMAN_POS };
})(window);
