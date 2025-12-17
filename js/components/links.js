/**
 * Link tube between nodes (world-space).
 */
AFRAME.registerComponent('link-tube', {
  schema: {
    from: { type: 'selector' },
    to: { type: 'selector' },
    color: { default: '#00F0FF' },
    thickness: { type: 'number', default: 0.012 },
    opacity: { type: 'number', default: 0.9 }
  },
  init() {
    const geom = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#050510'),
      emissive: new THREE.Color(this.data.color),
      emissiveIntensity: 1.25,
      metalness: 0.2,
      roughness: 0.35,
      transparent: true,
      opacity: this.data.opacity
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.el.setObject3D('mesh', this.mesh);

    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._mid = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  },
  update() {
    if (!this.mesh?.material) return;
    this.mesh.material.emissive = new THREE.Color(this.data.color);
    this.mesh.material.opacity = this.data.opacity;
    this.mesh.material.needsUpdate = true;
  },
  tick() {
    const { from, to, thickness } = this.data;
    if (!from || !to) return;

    from.object3D.getWorldPosition(this._a);
    to.object3D.getWorldPosition(this._b);

    this._dir.copy(this._b).sub(this._a);
    const len = this._dir.length();
    if (len < 0.0001) return;

    this._mid.copy(this._a).add(this._b).multiplyScalar(0.5);

    this._dir.normalize();
    this._quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._dir);

    this.mesh.position.copy(this._mid);
    this.mesh.quaternion.copy(this._quat);
    // base cylinder height = 1, scale.y makes height = len
    this.mesh.scale.set(thickness, len, thickness);
  }
});

