import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topology, metalMetalPairs, hillFormula, eigenvectors3, frameOf, autoOrient, rotated, identity } from '../src/geometry.ts';
import type { Atom, Mat3, Vec3 } from '../src/types.ts';

const atom = (e: string, x: number, y: number, z: number): Atom => ({e, p: [x, y, z], q: null});
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
function assertRotation(R: Mat3) {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(dot(R[i], R[j]), i === j ? 1 : 0);
  const det = dot(R[0], [R[1][1] * R[2][2] - R[1][2] * R[2][1], R[1][2] * R[2][0] - R[1][0] * R[2][2], R[1][0] * R[2][1] - R[1][1] * R[2][0]]);
  close(det, 1);
}

test('topology: 水は O–H が 2 本、H–H は結合しない', () => {
  const t = topology([atom('O', 0, 0, 0.119), atom('H', 0, 0.757, -0.476), atom('H', 0, -0.757, -0.476)]);
  assert.deepEqual(t.bonds, [[0, 1], [0, 2]]);
  assert.deepEqual(t.centers, []);
  close(t.D[0][1], Math.hypot(0.757, 0.595));
});

test('topology: 金属との接触は倍率で決まり、通常の結合には入らない', () => {
  // Zn–O の共有結合半径の和は 1.22 + 0.66 = 1.88 Å。2.20 Å は 1.15 倍(2.162)では接触にならず、1.20 倍(2.256)でなる
  const atoms = [atom('Zn', 0, 0, 0), atom('Cl', 2.2, 0, 0), atom('O', -2.2, 0, 0)];
  assert.deepEqual(topology(atoms, 1.15).contacts, [[0, 1]]);
  assert.deepEqual(topology(atoms, 1.20).contacts, [[0, 1], [0, 2]]);
  assert.deepEqual(topology(atoms, 1.20).bonds, []);
  assert.deepEqual(topology(atoms).centers, [0]);
});

test('topology: 配位原子に結合した、より遠い原子は配位原子にしない', () => {
  // O は Zn に 2.0 Å、その O に結合した C は Zn に 2.45 Å(判定距離内だが O より 0.4 Å 以上遠い)
  const atoms = [atom('Zn', 0, 0, 0), atom('O', 2.0, 0, 0), atom('C', 2.0, 1.415, 0)];
  assert.deepEqual(topology(atoms, 1.5).contacts, [[0, 1]]);
});

test('metalMetalPairs: 結合距離にある金属どうし', () => {
  const atoms = [atom('Cu', 0, 0, 0), atom('Cu', 2.5, 0, 0), atom('Cu', 9, 0, 0)];
  assert.deepEqual(metalMetalPairs(atoms, topology(atoms)), [[0, 1]]);
});

test('hillFormula', () => {
  const f = (s: string) => hillFormula(s.split(' ').map(e => atom(e, 0, 0, 0)));
  assert.equal(f('H O H'), 'H2O');
  assert.equal(f('O C H H Zn'), 'CH2OZn');
  assert.equal(f('Na Cl'), 'ClNa');
});

test('eigenvectors3: 固有値の大きい順に、直交した単位ベクトルを返す', () => {
  const v = eigenvectors3([[1, 0, 0], [0, 5, 0], [0, 0, 3]]);
  assert.deepEqual(v.map(x => x.map(Math.abs)), [[0, 1, 0], [0, 0, 1], [1, 0, 0]]);
  const w = eigenvectors3([[4, 1, 0.5], [1, 3, 0.2], [0.5, 0.2, 1]]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(dot(w[i], w[j]), i === j ? 1 : 0, 1e-9);
});

test('frameOf: 中心は重原子の重心', () => {
  const {origin, lim} = frameOf([atom('C', 0, 0, 0), atom('C', 2, 0, 0), atom('H', 5, 0, 0)]);
  assert.deepEqual(origin, [1, 0, 0]);
  close(lim, 5);
});

test('autoOrient: 最も広がった方向が横になる', () => {
  const atoms = [0, 1, 2, 3].map(i => atom('C', 0.1 * (i % 2), 0.3 * i, 1.5 * i));       // z 方向に長い
  const R = autoOrient(atoms, frameOf(atoms).origin);
  assertRotation(R);
  assert.ok(Math.abs(R[0][2]) > 0.95);
});

test('autoOrient: 1 原子でも壊れない', () => {
  assertRotation(autoOrient([atom('He', 1, 2, 3)], [1, 2, 3]));
});

test('rotated: 何度回しても回転行列のまま。逆向きに回すと元に戻る', () => {
  let R = identity();
  for (let i = 0; i < 500; i++) R = rotated(R, 7, -3, i % 5 === 0);
  assertRotation(R);
  const back = rotated(rotated(identity(), 40, 0), -40, 0);
  back.flat().forEach((v, i) => close(v, identity().flat()[i]));
});

test('rotated: 右に 225 px ドラッグすると 90° 回り、手前の原子が右に来る', () => {
  const R = rotated(identity(), 225, 0);
  const front = R.map(r => dot(r, [0, 0, 1]));              // 手前(+z)にあった点
  close(front[0], 1); close(front[2], 0, 1e-9);
});
