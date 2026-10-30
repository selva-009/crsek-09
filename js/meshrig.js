/* Crsek-09 — mesh player rig.
   Uses the skinned Mixamo character from assets/anim/catch.fbx as the player body:
   clones it per player, tints it to the kit, and poses its bones from the same
   pose targets the procedural rig uses. Falls back to the procedural rig if the
   FBX is missing, so the game never depends on the asset being present. */
(function (global) {
  'use strict';

  const MeshRig = {
    source: null,          // the loaded FBX scene (from CatchAnim)
    ready: false,

    // Bind the rig to an already-loaded FBX object.
    init(obj) {
      if (!obj) return false;
      let surface = null;
      obj.traverse((o) => {
        if (o.isSkinnedMesh && /surface/i.test(o.name)) surface = o;
        else if (o.isSkinnedMesh && !surface) surface = o;
      });
      if (!surface || !surface.skeleton) return false;
      this.source = obj;
      this.surfaceName = surface.name;
      this.ready = true;
      return true;
    },

    // A ready-to-place player: 1.8 m tall, feet on the ground, tinted to the kit.
    create(kitColor, role) {
      const THREE = global.THREE;
      if (!this.ready) return null;

      const model = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone)
        ? THREE.SkeletonUtils.clone(this.source)
        : this.source.clone(true);

      // the source object is hidden (it only drives the catch clip) — clones must not inherit that
      model.visible = true;
      model.traverse((o) => { o.visible = true; });

      let surface = null;
      model.traverse((o) => {
        if (o.isSkinnedMesh) {
          // the inner "joints" mesh roughly doubles the vertex cost for no visible gain
          if (/joint/i.test(o.name)) { o.visible = false; return; }
          o.castShadow = true;
          o.frustumCulled = false;
          if (o.name === this.surfaceName) surface = o;
          if (o.material) {
            o.material = o.material.clone();
            const isJoint = /joint/i.test(o.name);
            if (o.material.color) {
              o.material.color.set(isJoint ? '#2a3138' : (kitColor || '#7fd1ae'));
            }
            o.material.roughness = isJoint ? 0.9 : 0.72;
            o.material.metalness = 0.02;
          }
        }
      });
      if (!surface) model.traverse((o) => { if (o.isSkinnedMesh && !surface) surface = o; });

      // wrap so the cm-scale rig becomes metres without touching the skinned object
      const wrap = new THREE.Group();
      wrap.add(model);
      wrap.scale.setScalar(0.01);
      model.updateMatrixWorld(true);

      // a bat for the batters, parented to the hand bone (bone space is cm)
      if (role === 'bat') {
        let hand = null;
        model.traverse((o) => { if (o.isBone && o.name === 'mixamorigRightHand' && !hand) hand = o; });
        if (hand) {
          const batMat = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.55 });
          const gripMat = new THREE.MeshStandardMaterial({ color: 0x222b33, roughness: 0.9 });
          const bat = new THREE.Group();
          const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 24, 8), gripMat);
          handle.position.y = 12;
          bat.add(handle);
          const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 52, 3.6), batMat);
          blade.position.y = -20;
          bat.add(blade);
          bat.rotation.x = Math.PI / 2;     // lie the bat along the hand's forward axis
          bat.position.set(0, -4, 0);
          hand.add(bat);
        }
      }

      const bones = {};
      const bind = {};
      if (surface && surface.skeleton) {
        surface.skeleton.bones.forEach((b) => {
          if (!bones[b.name]) { bones[b.name] = b; bind[b.name] = b.quaternion.clone(); }
        });
      }

      wrap.userData = { isMesh: true, bones, bind, kit: kitColor, role: role };
      return wrap;
    },

    // pose target -> bone deltas. Arms hang at rest, so the shoulder base is a
    // rotation that brings them down from the T-pose, mirrored per side.
    apply(wrap, pose, shotType) {
      const THREE = global.THREE;
      const b = wrap.userData.bones;
      const bind = wrap.userData.bind;
      if (!b || !bind) return;
      const e = new THREE.Euler();
      const q = new THREE.Quaternion();

      const set = (name, x, y, z) => {
        const bone = b[name];
        if (!bone) return;
        e.set(x || 0, y || 0, z || 0);
        q.setFromEuler(e);
        bone.quaternion.copy(bind[name]).multiply(q);
      };

      const ARM_DOWN = 1.28;
      const isBat = wrap.userData.role === 'bat';
      const torsoY = pose.torsoY || 0;
      const torsoX = pose.torsoX || 0;

      set('mixamorigSpine', torsoX * 0.5, torsoY * 0.6, 0);
      set('mixamorigSpine1', torsoX * 0.4, torsoY * 0.3, 0);
      set('mixamorigHead', -(torsoX * 0.4), -torsoY * 0.4, 0);

      // shoulders: base down-pose plus the animated pitch (negative = raised)
      if (isBat) {
        // bat held across the body, hands together — a batting stance, not arms hanging
        set('mixamorigRightArm', 0.62 + (pose.armRX || 0) * 0.8, 0, -0.45);
        set('mixamorigLeftArm', -0.34 - (pose.armLX || 0) * 0.8, 0, 0.62);
      } else {
        set('mixamorigRightArm', ARM_DOWN + (pose.armRX || 0), 0, -0.12);
        set('mixamorigLeftArm', -ARM_DOWN - (pose.armLX || 0), 0, 0.12);
      }
      set('mixamorigRightForeArm', -(pose.elbowR || 0) * 1.1, 0, 0);
      set('mixamorigLeftForeArm', (pose.elbowL || 0) * 1.1, 0, 0);

      set('mixamorigRightUpLeg', pose.hipRX || 0, 0, -0.05);
      set('mixamorigLeftUpLeg', pose.hipLX || 0, 0, 0.05);
      set('mixamorigRightLeg', -(pose.kneeR || 0) * 1.15, 0, 0);
      set('mixamorigLeftLeg', -(pose.kneeL || 0) * 1.15, 0, 0);
    }
  };

  global.MeshRig = MeshRig;
})(window);
