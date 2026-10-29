/* Crsek-09 — mocap catch animation.
   Loads a Mixamo FBX (character + clip), plays it on a hidden skeleton and exposes
   the arm arc as a normalised envelope. The procedural player rig is not a Mixamo
   skeleton, so the clip cannot be applied bone-for-bone; what transfers is the
   motion — the swing up to the catch and back down — which drives our catch pose. */
(function (global) {
  'use strict';

  const CatchAnim = {
    ready: false,
    clip: null,
    url: null,
    error: null,
    _mixer: null,
    _bones: {},
    _t: 0,
    _peak: { l: 1, r: 1 },

    load(url) {
      return new Promise((resolve) => {
        const THREE = global.THREE;
        if (!THREE || !THREE.FBXLoader) { this.error = 'FBXLoader missing'; return resolve(false); }
        new THREE.FBXLoader().load(url, (obj) => {
          const clip = (obj.animations || []).find((a) => a.duration > 0.1);
          if (!clip) { this.error = 'no clip'; return resolve(false); }
          this.clip = clip;
          this.url = url;

          // the mesh is not needed — only the skeleton drives anything
          obj.visible = false;
          this._root = obj;
          this._mixer = new THREE.AnimationMixer(obj);
          const action = this._mixer.clipAction(clip);
          action.play();

          const want = ['mixamorigLeftArm', 'mixamorigRightArm'];
          obj.traverse((o) => {
            if (o.isBone && want.includes(o.name) && !this._bones[o.name]) this._bones[o.name] = o;
          });

          // measure each arm's peak swing so the envelope is 0..1
          const probe = { l: 0, r: 0 };
          for (let i = 0; i <= 24; i++) {
            this._mixer.setTime((i / 24) * clip.duration);
            obj.updateMatrixWorld(true);
            const l = this._bones.mixamorigLeftArm, r = this._bones.mixamorigRightArm;
            if (l) probe.l = Math.max(probe.l, Math.abs(l.quaternion.x) + Math.abs(l.quaternion.z));
            if (r) probe.r = Math.max(probe.r, Math.abs(r.quaternion.x) + Math.abs(r.quaternion.z));
          }
          this._peak = { l: probe.l || 1, r: probe.r || 1 };
          this._mixer.setTime(0);
          this.ready = true;
          resolve(true);
        }, undefined, (err) => {
          this.error = (err && err.message) || 'load failed';
          resolve(false);
        });
      });
    },

    // advance the clip and return how far through the catch we are (0..1 each arm)
    update(dt) {
      if (!this.ready || !this._mixer) return { l: 0, r: 0 };
      this._mixer.update(dt);
      const l = this._bones.mixamorigLeftArm, r = this._bones.mixamorigRightArm;
      const mag = (b, peak) => {
        if (!b) return 0;
        const v = Math.abs(b.quaternion.x) + Math.abs(b.quaternion.z);
        return Math.max(0, Math.min(1, v / peak));
      };
      return { l: mag(l, this._peak.l), r: mag(r, this._peak.r) };
    },

    restart() {
      if (this._mixer) this._mixer.setTime(0);
    }
  };

  global.CatchAnim = CatchAnim;
})(window);
