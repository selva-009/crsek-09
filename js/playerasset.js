/* Crsek-09 — optional realistic player assets.
   Loads a rigged glTF/GLB humanoid and hands back clones with an AnimationMixer.
   If the file is missing or fails to parse, callers keep the procedural rig, so
   the game never depends on an asset that may not be there. */
(function (global) {
  'use strict';

  const CLIP_MAP = {
    stance: ['idle', 'stand', 'breathing', 'wait'],
    walk: ['walk', 'walking'],
    run: ['run', 'jog', 'sprint', 'running'],
    swing: ['swing', 'bat', 'hit', 'punch', 'attack'],
    bowl: ['bowl', 'pitch', 'throw', 'overarm'],
    dive: ['dive', 'fall', 'slide'],
    catch: ['catch', 'reach', 'grab'],
    throw: ['throw', 'pitch'],
    celebrate: ['celebrate', 'cheer', 'victory', 'win']
  };

  function norm(s) { return String(s || '').toLowerCase(); }

  function pickClip(actions, wanted) {
    const keys = Object.keys(actions);
    if (!keys.length) return null;
    const candidates = CLIP_MAP[wanted] || [wanted];
    for (const c of candidates) {
      const exact = keys.find((k) => norm(k) === c);
      if (exact) return actions[exact];
    }
    for (const c of candidates) {
      const partial = keys.find((k) => norm(k).includes(c));
      if (partial) return actions[partial];
    }
    return null;
  }

  const PlayerAsset = {
    gltf: null,
    url: null,
    error: null,
    clips: [],

    // Resolve to the loaded gltf, or null. Never rejects: a missing asset is normal.
    load(url) {
      return new Promise((resolve) => {
        if (!global.THREE || !global.THREE.GLTFLoader) { this.error = 'GLTFLoader not present'; return resolve(null); }
        const loader = new global.THREE.GLTFLoader();
        loader.load(
          url,
          (gltf) => {
            this.gltf = gltf;
            this.url = url;
            this.clips = (gltf.animations || []).map((a) => a.name);
            resolve(gltf);
          },
          undefined,
          (err) => { this.error = (err && err.message) || 'load failed'; resolve(null); }
        );
      });
    },

    available() { return !!this.gltf; },

    // A ready-to-place person: normalised to 1.8 m tall with feet on the ground.
    instantiate(kitColor) {
      const THREE = global.THREE;
      if (!this.gltf) return null;
      const src = this.gltf.scene;
      const root = new THREE.Group();

      let model;
      if (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) model = THREE.SkeletonUtils.clone(src);
      else model = src.clone(true);

      // normalise scale and ground the feet
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const h = size.y || 1;
      const s = 1.8 / h;
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y -= box2.min.y;

      model.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          if (kitColor && o.material && o.material.color && /shirt|jersey|body|cloth/i.test(o.material.name || '')) {
            o.material = o.material.clone();
            o.material.color.set(kitColor);
          }
        }
      });
      root.add(model);

      const mixer = new THREE.AnimationMixer(model);

      // strip root translation so a clip with travel baked in cannot walk the
      // player away from where the match engine put them
      const rootName = (model.children[0] && model.children[0].name) || '';
      const actions = {};
      (this.gltf.animations || []).forEach((clip) => {
        let c = clip;
        if (rootName) {
          const kept = clip.tracks.filter((tr) => !(tr.name === rootName + '.position'));
          if (kept.length && kept.length !== clip.tracks.length) {
            c = new THREE.AnimationClip(clip.name, clip.duration, kept);
          }
        }
        actions[c.name] = mixer.clipAction(c);
      });
      if (Object.keys(actions).length) {
        const first = actions[Object.keys(actions)[0]];
        first.play();
      }

      let current = null;
      const drive = (state) => {
        const want = pickClip(actions, state) || pickClip(actions, 'stance');
        if (!want) return;
        if (current === want) return;
        want.reset().fadeIn(0.18).play();
        if (current) current.fadeOut(0.18);
        current = want;
      };

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.40, 0.54, 24),
        new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.visible = false;
      root.add(ring);

      root.userData = { drive, mixer, ring, isGLB: true, kit: kitColor };
      return root;
    },

    update(dt) {
      if (this.gltf) return;
    }
  };

  global.PlayerAsset = PlayerAsset;
})(window);
