/**
 * Mindmap from JSON.
 */
AFRAME.registerComponent('mindmap', {
  schema: { src: { type: 'selector' } },
  init() { this.rebuild(); },
  readJSON() {
    const el = this.data.src;
    if (!el) return null;
    try { return JSON.parse(el.textContent.trim()); }
    catch (e) { console.warn('Bad JSON', e); return null; }
  },
  clear() { while (this.el.firstChild) this.el.removeChild(this.el.firstChild); },
  rebuild() {
    const data = this.readJSON();
    if (!data) return;
    this.clear();

    (data.nodes || []).forEach(n => {
      const nodeEl = document.createElement('a-entity');
      nodeEl.setAttribute('id', n.id);
      nodeEl.setAttribute('position', `${n.pos?.[0] ?? 0} ${n.pos?.[1] ?? 1.6} ${n.pos?.[2] ?? -3}`);
      nodeEl.setAttribute('mind-node', `label: ${n.label ?? n.id}; color: ${n.color ?? '#00F0FF'}; size: ${n.size ?? 0.16}`);
      nodeEl.setAttribute('data-color', n.color ?? '#00F0FF');
      this.el.appendChild(nodeEl);
    });

    (data.links || []).forEach((l) => {
      const a = this.el.querySelector(`#${CSS.escape(l.from)}`);
      const b = this.el.querySelector(`#${CSS.escape(l.to)}`);
      if (!a || !b) return;

      const linkEl = document.createElement('a-entity');
      linkEl.setAttribute('link-tube', `from: #${l.from}; to: #${l.to}; color: ${l.color ?? '#00F0FF'}; thickness: ${l.thickness ?? 0.012}; opacity: ${l.opacity ?? 0.9}`);
      linkEl.setAttribute('data-from', l.from);
      linkEl.setAttribute('data-to', l.to);
      this.el.appendChild(linkEl);
    });
  }
});

