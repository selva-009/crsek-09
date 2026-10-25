/* Crsek-09 — networking layer.
   Real peer-to-peer multiplayer over WebRTC. The room host is authoritative:
   guests send intents to the host, the host runs the engine and broadcasts state.
   Room codes map to deterministic peer ids, so no game server is required.
   Voice chat rides the same PeerJS connection as a second, audio-only channel. */
(function (global) {
  'use strict';

  const PREFIX = 'crsek09-v1-';
  const SLOTS = 8;    // public matchmaking slots

  function rid() { return Math.random().toString(36).slice(2, 10); }

  // Signalling server. Defaults to the public PeerJS broker; a self-hosted
  // server can be supplied at runtime via window.CRSEK_PEER = {host, port, path, secure}.
  function peerOpts(debug) {
    const cfg = global.CRSEK_PEER;
    const o = { debug: debug || 0 };
    if (cfg && cfg.host) {
      o.host = cfg.host; o.port = cfg.port; o.path = cfg.path || '/';
      o.secure = !!cfg.secure;
      if (cfg.config) o.config = cfg.config;
    }
    return o;
  }

  class Net {
    constructor() {
      this.peer = null;
      this.conns = new Map();   // peerId -> DataConnection
      this.handlers = {};
      this.isHost = false;
      this.myId = null;
      this.roomCode = null;
      this.slot = null;
      this.voice = { stream: null, calls: new Map(), audios: new Map(), on: false };
    }

    on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
    fire(evt, payload) { (this.handlers[evt] || []).forEach((f) => f(payload)); }

    // ---------- host ----------
    hostRoom(code, cb) {
      this.isHost = true;
      this.roomCode = code;
      const peer = new Peer(PREFIX + 'r-' + code, peerOpts(1));
      this.peer = peer;
      peer.on('open', (id) => { this.myId = id; cb(null, id); });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') cb(new Error('That room code is already in use. Try again.'));
        else cb(new Error(e.type || 'Network error'));
      });
      peer.on('connection', (conn) => this._adopt(conn));
      this._wireVoice(peer);
      return peer;
    }

    // Try to claim a public matchmaking slot. Resolves with the slot number.
    hostPublicSlot(cb, attempt) {
      attempt = attempt || 1;
      if (attempt > SLOTS) return cb(new Error('No free public match slots right now. Create a private room instead.'));
      const id = PREFIX + 'q-' + attempt;
      const peer = new Peer(id, peerOpts(0));
      this.peer = peer;
      let settled = false;
      peer.on('open', () => {
        if (settled) return;
        settled = true;
        this.isHost = true;
        this.slot = attempt;
        this.myId = id;
        peer.on('connection', (conn) => this._adopt(conn));
        this._wireVoice(peer);
        cb(null, attempt);
      });
      peer.on('error', (e) => {
        if (settled) return;
        settled = true;
        try { peer.destroy(); } catch (x) {}
        if (e.type === 'unavailable-id') return this.hostPublicSlot(cb, attempt + 1);
        cb(new Error(e.type || 'Network error'));
      });
      return peer;
    }

    _adopt(conn) {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        this.fire('peerJoin', { peerId: conn.peer });
      });
      conn.on('data', (data) => this.fire('msg', { peerId: conn.peer, data }));
      conn.on('close', () => {
        this.conns.delete(conn.peer);
        this._dropAudio(conn.peer);
        this.fire('peerLeave', { peerId: conn.peer });
      });
      conn.on('error', () => {});
    }

    // ---------- guest ----------
    joinRoom(code, cb) {
      this.isHost = false;
      this.roomCode = code;
      const peer = new Peer(PREFIX + 'g-' + code + '-' + rid(), peerOpts(1));
      this.peer = peer;
      this._wireVoice(peer);
      let done = false;
      peer.on('open', (id) => {
        this.myId = id;
        const conn = peer.connect(PREFIX + 'r-' + code, { reliable: true });
        const fail = setTimeout(() => { if (!done) { done = true; cb(new Error('Could not reach room ' + code)); } }, 9000);
        conn.on('open', () => {
          if (done) return;
          done = true; clearTimeout(fail);
          this.conns.set(conn.peer, conn);
          this._wireGuest(conn);
          cb(null, conn.peer);
        });
        conn.on('error', () => { if (!done) { done = true; clearTimeout(fail); cb(new Error('Connection failed')); } });
      });
      peer.on('error', (e) => { if (!done) { done = true; cb(new Error(e.type || 'Network error')); } });
      return peer;
    }

    // Scan the public slots for an open match, all at once, first open wins.
    joinPublic(cb) {
      this.isHost = false;
      const peer = new Peer(PREFIX + 'g-q-' + rid(), peerOpts(0));
      this.peer = peer;
      this._wireVoice(peer);
      let done = false;
      peer.on('open', () => {
        this.myId = peer.id;
        const tries = [];
        const finish = (err, slot) => { if (done) return; done = true; cb(err, slot); };
        for (let slot = 1; slot <= SLOTS; slot++) {
          const conn = peer.connect(PREFIX + 'q-' + slot, { reliable: true });
          tries.push(conn);
          conn.on('open', () => {
            if (done) { try { conn.close(); } catch (e) {} return; }
            this.slot = slot;
            this.conns.set(conn.peer, conn);
            this._wireGuest(conn);
            tries.forEach((c) => { if (c !== conn) { try { c.close(); } catch (e) {} } });
            finish(null, slot);
          });
          conn.on('error', () => {});
        }
        setTimeout(() => finish(new Error('No open public match right now. Create a room, or try again in a moment.')), 2400);
      });
      peer.on('error', (e) => { if (!done) { done = true; cb(new Error(e.type || 'Network error')); } });
      return peer;
    }

    _wireGuest(conn) {
      conn.on('data', (data) => this.fire('msg', { peerId: conn.peer, data }));
      conn.on('close', () => this.fire('disconnected', { peerId: conn.peer }));
    }

    // ---------- voice ----------
    _wireVoice(peer) {
      peer.on('call', (call) => {
        try { call.answer(this.voice.stream || new MediaStream()); } catch (e) {}
        this._adoptCall(call, call.peer);
      });
    }

    _adoptCall(call, peerId) {
      this.voice.calls.set(peerId, call);
      call.on('stream', (stream) => this._playAudio(peerId, stream));
      call.on('close', () => { this.voice.calls.delete(peerId); this._dropAudio(peerId); });
      call.on('error', () => {});
    }

    _playAudio(peerId, stream) {
      let a = this.voice.audios.get(peerId);
      if (!a) {
        a = document.createElement('audio');
        a.autoplay = true; a.playsInline = true; a.setAttribute('playsinline', '');
        document.body.appendChild(a);
        this.voice.audios.set(peerId, a);
      }
      a.srcObject = stream;
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => {});
      this.fire('voice', { peerId: peerId, on: true });
    }

    _dropAudio(peerId) {
      const a = this.voice.audios.get(peerId);
      if (a) { try { a.srcObject = null; a.remove(); } catch (e) {} this.voice.audios.delete(peerId); }
      this.fire('voice', { peerId: peerId, on: false });
    }

    async enableMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Microphone not available');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.voice.stream = stream;
      this.voice.on = true;
      return stream;
    }

    disableMic() {
      this.voice.on = false;
      if (this.voice.stream) {
        this.voice.stream.getTracks().forEach((t) => t.stop());
        this.voice.stream = null;
      }
      this.voice.calls.forEach((c) => { try { c.close(); } catch (e) {} });
      this.voice.calls.clear();
      [...this.voice.audios.keys()].forEach((p) => this._dropAudio(p));
    }

    // Call every peer we are not already talking to (mesh, small squads only).
    syncVoice(peerIds) {
      if (!this.voice.on || !this.peer) return;
      (peerIds || []).forEach((pid) => {
        if (!pid || pid === this.myId) return;
        if (this.voice.calls.has(pid)) return;
        try {
          const call = this.peer.call(pid, this.voice.stream);
          this._adoptCall(call, pid);
        } catch (e) {}
      });
    }

    // ---------- send ----------
    send(peerId, obj) {
      const c = this.conns.get(peerId);
      if (c && c.open) { try { c.send(obj); } catch (e) {} }
    }
    broadcast(obj) {
      this.conns.forEach((c) => { if (c.open) { try { c.send(obj); } catch (e) {} } });
    }
    hostPeerId() {
      if (this.isHost) return this.myId;
      const first = this.conns.keys().next();
      return first.done ? null : first.value;
    }
    peerIds() {
      const ids = [...this.conns.keys()];
      if (this.myId) ids.push(this.myId);
      return ids;
    }
    destroy() {
      this.disableMic();
      this.conns.forEach((c) => { try { c.close(); } catch (e) {} });
      this.conns.clear();
      if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
      this.peer = null;
    }
  }

  global.Net = Net;
  global.NET_PREFIX = PREFIX;
})(window);
