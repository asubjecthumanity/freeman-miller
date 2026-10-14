// Studio helper (owner: studio): bake every static mesh of a built room into one mesh per material
// (and shadow flags), so the studio costs a few dozen draw calls instead of a few hundred.
// Anything under an object with userData.dynamic = true is left alone (moving parts, the camera
// hook, the wall section), and so are instanced meshes and multi-material meshes.
import * as THREE from 'three';

const KEEP = ['position', 'normal', 'uv'];

export function flattenStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const buckets = new Map();
  const victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.visible) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const g = o.geometry;
    if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, list: [] });
    m.multiplyMatrices(inv, o.matrixWorld);
    const c = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (!KEEP.includes(k)) c.deleteAttribute(k);
    buckets.get(key).list.push(c);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  // drop groups left empty
  const empty = [];
  root.traverse(o => { if (o !== root && !o.isMesh && !o.isLight && o.children.length === 0 && !o.userData.dynamic) empty.push(o); });
  for (const o of empty) o.parent?.remove(o);
  let n = 0;
  for (const { mat, cast, receive, list } of buckets.values()) {
    let count = 0;
    for (const g of list) count += g.attributes.position.count;
    const out = new THREE.BufferGeometry();
    for (const [k, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
      const arr = new Float32Array(count * size);
      let off = 0;
      for (const g of list) { arr.set(g.attributes[k].array, off); off += g.attributes.position.count * size; }
      out.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    const mesh = new THREE.Mesh(out, mat);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    n++;
  }
  return { merged: victims.length, meshes: n };
}
