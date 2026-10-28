/* Test-only PeerJS shim: emulates the Peer/DataConnection API over BroadcastChannel
   so two browser tabs can run the real Crsek-09 netcode without WebRTC. */
(function () {
  if (!window.CRSEK_FAKE_PEER) return;
  const CH = 'crsek-fake-peer';
  const bc = new BroadcastChannel(CH);
  const byId = new Map();
  const byConn = new Map();
  let n = 0;

  class Conn {
    constructor(peer, remoteId, connId) {
      this.peer = peer; this.peerId = remoteId; this.connId = connId;
      this.open = false; this.h = {};
      byConn.set(connId, this);
    }
    on(evt, fn) { (this.h[evt] = this.h[evt] || []).push(fn); return this; }
    fire(evt, x) { (this.h[evt] || []).forEach((f) => { try { f(x); } catch (e) { console.error('FAKEPEER handler error: ' + (e && e.stack || e)); } }); }
    _open() { if (this.open) return; this.open = true; this.fire('open'); }
    send(obj) { bc.postMessage({ k: 'data', connId: this.connId, payload: obj }); }
    close() {
      if (!this.open) return;
      this.open = false;
      bc.postMessage({ k: 'close', connId: this.connId });
      byConn.delete(this.connId);
      this.fire('close');
    }
  }

  class FakePeer {
    constructor(id, opts) {
      this.id = id; this.h = {}; this.destroyed = false;
      byId.set(id, this);
      bc.postMessage({ k: 'claim', id: id });
      setTimeout(() => {
        if (this.destroyed) return;
        if (this._taken) this.fire('error', { type: 'unavailable-id' });
        else this.fire('open', id);
      }, 90);
    }
    on(evt, fn) { (this.h[evt] = this.h[evt] || []).push(fn); return this; }
    fire(evt, x) { (this.h[evt] || []).forEach((f) => { try { f(x); } catch (e) {} }); }
    connect(targetId) {
      const connId = this.id + '|' + targetId + '|' + (++n);
      const conn = new Conn(this, targetId, connId);
      bc.postMessage({ k: 'connect', id: targetId, from: this.id, connId: connId });
      setTimeout(() => {
        if (!conn.open) { conn.fire('error', { type: 'peer-unavailable' }); }
      }, 900);
      return conn;
    }
    destroy() { this.destroyed = true; byId.delete(this.id); }
  }

  bc.onmessage = (e) => {
    const d = e.data || {};
    if (d.k === 'claim') {
      const p = byId.get(d.id);
      if (p && !p.destroyed) bc.postMessage({ k: 'taken', id: d.id });
    } else if (d.k === 'taken') {
      const p = byId.get(d.id);
      if (p) p._taken = true;
    } else if (d.k === 'connect') {
      const target = byId.get(d.id);
      if (!target || target.destroyed) return;
      const conn = new Conn(target, d.from, d.connId);
      target.fire('connection', conn);
      bc.postMessage({ k: 'accept', connId: d.connId });
      setTimeout(() => conn._open(), 10);
    } else if (d.k === 'accept') {
      const c = byConn.get(d.connId);
      if (c) c._open();
    } else if (d.k === 'data') {
      const c = byConn.get(d.connId);
      if (c) c.fire('data', d.payload);
    } else if (d.k === 'close') {
      const c = byConn.get(d.connId);
      if (c) { c.open = false; byConn.delete(d.connId); c.fire('close'); }
    }
  };

  window.Peer = FakePeer;
  window.__fake = { byId: byId, byConn: byConn, bc: bc };
})();
