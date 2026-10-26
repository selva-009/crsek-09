/* Crsek-09 — touch input.
   Pointer-event virtual sticks with capture, deadzone and snap-back, so a finger
   that slides off the pad keeps control and a second finger on a button can never
   steal the stick. Also gives the action buttons press feedback that cannot fire
   a shot from the joystick side of the screen. */
(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Stick {
    constructor(el, nubEl, opts) {
      this.el = el;
      this.nub = nubEl;
      this.opts = opts || {};
      this.x = 0; this.y = 0; this.mag = 0; this.angle = 0;
      this.active = false;
      this.pointerId = null;
      this.rect = null;
      this.onChange = this.opts.onChange || null;
      this.el.style.touchAction = 'none';
      this._bind();
    }

    _bind() {
      const el = this.el;
      el.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
      el.addEventListener('pointermove', (e) => this._move(e), { passive: false });
      el.addEventListener('pointerup', (e) => this._up(e), { passive: false });
      el.addEventListener('pointercancel', (e) => this._up(e), { passive: false });
      el.addEventListener('lostpointercapture', (e) => this._up(e), { passive: false });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _down(e) {
      if (this.pointerId !== null) return;      // one finger owns this stick
      e.preventDefault();
      e.stopPropagation();
      this.pointerId = e.pointerId;
      try { this.el.setPointerCapture(e.pointerId); } catch (err) {}
      this.rect = this.el.getBoundingClientRect();
      this.active = true;
      this.el.classList.add('engaged');
      this._apply(e);
    }

    _move(e) {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      this._apply(e);
    }

    _up(e) {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      this.release();
    }

    _apply(e) {
      const r = this.rect || this.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = Math.max(28, r.width / 2 - 10);
      const d = Math.hypot(dx, dy);
      const clamped = d > max;
      if (clamped) { dx = (dx / d) * max; dy = (dy / d) * max; }
      const dead = this.opts.deadzone == null ? 0.15 : this.opts.deadzone;
      const mag = Math.min(1, d / max);
      this.mag = mag < dead ? 0 : mag;
      this.x = this.mag ? dx / max : 0;
      this.y = this.mag ? dy / max : 0;
      this.angle = Math.atan2(this.y, this.x) * 180 / Math.PI;
      this.nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (this.opts.arrow) {
        const a = Math.atan2(dy, dx) * 180 / Math.PI;
        this.opts.arrow.style.transform = 'rotate(' + (a + 90) + 'deg)';
        this.opts.arrow.style.opacity = this.mag ? 1 : 0;
      }
      if (this.onChange) this.onChange(this);
    }

    release() {
      this.pointerId = null;
      this.active = false;
      this.x = 0; this.y = 0; this.mag = 0; this.angle = 0;
      this.el.classList.remove('engaged');
      this.nub.style.transform = 'translate(0,0)';
      if (this.opts.arrow) this.opts.arrow.style.opacity = 0;
      if (this.onChange) this.onChange(this);
    }

    // direction in degrees, 0 = straight up the screen, +right
    dir() {
      if (!this.mag) return 0;
      return clamp(Math.round(Math.atan2(this.x, -this.y) * 180 / Math.PI), -180, 180);
    }
  }

  // Press feedback for action buttons: never scrolls, never leaks to the stick.
  function bindButtons(container, handler) {
    container.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      b.classList.add('pressed');
    }, { passive: false });
    container.addEventListener('pointerup', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.classList.remove('pressed');
      e.preventDefault();
      handler(b);
    }, { passive: false });
    container.addEventListener('pointercancel', () => {
      container.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
    });
    container.addEventListener('click', (e) => e.preventDefault());
  }

  // Stop the page itself from scrolling, rubber-banding or zooming during play.
  function lockPage() {
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  }

  global.Input = { Stick, bindButtons, lockPage };
})(window);
