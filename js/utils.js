/**
 * Utility functions for the application.
 */

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} v - The value to clamp.
 * @param {number} a - The minimum value.
 * @param {number} b - The maximum value.
 * @returns {number} The clamped value.
 */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Generates a random number between a and b.
 * @param {number} a - The start of the range.
 * @param {number} b - The end of the range.
 * @returns {number} The random number.
 */
export const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Generates a nice random ID.
 * @param {string} prefix - The prefix for the ID.
 * @returns {string} The generated ID.
 */
export const niceId = (prefix = "n") => prefix + Math.random().toString(16).slice(2, 9);

/**
 * Triggers haptic feedback on a controller.
 * @param {object} handEl - The hand entity element.
 * @param {number} strength - The strength of the feedback (0-1).
 * @param {number} dur - The duration in milliseconds.
 */
export function haptic(handEl, strength = 0.2, dur = 35) {
  const ctrl = handEl?.components?.['oculus-touch-controls']?.controller;
  const h = ctrl?.gamepad?.hapticActuators?.[0];
  if (!h) return;
  try { h.pulse(strength, dur); } catch { }
}

/**
 * Gets the world position of an entity.
 * @param {object} el - The entity element.
 * @param {THREE.Vector3} out - The vector to store the result in.
 * @returns {THREE.Vector3} The world position.
 */
export function getWorldPos(el, out = new THREE.Vector3()) {
  el.object3D.getWorldPosition(out);
  return out;
}

