/* Crsek-09 — 3D stadium renderer (Three.js).
   Engine coordinates are metres on a ground plane: (x, y) with y along the pitch
   and z as height. Three uses (x, height, z), so world = (ex, ez, ey). */
(function (global) {
  'use strict';

  const T = () => global.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function stripeTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#11502a';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) continue;
      g.fillStyle = 'rgba(255,255,255,0.022)';
      g.fillRect((i * 512) / 8, 0, 512 / 8, 512);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  function crowdTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#0d1620';
    g.fillRect(0, 0, 1024, 256);
    const cols = ['#e8c07d', '#cf5b4a', '#7fb4e8', '#e0e6ee', '#8fd6a2', '#b58fe0'];
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.globalAlpha = 0.25 + Math.random() * 0.5;
      g.fillRect(Math.random() * 1024, Math.random() * 256, 3, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
  }

  function makePerson(THREE, kit, role) {
    const g = new THREE.Group();
    const skin = 0xb98a63;
    const kitMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(kit || '#7fd1ae'), roughness: 0.75 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2a35, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.22), kitMat);
    torso.position.y = 1.06; torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinMat);
    head.position.y = 1.46; head.castShadow = true;
    g.add(head);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.07, 12), kitMat);
    cap.position.y = 1.57;
    g.add(cap);

    const legs = [];
    [-0.1, 0.1].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.16), role === 'bat' ? padMat : darkMat);
      leg.position.set(x, 0.48, 0);
      leg.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.79, 0);
      leg.position.set(0, -0.31, 0);
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    });

    const arms = [];
    [-0.24, 0.24].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.12), skinMat);
      arm.position.set(0, -0.23, 0);
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.26, 0);
      pivot.add(arm);
      g.add(pivot);
      arms.push(pivot);
    });

    let bat = null;
    if (role === 'bat') {
      bat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.16), new THREE.MeshStandardMaterial({ color: 0xdcc79a, roughness: 0.7 }));
      bat.position.set(0.02, -0.62, 0.06);
      bat.rotation.z = 0.18;
      arms[1].add(bat);
    }

    // marker ring for the player you control
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.56, 24),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    g.add(ring);

    g.scale.setScalar(1.15);
    g.userData = { legs, arms, torso, head, bat, ring, kit, role, phase: Math.random() * 6.28 };
    return g;
  }

  function create(canvas, opts) {
    const THREE = T();
    if (!THREE) return null;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    const cores = (navigator.hardwareConcurrency || 4);
    const hiEnd = (global.devicePixelRatio || 1) >= 2 && cores >= 6;
    let quality = hiEnd ? 2 : 1;
    renderer.setPixelRatio(Math.min(hiEnd ? 2 : 1.5, global.devicePixelRatio || 1));
    renderer.shadowMap.enabled = hiEnd;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050f0a);
    scene.fog = new THREE.Fog(0x050f0a, 130, 340);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x14361f, 0.48));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.78);
    sun.position.set(28, 60, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa8d8ff, 0.2);
    fill.position.set(-30, 30, 30);
    scene.add(fill);

    // ---- ground ----
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 72),
      new THREE.MeshStandardMaterial({ map: stripeTexture(THREE), roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(66, 0.28, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0xf5f7f8, roughness: 0.5 })
    );
    rope.rotation.x = -Math.PI / 2;
    rope.position.y = 0.12;
    scene.add(rope);

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(26.8, 27.1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.04;
    scene.add(inner);

    // ---- pitch ----
    const pitch = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.08, 28),
      new THREE.MeshStandardMaterial({ color: 0x9a8459, roughness: 1.0 })
    );
    pitch.position.set(0, 0.04, 1);
    pitch.receiveShadow = true;
    scene.add(pitch);

    [10, -10].forEach((z) => {
      const crease = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.01, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xf7f7f7 })
      );
      crease.position.set(0, 0.09, z);
      scene.add(crease);
      [-0.13, 0, 0.13].forEach((x) => {
        const stump = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.72, 8),
          new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.6 })
        );
        stump.position.set(x, 0.44, z);
        stump.castShadow = true;
        scene.add(stump);
      });
      const bails = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.03, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xf2ede2 })
      );
      bails.position.set(0, 0.82, z);
      scene.add(bails);
    });

    // ---- stands ----
    const crowd = crowdTexture(THREE);
    [[70, 10, 0x101a24], [78, 16, 0x0c141d], [86, 22, 0x0a1119]].forEach(([r, h, col], i) => {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 4, h, 64, 1, true),
        i === 0
          ? new THREE.MeshStandardMaterial({ map: crowd, color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide })
      );
      shell.position.y = h / 2 - 1;
      scene.add(shell);
    });

    // floodlights
    [[-52, -52], [52, -52], [-52, 52], [52, 52]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 30, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a3742, roughness: 0.8 })
      );
      pole.position.set(x, 15, z);
      scene.add(pole);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(9, 5, 1),
        new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff3cc, emissiveIntensity: 1.4 })
      );
      head.position.set(x, 31, z);
      head.lookAt(0, 0, 0);
      scene.add(head);
    });

    // ---- ball ----
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 })
    );
    ball.castShadow = true;
    ball.visible = false;
    scene.add(ball);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.visible = false;
    scene.add(ballShadow);

    const landingRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    landingRing.rotation.x = -Math.PI / 2;
    landingRing.visible = false;
    scene.add(landingRing);

    // ---- people ----
    const striker = makePerson(THREE, '#7fd1ae', 'bat');
    const nonStriker = makePerson(THREE, '#7fd1ae', 'bat');
    const bowler = makePerson(THREE, '#ffb4a2', 'bowl');
    scene.add(striker, nonStriker, bowler);

    const fielderPool = [];
    for (let i = 0; i < 13; i++) {
      const f = makePerson(THREE, '#e8eef2', 'field');
      f.visible = false;
      scene.add(f);
      fielderPool.push(f);
    }

    const cam = { mode: 'batter', auto: true, look: new THREE.Vector3(0, 1.2, -6), pos: new THREE.Vector3(0, 9, 26), t: 0 };
    const tmp = new THREE.Vector3();

    function resize() {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const wide = w / h < 0.75;         // portrait phone
      camera.fov = wide ? 62 : 50;
      camera.updateProjectionMatrix();
    }

    function setCameraMode(m, auto) { cam.mode = m; if (!auto) cam.auto = false; }
    function setAutoCamera(role) {
      if (!cam.auto) return;
      const want = (role === 'bat' || role === 'nonstriker' || role === 'waitbat') ? 'batter' : 'broadcast';
      cam.mode = want;
    }
    function cameraMode() { return cam.mode; }

    function placePerson(p, ex, ey, faceZ, dt, moving, isMine) {
      p.position.set(ex, 0, ey);
      const ud = p.userData;
      if (faceZ !== null) p.rotation.y = faceZ;
      ud.ring.visible = !!isMine;
      const speed = moving ? 11 : 1.6;
      ud.phase += dt * speed;
      const swing = moving ? Math.sin(ud.phase) * 0.7 : Math.sin(ud.phase) * 0.05;
      ud.legs[0].rotation.x = swing;
      ud.legs[1].rotation.x = -swing;
      ud.arms[0].rotation.x = -swing * 0.8;
      ud.arms[1].rotation.x = swing * 0.8;
      ud.torso.position.y = 1.06 + (moving ? Math.abs(Math.sin(ud.phase)) * 0.04 : Math.sin(ud.phase) * 0.012);
    }

    function animateBat(person, t, swingT) {
      const ud = person.userData;
      if (!ud.bat) return;
      if (swingT != null) {
        const k = Math.min(1, swingT / 0.34);
        ud.arms[1].rotation.x = -2.2 * Math.sin(k * Math.PI);
        ud.arms[0].rotation.x = -1.1 * Math.sin(k * Math.PI);
        ud.torso.rotation.y = 0.5 * Math.sin(k * Math.PI);
      } else {
        ud.torso.rotation.y *= 0.9;
        ud.arms[1].rotation.x = 0.35 + Math.sin(t * 1.5) * 0.05;
        ud.arms[0].rotation.x = 0.3;
      }
    }

    let lastPhase = null;
    let swingStart = null;
    let runUp = 0;
    let frames = 0, frameAcc = 0;

    function render(state, myPid, dt) {
      if (!state) { renderer.clear(); return; }
      if (document.hidden) return;
      const t = performance.now() / 1000;

      if (state.phase === 'flight') runUp = Math.min(1, runUp + dt * 2.4);
      else if (state.phase === 'delivery' || state.phase === 'ready') runUp = Math.max(0, runUp - dt * 1.5);

      // striker / non-striker
      const batTeam = state.teams[state.batTeam];
      const strikerKit = (batTeam.players.find((p) => p.id === state.strikerId) || {}).kit || '#7fd1ae';
      const nsKit = (batTeam.players.find((p) => p.id === state.nonStrikerId) || {}).kit || '#7fd1ae';
      striker.userData.torso.material.color.set(strikerKit);
      nonStriker.userData.torso.material.color.set(nsKit);

      placePerson(striker, 0, 10, Math.PI, dt, false, state.strikerId === myPid);
      placePerson(nonStriker, 0.9, -10, 0, dt, false, state.nonStrikerId === myPid);
      animateBat(striker, t, swingStart != null ? (performance.now() - swingStart) / 1000 : null);

      // bowler run-up
      const bowlerZ = -16 + runUp * 5;
      placePerson(bowler, 0.6, bowlerZ, Math.PI, dt, runUp > 0.02 && runUp < 1, state.bowlerId === myPid);
      bowler.userData.arms[1].rotation.x = -1.2 * runUp;

      // fielders
      const fs = state.fielders || [];
      fielderPool.forEach((f, i) => {
        const sp = fs[i];
        if (!sp) { f.visible = false; return; }
        f.visible = true;
        const kit = sp.kit || (sp.keeper ? '#f0b429' : '#e8eef2');
        f.userData.torso.material.color.set(kit);
        const moving = state.phase === 'inplay';
        placePerson(f, sp.x, sp.y, Math.PI, dt, moving, sp.ownerId && sp.ownerId === myPid);
        if (sp.keeper) f.userData.legs.forEach((l) => { l.rotation.x = 0.25; });
      });

      // ball
      const b = state.ball;
      if (b) {
        ball.visible = true; ballShadow.visible = true;
        ball.position.set(b.x, (b.z || 0) + 0.08, b.y);
        ballShadow.position.set(b.x, 0.05, b.y);
        const sc = 1 + (b.z || 0) * 0.06;
        ballShadow.scale.setScalar(sc);
        ballShadow.material.opacity = Math.max(0.06, 0.34 - (b.z || 0) * 0.012);
        if (b.landing && state.phase === 'inplay') {
          landingRing.visible = true;
          landingRing.position.set(b.landing.x, 0.06, b.landing.y);
          landingRing.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
        } else landingRing.visible = false;
      } else {
        ball.visible = false; ballShadow.visible = false; landingRing.visible = false;
      }

      // camera — always keep batter, bowler, ball and fielders in frame
      const targetPos = cam.pos.clone();
      const targetLook = cam.look.clone();
      const live = state.phase === 'inplay';
      const bx = b ? b.x : 0, by = b ? b.y : 0, bz = b ? (b.z || 0) : 0;

      // how far the ball is from the batsman drives how wide the shot is framed
      const ballDist = b ? Math.hypot(bx, by - 10) : 0;

      if (live && b) {
        // action camera: frame the ball together with the two closest fielders,
        // so the chase is always on screen even on a narrow portrait phone
        const near = (fs || [])
          .slice()
          .sort((a, c) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(c.x - bx, c.y - by))
          .slice(0, 2);
        const cx = (bx + near.reduce((sum, f) => sum + f.x, 0)) / (1 + near.length);
        const cy = (by + near.reduce((sum, f) => sum + f.y, 0)) / (1 + near.length);
        const spread = Math.max(6, ...near.map((f) => Math.hypot(f.x - bx, f.y - by)));
        const back = clamp(13 + spread * 0.95, 13, 36);
        const up = clamp(7 + spread * 0.55, 7, 24);
        targetPos.set(cx * 0.7, up, cy - back);
        targetLook.set(cx, 0.8, cy);
      } else if (cam.mode === 'batter') {
        // over the striker's shoulder down the pitch; pulls back as the ball flies away
        const back = 23 + Math.min(9, ballDist * 0.22);
        targetPos.set(bx * 0.22, 7.5 + Math.min(4, ballDist * 0.12), back);
        targetLook.set(bx * 0.4, 1.3, live ? Math.min(6, (10 + by) / 2) : -4);
      } else if (cam.mode === 'broadcast') {
        // follows the ball so the batter, ball and chasing fielders stay in frame
        const back = clamp(30 + ballDist * 0.4, 30, 50);
        const up = clamp(19 + ballDist * 0.22, 19, 34);
        targetPos.set(bx * 0.45, up, -back);
        targetLook.set(bx * 0.5, 1.5, (10 + by) / 2 + 2);
      } else {
        targetPos.set(0, 74, 0.1);
        targetLook.set(bx * 0.3, 0, by * 0.4);
      }
      // on a phase change, cut straight to the new framing instead of gliding,
      // so the ball is never off-screen while the camera travels
      if (state.phase !== lastPhase) {
        camera.position.copy(targetPos);
        cam.look.copy(targetLook);
      } else {
        const k = Math.min(1, dt * (live ? 6 : 3));
        camera.position.lerp(targetPos, k);
        tmp.copy(targetLook);
        cam.look.lerp(tmp, k);
      }
      camera.lookAt(cam.look);

      renderer.render(scene, camera);

      // adaptive quality: if the phone is struggling, drop resolution then shadows
      frames++;
      frameAcc += dt;
      if (frames >= 90) {
        const avg = frameAcc / frames;
        if (avg > 0.028 && quality > 0) {
          quality--;
          if (quality === 1) renderer.setPixelRatio(1);
          else if (quality === 0) { renderer.shadowMap.enabled = false; sun.castShadow = false; }
        }
        frames = 0; frameAcc = 0;
      }
      lastPhase = state.phase;
    }

    function onShot() { swingStart = performance.now(); setTimeout(() => { swingStart = null; }, 420); }

    return { renderer, scene, camera, resize, render, setCameraMode, setAutoCamera, cameraMode, onShot, dispose() { renderer.dispose(); } };
  }

  global.View3D = { create };
})(window);
