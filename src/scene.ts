// 表示している構造の状態(向き・ラベル・距離)を作る・変える。画面(DOM)には触らない

import { topology, hillFormula, frameOf, autoOrient, copyMat } from './geometry.ts';
import { formatCharge } from './render.ts';
import type { ColorMode, Mat3, Molecule, Scene, Topology } from './types.ts';

/** 読み込んだファイル(名前つきの構造) */
export interface LoadedMolecule extends Molecule {
  /** ファイル名 */
  name: string;
  /** 拡張子を除いたファイル名(保存するときの名前に使う) */
  stem: string;
}

/** いま表示している構造と、その向き・ラベル・距離 */
export interface Current extends Scene {
  mol: LoadedMolecule;
  /** 最初の向き(「向きを最初に戻す」用) */
  R0: Mat3;
}

export const withName = (mol: Molecule, name: string): LoadedMolecule =>
  ({...mol, name, stem: name.replace(/\.[^.]+$/, '')});

export const heavyAtoms = (mol: Molecule): number[] => mol.atoms.flatMap((a, i) => a.e !== 'H' ? [i] : []);
export const metalsAndLigands = (topo: Topology): number[] => [...topo.centers, ...topo.contacts.map(b => b[1])];

/** 最初に付けるラベル:金属があれば金属と配位原子、なければ重原子(15 個以下のとき) */
export function defaultLabels(mol: Molecule, topo: Topology): Set<number> {
  if (topo.centers.length) return new Set(metalsAndLigands(topo));
  const heavy = heavyAtoms(mol);
  return new Set(heavy.length <= 15 ? heavy : []);
}

/** 読み込んだ直後の状態(自動の向き、既定のラベル、距離なし) */
export function createScene(mol: LoadedMolecule, metalScale: number, custom: Scene['custom']): Current {
  const {origin, lim} = frameOf(mol.atoms);
  const R = autoOrient(mol.atoms, origin);
  const topo = topology(mol.atoms, metalScale);
  return {mol, topo, origin, lim, R, R0: copyMat(R), labels: defaultLabels(mol, topo), links: [], pick: null, custom};
}

/** 原子 i のラベルを付ける / 消す */
export function toggleLabel(c: Scene, i: number): void {
  if (c.labels.has(i)) c.labels.delete(i); else c.labels.add(i);
}

/**
 * 距離のための原子のクリック。1 個目は選択、同じ原子なら選択を外す、
 * 2 個目でその組の距離を追加(すでにあれば削除)。
 */
export function pickForDistance(c: Scene, i: number): void {
  if (c.pick === null) { c.pick = i; return; }
  if (c.pick !== i) {
    const a = Math.min(c.pick, i), b = Math.max(c.pick, i);
    const k = c.links.findIndex(l => l[0] === a && l[1] === b);
    if (k >= 0) c.links.splice(k, 1); else c.links.push([a, b]);
  }
  c.pick = null;
}

/** 画面の上に出す説明(ファイル名、組成式、原子数、計算レベル、電荷の有無) */
export function describe(mol: LoadedMolecule): string {
  const sum = mol.atoms.reduce((t, a) => t + (a.q ?? 0), 0);
  const charge = mol.hasQ ? `、NPA 電荷あり(合計 ${formatCharge(Math.abs(sum) < 0.005 ? 0 : sum)})`
    : mol.kind === 'log' ? '、NPA 電荷なし(元素の色で表示)' : '、構造のみ(元素の色で表示)';
  return `${mol.name} — ${hillFormula(mol.atoms)}、${mol.atoms.length} 原子` + (mol.method ? `、${mol.method}` : '') + charge;
}

/** 保存するファイルの名前(拡張子なし) */
export const exportStem = (mol: LoadedMolecule, colorMode: ColorMode): string =>
  mol.stem + (colorMode === 'q' && mol.hasQ ? '_NPA' : '_structure');
