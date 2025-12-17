/**
 * Procedural grid texture component.
 */
AFRAME.registerComponent('procedural-grid', {
  schema: {
    size: { type: 'number', default: 40 },
    lines: { type: 'number', default: 40 },
    majorEvery: { type: 'number', default: 5 },
    minorColor: { type: 'string', default: 'rgba(0,240,255,0.08)' },
    majorColor: { type: 'string', default: 'rgba(0,240,255,0.18)' }
  },
  init() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const N = this.data.lines;
    const step = 1024 / N;

    ctx.clearRect(0, 0, 1024, 1024);

    for (let i = 0; i <= N; i++) {
      const major = (i % this.data.majorEvery) === 0;
      ctx.strokeStyle = major ? this.data.majorColor : this.data.minorColor;
      ctx.lineWidth = major ? 2 : 1;

      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(1024, i * step); ctx.stroke();
    }

    const g = ctx.createRadialGradient(512, 512, 140, 512, 512, 620);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(this.data.size / 6, this.data.size / 6);
    tex.anisotropy = 8;

    const apply = () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      mesh.material.map = tex;
      mesh.material.transparent = true;
      mesh.material.needsUpdate = true;
    };

    if (!this.el.getObject3D('mesh')) this.el.addEventListener('object3dset', apply, { once: true });
    else apply();
  }
});

