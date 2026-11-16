// Gaussian のファイルを読む(.log と .com / .gjf)。
// 読めないときは、理由を書いた Error を投げる。

import { ELEMENTS, ZOF } from './elements.ts';
import type { Atom, Molecule } from './types.ts';

/** 'C' 'c' 'C1' 'C(Fragment=1)' 'C-CA-0.1' '6' → 'C'。元素でなければ null */
export function symbolOf(token: string): string | null {
  const tok = token.trim();
  if (/^\d+$/.test(tok)) return ELEMENTS[parseInt(tok, 10)] ?? null;
  const m = /^[A-Za-z]{1,2}/.exec(tok);
  if (!m) return null;
  let s = m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase();
  if (!(s in ZOF) || s === 'X') s = s.charAt(0);
  return (s in ZOF && s !== 'X') ? s : null;
}

// ----- route 行から計算レベルを読む -----
const FUNCTIONALS: Record<string, string> = {pbe1pbe:'PBE0', pbe0:'PBE0', pbepbe:'PBE', b3lyp:'B3LYP', m062x:'M06-2X', m06:'M06', m06l:'M06-L', m06hf:'M06-HF',
  wb97xd:'ωB97X-D', wb97x:'ωB97X', 'cam-b3lyp':'CAM-B3LYP', tpsstpss:'TPSS', tpssh:'TPSSh', b3pw91:'B3PW91', bp86:'BP86',
  mn15:'MN15', mn15l:'MN15-L', hf:'HF', mp2:'MP2', b97d:'B97-D', b97d3:'B97-D3', 'lc-wpbe':'LC-ωPBE', lcwpbe:'LC-ωPBE',
  pw6b95d3:'PW6B95-D3', b2plyp:'B2PLYP', blyp:'BLYP', hseh1pbe:'HSE06', m052x:'M05-2X', pbeh1pbe:'PBEh', apfd:'APF-D'};
const BASIS_RE = /^(ma-)?(def2-?[a-z]+|6-311?\+{0,2}g(\([a-z0-9,]+\)|\*{1,2})?|3-21g\*?|sto-3g|(aug-)?cc-pv[dtq56]z(-pp)?|lanl2dz|lanl2mb|sdd|sddall|gen|genecp|tzvp|svp|qzvp)$/;
const SPIN_PREFIX = /^(u|ro|r)(?=[a-z])/;       // ub3lyp → b3lyp
const SOLVENT_MODELS = ['smd', 'pcm', 'cpcm', 'iefpcm'];

function basisName(basis: string): string {
  const b = basis.toLowerCase();
  const m = /^(ma-)?def2-?(.+)$/.exec(b);
  if (m) return (m[1] ?? '') + 'def2-' + m[2].toUpperCase();
  if (b === 'gen' || b === 'genecp') return b;
  if (b.startsWith('cc-pv') || b.startsWith('aug-cc-pv'))
    return b.replace('cc-pv', 'cc-pV').replace(/([dtq56])z/, (_, c: string) => c.toUpperCase() + 'Z');
  return b.replace('g', 'G').replace('lanl2dz', 'LANL2DZ').replace('sdd', 'SDD');
}

/** route 行 → 'M06-2X/def2-TZVP, SMD(thf)' のような表記。読めなければ '' */
export function methodFromRoute(route: string): string {
  const r = route.toLowerCase();
  let func = '', basis = '';
  for (const tok of r.replace(/^#[pntPNT]?/, ' ').split(/\s+/)) {
    if (!tok) continue;
    if (tok.includes('/') && !tok.slice(0, tok.indexOf('/')).includes('=')) {      // 「汎関数/基底関数」
      const [a, b] = tok.split('/');
      if (a && !func) func = a;
      if (b && !basis) basis = b;
      continue;
    }
    if ((tok.includes('=') || tok.includes('(')) && !BASIS_RE.test(tok)) continue;  // opt=(...) などのキーワード
    const bare = tok.replace(SPIN_PREFIX, '');
    if (!func && (tok in FUNCTIONALS || bare in FUNCTIONALS)) { func = tok in FUNCTIONALS ? tok : bare; continue; }
    if (!basis && BASIS_RE.test(tok)) basis = tok;
  }
  if (!func && !basis) return '';
  let s = FUNCTIONALS[func] ?? FUNCTIONALS[func.replace(SPIN_PREFIX, '')] ?? func.toUpperCase();
  if (/gd3bj/.test(r)) s += '-D3(BJ)'; else if (/gd3/.test(r)) s += '-D3';
  if (basis) s += '/' + basisName(basis);
  const scrf = /scrf(?:=\(?([^)\s]*)\)?)?/.exec(r);
  if (scrf) {
    const opts = (scrf[1] ?? '').split(',');
    const model = (opts.find(o => SOLVENT_MODELS.includes(o)) ?? 'pcm').toUpperCase();
    const solvent = opts.find(o => o.startsWith('solvent='));
    s += solvent ? `, ${model}(${solvent.split('=')[1]})` : `, ${model}`;
  }
  return s;
}

/** route 行(複数行に続くことがある)を 1 行にして返す */
function routeOf(lines: string[], isLog: boolean): string {
  const i = lines.findIndex(l => /^\s*#/.test(l));
  if (i < 0) return '';
  let r = lines[i].trim();
  for (let j = i + 1; j < lines.length && j < i + 12; j++) {
    const l = lines[j];
    if (isLog ? /^\s*-{5,}/.test(l) : !l.trim()) break;
    r += isLog ? l.replace(/^ /, '').replace(/\s+$/, '') : ' ' + l.trim();
  }
  return r;
}

// ----- .log -----
const NPA_HEAD = 'Summary of Natural Population Analysis';

function indicesOf(lines: string[], text: string): number[] {
  const out: number[] = [];
  lines.forEach((l, i) => { if (l.includes(text)) out.push(i); });
  return out;
}

/** NPA の表(見出しが k 行目)から電荷を順に読む */
function readNpaCharges(lines: string[], k: number): number[] {
  const q: number[] = [];
  let started = false;
  for (let j = k + 1; j < lines.length; j++) {
    const m = /^\s*([A-Za-z]{1,3})\s*(\d+)\s+(-?\d+\.\d+)/.exec(lines[j]);
    if (m) { q.push(parseFloat(m[3])); started = true; } else if (started) break;
  }
  return q;
}

/**
 * Gaussian の .log を読む。
 * 座標:最後の Standard orientation(なければ Input orientation)。
 * 電荷:その座標より後にある最初の NPA の表(開殻なら全電子の表)。なければ最後の表。
 */
export function parseLog(text: string): Molecule {
  const L = text.split(/\r?\n/);
  let heads = indicesOf(L, 'Standard orientation:');
  if (!heads.length) heads = indicesOf(L, 'Input orientation:');
  if (!heads.length)
    throw new Error('座標(Standard orientation / Input orientation)が見つかりません。Gaussian の log ではない可能性があります。');
  const h = heads[heads.length - 1];
  const atoms: Atom[] = [];
  for (let j = h + 5; j < L.length && !/^\s*-{5,}/.test(L[j]); j++) {
    const c = L[j].trim().split(/\s+/);
    if (c.length < 6) break;
    atoms.push({e: ELEMENTS[parseInt(c[1], 10)] ?? 'X', p: [parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5])], q: null});
  }
  if (!atoms.length) throw new Error('座標の表を読めませんでした。');

  const npa = indicesOf(L, NPA_HEAD);
  let hasQ = false, warn = '';
  if (npa.length) {
    const after = npa.filter(k => k > h);
    const q = readNpaCharges(L, after.length ? after[0] : npa[npa.length - 1]);
    if (q.length === atoms.length) { atoms.forEach((a, i) => { a.q = q[i]; }); hasQ = true; }
    else warn = `NPA の表の原子数(${q.length})が構造の原子数(${atoms.length})と合わないため、電荷は使いません。`;
  }
  if (!/Normal termination/.test(L.slice(-12).join('\n')))
    warn += (warn ? '\n' : '') + '「Normal termination」で終わっていない log です(計算の途中か、異常終了の可能性があります)。';
  return {atoms, hasQ, method: methodFromRoute(routeOf(L, true)), warn, kind: 'log'};
}

// ----- .com / .gjf -----
const CHARGE_MULT_RE = /^\s*-?\d+[\s,]+\d+([\s,]+-?\d+[\s,]+\d+)*\s*$/;

/** Gaussian の入力ファイル(Cartesian 座標)を読む */
export function parseCom(text: string): Molecule {
  const L = text.split(/\r?\n/);
  const route = routeOf(L, false);
  if (!route) throw new Error('route 行(# で始まる行)が見つかりません。Gaussian の入力ファイルではない可能性があります。');
  if (/geom\s*=?\s*\(?[^)\s]*(check|allcheck)/i.test(route))
    throw new Error('この入力ファイルは geom=check / allcheck で、座標がファイルの中にありません(座標は .chk にあります)。\n計算後の .log をドロップしてください。');
  const routeLine = L.findIndex(l => /^\s*#/.test(l));
  let start = -1;
  for (let i = routeLine + 1; i < L.length; i++) if (CHARGE_MULT_RE.test(L[i])) { start = i; break; }
  if (start < 0) throw new Error('電荷・多重度の行が見つかりません。');

  const atoms: Atom[] = [];
  const notNumber = (x: string) => !/[.\d]/.test(x) || /^[A-Za-z]/.test(x);
  for (let i = start + 1; i < L.length; i++) {
    const l = L[i];
    if (!l.trim()) break;
    const t = l.replace(/,/g, ' ').trim().split(/\s+/);
    const e = symbolOf(t[0]);
    let nums = t.slice(1);
    if (nums.length >= 4 && /^-?\d+$/.test(nums[0])) nums = nums.slice(1);      // 「元素 固定フラグ x y z」
    const v = nums.slice(0, 3).map(Number);
    if (!e || v.length < 3 || v.some(x => !isFinite(x)) || nums.slice(0, 3).some(notNumber))
      throw new Error(`座標の ${atoms.length + 1} 行目を読めませんでした(「${l.trim()}」)。\nZ-matrix 形式は読めません。Cartesian 座標で保存したファイルを使ってください。`);
    atoms.push({e, p: [v[0], v[1], v[2]], q: null});
  }
  if (!atoms.length) throw new Error('座標が見つかりません。');
  return {atoms, hasQ: false, method: methodFromRoute(route), warn: '', kind: 'com'};
}

/** ファイル名の拡張子(なければ中身)で種類を判断して読む */
export function parseAny(name: string, text: string): Molecule {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'com' || ext === 'gjf') return parseCom(text);
  if (ext === 'log' || ext === 'out') return parseLog(text);
  return /orientation:|Entering Gaussian System/.test(text) ? parseLog(text) : parseCom(text);
}
