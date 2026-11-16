// 構造の計算(結合・配位の判定、組成式、向き、回転)。画面には触らない

import { covalentRadius, isMetal } from './elements.ts';
import type { Atom, Mat3, Pair, Topology, Vec3 } from './types.ts';

export const BOND_SCALE = 1.15;   // 共有結合:距離 < (r1 + r2) × この値
export const METAL_SCALE = 1.15;  // 金属との接触の既定値:距離 < (r_M + r) × この値
// 金属により近い配位原子と結合していて、それより この値(Å)以上遠い原子は配位原子としない
// (キレートの 2 つの配位原子に挟まれた原子が、配位原子と誤判定されるのを防ぐ)
const SHADOW = 0.4;

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 結合と配位を距離から判定する */
export function topology(atoms: Atom[], metalScale: number = METAL_SCALE): Topology {
  const n = atoms.length;
  const D: Float64Array[] = [], B: Uint8Array[] = [];
  for (let i = 0; i < n; i++) { D.push(new Float64Array(n)); B.push(new Uint8Array(n)); }
  const cv = atoms.map(a => covalentRadius(a.e));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = distance(atoms[i].p, atoms[j].p);
    D[i][j] = D[j][i] = d;
    if (d < BOND_SCALE * (cv[i] + cv[j])) B[i][j] = B[j][i] = 1;
  }
  const centers: number[] = [];
  const cset = new Set<number>();
  atoms.forEach((a, i) => { if (isMetal(a.e)) { centers.push(i); cset.add(i); } });
  const bonds: Pair[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (B[i][j] && !cset.has(i) && !cset.has(j)) bonds.push([i, j]);
  const contacts: Pair[] = [];
  for (const c of centers) {
    const cand: number[] = [];
    for (let k = 0; k < n; k++) if (!cset.has(k) && D[c][k] < metalScale * (cv[c] + cv[k])) cand.push(k);
    for (const k of cand)
      if (!cand.some(d => d !== k && B[k][d] && D[c][k] > D[c][d] + SHADOW)) contacts.push([c, k]);
  }
  return {D, bonds, contacts, centers};
}

/** 金属どうしが結合距離にある組 */
export function metalMetalPairs(atoms: Atom[], topo: Topology): Pair[] {
  const out: Pair[] = [], c = topo.centers;
  for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++)
    if (topo.D[c[a]][c[b]] < BOND_SCALE * (covalentRadius(atoms[c[a]].e) + covalentRadius(atoms[c[b]].e))) out.push([c[a], c[b]]);
  return out;
}

/** 組成式(Hill 方式) */
export function hillFormula(atoms: Atom[]): string {
  const c: Record<string, number> = {};
  atoms.forEach(a => { c[a.e] = (c[a.e] ?? 0) + 1; });
  const keys = Object.keys(c).sort();
  const order = c.C ? ['C', 'H'].concat(keys.filter(k => k !== 'C' && k !== 'H')) : keys;
  return order.filter(k => c[k]).map(k => k + (c[k] > 1 ? c[k] : '')).join('');
}

// ----- 3×3 の行列 -----
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const column = (M: Mat3, j: number): Vec3 => [M[0][j], M[1][j], M[2][j]];

export function matMul(A: Mat3, B: Mat3): Mat3 {
  const row = (r: Vec3): Vec3 => [dot(r, column(B, 0)), dot(r, column(B, 1)), dot(r, column(B, 2))];
  return [row(A[0]), row(A[1]), row(A[2])];
}
/** 行列をベクトルに掛ける */
export const apply = (M: Mat3, v: Vec3): Vec3 => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
export const identity = (): Mat3 => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const copyMat = (M: Mat3): Mat3 => [[...M[0]], [...M[1]], [...M[2]]];

/** 対称 3×3 行列の固有ベクトル(Jacobi 法)。固有値の大きい順に 3 本 */
export function eigenvectors3(matrix: Mat3): Mat3 {
  const A = copyMat(matrix), V = identity();
  for (let it = 0; it < 60; it++) {
    let p = 0, q = 1, mx = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++)
      if (Math.abs(A[i][j]) > mx) { mx = Math.abs(A[i][j]); p = i; q = j; }
    if (mx < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
  }
  const idx = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  return [column(V, idx[0]), column(V, idx[1]), column(V, idx[2])];
}

/** 図の中心(重原子の重心)と大きさ(中心から最も遠い原子までの距離 + 1 Å) */
export function frameOf(atoms: Atom[]): {origin: Vec3; lim: number} {
  const heavy = atoms.filter(a => a.e !== 'H'), base = heavy.length ? heavy : atoms;
  const mean = (k: number) => base.reduce((t, a) => t + a.p[k], 0) / base.length;
  const origin: Vec3 = [mean(0), mean(1), mean(2)];
  const lim = Math.max(...atoms.map(a => distance(a.p, origin))) + 1.0;
  return {origin, lim};
}

/** 最初の向き:最も広がった方向を横、次に広がった方向を縦にする(重原子の座標の主成分) */
export function autoOrient(atoms: Atom[], origin: Vec3): Mat3 {
  const heavy = atoms.filter(a => a.e !== 'H');
  // 重原子が 3 個未満(H2O など)のときは、H も含めた全原子で向きを決める
  const useAll = (heavy.length ? heavy : atoms).length < 3;
  const C: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const a of atoms) {
    if (a.e === 'H' && !useAll) continue;
    const v: Vec3 = [a.p[0] - origin[0], a.p[1] - origin[1], a.p[2] - origin[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += v[i] * v[j];
  }
  const v = eigenvectors3(C);
  const R: Mat3 = [v[0], v[1], cross(v[0], v[1])];
  return R.flat().some(x => !isFinite(x)) ? identity() : R;
}

const DEG_PER_PIXEL = 0.4;

/**
 * ドラッグ量(ピクセル。dy は上向きが正)だけ回した行列を返す。
 * roll = true なら画面に垂直な軸のまわりに回す。
 */
export function rotated(R: Mat3, dx: number, dy: number, roll = false): Mat3 {
  const k = DEG_PER_PIXEL * Math.PI / 180;
  let M: Mat3;
  if (roll) {
    const t = -dx * k, c = Math.cos(t), s = Math.sin(t);
    M = matMul([[c, -s, 0], [s, c, 0], [0, 0, 1]], R);
  } else {
    const ty = dx * k, tx = -dy * k;
    const Ry: Mat3 = [[Math.cos(ty), 0, Math.sin(ty)], [0, 1, 0], [-Math.sin(ty), 0, Math.cos(ty)]];
    const Rx: Mat3 = [[1, 0, 0], [0, Math.cos(tx), -Math.sin(tx)], [0, Math.sin(tx), Math.cos(tx)]];
    M = matMul(Rx, matMul(Ry, R));
  }
  // 誤差がたまらないよう、行を直交化する
  const x = unit(M[0]);
  const d = dot(x, M[1]);
  const y = unit([M[1][0] - d * x[0], M[1][1] - d * x[1], M[1][2] - d * x[2]]);
  return [x, y, cross(x, y)];
}
