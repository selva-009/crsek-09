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

  // ---------- players ----------
  // Jointed low-poly rig: hips -> torso -> shoulders -> elbows, hips -> knees -> feet.
  // Proportions are human (1.8 m), not blocky, and every joint is animated.
  const PART = {};

  function boxPart(THREE, w, h, d, mat, key) {
    if (key && PART[key]) return new THREE.Mesh(PART[key], mat);
    const g = new THREE.BoxGeometry(w, h, d);
    if (key) PART[key] = g;
    return new THREE.Mesh(g, mat);
  }

  function makePerson(THREE, kit, role) {
    const root = new THREE.Group();
    const isUmp = role === 'umpire';
    const kitMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(isUmp ? '#f2f2ec' : (kit || '#7fd1ae')), roughness: 0.72 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf3f6f8, roughness: 0.6 });
    const trouserMat = new THREE.MeshStandardMaterial({ color: isUmp ? 0x1b2430 : 0xf0f2f4, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xb98a63, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2732, roughness: 0.8 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.55 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.7 });

    const hips = new THREE.Group();
    hips.position.y = 0.92;
    root.add(hips);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.22), kitMat);
    torso.position.y = 0.26;
    torso.castShadow = true;
    hips.add(torso);

    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.20), trimMat);
    collar.position.y = 0.53;
    hips.add(collar);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.045, 0.19), trimMat);
    belt.position.y = 0.02;
    hips.add(belt);
    if (!isUmp) {
      [-1, 1].forEach((sd) => {
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.16, 0.155), kitMat);
        sleeve.position.set(sd * 0.19, 0.40, 0);
        hips.add(sleeve);
      });
    }

    // ---- head + helmet ----
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.62;
    hips.add(headGroup);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 8), skinMat);
    neck.position.y = 0.04;
    headGroup.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skinMat);
    head.position.y = 0.18;
    head.castShadow = true;
    headGroup.add(head);

    if (isUmp) {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.85 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.09, 12), hatMat);
      crown.position.y = 0.29;
      headGroup.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.015, 16), hatMat);
      brim.position.y = 0.245;
      headGroup.add(brim);
      // face
      const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.02), darkMat);
      eyes.position.set(0, 0.20, 0.108);
      headGroup.add(eyes);
    } else {
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), kitMat);
      helmet.position.y = 0.20;
      headGroup.add(helmet);
      const peak = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.11), kitMat);
      peak.position.set(0, 0.21, 0.13);
      headGroup.add(peak);
      for (let i = -1; i <= 1; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.012), darkMat);
        bar.position.set(i * 0.055, 0.13, 0.125);
        headGroup.add(bar);
      }
      const grilleBar = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.012), darkMat);
      grilleBar.position.set(0, 0.10, 0.125);
      headGroup.add(grilleBar);
    }

    // face detail for outfield players too: eyes and a jaw shadow
    if (!isUmp) {
      const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.016, 0.02), darkMat);
      eyes.position.set(0, 0.185, 0.105);
      headGroup.add(eyes);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.05, 0.035), skinMat);
      nose.position.set(0, 0.155, 0.112);
      headGroup.add(nose);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), darkMat);
      hair.position.y = 0.175;
      hair.rotation.x = -0.35;
      headGroup.add(hair);
      // helmet strap + ear guards
      [-1, 1].forEach((sd) => {
        const guard = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), kitMat);
        guard.position.set(sd * 0.10, 0.14, 0.02);
        guard.scale.set(0.7, 1, 1);
        headGroup.add(guard);
      });
    }

    // ---- arms ----
    function arm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.235, 0.46, 0);
      hips.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.048, 0.20, 4, 8) : new THREE.CylinderGeometry(0.048, 0.045, 0.28, 8), kitMat);
      upper.position.y = -0.14;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.26, 8), skinMat);
      fore.position.y = -0.13;
      fore.castShadow = true;
      elbow.add(fore);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.10, 0.075), role === 'bat' || role === 'keep' ? padMat : skinMat);
      glove.position.y = -0.30;
      elbow.add(glove);
      return { shoulder, elbow, glove };
    }
    const armL = arm(-1);
    const armR = arm(1);

    // ---- legs ----
    function leg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.105, -0.02, 0);
      hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.40, 8), trouserMat);
      thigh.position.y = -0.20;
      thigh.castShadow = true;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.40;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.40, 8), trouserMat);
      shin.position.y = -0.20;
      shin.castShadow = true;
      knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.24), darkMat);
      foot.position.set(0, -0.42, 0.05);
      knee.add(foot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.02, 0.245), trimMat);
      sole.position.set(0, -0.455, 0.05);
      knee.add(sole);
      if (role === 'bat' || role === 'keep') {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.46, 0.075), padMat);
        pad.position.set(0, -0.22, 0.085);
        knee.add(pad);
      }
      return { hip, knee, foot };
    }
    const legL = leg(-1);
    const legR = leg(1);

    // ---- bat ----
    let bat = null;
    if (role === 'bat') {
      bat = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 8), darkMat);
      handle.position.y = 0.12;
      bat.add(handle);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.10, 8), trimMat);
      grip.position.y = 0.06;
      bat.add(grip);
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.032), woodMat);
      shoulder.position.y = -0.005;
      bat.add(shoulder);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.42, 0.035), woodMat);
      blade.position.y = -0.21;
      blade.castShadow = true;
      bat.add(blade);
      bat.position.set(0.07, -0.34, 0.11);
      bat.rotation.x = -0.45;
      bat.rotation.z = 0.2;
      armR.elbow.add(bat);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.40, 0.54, 24),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    root.add(ring);

    root.userData = {
      role, kit,
      joints: { hips, torso, headGroup, armL, armR, legL, legR, bat },
      pose: { // live pose, blended toward target each frame
        torsoX: 0, torsoY: 0, hipsY: 0.92,
        armLX: 0, armRX: 0, armLZ: 0.08, armRZ: -0.08,
        elbowL: 0, elbowR: 0,
        hipLX: 0, hipRX: 0, kneeL: 0, kneeR: 0, rootY: 0, tilt: 0
      },
      ring,
      phase: Math.random() * 6.28
    };
    return root;
  }

  // target pose for a given animation state
  function targetPose(state, t, person, extra) {
    const p = person.userData.pose;
    const role = person.userData.role;
    const out = {
      torsoX: 0, torsoY: 0, hipsY: 0.92,
      armLX: 0, armRX: 0, armLZ: 0.08, armRZ: -0.08,
      elbowL: 0, elbowR: 0, hipLX: 0, hipRX: 0, kneeL: 0, kneeR: 0, rootY: 0, tilt: 0
    };
    const breathe = Math.sin(t * 1.7 + person.userData.phase) * 0.02;

    if (state === 'stance') {
      out.torsoX = 0.10 + breathe;
      out.hipsY = 0.90;
      out.kneeL = 0.18; out.kneeR = 0.18;
      out.hipLX = -0.12; out.hipRX = 0.10;
      out.armRX = -0.55 + Math.sin(t * 1.3) * 0.05;
      out.elbowR = 0.75;
      out.armLX = -0.35;
      out.elbowL = 0.45;
      out.torsoY = -0.22;
    } else if (state === 'swing') {
      const k = Math.min(1, (extra && extra.k != null) ? extra.k : 0);
      const lift = k < 0.22 ? k / 0.22 : 1;                 // backlift first
      const swing = k < 0.22 ? 0 : Math.sin(((k - 0.22) / 0.78) * Math.PI);
      out.torsoY = -0.22 + swing * 0.85;
      out.torsoX = 0.10 + swing * 0.10;
      out.armRX = -0.55 - lift * 0.55 - swing * 1.9;
      out.elbowR = 0.75 + lift * 0.5 - swing * 0.55;
      out.armLX = -0.35 - lift * 0.3 - swing * 0.7;
      out.hipLX = -0.12; out.hipRX = 0.10;
      out.kneeL = 0.18 + swing * 0.15;
    } else if (state === 'run') {
      const sw = Math.sin(t * 11 + person.userData.phase);
      out.hipLX = sw * 0.75; out.hipRX = -sw * 0.75;
      out.kneeL = Math.max(0, -sw) * 1.1; out.kneeR = Math.max(0, sw) * 1.1;
      out.armLX = -sw * 0.85; out.armRX = sw * 0.85;
      out.elbowL = 0.35; out.elbowR = 0.35;
      out.torsoX = 0.16;
      out.hipsY = 0.92 + Math.abs(sw) * 0.03;
    } else if (state === 'bowl') {
      const k = (extra && extra.k != null) ? extra.k : 0;   // 0 = start of run-up, 1 = release
      out.armRX = -0.4 - Math.sin(k * Math.PI) * 3.0;        // windmill
      out.armLX = 0.35;
      out.elbowR = Math.max(0, 0.9 - k * 1.4);
      out.torsoY = -0.15 + k * 0.55;
      out.torsoX = 0.12 + k * 0.12;
      out.kneeL = 0.25 + k * 0.35; out.kneeR = 0.25;
      out.hipLX = -0.3 * k; out.hipRX = 0.25;
      out.rootY = Math.sin(k * Math.PI) * 0.06;
    } else if (state === 'dive') {
      out.tilt = -1.15;
      out.hipsY = 0.55;
      out.armLX = -1.5; out.armRX = -1.5;
      out.hipLX = -0.35; out.hipRX = 0.2;
      out.kneeL = 0.5; out.kneeR = 0.2;
    } else if (state === 'catch') {
      out.armLX = -2.6; out.armRX = -2.6;
      out.elbowL = 0.3; out.elbowR = 0.3;
      out.torsoX = -0.08;
      out.kneeL = 0.3; out.kneeR = 0.3;
      out.hipsY = 0.86;
    } else if (state === 'throw') {
      const k = (extra && extra.k != null) ? extra.k : 0.4;
      out.armRX = -2.2 + k * 3.0;
      out.elbowR = 0.9 - k * 0.8;
      out.armLX = -0.6;
      out.torsoY = -0.3 + k * 0.5;
      out.hipLX = -0.2; out.kneeL = 0.25;
    } else if (state === 'celebrate') {
      const b = Math.abs(Math.sin(t * 5));
      out.armLX = -2.9; out.armRX = -2.9;
      out.rootY = b * 0.12;
      out.torsoX = -0.05;
    } else { // idle
      out.torsoX = 0.03 + breathe;
      out.armLX = 0.05; out.armRX = 0.05;
    }
    return out;
  }

  function applyPose(person, target, dt) {
    const j = person.userData.joints;
    const p = person.userData.pose;
    const k = Math.min(1, dt * 14);
    Object.keys(target).forEach((key) => {
      if (typeof target[key] === 'number') p[key] = p[key] + (target[key] - p[key]) * k;
    });
    j.torso.rotation.x = p.torsoX;
    j.torso.rotation.y = p.torsoY;
    j.hips.position.y = p.hipsY + p.rootY;
    j.armL.shoulder.rotation.x = p.armLX;
    j.armR.shoulder.rotation.x = p.armRX;
    j.armL.shoulder.rotation.z = p.armLZ;
    j.armR.shoulder.rotation.z = p.armRZ;
    j.armL.elbow.rotation.x = p.elbowL;
    j.armR.elbow.rotation.x = p.elbowR;
    j.legL.hip.rotation.x = p.hipLX;
    j.legR.hip.rotation.x = p.hipRX;
    j.legL.knee.rotation.x = p.kneeL;
    j.legR.knee.rotation.x = p.kneeR;
    person.rotation.z = p.tilt;
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
    const fill = new THREE.DirectionalLight(0xa8d8ff, 0.14);
    fill.position.set(-30, 30, 30);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9be8c4, 0.16);
    rim.position.set(-10, 18, 40);
    scene.add(rim);

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
    const keeper = makePerson(THREE, '#f0b429', 'keep');
    keeper.visible = false;
    scene.add(striker, nonStriker, bowler, keeper);

    const fielderPool = [];
    for (let i = 0; i < 12; i++) {
      const f = makePerson(THREE, '#e8eef2', 'field');
      f.visible = false;
      scene.add(f);
      fielderPool.push(f);
    }

    // two on-field umpires: bowler's end and square leg
    const umpireA = makePerson(THREE, '#f2f2ec', 'umpire');
    const umpireB = makePerson(THREE, '#f2f2ec', 'umpire');
    umpireA.position.set(-1.5, 0, -12.4);
    umpireB.position.set(-9.5, 0, 1.5);
    umpireA.rotation.y = 0;
    umpireB.rotation.y = -Math.PI / 2;
    scene.add(umpireA, umpireB);

    // DRS ball-tracking path
    const reviewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    const reviewLine = new THREE.Line(reviewGeo, new THREE.LineDashedMaterial({
      color: 0xff5252, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.95
    }));
    reviewLine.visible = false;
    scene.add(reviewLine);
    const reviewMark = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.9 })
    );
    reviewMark.visible = false;
    scene.add(reviewMark);

    function setReviewPath(info) {
      if (!info) return;
      const targetX = info.x || 0;
      const targetZ = 10;
      const pts = [
        new THREE.Vector3(0, 2.0, -10),
        new THREE.Vector3(targetX * 0.5, 0.9, 0),
        new THREE.Vector3(targetX, Math.max(0.15, info.z || 0.4), targetZ)
      ];
      reviewGeo.setFromPoints(pts);
      reviewLine.computeLineDistances();
      reviewLine.visible = true;
      reviewMark.position.copy(pts[2]);
      reviewMark.visible = true;
    }
    function clearReviewPath() { reviewLine.visible = false; reviewMark.visible = false; }

    // bowling preview: dashed line to where the ball will pitch
    const PITCH_Y = { yorker: 9.5, full: 8.0, good: 6.2, short: 3.4 };
    const previewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const previewLine = new THREE.Line(previewGeo, new THREE.LineDashedMaterial({
      color: 0xffd54f, dashSize: 0.55, gapSize: 0.35, transparent: true, opacity: 0.9
    }));
    previewLine.visible = false;
    scene.add(previewLine);
    const previewRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.46, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    previewRing.rotation.x = -Math.PI / 2;
    previewRing.visible = false;
    scene.add(previewRing);

    function setPreview(info) {
      const py = PITCH_Y[info.length] != null ? PITCH_Y[info.length] : 6.2;
      const px = (info.line || 0) * 1.2;
      const pts = [new THREE.Vector3(0.45, 2.0, -10.5), new THREE.Vector3(px, 0.06, py)];
      previewGeo.setFromPoints(pts);
      previewLine.computeLineDistances();
      previewLine.visible = true;
      previewRing.position.set(px, 0.05, py);
      previewRing.visible = true;
    }
    function clearPreview() { previewLine.visible = false; previewRing.visible = false; }

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

    function placePerson(person, ex, ey, faceY, isMine) {
      person.position.set(ex, 0, ey);
      if (faceY !== null) person.rotation.y = faceY;
      person.userData.ring.visible = !!isMine;
    }

    function animate(person, state, t, dt, extra) {
      applyPose(person, targetPose(state, t, person, extra), dt);
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
      const strikerP = batTeam.players.find((p) => p.id === state.strikerId) || {};
      const nsP = batTeam.players.find((p) => p.id === state.nonStrikerId) || {};
      striker.userData.joints.torso.material.color.set(strikerP.kit || '#7fd1ae');
      nonStriker.userData.joints.torso.material.color.set(nsP.kit || '#7fd1ae');

      placePerson(striker, 0, 10, Math.PI, state.strikerId === myPid);
      placePerson(nonStriker, 0.9, -10, 0, state.nonStrikerId === myPid);

      if (swingStart != null) {
        const k = Math.min(1, (performance.now() - swingStart) / 340);
        animate(striker, 'swing', t, dt, { k: k });
      } else {
        animate(striker, 'stance', t, dt);
      }
      animate(nonStriker, 'stance', t, dt);

      // bowler run-up and release
      const bowlerZ = -16 + runUp * 5;
      placePerson(bowler, 0.6, bowlerZ, Math.PI, state.bowlerId === myPid);
      if (runUp > 0.02) animate(bowler, 'bowl', t, dt, { k: runUp });
      else animate(bowler, state.phase === 'inplay' ? 'idle' : 'stance', t, dt);

      // fielders (keeper handled separately so it can wear pads)
      const fs = state.fielders || [];
      let poolIdx = 0;
      keeper.visible = false;
      fielderPool.forEach((f) => { f.visible = false; });
      fs.forEach((sp) => {
        let person;
        if (sp.keeper) { person = keeper; keeper.visible = true; }
        else { person = fielderPool[poolIdx++]; if (!person) return; person.visible = true; }
        person.userData.joints.torso.material.color.set(sp.kit || (sp.keeper ? '#f0b429' : '#e8eef2'));
        placePerson(person, sp.x, sp.y, Math.PI, sp.ownerId && sp.ownerId === myPid);
        const moving = state.phase === 'inplay';
        const diving = sp.ownerId && sp.diveUntil && sp.diveUntil > Date.now();
        animate(person, diving ? 'dive' : moving ? 'run' : 'stance', t, dt);
      });

      animate(umpireA, 'stance', t, dt);
      animate(umpireB, 'stance', t * 0.8, dt);

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
        // offset to the off side so the striker sits clear of the shot buttons
        const back = 19 + Math.min(5, ballDist * 0.16);
        targetPos.set(0.5 + bx * 0.2, 6.4 + Math.min(2, ballDist * 0.08), back);
        targetLook.set(3.0 + bx * 0.35, 0.9, live ? Math.min(6, (10 + by) / 2) : -6);
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
      // smooth, frame-rate independent easing — fast enough that the ball never
      // leaves the frame, slow enough that it never looks like a cut
      const rate = live ? 9 : state.phase === 'flight' ? 7 : 4.5;
      const k = 1 - Math.exp(-dt * rate);
      camera.position.lerp(targetPos, k);
      tmp.copy(targetLook);
      cam.look.lerp(tmp, k);
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

    return { renderer, scene, camera, resize, render, setCameraMode, setAutoCamera, cameraMode, setPreview, clearPreview, setReviewPath, clearReviewPath, onShot, dispose() { renderer.dispose(); } };
  }

  global.View3D = { create };
})(window);
