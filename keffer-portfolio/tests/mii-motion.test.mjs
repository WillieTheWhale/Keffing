import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MiiMotion } from '../lib/mii-motion.ts';

async function rig() {
  const bytes = await readFile(new URL('../public/assets/mii/body.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const motion = new MiiMotion(gltf.scene, gltf.animations);
  const bones = [];
  gltf.scene.traverse(node => { if (node.isBone) bones.push(node); });
  const sample = () => {
    gltf.scene.updateMatrixWorld(true);
    return bones.map(bone => bone.getWorldPosition(new Vector3()));
  };
  return { motion, sample, bones };
}

test('changing or interrupting poses preserves the actual skeleton at the transition instant', async () => {
  const { motion, sample, bones } = await rig();
  assert.ok(bones.length >= 18);
  for (const [next, advance] of [['wave', 0.2], ['celebrate', 0.15], ['idle', 0.25], ['wave', 0.1], ['celebrate', 0.9]]) {
    for (let t = 0; t < advance; t += 1 / 120) motion.update(1 / 120);
    const before = sample();
    motion.select(next);
    motion.update(0);
    const after = sample();
    after.forEach((position, i) => assert.ok(position.distanceTo(before[i]) < 1e-5, `bone ${bones[i].name} jumped`));
    assert.ok(Math.abs(Object.values(motion.weights).reduce((a, b) => a + b, 0) - 1) < 1e-8);
  }
  motion.dispose();
});

test('the wave moves joints, completes its return, and has no discontinuity at animation loop seams', async () => {
  const { motion, sample, bones } = await rig();
  const rest = sample();
  motion.select('wave');
  let previous = rest;
  let maxStep = 0;
  let moved = 0;
  for (let frame = 0; frame < 1440; frame++) {
    motion.update(1 / 240);
    const current = sample();
    current.forEach((position, i) => {
      maxStep = Math.max(maxStep, position.distanceTo(previous[i]));
      if (bones[i].name.includes('Wrist')) moved = Math.max(moved, position.distanceTo(rest[i]));
    });
    previous = current;
  }
  assert.ok(moved > 3, `wave must physically move a wrist; moved ${moved}`);
  assert.ok(maxStep < 0.2, `unexpected discontinuity: ${maxStep} units in 1/240 s`);
  assert.equal(motion.pose, 'idle');
  assert.equal(motion.weights.idle, 1);
  motion.dispose();
});
