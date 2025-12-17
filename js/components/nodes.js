import { clamp } from '../utils.js';

/**
 * Node visual component.
 */
AFRAME.registerComponent('mind-node', {
  schema: { label: { default: 'Node' }, color: { default: '#00F0FF' }, size: { type: 'number', default: 0.16 } },
  init() {
    const { label, color, size } = this.data;

    this.el.classList.add('hitNode');

    const orb = document.createElement('a-sphere');
    orb.classList.add('hitNode');
    orb.setAttribute('radius', size);
    orb.setAttribute('segments-width', 28);
    orb.setAttribute('segments-height', 18);
    orb.setAttribute('material', `shader: standard; color:#07070d; metalness:0.65; roughness:0.18; emissive:${color}; emissiveIntensity:1.0;`);
    orb.setAttribute('animation__pulse', 'property: material.emissiveIntensity; dir: alternate; dur: 950; loop: true; to: 1.35; easing: easeInOutSine');
    this.el.appendChild(orb);

    const ring = document.createElement('a-torus');
    ring.classList.add('hitNode');
    ring.setAttribute('radius', size * 1.25);
    ring.setAttribute('radius-tubular', Math.max(0.006, size * 0.06));
    ring.setAttribute('segments-tubular', 48);
    ring.setAttribute('rotation', '90 0 0');
    ring.setAttribute('material', `shader: standard; color:#050510; metalness:0.2; roughness:0.35; emissive:${color}; emissiveIntensity:1.2; opacity:0.85; transparent:true;`);
    ring.setAttribute('animation__spin', 'property: rotation; to: 90 360 0; loop: true; dur: 9000; easing: linear');
    this.el.appendChild(ring);

    const plate = document.createElement('a-plane');
    plate.setAttribute('position', `0 ${size * 1.55} 0`);
    plate.setAttribute('width', clamp(label.length * 0.12, 0.8, 2.8));
    plate.setAttribute('height', 0.36);
    plate.setAttribute('material', 'shader: standard; color:#02020a; metalness:0.1; roughness:0.9; emissive:#00131a; emissiveIntensity:0.8; opacity:0.72; transparent:true;');
    this.el.appendChild(plate);

    const txt = document.createElement('a-text');
    txt.setAttribute('value', label);
    txt.setAttribute('align', 'center');
    txt.setAttribute('width', 3.2);
    txt.setAttribute('color', color);
    txt.setAttribute('position', `0 ${size * 1.55} 0.02`);
    txt.setAttribute('data-role', 'label');
    this.el.appendChild(txt);
  }
});

/**
 * Gets the label text from a node entity.
 * @param {Element} nodeEl - The node entity.
 * @returns {string} The label text.
 */
export function getNodeLabel(nodeEl) {
  const t = nodeEl.querySelector('[data-role="label"]');
  return t ? (t.getAttribute('value') || '') : '';
}

/**
 * Sets the label text for a node entity.
 * @param {Element} nodeEl - The node entity.
 * @param {string} label - The new label text.
 */
export function setNodeLabel(nodeEl, label) {
  const t = nodeEl.querySelector('[data-role="label"]');
  if (t) t.setAttribute('value', label);
  const plate = nodeEl.querySelector('a-plane');
  if (plate) plate.setAttribute('width', clamp(label.length * 0.12, 0.8, 2.8));
}

