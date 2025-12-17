import { clamp, haptic, getWorldPos, niceId } from '../utils.js';
import { getNodeLabel } from './nodes.js';

/**
 * Locomotion (rig-relative; stable).
 */
AFRAME.registerComponent('locomotion-rig', {
  schema: {
    leftHand: { type: 'selector' },
    rightHand: { type: 'selector' },
    moveSpeed: { type: 'number', default: 2.4 },
    turnSpeed: { type: 'number', default: 72 },
    deadzone: { type: 'number', default: 0.18 }
  },
  init() {
    this._move = { x: 0, y: 0 };
    this._turn = { x: 0, y: 0 };

    const lh = this.data.leftHand;
    const rh = this.data.rightHand;

    if (lh) {
      lh.addEventListener('thumbstickmoved', e => { this._move.x = e.detail.x; this._move.y = e.detail.y; });
      lh.addEventListener('thumbstickup', () => { this._move.x = 0; this._move.y = 0; });
    }
    if (rh) {
      rh.addEventListener('thumbstickmoved', e => { this._turn.x = e.detail.x; this._turn.y = e.detail.y; });
      rh.addEventListener('thumbstickup', () => { this._turn.x = 0; this._turn.y = 0; });
    }

    this._tmp = new THREE.Vector3();
  },
  tick(_, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    const dz = this.data.deadzone;

    // Turn (right stick X)
    const tx = Math.abs(this._turn.x) > dz ? this._turn.x : 0;
    if (tx) {
      const turnDeg = this.data.turnSpeed * dt * tx;
      this.el.object3D.rotation.y -= THREE.MathUtils.degToRad(turnDeg);
    }

    // Move (left stick). Oculus y is typically -1 when pushing forward, so forward = -y.
    const mx = Math.abs(this._move.x) > dz ? this._move.x : 0;
    const my = Math.abs(this._move.y) > dz ? this._move.y : 0;
    if (!mx && !my) return;

    const forwardAxis = -my;
    const strafeAxis = mx;

    const yaw = this.el.object3D.rotation.y;

    // Rig-relative basis (stable regardless of head direction)
    const fwd = this._tmp.set(-Math.sin(yaw), 0, -Math.cos(yaw)); // forward
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); // right

    const move = new THREE.Vector3()
      .copy(fwd).multiplyScalar(forwardAxis)
      .add(right.multiplyScalar(strafeAxis));

    if (move.lengthSq() < 1e-6) return;
    move.normalize();

    this.el.object3D.position.addScaledVector(move, this.data.moveSpeed * dt);
  }
});

/**
 * Main controller logic:
 * Trigger select / click UI
 * Grip drag node
 * Both grips => manipulate whole workspace (move/rotate/zoom)
 * A add node at ray hit surface (or in front)
 * B delete selected
 * Y link mode
 * X rename
 */
AFRAME.registerComponent('mind-controls', {
  schema: {
    leftHand: { type: 'selector' },
    rightHand: { type: 'selector' },
    workspace: { type: 'selector' },
    root: { type: 'selector' },
    ring: { type: 'selector' },
    keyboard: { type: 'selector' }
  },
  init() {
    this.selected = null;
    this.linkFrom = null;

    this.gripHeld = { left: false, right: false };
    this.dragNode = { left: null, right: null };
    this.dragOffsetW = { left: new THREE.Vector3(), right: new THREE.Vector3() };

    // Trigger hold state
    this.triggerState = {
      left: { active: false, time: 0, created: false, indicator: null },
      right: { active: false, time: 0, created: false, indicator: null }
    };
    this.CREATE_THRESHOLD = 0.8; // seconds

    this.worldMode = false;
    this.wm = {
      startDist: 1,
      startScale: 1,
      startRotY: 0,
      startPos: new THREE.Vector3(),
      startMid: new THREE.Vector3(),
      startAngle: 0
    };

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpC = new THREE.Vector3();

    this.ringComp = this.data.ring?.components['selection-ring'];
    this.kbComp = this.data.keyboard?.components['vr-keyboard'];

    const lh = this.data.leftHand;
    const rh = this.data.rightHand;

    lh.addEventListener('triggerdown', () => this.onTriggerDown(lh));
    rh.addEventListener('triggerdown', () => this.onTriggerDown(rh));
    lh.addEventListener('triggerup', () => this.onTriggerUp(lh));
    rh.addEventListener('triggerup', () => this.onTriggerUp(rh));

    lh.addEventListener('gripdown', () => this.onGripDown('left', lh));
    rh.addEventListener('gripdown', () => this.onGripDown('right', rh));
    lh.addEventListener('gripup', () => this.onGripUp('left'));
    rh.addEventListener('gripup', () => this.onGripUp('right'));

    // Buttons
    rh.addEventListener('abuttondown', () => this.addNodeFromRay(rh));
    rh.addEventListener('bbuttondown', () => this.deleteSelected());
    lh.addEventListener('ybuttondown', () => this.toggleLinkMode());
    lh.addEventListener('xbuttondown', () => this.renameSelected());

    // Desktop JSON helpers wiring
    this.setupJSONDesktop();
  },

  // --- Ray helpers
  getRayHit(handEl) {
    const ray = handEl?.components?.raycaster;
    const hits = ray?.intersections;
    if (!hits || !hits.length) return null;
    return hits[0]; // closest
  },
  findHit(handEl, cls) {
    const ray = handEl?.components?.raycaster;
    const hits = ray?.intersections;
    if (!hits || !hits.length) return null;

    for (const hit of hits) {
      let el = hit.object?.el;
      while (el && el !== this.el.sceneEl) {
        if (el.classList?.contains(cls)) return { el, hit };
        el = el.parentEl;
      }
    }
    return null;
  },

  // --- Selection & UI clicks
  onTriggerDown(handEl) {
    const side = (handEl === this.data.leftHand) ? 'left' : 'right';
    const state = this.triggerState[side];
    state.active = true;
    state.time = 0;
    state.created = false;

    // Create indicator
    if (!state.indicator) {
      const el = document.createElement('a-sphere');
      el.setAttribute('radius', 0.01);
      el.setAttribute('material', 'shader: flat; color: #ffffff; opacity: 0.5; transparent: true');
      handEl.appendChild(el);
      state.indicator = el;
    }
    state.indicator.object3D.visible = true;
    state.indicator.object3D.scale.set(0.1, 0.1, 0.1);
    // Position it at the tip? Hand controller models vary, but 0,0,0 is usually grip.
    // Let's put it slightly forward.
    state.indicator.object3D.position.set(0, -0.02, -0.05); 
  },

  onTriggerUp(handEl) {
    const side = (handEl === this.data.leftHand) ? 'left' : 'right';
    const state = this.triggerState[side];
    
    if (state.indicator) {
      state.indicator.object3D.visible = false;
    }

    if (!state.active) return;
    state.active = false;

    // If we haven't created a node yet, treat as click/select
    if (!state.created) {
      this.doSelectOrClick(handEl);
    }
  },

  doSelectOrClick(handEl) {
    // 1) If keyboard/UI is hit => click it
    const ui = this.findHit(handEl, 'hitUI');
    if (ui) {
      ui.el.emit('click');
      haptic(handEl, 0.22, 28);
      return;
    }

    // 2) Node select
    const nodeHit = this.findHit(handEl, 'hitNode');
    if (!nodeHit) return;

    const nodeEl = this.getNodeEntity(nodeHit.el);
    if (!nodeEl) return;

    // link flow
    if (this.linkFrom && this.linkFrom !== nodeEl) {
      this.createLink(this.linkFrom, nodeEl);
      this.linkFrom = null;
    }

    this.selectNode(nodeEl);
    haptic(handEl, 0.25, 30);
  },

  onTrigger(handEl) {
    // Deprecated, split into Down/Up/Tick
  },

  getNodeEntity(anyEl) {
    // climb up to entity that has mind-node component
    let el = anyEl;
    while (el && el !== this.el.sceneEl) {
      if (el.components?.['mind-node']) return el;
      el = el.parentEl;
    }
    return null;
  },

  selectNode(nodeEl) {
    this.selected = nodeEl;
    if (this.ringComp) this.ringComp.setTarget(nodeEl);
    nodeEl.setAttribute('animation__sel', 'property: scale; to: 1.08 1.08 1.08; dur: 120; easing: easeOutQuad');
  },

  // --- Link mode
  toggleLinkMode() {
    if (!this.selected) return;
    this.linkFrom = this.selected;
    haptic(this.data.leftHand, 0.35, 55);
  },

  // --- Rename
  renameSelected() {
    if (!this.selected || !this.kbComp) return;
    this.kbComp.openFor(this.selected);
    haptic(this.data.leftHand, 0.25, 40);
  },

  // --- Delete
  deleteSelected() {
    if (!this.selected) return;

    const root = this.data.root;
    const id = this.selected.id;

    // remove links referencing id
    root.querySelectorAll('[link-tube]').forEach(el => {
      const from = el.getAttribute('data-from');
      const to = el.getAttribute('data-to');
      if (from === id || to === id) el.parentNode && el.parentNode.removeChild(el);
    });

    // remove node
    const gone = this.selected;
    this.selected = null;
    this.linkFrom = null;
    if (this.ringComp) this.ringComp.setTarget(null);
    gone.parentNode && gone.parentNode.removeChild(gone);

    haptic(this.data.rightHand, 0.40, 70);
  },

  // --- Add node at hand position
  addNodeAtHand(handEl) {
    const root = this.data.root;
    
    const handPos = new THREE.Vector3();
    handEl.object3D.getWorldPosition(handPos);
    
    // convert world -> root local
    const local = handPos.clone();
    root.object3D.worldToLocal(local);

    this.createNode(local);
    haptic(handEl, 0.5, 80);
  },

  createNode(localPos) {
    const root = this.data.root;
    const palette = ['#00F0FF', '#FF4FD8', '#7CFF6B', '#FFD24D', '#9B7CFF'];
    const color = palette[Math.floor(Math.random() * palette.length)];
    const label = ['Idea', 'Note', 'Task', 'Branch', 'Signal', 'Edge'][Math.floor(Math.random() * 6)];

    const id = niceId('n');
    const nodeEl = document.createElement('a-entity');
    nodeEl.setAttribute('id', id);
    nodeEl.setAttribute('position', `${localPos.x.toFixed(3)} ${localPos.y.toFixed(3)} ${localPos.z.toFixed(3)}`);
    nodeEl.setAttribute('mind-node', `label: ${label}; color: ${color}; size: 0.15`);
    nodeEl.setAttribute('data-color', color);
    root.appendChild(nodeEl);

    // auto-link if linkFrom armed OR if there is a selected node
    if (this.linkFrom && this.linkFrom !== nodeEl) {
      this.createLink(this.linkFrom, nodeEl, color);
      this.linkFrom = null;
    } else if (this.selected && this.selected !== nodeEl) {
      // optional: create link from selected when adding
      this.createLink(this.selected, nodeEl, color);
    }

    this.selectNode(nodeEl);
  },

  // --- Add node (A): at ray hit surface, otherwise in front of camera
  addNodeFromRay(handEl) {
    const root = this.data.root;
    // const ws = this.data.workspace; // Unused

    const hitSurface = this.findHit(handEl, 'hitSurface');
    let spawnWorld = new THREE.Vector3();

    if (hitSurface) {
      spawnWorld.copy(hitSurface.hit.point);
      spawnWorld.y = Math.max(0.6, spawnWorld.y); // keep above floor a bit if needed
    } else {
      const cam = document.querySelector('#camera');
      const camPos = new THREE.Vector3();
      const dir = new THREE.Vector3();
      cam.object3D.getWorldPosition(camPos);
      cam.object3D.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      spawnWorld.copy(camPos).add(dir.multiplyScalar(1.8));
      spawnWorld.y = 1.55;
    }

    // convert world -> root local
    const local = spawnWorld.clone();
    root.object3D.worldToLocal(local);

    this.createNode(local);
    haptic(handEl, 0.32, 55);
  },

  createLink(fromEl, toEl, color) {
    const root = this.data.root;
    if (!fromEl || !toEl) return;

    // avoid duplicates
    const exists = root.querySelector(`[data-from="${fromEl.id}"][data-to="${toEl.id}"],[data-from="${toEl.id}"][data-to="${fromEl.id}"]`);
    if (exists) return;

    const c = color || fromEl.getAttribute('data-color') || '#00F0FF';

    const linkEl = document.createElement('a-entity');
    linkEl.setAttribute('link-tube', `from: #${fromEl.id}; to: #${toEl.id}; color: ${c}; thickness: 0.012; opacity: 0.9`);
    linkEl.setAttribute('data-from', fromEl.id);
    linkEl.setAttribute('data-to', toEl.id);
    root.appendChild(linkEl);

    haptic(this.data.leftHand, 0.20, 30);
  },

  // --- Grip handling: single grip = drag node; both grips = world mode
  onGripDown(side, handEl) {
    this.gripHeld[side] = true;

    // If the other grip is already held => start world mode immediately
    if (this.gripHeld.left && this.gripHeld.right) {
      this.startWorldMode();
      haptic(this.data.leftHand, 0.25, 40);
      haptic(this.data.rightHand, 0.25, 40);
      return;
    }

    // else: try grab node under this hand ray
    const nodeHit = this.findHit(handEl, 'hitNode');
    if (!nodeHit) return;

    const nodeEl = this.getNodeEntity(nodeHit.el);
    if (!nodeEl) return;

    this.selectNode(nodeEl);

    // store world offset: nodeWorld - handWorld
    const handW = getWorldPos(handEl, this._tmpA);
    const nodeW = getWorldPos(nodeEl, this._tmpB);
    this.dragNode[side] = nodeEl;
    this.dragOffsetW[side].copy(nodeW).sub(handW);

    haptic(handEl, 0.28, 45);
  },

  onGripUp(side) {
    this.gripHeld[side] = false;
    this.dragNode[side] = null;

    // leaving world mode if one grip released
    if (this.worldMode && !(this.gripHeld.left && this.gripHeld.right)) {
      this.worldMode = false;
    }
  },

  startWorldMode() {
    this.worldMode = true;
    // cancel node drags
    this.dragNode.left = null;
    this.dragNode.right = null;

    const ws = this.data.workspace;
    const lh = this.data.leftHand;
    const rh = this.data.rightHand;

    const lp = getWorldPos(lh, this._tmpA);
    const rp = getWorldPos(rh, this._tmpB);

    const mid = lp.clone().add(rp).multiplyScalar(0.5);
    const vec = rp.clone().sub(lp); vec.y = 0;

    this.wm.startDist = Math.max(0.0001, lp.distanceTo(rp));
    this.wm.startScale = ws.object3D.scale.x;
    this.wm.startRotY = ws.object3D.rotation.y;
    this.wm.startPos.copy(ws.object3D.position);
    this.wm.startMid.copy(mid);
    this.wm.startAngle = Math.atan2(vec.z, vec.x);
  },

  tick(t, dtMs) {
    const dt = dtMs / 1000;
    
    // Check triggers for hold
    for (const side of ['left', 'right']) {
      const state = this.triggerState[side];
      if (state.active && !state.created) {
        state.time += dt;
        
        // Animate indicator
        if (state.indicator) {
          const progress = Math.min(1, state.time / this.CREATE_THRESHOLD);
          const s = 0.02 + (progress * 0.15); // Grow
          state.indicator.object3D.scale.set(s, s, s);
          state.indicator.setAttribute('material', 'color', progress > 0.9 ? '#7CFF6B' : '#ffffff');
        }

        if (state.time > this.CREATE_THRESHOLD) {
          state.created = true;
          const hand = (side === 'left') ? this.data.leftHand : this.data.rightHand;
          this.addNodeAtHand(hand);
          if (state.indicator) state.indicator.object3D.visible = false;
        }
      }
    }

    const root = this.data.root;
    const ws = this.data.workspace;

    // World mode: both grips held => manipulate workspace
    if (this.worldMode && this.gripHeld.left && this.gripHeld.right) {
      const lh = this.data.leftHand;
      const rh = this.data.rightHand;

      const lp = getWorldPos(lh, this._tmpA);
      const rp = getWorldPos(rh, this._tmpB);

      // scale
      const dist = Math.max(0.0001, lp.distanceTo(rp));
      const scaleFactor = dist / this.wm.startDist;
      const s = clamp(this.wm.startScale * scaleFactor, 0.20, 5.0);
      ws.object3D.scale.set(s, s, s);

      // rotation (Y) via hand vector angle
      const vec = rp.clone().sub(lp); vec.y = 0;
      const ang = Math.atan2(vec.z, vec.x);
      const dAng = ang - this.wm.startAngle;
      ws.object3D.rotation.y = this.wm.startRotY + dAng;

      // pan via midpoint delta
      const mid = lp.clone().add(rp).multiplyScalar(0.5);
      const delta = mid.clone().sub(this.wm.startMid);
      ws.object3D.position.copy(this.wm.startPos).add(delta);

      return;
    }

    // Node dragging (single grip)
    for (const side of ['left', 'right']) {
      const node = this.dragNode[side];
      if (!node) continue;

      const handEl = (side === 'left') ? this.data.leftHand : this.data.rightHand;

      const handW = getWorldPos(handEl, this._tmpA);
      const desiredW = handW.clone().add(this.dragOffsetW[side]);

      // convert world -> root local (because workspace might be transformed)
      const local = desiredW.clone();
      root.object3D.worldToLocal(local);

      node.setAttribute('position', `${local.x} ${local.y} ${local.z}`);
    }
  },

  // --- JSON Desktop helpers
  exportJSON() {
    const root = this.data.root;
    const nodes = [];
    root.querySelectorAll('[mind-node]').forEach(n => {
      const pos = n.getAttribute('position');
      const label = getNodeLabel(n) || n.id;
      const attr = n.getAttribute('mind-node');
      nodes.push({
        id: n.id,
        label,
        pos: [pos.x, pos.y, pos.z],
        color: attr?.color || n.getAttribute('data-color') || '#00F0FF',
        size: attr?.size || 0.16
      });
    });

    const links = [];
    root.querySelectorAll('[link-tube]').forEach(l => {
      const lt = l.getAttribute('link-tube');
      links.push({
        from: l.getAttribute('data-from'),
        to: l.getAttribute('data-to'),
        color: lt?.color || '#00F0FF',
        thickness: lt?.thickness || 0.012
      });
    });

    const obj = { nodes, links };
    const script = document.getElementById('mindmap-json');
    script.textContent = JSON.stringify(obj, null, 2);

    const box = document.getElementById('jsonBox');
    box.value = script.textContent;
  },

  setupJSONDesktop() {
    const toggleBtn = document.getElementById('toggleJson');
    const applyBtn = document.getElementById('applyJson');
    const exportBtn = document.getElementById('exportJson');
    const box = document.getElementById('jsonBox');
    const jsonScript = document.getElementById('mindmap-json');
    const root = this.data.root;

    const syncFromScript = () => { box.value = jsonScript.textContent.trim(); };

    toggleBtn.addEventListener('click', () => {
      const open = box.style.display !== 'none';
      box.style.display = open ? 'none' : 'block';
      if (!open) syncFromScript();
    });

    applyBtn.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(box.value);
        jsonScript.textContent = JSON.stringify(parsed, null, 2);
        const mm = root?.components?.mindmap;
        if (mm) mm.rebuild();
      } catch (e) {
        alert('JSON error:\n' + e.message);
      }
    });

    exportBtn.addEventListener('click', () => {
      this.exportJSON();
      box.style.display = 'block';
    });
  }
});

