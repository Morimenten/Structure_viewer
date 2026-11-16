// 図(SVG)を作る。画面表示と保存で同じ関数を使う。
// ここは画面(DOM)に触らない:入力は「場面」と「設定」だけで、出力は SVG の文字列。
//
// 描く順番:結合と原子(drawBody)→ 数値(drawNumbers)→ 枠を決める → カラーバー / 凡例(drawLegend)→ 注記(drawNote)

import { ZOF, drawRadius } from './elements.ts';
import { NEG, ZERO, POS, INK, INK2, chargeColor, elementColor } from './colors.ts';
import { apply, metalMetalPairs } from './geometry.ts';
import type { Atom, Figure, Hit, Options, Pair, Scene, TextWidth, Vec3 } from './types.ts';

const FONT = 'Arial, Helvetica, sans-serif';
const SCALE = 50;                 // 1 Å = 50 px
const MINUS = '−';
const PAD = 14;                   // 保存する図の余白(px)
const PICK_COLOR = '#eb6834';     // 距離の 1 個目として選択中の原子の印

/** +0.15 / −0.62 の形(digits は小数点以下の桁数) */
export const formatCharge = (q: number, digits = 2): string => (q >= 0 ? '+' : MINUS) + Math.abs(q).toFixed(digits);
const escapeXml = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number): string => (Math.round(v * 100) / 100).toString();

/** 中央そろえの文字 */
const centeredText = (x: number, y: number, size: number, content: string): string =>
  `<text x="${num(x)}" y="${num(y)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="${INK2}">${content}</text>`;

/** 電荷の色で描くか(設定が「電荷の色」で、電荷がある) */
const usesChargeColor = (scene: Scene, o: Options): boolean => o.colorMode === 'q' && scene.mol.hasQ;

/** 自動の注記(計算レベル、H の省略、色の範囲など) */
export function autoNote(scene: Scene, o: Options): string {
  const m = scene.mol, parts: string[] = [];
  const useQ = usesChargeColor(scene, o);
  if (useQ) parts.push('NPA charges (e)' + (m.method ? ', ' + m.method : '') + '.');
  else if (m.method) parts.push(m.method + '.');
  if (!o.h && m.atoms.some(a => a.e === 'H')) parts.push('H atoms omitted.');
  if (o.num && (scene.links.length || (o.md && scene.topo.contacts.length))) parts.push('Distances in Å.');
  if (useQ) {
    const over = [...new Set(m.atoms.filter(a => Math.abs(a.q ?? 0) > o.qr).map(a => a.e))].sort();
    parts.push(`Colors clipped at ±${o.qr.toFixed(1)} e` +
      (over.length ? ` (${over.join(', ')} ${over.length === 1 ? 'exceeds' : 'exceed'} this range).` : '.'));
  }
  return parts.join(' ');
}

/** 図の範囲を広げていくための入れ物 */
class Bounds {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  add(x0: number, y0: number, x1: number, y1: number): void {
    this.x0 = Math.min(this.x0, x0); this.y0 = Math.min(this.y0, y0);
    this.x1 = Math.max(this.x1, x1); this.y1 = Math.max(this.y1, y1);
  }
  widen(x0: number, x1: number): void { this.x0 = Math.min(this.x0, x0); this.x1 = Math.max(this.x1, x1); }
  get cx(): number { return (this.x0 + this.x1) / 2; }
}

/** 描くときに共通で使うもの(原子の位置・見えるか・大きさ・色と、図の範囲) */
interface Ctx {
  scene: Scene;
  o: Options;
  live: boolean;
  textWidth: TextWidth;
  useQ: boolean;
  /** 原子が見えるか(H を隠すとき H は false) */
  vis: boolean[];
  /** 図の中での位置(px)。x = 右、y = 下 */
  X: (i: number) => number;
  Y: (i: number) => number;
  /** 奥行き(Å)。大きいほど手前 */
  Z: (i: number) => number;
  /** 丸の半径(px) */
  rad: (i: number) => number;
  colorOf: (a: Atom) => string;
  bb: Bounds;
}

function makeContext(scene: Scene, o: Options, live: boolean, textWidth: TextWidth): Ctx {
  const m = scene.mol, s = SCALE;
  const useQ = usesChargeColor(scene, o);
  /** 図の中での位置(Å)。x = 右、y = 上、z = 手前 */
  const P: Vec3[] = m.atoms.map(a =>
    apply(scene.R, [a.p[0] - scene.origin[0], a.p[1] - scene.origin[1], a.p[2] - scene.origin[2]]));
  return {
    scene, o, live, textWidth, useQ,
    vis: m.atoms.map(a => o.h || a.e !== 'H'),
    X: i => P[i][0] * s,
    Y: i => -P[i][1] * s,
    Z: i => P[i][2],
    rad: i => Math.max(drawRadius(m.atoms[i].e) * o.asz * (1 + 0.04 * P[i][2]) * s, 1.5),   // 手前の原子ほど少し大きく
    colorOf: a => useQ ? chargeColor(a.q ?? 0, o.qr) : elementColor(a.e, o.preset, scene.custom),
    bb: new Bounds(),
  };
}

const bothVisible = (c: Ctx) => (b: Pair): boolean => c.vis[b[0]] && c.vis[b[1]];
const midpoint = (c: Ctx, b: Pair): [number, number] => [(c.X(b[0]) + c.X(b[1])) / 2, (c.Y(b[0]) + c.Y(b[1])) / 2];

// =============================================================================
// 結合と原子
// =============================================================================
type LineKind = 'bond' | 'metal' | 'link';
/** 奥から順に描くもの:結合の線か、原子の丸 */
type Item =
  | {type: 'line'; z: number; i: number; j: number; kind: LineKind}
  | {type: 'atom'; z: number; i: number};

const LINE_STYLE: Record<LineKind, {width: number; dash: string}> = {
  bond: {width: 2.6, dash: ''},
  metal: {width: 1.8, dash: ' stroke-dasharray="5 4"'},
  link: {width: 1.8, dash: ' stroke-dasharray="1.5 4"'},
};

/**
 * 結合と原子を奥から順に並べる。
 * 結合の重なり:depth = 奥行きの順(手前の結合は原子の上に重なる)、trim = 奥行きの順だが両端を原子の縁で止める、
 *               back = 結合をすべて原子の後ろに描く
 */
function depthOrder(c: Ctx): Item[] {
  const {scene, o, vis, Z} = c, T = scene.topo;
  const items: Item[] = [];
  const addLine = (kind: LineKind) => ([i, j]: Pair) => {
    if (vis[i] && vis[j])
      items.push({z: (Z(i) + Z(j)) / 2 - 0.01 - (o.bondz === 'back' ? 1e6 : 0), type: 'line', i, j, kind});
  };
  T.bonds.forEach(addLine('bond'));
  T.contacts.forEach(addLine('metal'));
  metalMetalPairs(scene.mol.atoms, T).forEach(addLine('metal'));
  scene.links.forEach(addLine('link'));
  scene.mol.atoms.forEach((_, i) => { if (vis[i]) items.push({z: Z(i), type: 'atom', i}); });
  return items.sort((a, b) => a.z - b.z);
}

function drawLine(c: Ctx, it: Extract<Item, {type: 'line'}>): string {
  const {X, Y, rad, o} = c, style = LINE_STYLE[it.kind];
  let x1 = X(it.i), y1 = Y(it.i), x2 = X(it.j), y2 = Y(it.j);
  if (o.bondz === 'trim') {                     // 両端を原子の縁まで縮める。丸どうしが重なっていれば線は描かない
    const len = Math.hypot(x2 - x1, y2 - y1), r1 = rad(it.i), r2 = rad(it.j);
    if (len <= r1 + r2 + 0.5) return '';
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    x1 += ux * r1; y1 += uy * r1; x2 -= ux * r2; y2 -= uy * r2;
  }
  return `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${INK2}" stroke-width="${style.width}" stroke-linecap="${o.bondz === 'trim' ? 'butt' : 'round'}"${style.dash}/>`;
}

function drawAtom(c: Ctx, i: number, hits: Hit[]): string {
  const {scene, live, bb} = c;
  const a = scene.mol.atoms[i], r = c.rad(i), x = c.X(i), y = c.Y(i);
  const tip = live ? `<title>${a.e}${i + 1}${a.q !== null ? '  q = ' + formatCharge(a.q, 3) : ''}</title>` : '';
  let g = `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${c.colorOf(a)}" stroke="${INK2}" stroke-width="1.1"${live ? ` data-i="${i}"` : ''}>${tip}</circle>`;
  bb.add(x - r, y - r, x + r, y + r);
  if (live) {
    hits.push([i, x, y, r]);
    if (scene.pick === i)
      g += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r + 4)}" fill="none" stroke="${PICK_COLOR}" stroke-width="2.5" pointer-events="none"/>`;
  }
  return g;
}

/** 結合と原子。hits には画面表示用のときだけ当たり判定を足す(奥から手前の順) */
function drawBody(c: Ctx, hits: Hit[]): string {
  return depthOrder(c).map(it => it.type === 'line' ? drawLine(c, it) : drawAtom(c, it.i, hits)).join('');
}

// =============================================================================
// 数値(距離・ラベル)
// =============================================================================
/** 白い下地つきの文字(複数行) */
function boxedText(c: Ctx, lines: string[], x: number, y: number, fs: number, col: string, italic: boolean): string {
  const font = `${italic ? 'italic ' : ''}${fs}px Arial`, lh = fs * 1.05;
  const w = Math.max(...lines.map(l => c.textWidth(l, font))), h = lh * lines.length;
  c.bb.add(x - w / 2 - 2, y - h / 2 - 1, x + w / 2 + 2, y + h / 2 + 1);
  let t = `<rect x="${num(x - w / 2 - 2)}" y="${num(y - h / 2 - 1)}" width="${num(w + 4)}" height="${num(h + 2)}" fill="#ffffff" fill-opacity="0.88" pointer-events="none"/>`;
  lines.forEach((l, k) => {
    t += `<text x="${num(x)}" y="${num(y + (k - (lines.length - 1) / 2) * lh + fs * 0.35)}" text-anchor="middle" font-family="${FONT}" font-size="${fs}"${italic ? ' font-style="italic"' : ''} fill="${col}" pointer-events="none">${escapeXml(l)}</text>`;
  });
  return t;
}

function drawDistances(c: Ctx): string {
  const {scene, o} = c, T = scene.topo;
  return (o.md ? T.contacts : []).concat(scene.links).filter(bothVisible(c))
    .map(b => boxedText(c, [T.D[b[0]][b[1]].toFixed(2)], ...midpoint(c, b), o.fs * 0.83, INK2, true)).join('');
}

/** ラベルは、周りの原子・結合の中点・他のラベルから最も離れた向きに置く */
function drawLabels(c: Ctx): string {
  const {scene, o, vis, X, Y} = c, T = scene.topo, m = scene.mol, s = SCALE;
  const obstacles: [number, number, number][] = [];       // [x, y, 原子の番号(結合の中点は −1)]
  m.atoms.forEach((_, i) => { if (vis[i]) obstacles.push([X(i), Y(i), i]); });
  T.bonds.concat(T.contacts, scene.links).filter(bothVisible(c)).forEach(b => obstacles.push([...midpoint(c, b), -1]));
  const placed: [number, number][] = [];
  let g = '';
  for (const i of [...scene.labels].filter(k => k < m.atoms.length && vis[k]).sort((a, b) => a - b)) {
    const a = m.atoms[i], lines = [a.e + (i + 1)].concat(a.q !== null ? [formatCharge(a.q)] : []);
    const off = c.rad(i) + (lines.length > 1 ? 0.48 : 0.36) * s * (o.fs / 12);
    let best: [number, number, number] | null = null;      // [周りからの離れ具合, x, y]
    for (let deg = 0; deg < 360; deg += 15) {
      const cos = Math.cos(deg * Math.PI / 180), sin = Math.sin(deg * Math.PI / 180);
      const x = X(i) + off * cos, y = Y(i) - off * sin;
      let d = 9 * s;
      for (const ob of obstacles) if (ob[2] !== i) d = Math.min(d, Math.hypot((x - ob[0]) * 0.7, y - ob[1]));
      for (const ob of placed) d = Math.min(d, Math.hypot((x - ob[0]) * 0.6, y - ob[1]) * 0.8);
      d += 0.02 * (x * cos - y * sin);            // 迷ったら図の外側へ
      if (!best || d > best[0]) best = [d, x, y];
    }
    if (!best) continue;
    placed.push([best[1], best[2]]);
    g += boxedText(c, lines, best[1], best[2], o.fs, INK, false);
  }
  return g;
}

function drawNumbers(c: Ctx): string {
  return c.o.num ? drawDistances(c) + drawLabels(c) : '';
}

// =============================================================================
// 枠の下に付けるもの(カラーバー・凡例・注記)。どれも y から描き、使った高さを返す
// =============================================================================
interface Block { svg: string; height: number }

function drawColorBar(c: Ctx, y: number): Block {
  const {o, bb} = c, cx = bb.cx;
  const w = 190, h = 11, x0 = cx - w / 2;
  let svg = `<defs><linearGradient id="npa-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${NEG}"/><stop offset="0.5" stop-color="${ZERO}"/><stop offset="1" stop-color="${POS}"/></linearGradient></defs>`;
  svg += `<polygon points="${num(x0 - 9)},${num(y + h / 2)} ${num(x0)},${num(y)} ${num(x0)},${num(y + h)}" fill="${NEG}"/><polygon points="${num(x0 + w + 9)},${num(y + h / 2)} ${num(x0 + w)},${num(y)} ${num(x0 + w)},${num(y + h)}" fill="${POS}"/>`;
  svg += `<rect x="${num(x0)}" y="${num(y)}" width="${w}" height="${h}" fill="url(#npa-g)" stroke="#e1e0d9" stroke-width="0.8"/>`;
  for (let k = 0; k <= 4; k++) {
    const tx = x0 + w * k / 4, v = -o.qr + o.qr * k / 2;
    const label = (v < 0 ? MINUS : '') + Math.abs(v).toFixed(o.qr % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1');
    svg += `<line x1="${num(tx)}" y1="${num(y + h)}" x2="${num(tx)}" y2="${num(y + h + 3)}" stroke="${INK2}" stroke-width="0.8"/>`;
    svg += centeredText(tx, y + h + 14, 10, label);
  }
  svg += centeredText(cx, y + h + 28, 10.5, 'NPA atomic charge (e)');
  bb.widen(x0 - 16, x0 + w + 16);
  return {svg, height: h + 36};
}

function drawElementLegend(c: Ctx, y: number): Block {
  const {scene, o, vis, bb} = c;
  const els = [...new Set(scene.mol.atoms.filter((_, i) => vis[i]).map(a => a.e))].sort((a, b) => ZOF[a] - ZOF[b]);
  const cell = 40, w = cell * els.length, x0 = bb.cx - w / 2;
  let svg = '';
  els.forEach((e, k) => {
    svg += `<circle cx="${num(x0 + cell * k + 10)}" cy="${num(y + 8)}" r="6.5" fill="${elementColor(e, o.preset, scene.custom)}" stroke="${INK2}" stroke-width="1"/>`;
    svg += `<text x="${num(x0 + cell * k + 20)}" y="${num(y + 12)}" font-family="${FONT}" font-size="11" fill="${INK2}">${e}</text>`;
  });
  bb.widen(x0 - 6, x0 + w + 6);
  return {svg, height: 26};
}

/** カラーバー(電荷の色のとき)か元素の凡例 */
function drawLegend(c: Ctx, y: number): Block {
  if (!c.o.leg) return {svg: '', height: 0};
  return c.useQ ? drawColorBar(c, y) : drawElementLegend(c, y);
}

/** 長い文を、幅 maxW(px)に収まるよう単語の切れ目で折り返す */
function wrapWords(text: string, maxW: number, font: string, textWidth: TextWidth): string[] {
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1], t = last ? last + ' ' + word : word;
    if (textWidth(t, font) > maxW && last) lines.push(word); else lines[lines.length - 1] = t;
  }
  return lines;
}

/** 注記(幅に合わせて折り返す) */
function drawNote(c: Ctx, y: number): Block {
  const {scene, o, bb, textWidth} = c;
  const text = o.note ? (o.noteText.trim() || autoNote(scene, o)) : '';
  if (!text) return {svg: '', height: 0};
  const font = '9.5px Arial', cx = bb.cx;
  const lines = wrapWords(text, Math.max(bb.x1 - bb.x0 - 16, 340), font, textWidth);
  const svg = lines.map((l, k) => centeredText(cx, y + 10 + k * 12.5, 9.5, escapeXml(l))).join('');
  const half = Math.max(...lines.map(l => textWidth(l, font))) / 2 + 8;
  bb.widen(cx - half, cx + half);
  return {svg, height: 6 + lines.length * 12.5};
}

// =============================================================================
// 図
// =============================================================================
/**
 * 図を作る。
 * @param env.live      画面表示用(枠を固定し、クリック用の情報を付ける)。false なら保存用(図の内容に枠を合わせる)
 * @param env.textWidth 文字列の幅を測る関数
 */
export function buildSVG(scene: Scene, o: Options, env: {live: boolean; textWidth: TextWidth}): Figure {
  const c = makeContext(scene, o, env.live, env.textWidth), bb = c.bb;
  const hits: Hit[] = [];
  const body = drawBody(c, hits) + drawNumbers(c);

  // 枠:画面では固定(回しても動かない)、保存では図の内容に合わせる
  if (c.live) { const L = scene.lim * SCALE; bb.x0 = -L; bb.x1 = L; bb.y0 = -L * 0.82; bb.y1 = L * 0.82; }
  else { bb.x0 -= PAD; bb.y0 -= PAD; bb.x1 += PAD; bb.y1 += PAD; }

  let y = bb.y1 + 6, extra = '';
  for (const draw of [drawLegend, drawNote]) {      // 順に下へ積む
    const b = draw(c, y);
    extra += b.svg;
    y += b.height;
  }
  bb.y1 = y + 6;

  const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0;
  const background = (c.live || !o.transparent)
    ? `<rect x="${num(bb.x0)}" y="${num(bb.y0)}" width="${num(W)}" height="${num(H)}" fill="#ffffff"/>` : '';
  const size = c.live ? '' : ` width="${num(W)}" height="${num(H)}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(bb.x0)} ${num(bb.y0)} ${num(W)} ${num(H)}"${size}>${background}${body}${extra}</svg>`;
  return {svg, W, H, hits};
}
