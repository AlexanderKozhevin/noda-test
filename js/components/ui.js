import { getNodeLabel, setNodeLabel } from './nodes.js';

/**
 * Neon frame component for title.
 */
AFRAME.registerComponent('neon-frame', {
  schema: { w: { type: 'number', default: 10 }, h: { type: 'number', default: 3 }, color: { type: 'string', default: '#00F0FF' } },
  init() {
    const { w, h, color } = this.data;
    const mk = (pos, scale) => {
      const e = document.createElement('a-box');
      e.setAttribute('position', pos);
      e.setAttribute('scale', scale);
      e.setAttribute('material', `shader: standard; color:#07070d; metalness:0.4; roughness:0.22; emissive:${color}; emissiveIntensity: 1.15;`);
      e.setAttribute('opacity', '0.95');
      e.setAttribute('transparent', 'true');
      e.setAttribute('animation__pulse', 'property: material.emissiveIntensity; dir: alternate; dur: 1400; loop: true; to: 1.55; easing: easeInOutSine');
      this.el.appendChild(e);
    };
    mk(`0 ${h / 2} 0`, `${w} 0.06 0.06`);
    mk(`0 ${-h / 2} 0`, `${w} 0.06 0.06`);
    mk(`${-w / 2} 0 0`, `0.06 ${h} 0.06`);
    mk(`${w / 2} 0 0`, `0.06 ${h} 0.06`);
  }
});

/**
 * Selection ring component.
 */
AFRAME.registerComponent('selection-ring', {
  init() {
    const ring = document.createElement('a-torus');
    ring.setAttribute('radius', 0.28);
    ring.setAttribute('radius-tubular', 0.012);
    ring.setAttribute('rotation', '90 0 0');
    ring.setAttribute('material', 'shader: standard; color:#050510; metalness:0.2; roughness:0.25; emissive:#00F0FF; emissiveIntensity: 1.55; opacity:0.9; transparent:true;');
    ring.setAttribute('animation__spin', 'property: rotation; to: 90 360 0; loop: true; dur: 2400; easing: linear');
    this.el.appendChild(ring);
  },
  setTarget(nodeEl) {
    if (!nodeEl) { this.el.setAttribute('visible', 'false'); return; }
    nodeEl.object3D.add(this.el.object3D);
    this.el.object3D.position.set(0, 0, 0);
    this.el.setAttribute('visible', 'true');
  }
});

/**
 * Simple VR keyboard (X to open, Trigger to click).
 */
AFRAME.registerComponent('vr-keyboard', {
  init() {
    this.value = '';
    this.targetNode = null;

    const bg = document.createElement('a-plane');
    bg.classList.add('hitUI');
    bg.setAttribute('width', '1.45');
    bg.setAttribute('height', '0.78');
    bg.setAttribute('material', 'shader: standard; color:#02020a; opacity:0.62; transparent:true; emissive:#00131a; emissiveIntensity:0.85; roughness:1.0; metalness:0.0');
    this.el.appendChild(bg);

    const title = document.createElement('a-text');
    title.setAttribute('value', 'Rename node');
    title.setAttribute('align', 'center');
    title.setAttribute('width', '2.4');
    title.setAttribute('color', '#8ff0ff');
    title.setAttribute('position', '0 0.32 0.01');
    this.el.appendChild(title);

    this.display = document.createElement('a-text');
    this.display.setAttribute('value', '');
    this.display.setAttribute('align', 'center');
    this.display.setAttribute('width', '2.6');
    this.display.setAttribute('color', '#e9fbff');
    this.display.setAttribute('position', '0 0.24 0.01');
    this.el.appendChild(this.display);

    const keys = [
      'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P',
      'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L',
      'Z', 'X', 'C', 'V', 'B', 'N', 'M',
      'SPACE', 'BKSP', 'DONE'
    ];

    const makeKey = (label, x, y, w = 0.12) => {
      const k = document.createElement('a-entity');
      k.classList.add('hitUI');
      k.setAttribute('position', `${x} ${y} 0.01`);

      const box = document.createElement('a-box');
      box.classList.add('hitUI');
      box.setAttribute('width', w);
      box.setAttribute('height', '0.08');
      box.setAttribute('depth', '0.03');
      box.setAttribute('material', 'shader: standard; color:#07070d; metalness:0.2; roughness:0.4; emissive:#00F0FF; emissiveIntensity:0.55; opacity:0.92; transparent:true');
      k.appendChild(box);

      const t = document.createElement('a-text');
      t.setAttribute('value', label === 'SPACE' ? 'Space' : label);
      t.setAttribute('align', 'center');
      t.setAttribute('width', '1.0');
      t.setAttribute('color', '#e9fbff');
      t.setAttribute('position', '0 0 0.03');
      k.appendChild(t);

      k.addEventListener('click', () => this.onKey(label));
      this.el.appendChild(k);
    };

    let idx = 0;
    for (let i = 0; i < 10; i++, idx++) makeKey(keys[idx], -0.58 + i * 0.13, 0.10, 0.12);
    for (let i = 0; i < 9; i++, idx++) makeKey(keys[idx], -0.52 + i * 0.13, 0.00, 0.12);
    for (let i = 0; i < 7; i++, idx++) makeKey(keys[idx], -0.39 + i * 0.13, -0.10, 0.12);

    makeKey('SPACE', -0.24, -0.24, 0.46);
    makeKey('BKSP', 0.29, -0.24, 0.22);
    makeKey('DONE', 0.52, -0.24, 0.22);

    const frame = document.createElement('a-entity');
    frame.setAttribute('neon-frame', 'w: 1.52; h: 0.86; color: #00F0FF');
    frame.setAttribute('position', '0 0 0.02');
    this.el.appendChild(frame);
  },
  openFor(nodeEl) {
    this.targetNode = nodeEl;
    this.value = (getNodeLabel(nodeEl) || '').slice(0, 60);
    this.display.setAttribute('value', this.value || ' ');

    // place in front of camera
    const cam = document.querySelector('#camera');
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    cam.object3D.getWorldPosition(pos);
    cam.object3D.getWorldDirection(dir);
    dir.y = 0; dir.normalize();

    const place = pos.clone().add(dir.multiplyScalar(1.15));
    place.y = 1.55;

    this.el.object3D.position.copy(place);
    this.el.object3D.lookAt(pos.x, 1.55, pos.z);

    this.el.setAttribute('visible', 'true');
  },
  close() {
    this.el.setAttribute('visible', 'false');
    this.targetNode = null;
  },
  onKey(k) {
    if (!this.targetNode) return;

    if (k === 'DONE') {
      setNodeLabel(this.targetNode, (this.value.trim() || 'Node'));
      this.close();
      return;
    }
    if (k === 'BKSP') {
      this.value = this.value.slice(0, -1);
    } else if (k === 'SPACE') {
      this.value += ' ';
    } else {
      this.value += k;
    }
    this.value = this.value.slice(0, 60);
    this.display.setAttribute('value', this.value || ' ');
  }
});

