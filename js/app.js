import './utils.js';
import './components/grid.js';
import './components/nodes.js';
import './components/ui.js';
import './components/links.js';
import './components/mindmap.js';
import './components/controls.js';

// ----------------------------
// Hide HUD in VR
// ----------------------------
(function () {
  const hud = document.getElementById('hud');
  const scene = document.getElementById('scene');
  
  if (!hud || !scene) return;

  scene.addEventListener('enter-vr', () => { hud.style.display = 'none'; });
  scene.addEventListener('exit-vr', () => { hud.style.display = 'block'; });
})();

