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
  // Anatomically proportioned rig: tapered limbs, chest/waist taper, jointed
  // shoulders, elbows, hips, knees and ankles, with cricket kit built on top.
  const GEO = {};
  const MAT = {};

  function geo(key, make) {
    if (!GEO[key]) GEO[key] = make();
    return GEO[key];
  }
  function mat(key, make) {
    if (!MAT[key]) MAT[key] = make();
    return MAT[key];
  }
  function capsule(key, r1, r2, len, m) {
    const g = geo(key, () => new THREE.CylinderGeometry(r1, r2, len, 10, 1));
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  // five skin tones so a squad does not look cloned
  const SKINS = [0xc99b73, 0xa9764f, 0x8a5a3b, 0xe0b48c, 0x6f4529];

  function makePerson(THREE, kit, role, skinIdx) {
    const root = new THREE.Group();
    const isUmp = role === 'umpire';
    const isKeeper = role === 'keep';
    const skinTone = SKINS[(skinIdx == null ? 0 : skinIdx) % SKINS.length];

    const kitMat = mat('kit' + (isUmp ? 'ump' : kit), () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(isUmp ? '#f2f2ec' : kit), roughness: 0.78, metalness: 0.02
    }));
    const trimMat = mat('trim', () => new THREE.MeshStandardMaterial({ color: 0xf3f6f8, roughness: 0.6 }));
    const trouserMat = mat('trouser' + (isUmp ? 'ump' : 'p'), () => new THREE.MeshStandardMaterial({
      color: isUmp ? 0x1b2430 : 0xf0f2f4, roughness: 0.88
    }));
    const skinMat = mat('skin' + skinTone, () => new THREE.MeshStandardMaterial({
      color: skinTone, roughness: 0.72, metalness: 0.0
    }));
    const darkMat = mat('dark', () => new THREE.MeshStandardMaterial({ color: 0x1c2732, roughness: 0.8 }));
    const padMat = mat('pad', () => new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.62 }));
    const woodMat = mat('wood', () => new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.55 }));
    const eyeWhite = mat('eyew', () => new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.35 }));
    const irisMat = mat('iris', () => new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.3 }));
    const hairMat = mat('hair', () => new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 }));

    const hips = new THREE.Group();
    hips.position.y = 0.94;
    root.add(hips);

    // ---- torso: chest wider than waist, with shoulders ----
    const torso = new THREE.Mesh(geo('torso', () => new THREE.CylinderGeometry(0.205, 0.155, 0.52, 12, 1)), kitMat);
    torso.scale.z = 0.72;
    torso.position.y = 0.26;
    torso.castShadow = true;
    hips.add(torso);

    const chest = new THREE.Mesh(geo('chest', () => new THREE.SphereGeometry(0.20, 12, 10)), kitMat);
    chest.scale.set(1.05, 0.55, 0.75);
    chest.position.y = 0.44;
    hips.add(chest);

    [-1, 1].forEach((sd) => {
      const sh = new THREE.Mesh(geo('shoulder', () => new THREE.SphereGeometry(0.085, 10, 8)), kitMat);
      sh.position.set(sd * 0.20, 0.44, 0);
      sh.castShadow = true;
      hips.add(sh);
      if (!isUmp) {
        const sleeve = new THREE.Mesh(geo('sleeve', () => new THREE.CylinderGeometry(0.082, 0.070, 0.17, 10)), kitMat);
        sleeve.position.set(sd * 0.205, 0.34, 0);
        hips.add(sleeve);
      }
    });

    const collar = new THREE.Mesh(geo('collar', () => new THREE.CylinderGeometry(0.088, 0.10, 0.06, 10)), trimMat);
    collar.position.y = 0.53;
    hips.add(collar);
    const belt = new THREE.Mesh(geo('belt', () => new THREE.CylinderGeometry(0.163, 0.163, 0.05, 12)), trimMat);
    belt.scale.z = 0.74;
    belt.position.y = 0.01;
    hips.add(belt);

    // ---- head: face, hair, ears, helmet or umpire hat ----
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.60;
    hips.add(headGroup);

    const neck = capsule('neck', 0.052, 0.058, 0.09, skinMat);
    neck.position.y = 0.05;
    headGroup.add(neck);

    const skull = new THREE.Mesh(geo('skull', () => new THREE.SphereGeometry(0.115, 16, 14)), skinMat);
    skull.scale.set(1, 1.12, 1.02);
    skull.position.y = 0.185;
    skull.castShadow = true;
    headGroup.add(skull);

    const jaw = new THREE.Mesh(geo('jaw', () => new THREE.SphereGeometry(0.082, 12, 10)), skinMat);
    jaw.scale.set(0.95, 0.8, 0.95);
    jaw.position.set(0, 0.135, 0.022);
    headGroup.add(jaw);

    // eyes with irises
    [-1, 1].forEach((sd) => {
      const eye = new THREE.Mesh(geo('eye', () => new THREE.SphereGeometry(0.021, 10, 8)), eyeWhite);
      eye.position.set(sd * 0.042, 0.196, 0.094);
      headGroup.add(eye);
      const iris = new THREE.Mesh(geo('iris', () => new THREE.SphereGeometry(0.011, 8, 6)), irisMat);
      iris.position.set(sd * 0.042, 0.196, 0.112);
      headGroup.add(iris);
      const brow = new THREE.Mesh(geo('brow', () => new THREE.BoxGeometry(0.038, 0.009, 0.012)), hairMat);
      brow.position.set(sd * 0.043, 0.222, 0.101);
      headGroup.add(brow);
      const ear = new THREE.Mesh(geo('ear', () => new THREE.SphereGeometry(0.024, 8, 6)), skinMat);
      ear.scale.set(0.45, 1, 0.8);
      ear.position.set(sd * 0.108, 0.183, 0.006);
      headGroup.add(ear);
    });
    const nose = new THREE.Mesh(geo('nose', () => new THREE.ConeGeometry(0.019, 0.05, 6)), skinMat);
    nose.rotation.x = Math.PI / 2.1;
    nose.position.set(0, 0.168, 0.108);
    headGroup.add(nose);
    const mouth = new THREE.Mesh(geo('mouth', () => new THREE.BoxGeometry(0.042, 0.008, 0.01)), darkMat);
    mouth.position.set(0, 0.132, 0.104);
    headGroup.add(mouth);
    const hair = new THREE.Mesh(geo('hair', () => new THREE.SphereGeometry(0.118, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairMat);
    hair.position.y = 0.19;
    hair.rotation.x = -0.22;
    headGroup.add(hair);

    if (isUmp) {
      // long umpire's coat over the trousers
      const coat = new THREE.Mesh(geo('coat', () => new THREE.CylinderGeometry(0.175, 0.215, 0.46, 12)), kitMat);
      coat.scale.z = 0.78;
      coat.position.y = -0.12;
      hips.add(coat);
      const hatMat = mat('hat', () => new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.88 }));
      const crown = new THREE.Mesh(geo('hatCrown', () => new THREE.CylinderGeometry(0.104, 0.116, 0.09, 12)), hatMat);
      crown.position.y = 0.29;
      headGroup.add(crown);
      const brim = new THREE.Mesh(geo('hatBrim', () => new THREE.CylinderGeometry(0.215, 0.215, 0.014, 18)), hatMat);
      brim.position.y = 0.245;
      headGroup.add(brim);
    } else {
      const helmet = new THREE.Mesh(geo('helmet', () => new THREE.SphereGeometry(0.132, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)), kitMat);
      helmet.position.y = 0.205;
      headGroup.add(helmet);
      const peak = new THREE.Mesh(geo('peak', () => new THREE.BoxGeometry(0.23, 0.018, 0.115)), kitMat);
      peak.position.set(0, 0.215, 0.135);
      headGroup.add(peak);
      [-1, 1].forEach((sd) => {
        const guard = new THREE.Mesh(geo('guard', () => new THREE.SphereGeometry(0.055, 10, 8)), kitMat);
        guard.scale.set(0.62, 1, 1);
        guard.position.set(sd * 0.105, 0.155, 0.012);
        headGroup.add(guard);
      });
      // grille
      for (let i = -1; i <= 1; i++) {
        const bar = new THREE.Mesh(geo('gbar', () => new THREE.BoxGeometry(0.011, 0.125, 0.011)), darkMat);
        bar.position.set(i * 0.05, 0.135, 0.128);
        headGroup.add(bar);
      }
      [0.085, 0.155].forEach((yy) => {
        const hb = new THREE.Mesh(geo('gbarH', () => new THREE.BoxGeometry(0.165, 0.011, 0.011)), darkMat);
        hb.position.set(0, yy, 0.128);
        headGroup.add(hb);
      });
    }

    // ---- arms: upper arm, elbow, forearm, hand with fingers ----
    function arm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.205, 0.44, 0);
      hips.add(shoulder);
      const upper = capsule('upperArm', 0.052, 0.044, 0.28, skinMat);
      upper.position.y = -0.14;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      shoulder.add(elbow);
      const fore = capsule('foreArm', 0.042, 0.034, 0.26, skinMat);
      fore.position.y = -0.13;
      elbow.add(fore);
      const handMat = (role === 'bat' || isKeeper) ? padMat : skinMat;
      const hand = new THREE.Mesh(geo('hand', () => new THREE.BoxGeometry(0.072, 0.085, 0.055)), handMat);
      hand.position.y = -0.30;
      elbow.add(hand);
      if (role === 'bat' || isKeeper) {
        // glove fingers
        for (let i = -1; i <= 1; i++) {
          const f = new THREE.Mesh(geo('finger', () => new THREE.BoxGeometry(0.018, 0.045, 0.02)), padMat);
          f.position.set(i * 0.022, -0.355, 0.012);
          elbow.add(f);
        }
      }
      return { shoulder, elbow, glove: hand };
    }
    const armL = arm(-1);
    const armR = arm(1);

    // ---- legs: thigh, knee, shin, ankle, shoe ----
    function leg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.098, -0.03, 0);
      hips.add(hip);
      const thigh = capsule('thigh', 0.078, 0.058, 0.40, trouserMat);
      thigh.position.y = -0.20;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.40;
      hip.add(knee);
      const shin = capsule('shin', 0.052, 0.038, 0.40, trouserMat);
      shin.position.y = -0.20;
      knee.add(shin);
      const ankle = new THREE.Group();
      ankle.position.y = -0.40;
      knee.add(ankle);
      const shoe = new THREE.Mesh(geo('shoe', () => new THREE.BoxGeometry(0.095, 0.055, 0.235)), darkMat);
      shoe.position.set(0, -0.025, 0.05);
      ankle.add(shoe);
      const sole = new THREE.Mesh(geo('sole', () => new THREE.BoxGeometry(0.10, 0.018, 0.24)), trimMat);
      sole.position.set(0, -0.058, 0.05);
      ankle.add(sole);
      if (role === 'bat' || isKeeper) {
        const pad = new THREE.Mesh(geo('pad', () => new THREE.BoxGeometry(0.135, 0.46, 0.075)), padMat);
        pad.position.set(0, -0.22, 0.082);
        knee.add(pad);
        [-0.16, -0.24, -0.32].forEach((yy) => {
          const strap = new THREE.Mesh(geo('strap', () => new THREE.BoxGeometry(0.145, 0.016, 0.08)), trimMat);
          strap.position.set(0, yy, 0.082);
          knee.add(strap);
        });
      }
      return { hip, knee, ankle, foot: shoe };
    }
    const legL = leg(-1);
    const legR = leg(1);

    // ---- bat: handle, grip, shoulder, bevelled blade ----
    let bat = null;
    if (role === 'bat') {
      bat = new THREE.Group();
      const handle = new THREE.Mesh(geo('bhandle', () => new THREE.CylinderGeometry(0.017, 0.017, 0.24, 8)), darkMat);
      handle.position.y = 0.12;
      bat.add(handle);
      const grip = new THREE.Mesh(geo('bgrip', () => new THREE.CylinderGeometry(0.020, 0.020, 0.10, 8)), trimMat);
      grip.position.y = 0.06;
      bat.add(grip);
      const blade = new THREE.Mesh(geo('blade', () => new THREE.BoxGeometry(0.088, 0.44, 0.038)), woodMat);
      blade.position.y = -0.22;
      blade.castShadow = true;
      bat.add(blade);
      const toe = new THREE.Mesh(geo('btoe', () => new THREE.BoxGeometry(0.086, 0.05, 0.034)), woodMat);
      toe.position.y = -0.44;
      bat.add(toe);
      bat.position.set(0.06, -0.34, 0.10);
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
      pose: {
        torsoX: 0, torsoY: 0, hipsY: 0.94,
        armLX: 0, armRX: 0, armLZ: 0.08, armRZ: -0.08,
        elbowL: 0, elbowR: 0,
        hipLX: 0, hipRX: 0, kneeL: 0, kneeR: 0, ankleL: 0, ankleR: 0,
        rootY: 0, tilt: 0
      },
      ring,
      phase: Math.random() * 6.28
    };
    root.userData.drive = (state, t, dt, extra) => {
      applyPose(root, targetPose(state, t, root, extra), dt);
    };
    return root;
  }

  // Each shot has its own footwork, hip/shoulder rotation and bat arc.
  const SHOT_POSE = {
    drive:  { torsoY: 0.95, armR: -2.45, elbowR: 0.15, armL: -1.00, hipL: 0.38, hipR: -0.22, kneeL: 0.38, step: 0.32, crouch: 0 },
    loft:   { torsoY: 0.60, armR: -3.00, elbowR: 0.00, armL: -1.65, hipL: 0.52, hipR: -0.30, kneeL: 0.52, step: 0.44, crouch: 0 },
    pull:   { torsoY: 1.35, armR: -1.90, elbowR: 0.40, armL: -1.30, hipL: -0.42, hipR: 0.30, kneeL: 0.22, step: -0.26, crouch: 0.05 },
    cut:    { torsoY: 1.10, armR: -1.70, elbowR: 0.50, armL: -1.50, hipL: -0.50, hipR: 0.34, kneeL: 0.26, step: -0.30, crouch: 0.05 },
    sweep:  { torsoY: 1.55, armR: -1.45, elbowR: 0.60, armL: -1.40, hipL: 0.10, hipR: -0.62, kneeL: 0.95, step: 0.28, crouch: 0.30 },
    defend: { torsoY: 0.22, armR: -1.00, elbowR: 0.50, armL: -0.60, hipL: 0.22, hipR: -0.10, kneeL: 0.26, step: 0.18, crouch: 0.06 }
  };

  // target pose for a given animation state
  function targetPose(state, t, person, extra) {
    const p = person.userData.pose;
    const role = person.userData.role;
    const out = {
      torsoX: 0, torsoY: 0, hipsY: 0.94,
      armLX: 0, armRX: 0, armLZ: 0.08, armRZ: -0.08,
      elbowL: 0, elbowR: 0, hipLX: 0, hipRX: 0, kneeL: 0, kneeR: 0, ankleL: 0, ankleR: 0, rootY: 0, tilt: 0
    };
    const breathe = Math.sin(t * 1.7 + person.userData.phase) * 0.02;

    if (state === 'stance') {
      // a real batting stance: side-on to the bowler, knees bent, hands high with
      // the bat cocked behind the back leg, weight on the balls of the feet
      out.torsoX = 0.20 + breathe;
      out.torsoY = -0.55;
      out.hipsY = 0.86;
      out.kneeL = 0.42; out.kneeR = 0.34;
      out.hipLX = -0.30; out.hipRX = 0.16;
      out.armRX = -1.20 + Math.sin(t * 1.3) * 0.06;
      out.elbowR = 1.30;
      out.armLX = -0.62;
      out.elbowL = 0.95;
      out.armLZ = 0.22; out.armRZ = -0.18;
    } else if (state === 'swing') {
      const k = Math.min(1, (extra && extra.k != null) ? extra.k : 0);
      const type = (extra && extra.type) || 'drive';
      const foot = (extra && extra.foot) || 'neutral';
      const sp = SHOT_POSE[type] || SHOT_POSE.drive;
      // 0-0.25 backlift, 0.25-0.62 downswing to contact, 0.62-1 follow-through
      const lift = k < 0.25 ? k / 0.25 : 1;
      const swing = k < 0.25 ? 0 : Math.sin(((k - 0.25) / 0.75) * Math.PI);

      out.torsoY = -0.22 + lift * 0.15 + swing * sp.torsoY;
      out.torsoX = 0.10 + swing * 0.12 + sp.crouch;
      out.armRX = -0.55 - lift * 0.55 + swing * sp.armR * 0.75;
      out.elbowR = 0.75 + lift * 0.45 + swing * sp.elbowR;
      out.armLX = -0.35 - lift * 0.25 + swing * sp.armL * 0.5;
      // footwork: front foot to the pitch of the ball, back foot for the short ball
      const stepIn = foot === 'front' ? 1 : foot === 'back' ? -1 : (type === 'pull' || type === 'cut' ? -1 : 1);
      out.hipLX = -0.12 + swing * sp.hipL + stepIn * 0.10;
      out.hipRX = 0.10 + swing * sp.hipR - stepIn * 0.06;
      out.kneeL = 0.18 + swing * sp.kneeL + (stepIn > 0 ? 0.12 : 0);
      out.kneeR = 0.18 + (stepIn < 0 ? 0.12 : 0);
      out.rootY = -sp.crouch * 0.5;
      out.tilt = 0;
      // bat stays on the swing plane rather than clipping the body
      if (person.userData.joints && person.userData.joints.bat) person.userData.joints.bat.rotation.z = 0.2 + swing * (type === 'sweep' ? 1.1 : 0.35);
    } else if (state === 'idle') {
      // standing, waiting to take guard
      out.torsoX = 0.04 + breathe;
      out.armLX = -0.10; out.armRX = -0.12;
      out.elbowL = 0.18; out.elbowR = 0.20;
      out.hipLX = 0.04; out.hipRX = -0.04;
      out.kneeL = 0.08; out.kneeR = 0.08;
    } else if (state === 'walk') {
      const sw = Math.sin(t * 6 + person.userData.phase);
      out.hipLX = sw * 0.42; out.hipRX = -sw * 0.42;
      out.kneeL = Math.max(0, -sw) * 0.7; out.kneeR = Math.max(0, sw) * 0.7;
      out.armLX = -sw * 0.5; out.armRX = sw * 0.5;
      out.elbowL = 0.25; out.elbowR = 0.25;
      out.torsoX = 0.08;
    } else if (state === 'dejected') {
      out.torsoX = 0.34;
      out.headGroup = 0.4;
      out.armLX = 0.28; out.armRX = 0.28;
      out.elbowL = 0.15; out.elbowR = 0.15;
      out.kneeL = 0.2; out.kneeR = 0.2;
      out.hipsY = 0.90;
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
      // extra.env comes from the mocap clip: 0 = arms down, 1 = full stretch
      const e = (extra && extra.env != null) ? extra.env : 1;
      const k = 0.3 + 0.7 * e;
      out.armLX = -2.6 * k; out.armRX = -2.6 * k;
      out.elbowL = 0.3 + (1 - e) * 0.5; out.elbowR = 0.3 + (1 - e) * 0.5;
      out.torsoX = -0.08 - (1 - e) * 0.12;
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
    // keep the sole flat: ankle counter-rotates the knee bend
    j.legL.ankle.rotation.x = -(p.hipLX + p.kneeL) * 0.55;
    j.legR.ankle.rotation.x = -(p.hipRX + p.kneeR) * 0.55;
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
      new THREE.TorusGeometry(66, 0.55, 10, 128),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0x666666, emissiveIntensity: 0.5 })
    );
    rope.rotation.x = -Math.PI / 2;
    rope.position.y = 0.45;
    scene.add(rope);

    // painted boundary line on the grass, so the rope reads from any camera
    const bLine = new THREE.Mesh(
      new THREE.RingGeometry(64.6, 66.0, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    bLine.rotation.x = -Math.PI / 2;
    bLine.position.y = 0.03;
    scene.add(bLine);

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(26.8, 27.1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
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
      const stumpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, emissive: 0x333333, emissiveIntensity: 0.35 });
      [-0.13, 0, 0.13].forEach((x) => {
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.050, 0.72, 10), stumpMat);
        stump.position.set(x, 0.435, z);
        stump.castShadow = true;
        scene.add(stump);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 6), stumpMat);
        tip.position.set(x, 0.79, z);
        scene.add(tip);
      });
      [-0.065, 0.065].forEach((bx) => {
        const bail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8), stumpMat);
        bail.rotation.z = Math.PI / 2;
        bail.position.set(bx, 0.815, z);
        bail.castShadow = true;
        scene.add(bail);
      });
    });

    // ---- stands ----
    const crowd = crowdTexture(THREE);
    // stepped tiers: each ring sits higher and further back than the last
    [[69, 5, 0x243544], [74, 9, 0x1e2c3a], [80, 14, 0x1a2632], [87, 19, 0x16202a]].forEach(([r, h, col], i) => {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 4, h, 64, 1, true),
        i <= 1
          ? new THREE.MeshStandardMaterial({ map: crowd, color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide })
      );
      shell.position.y = h / 2 - 1;
      scene.add(shell);
      // white rim on each tier so the steps read as terraces
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(r + 0.2, 0.12, 6, 96),
        new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.7 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = h - 1;
      scene.add(rim);
    });
    // roof over the back of the stands
    const roof = new THREE.Mesh(
      new THREE.TorusGeometry(90, 1.6, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0x33465a, roughness: 0.9 })
    );
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 19.5;
    scene.add(roof);

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
    // a real rigged glTF wins when one is present; otherwise the procedural rig
    const useGLB = !!(global.PlayerAsset && global.PlayerAsset.available && global.PlayerAsset.available());
    function newPerson(kit, role, skinIdx, useMesh) {
      // a real skinned body from the supplied FBX, used for the players closest to
      // the camera; distant fielders stay procedural to keep the vertex budget sane
      const wantMesh = global.__crsekPlayerModel !== 'classic';
      if (useMesh !== false && wantMesh && global.MeshRig && global.MeshRig.ready) {
        const mesh = global.MeshRig.create(kit, role);
        if (mesh) {
          mesh.userData.role = role;
          mesh.userData.phase = Math.random() * 6.28;
          mesh.userData.pose = {
            torsoX: 0, torsoY: 0, hipsY: 0.94, armLX: 0, armRX: 0, armLZ: 0.08, armRZ: -0.08,
            elbowL: 0, elbowR: 0, hipLX: 0, hipRX: 0, kneeL: 0, kneeR: 0, ankleL: 0, ankleR: 0,
            rootY: 0, tilt: 0
          };
          mesh.userData.drive = (state, t, dt, extra) => {
            const target = targetPose(state, t, mesh, extra);
            if (global.MeshRig) global.MeshRig.apply(mesh, target);
          };
          return mesh;
        }
      }
      if (useGLB) {
        const p = global.PlayerAsset.instantiate(kit);
        if (p) { p.userData.role = role; return p; }
      }
      return makePerson(THREE, kit, role, skinIdx);
    }

    const striker = newPerson('#7fd1ae', 'bat', 1);
    const nonStriker = newPerson('#7fd1ae', 'bat', 3);
    const bowler = newPerson('#ffb4a2', 'bowl', 0);
    const keeper = newPerson('#f0b429', 'keep', 2);
    keeper.visible = false;
    scene.add(striker, nonStriker, bowler, keeper);

    const fielderPool = [];
    for (let i = 0; i < 12; i++) {
      const f = newPerson('#e8eef2', 'field', i % 5, i < 2);
      f.visible = false;
      scene.add(f);
      fielderPool.push(f);
    }

    // two on-field umpires: bowler's end and square leg
    // umpires stay procedural: white coat, hat and dark trousers read as officials
    const umpireA = makePerson(THREE, '#f2f2ec', 'umpire', 0);
    const umpireB = makePerson(THREE, '#f2f2ec', 'umpire', 4);
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

    // manual quality override from the settings sheet
    function setQuality(level) {
      if (level === 'high') {
        quality = 2;
        renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
        renderer.shadowMap.enabled = true; sun.castShadow = true;
      } else if (level === 'low') {
        quality = 0;
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false; sun.castShadow = false;
      } else {
        quality = hiEnd ? 2 : 1;
        renderer.setPixelRatio(Math.min(hiEnd ? 2 : 1.5, global.devicePixelRatio || 1));
        renderer.shadowMap.enabled = hiEnd; sun.castShadow = hiEnd;
      }
      resize();
    }
    function setAutoCamera(role) {
      if (!cam.auto) return;
      const want = (role === 'bat' || role === 'nonstriker' || role === 'waitbat') ? 'batter' : 'broadcast';
      cam.mode = want;
    }
    function cameraMode() { return cam.mode; }

    function placePerson(person, ex, ey, faceY, isMine) {
      person.position.set(ex, 0, ey);
      if (faceY !== null) person.rotation.y = faceY;
      if (person.userData.ring) person.userData.ring.visible = !!isMine;
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

      // advance the mocap catch and read how far through the arc we are
      if (catchPlay) {
        const env = global.CatchAnim ? global.CatchAnim.update(dt) : null;
        catchEnv = env ? Math.max(env.l, env.r) : 0;
        catchElapsed += dt;                       // frame-time based, not wall clock
        if (catchElapsed > (global.CatchAnim && global.CatchAnim.clip ? global.CatchAnim.clip.duration : 2.6)) {
          catchPlay = null; catchEnv = 0;
        }
      }

      // run-up happens during 'delivery' (before the ball is released), then the
      // action completes on release and settles into the follow-through
      if (state.phase === 'delivery') runUp = Math.min(1, runUp + dt / 0.75);
      else if (state.phase === 'flight') runUp = 1;
      else if (state.phase === 'inplay' || state.phase === 'result') runUp = Math.max(0.62, runUp - dt * 0.9);
      else runUp = Math.max(0, runUp - dt * 1.6);

      // striker / non-striker
      const batTeam = state.teams[state.batTeam];
      const strikerP = batTeam.players.find((p) => p.id === state.strikerId) || {};
      const nsP = batTeam.players.find((p) => p.id === state.nonStrikerId) || {};
      if (striker.userData.joints) striker.userData.joints.torso.material.color.set(strikerP.kit || '#7fd1ae');
      if (nonStriker.userData.joints) nonStriker.userData.joints.torso.material.color.set(nsP.kit || '#7fd1ae');

      const guard = state.batsman || { x: 0, y: 0, ready: true };
      placePerson(striker, 0.42 + (guard.x || 0), 8.9 + (guard.y || 0), Math.PI, state.strikerId === myPid);
      placePerson(nonStriker, -0.55, -8.9, 0, state.nonStrikerId === myPid);

      if (swing) {
        const elapsed = performance.now() - swing.start;
        if (elapsed > 620) swing = null;
        else {
          const k = Math.min(1, elapsed / 520);
          if (striker.userData.drive) striker.userData.drive('swing', t, dt, { k: k, type: swing.type, foot: swing.foot });
          else animate(striker, 'swing', t, dt, { k: k, type: swing.type, foot: swing.foot });
          striker.rotation.y = Math.PI + (swing.dir * 0.5) * Math.PI / 180;
        }
      } else if (guard.ready === false) {
        // standing up, waiting to take guard
        if (striker.userData.drive) striker.userData.drive('idle', t, dt);
        else animate(striker, 'idle', t, dt);
      } else if (striker.userData.drive) striker.userData.drive('stance', t, dt);
      else animate(striker, 'stance', t, dt);
      if (nonStriker.userData.drive) nonStriker.userData.drive('stance', t, dt);
      else animate(nonStriker, 'stance', t, dt);

      // bowler run-up and release
      const bowlerZ = -20 + runUp * 8.6;      // top of the mark to the crease
      placePerson(bowler, 0.6, bowlerZ, Math.PI, state.bowlerId === myPid);
      if (runUp > 0.02 && runUp < 0.78) {
        // running in to bowl
        if (bowler.userData.drive) bowler.userData.drive('run', t, dt);
        else animate(bowler, 'run', t, dt);
      } else if (runUp >= 0.78) {
        // gather, arm over, follow through
        const k = Math.min(1, (runUp - 0.78) / 0.22);
        if (bowler.userData.drive) bowler.userData.drive('bowl', t, dt, { k: k });
        else animate(bowler, 'bowl', t, dt, { k: k });
      } else if (bowler.userData.drive) bowler.userData.drive('stance', t, dt);
      else animate(bowler, 'stance', t, dt);

      // fielders (keeper handled separately so it can wear pads)
      const fs = state.fielders || [];
      let poolIdx = 0;
      keeper.visible = false;
      fielderPool.forEach((f) => { f.visible = false; });
      fs.forEach((sp) => {
        let person;
        if (sp.keeper) { person = keeper; keeper.visible = true; }
        else { person = fielderPool[poolIdx++]; if (!person) return; person.visible = true; }
        if (person.userData.joints) person.userData.joints.torso.material.color.set(sp.kit || (sp.keeper ? '#f0b429' : '#e8eef2'));
        placePerson(person, sp.x, sp.y, Math.PI, sp.ownerId && sp.ownerId === myPid);
        // animation follows the fielder's actual speed, so a player standing in
        // the field stands still instead of jogging on the spot
        const lx = person.userData.lastX;
        const ly = person.userData.lastY;
        let speed = 0;
        if (lx != null && dt > 0) speed = Math.hypot(sp.x - lx, sp.y - ly) / dt;
        person.userData.lastX = sp.x;
        person.userData.lastY = sp.y;
        const catching = catchPlay && sp.keeper;
        const fState = catching ? 'catch' : speed > 3.2 ? 'run' : speed > 0.5 ? 'walk' : 'stance';
        const extra = catching ? { env: catchEnv } : undefined;
        if (person.userData.drive) person.userData.drive(fState, t, dt, extra);
        else animate(person, fState, t, dt, extra);
      });

      if (umpireA.userData.drive) umpireA.userData.drive('stance', t, dt); else animate(umpireA, 'stance', t, dt);
      if (umpireB.userData.drive) umpireB.userData.drive('stance', t * 0.8, dt); else animate(umpireB, 'stance', t * 0.8, dt);

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

      if (catchCam && performance.now() < catchCam.until) {
        // sit behind the catcher so the take is on screen
        targetPos.set(catchCam.x * 0.8, 6.5, catchCam.y - 9);
        targetLook.set(catchCam.x, 1.1, catchCam.y);
      } else if (live && b && cam.mode !== 'top' && cam.mode !== 'portrait' && cam.mode !== 'side') {
        // action camera: frame the ball together with the two closest fielders,
        // so the chase is always on screen even on a narrow portrait phone
        const near = (fs || [])
          .slice()
          .sort((a, c) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(c.x - bx, c.y - by))
          .slice(0, 2);
        const cx = (bx + near.reduce((sum, f) => sum + f.x, 0)) / (1 + near.length);
        const cy = (by + near.reduce((sum, f) => sum + f.y, 0)) / (1 + near.length);
        const spread = Math.max(8, ...near.map((f) => Math.hypot(f.x - bx, f.y - by)));
        const back = clamp(17 + spread * 0.8, 17, 36);
        const up = clamp(9.5 + spread * 0.5, 9.5, 24);
        targetPos.set(cx * 0.7, up, cy - back);
        targetLook.set(cx, 0.8, cy);
      } else if (cam.mode === 'batter') {
        // over the striker's shoulder down the pitch; pulls back as the ball flies away
        // offset to the off side so the striker sits clear of the shot buttons
        const back = 19 + Math.min(5, ballDist * 0.14);
        targetPos.set(0.5 + bx * 0.2, 8.2 + Math.min(2, ballDist * 0.07), back);
        targetLook.set(1.2 + bx * 0.35, 0.9, live ? Math.min(10, (10 + by) / 2) : -4);
      } else if (cam.mode === 'broadcast') {
        // follows the ball so the batter, ball and chasing fielders stay in frame
        const back = clamp(30 + ballDist * 0.4, 30, 50);
        const up = clamp(19 + ballDist * 0.22, 19, 34);
        targetPos.set(bx * 0.45, up, -back);
        targetLook.set(bx * 0.5, 1.5, (10 + by) / 2 + 2);
      } else if (cam.mode === 'side') {
        // QA view: the striker from the off side, to check stance and bat path
        const sx = striker.position.x, sz = striker.position.z;
        targetPos.set(sx + 3.2, 1.55, sz + 0.6);
        targetLook.set(sx, 1.0, sz);
      } else if (cam.mode === 'portrait') {
        // tight on the striker: used for checking character detail
        const sx = striker.position.x, sz = striker.position.z;
        targetPos.set(sx + 0.55, 1.62, sz + 2.9);
        targetLook.set(sx, 1.15, sz);
      } else {
        targetPos.set(0, 74, 0.1);
        targetLook.set(bx * 0.3, 0, by * 0.4);
      }
      // smooth, frame-rate independent easing — fast enough that the ball never
      // leaves the frame, slow enough that it never looks like a cut
      const rate = live ? 9 : state.phase === 'flight' ? 7 : 4.5;
      const k = 1 - Math.exp(-dt * rate);
      if (camera.position.distanceTo(targetPos) > 6) camera.position.copy(targetPos);
      else camera.position.lerp(targetPos, k);
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

    let swing = null;
    let catchPlay = null;
    let catchCam = null;      // { until, x, y } — swings the camera onto the catch
    let catchEnv = 0;
    let catchElapsed = 0;

    function focusCatch(x, y) {
      catchCam = { until: performance.now() + 1700, x: x, y: y };
    }

    function playCatch() {
      if (global.CatchAnim && global.CatchAnim.ready) {
        global.CatchAnim.restart();
        catchPlay = performance.now();
        catchEnv = 0;
        catchElapsed = 0;
      }
    }
    function onShot(info) {
      swing = {
        start: performance.now(),
        type: (info && info.type) || 'drive',
        dir: (info && info.dir) || 0,
        foot: (info && info.foot) || 'neutral'
      };
    }

    return { usingGLB: useGLB, renderer, scene, camera, resize, render, setCameraMode, setAutoCamera, cameraMode, setPreview, clearPreview, setReviewPath, clearReviewPath, setQuality, playCatch, focusCatch, onShot, dispose() { renderer.dispose(); } };
  }

  global.View3D = { create };
})(window);
