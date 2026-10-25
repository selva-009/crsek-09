/* Crsek-09 — canvas renderer (top-down broadcast view). */
(function (global) {
  'use strict';

  const WORLD = 74;             // half-extent drawn, metres
  const BAT_Y = 10, BOWL_Y = -10;

  const lerp = (a, b, t) => a + (b - a) * t;

  function makeView(canvas) {
    const ctx = canvas.getContext('2d');
    const view = {
      canvas, ctx, dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0,
      ballSmooth: null, trail: [], shake: 0,
      resize() {
        const r = canvas.getBoundingClientRect();
        this.dpr = Math.min(2, global.devicePixelRatio || 1);
        this.w = r.width; this.h = r.height;
        canvas.width = Math.round(r.width * this.dpr);
        canvas.height = Math.round(r.height * this.dpr);
        this.scale = Math.min(this.w, this.h) / (WORLD * 2);
        this.ox = this.w / 2;
        this.oy = this.h / 2;
      },
      toScreen(x, y) { return { x: this.ox + x * this.scale, y: this.oy + y * this.scale }; }
    };
    view.resize();
    global.addEventListener('resize', () => view.resize());
    return view;
  }

  function drawField(v, st) {
    const { ctx } = v;
    ctx.save();
    ctx.clearRect(0, 0, v.w, v.h);

    // sky / surround
    const bg = ctx.createLinearGradient(0, 0, 0, v.h);
    bg.addColorStop(0, '#08150f');
    bg.addColorStop(1, '#040b08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, v.w, v.h);

    const c = v.toScreen(0, 0);
    const R = 68 * v.scale;

    // outfield
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R, R * 0.98, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c.x, c.y - R * 0.3, R * 0.1, c.x, c.y, R);
    g.addColorStop(0, '#1f6b3a');
    g.addColorStop(1, '#114a28');
    ctx.fillStyle = g;
    ctx.fill();

    // mowing stripes
    ctx.save();
    ctx.clip();
    for (let i = -8; i < 9; i++) {
      if (i % 2) continue;
      const x0 = c.x + i * (R / 8);
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      ctx.fillRect(x0, c.y - R, R / 8, R * 2);
    }
    ctx.restore();

    // boundary rope
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R, R * 0.98, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 30 yard circle
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 27 * v.scale, 27 * v.scale, 0, 0, Math.PI * 2);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // pitch
    const p1 = v.toScreen(-1.7, -13), p2 = v.toScreen(1.7, 15);
    ctx.fillStyle = '#c9b483';
    ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    // creases + stumps
    [-10, 10].forEach((y) => {
      const a = v.toScreen(-1.5, y), b = v.toScreen(1.5, y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      [-0.22, 0, 0.22].forEach((dx) => {
        const s = v.toScreen(dx, y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(1.5, 0.14 * v.scale), 0, Math.PI * 2);
        ctx.fillStyle = '#f5f5f5';
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function label(v, text, x, y, opts) {
    const { ctx } = v;
    ctx.font = (opts && opts.font) || '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 10;
    const bx = x - w / 2, by = y - 8;
    ctx.fillStyle = 'rgba(4,10,7,0.72)';
    roundRect(ctx, bx, by, w, 16, 5);
    ctx.fill();
    ctx.fillStyle = (opts && opts.color) || '#d9f2e2';
    ctx.fillText(text, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlayers(v, st, myPid) {
    const { ctx } = v;

    // fielders
    (st.fielders || []).forEach((f) => {
      const p = v.toScreen(f.x, f.y);
      const mine = f.ownerId && f.ownerId === myPid;
      ctx.beginPath();
      ctx.arc(p.x, p.y, mine ? 8.5 : 7, 0, Math.PI * 2);
      ctx.fillStyle = f.keeper ? '#f0b429' : (f.kit || (mine ? '#4fc3f7' : '#e8eef2'));
      ctx.fill();
      ctx.lineWidth = mine ? 2.5 : 1.5;
      ctx.strokeStyle = mine ? '#ffffff' : 'rgba(0,0,0,0.45)';
      ctx.stroke();
      if (mine) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79,195,247,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      label(v, f.name, p.x, p.y - 16, { color: mine ? '#9fe4ff' : '#cfe3d8' });
    });

    // non-striker
    const ns = v.toScreen(0, BOWL_Y);
    ctx.beginPath(); ctx.arc(ns.x, ns.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#7fd1ae'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (st.nonStrikerId === myPid) {
      ctx.beginPath(); ctx.arc(ns.x, ns.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79,195,247,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // striker
    const s = v.toScreen(0, BAT_Y);
    ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#7fd1ae'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (st.strikerId === myPid) {
      ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79,195,247,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    }
    // bat
    ctx.strokeStyle = '#e6d9b0'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x + 6, s.y + 4);
    ctx.lineTo(s.x + 16, s.y - 10);
    ctx.stroke();

    // bowler
    const b = v.toScreen(0, BOWL_Y - 1.5);
    ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb4a2'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (st.bowlerId === myPid) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,180,162,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  function drawBall(v, st, dt) {
    const b = st.ball;
    if (!b) { v.ballSmooth = null; return; }
    const { ctx } = v;
    const target = { x: b.x, y: b.y };
    if (!v.ballSmooth) v.ballSmooth = { x: target.x, y: target.y };
    v.ballSmooth.x = lerp(v.ballSmooth.x, target.x, 0.45);
    v.ballSmooth.y = lerp(v.ballSmooth.y, target.y, 0.45);
    const p = v.toScreen(v.ballSmooth.x, v.ballSmooth.y);
    const z = b.z || 0;

    if (b.landing && st.phase === 'inplay') {
      const l = v.toScreen(b.landing.x, b.landing.y);
      ctx.beginPath();
      ctx.arc(l.x, l.y, 9 + Math.sin(Date.now() / 160) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = b.airborne ? 'rgba(255,196,0,0.85)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // shadow
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 3, 5 + z * 0.25, 2.5 + z * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // ball
    const r = 4.5 + z * 0.28;
    const gp = ctx.createRadialGradient(p.x - r * 0.3, p.y - z * 0.7 - r * 0.3, r * 0.2, p.x, p.y - z * 0.7, r);
    gp.addColorStop(0, '#ffffff');
    gp.addColorStop(1, '#cfd8dc');
    ctx.beginPath();
    ctx.arc(p.x, p.y - z * 0.7, r, 0, Math.PI * 2);
    ctx.fillStyle = gp;
    ctx.fill();
  }

  function render(v, st, myPid) {
    if (!st) {
      v.ctx.clearRect(0, 0, v.w, v.h);
      return;
    }
    drawField(v, st);
    drawPlayers(v, st, myPid);
    drawBall(v, st);
  }

  global.View = { makeView, render };
})(window);
