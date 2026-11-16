// 図(SVG)を作る。画面表示と保存で同じ関数を使う。
// ここは画面(DOM)に触らない:入力は「場面」と「設定」だけで、出力は SVG の文字列。

import { ZOF, drawRadius } from './elements.ts';
import { NEG, ZERO, POS, INK, INK2, chargeColor, elementColor } from './colors.ts';
import { apply, metalMetalPairs } from './geometry.ts';
import type { Atom, Figure, Hit, Options, Pair, Scene, TextWidth, Vec3 } from './types.ts';

const FONT = 'Arial, Helvetica, sans-serif';
const SCALE = 50;                 // 1 Å = 50 px
const MINUS = '−';
const PAD = 14;                   // 保存する図の余白(px)

/** +0.15 / −0.62 の形 */
export const formatCharge = (q: number): string => (q >= 0 ? '+' : MINUS) + Math.abs(q).toFixed(2);
const escapeXml = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number): string => (Math.round(v * 100) / 100).toString();

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
}

/** 奥から順に描くもの:結合の線か、原子の丸 */
type Item =
  | {type: 'line'; z: number; i: number; j: number; kind: 'bond' | 'metal' | 'link'}
  | {type: 'atom'; z: number; i: number};

/**
 * 図を作る。
 * @param env.live      画面表示用(枠を固定し、クリック用の情報を付ける)。false なら保存用(図の内容に枠を合わせる)
 * @param env.textWidth 文字列の幅を測る関数
 */
export function buildSVG(scene: Scene, o: Options, env: {live: boolean; textWidth: TextWidth}): Figure {
  const {live, textWidth} = env;
  const m = scene.mol, T = scene.topo, s = SCALE, n = m.atoms.length;
  const useQ = usesChargeColor(scene, o);
  /** 図の中での位置(Å)。x = 右、y = 上、z = 手前 */
  const P: Vec3[] = m.atoms.map(a =>
    apply(scene.R, [a.p[0] - scene.origin[0], a.p[1] - scene.origin[1], a.p[2] - scene.origin[2]]));
  const vis = m.atoms.map(a => o.h || a.e !== 'H');
  const X = (i: number) => P[i][0] * s, Y = (i: number) => -P[i][1] * s;
  const rad = (i: number) => Math.max(drawRadius(m.atoms[i].e) * o.asz * (1 + 0.04 * P[i][2]) * s, 1.5);   // 手前の原子ほど少し大きく
  const colorOf = (a: Atom) => useQ ? chargeColor(a.q ?? 0, o.qr) : elementColor(a.e, o.preset, scene.custom);
  const bb = new Bounds();
  const bothVisible = (b: Pair) => vis[b[0]] && vis[b[1]];

  // --- 結合と原子を奥から順に描く ---
  // 結合の重なり:depth = 奥行きの順(手前の結合は原子の上に重なる)、trim = 奥行きの順だが両端を原子の縁で止める、
  //               back = 結合をすべて原子の後ろに描く
  const items: Item[] = [];
  const addLine = (i: number, j: number, kind: 'bond' | 'metal' | 'link') => {
    if (vis[i] && vis[j])
      items.push({z: (P[i][2] + P[j][2]) / 2 - 0.01 - (o.bondz === 'back' ? 1e6 : 0), type: 'line', i, j, kind});
  };
  T.bonds.forEach(b => addLine(b[0], b[1], 'bond'));
  T.contacts.forEach(b => addLine(b[0], b[1], 'metal'));
  metalMetalPairs(m.atoms, T).forEach(b => addLine(b[0], b[1], 'metal'));
  scene.links.forEach(b => addLine(b[0], b[1], 'link'));
  m.atoms.forEach((_, i) => { if (vis[i]) items.push({z: P[i][2], type: 'atom', i}); });
  items.sort((a, b) => a.z - b.z);

  let g = '';
  const hits: Hit[] = [];
  for (const it of items) {
    if (it.type === 'line') {
      const w = it.kind === 'bond' ? 2.6 : 1.8;
      const dash = it.kind === 'bond' ? '' : it.kind === 'metal' ? ' stroke-dasharray="5 4"' : ' stroke-dasharray="1.5 4"';
      let x1 = X(it.i), y1 = Y(it.i), x2 = X(it.j), y2 = Y(it.j);
      if (o.bondz === 'trim') {                     // 両端を原子の縁まで縮める。丸どうしが重なっていれば線は描かない
        const len = Math.hypot(x2 - x1, y2 - y1), r1 = rad(it.i), r2 = rad(it.j);
        if (len <= r1 + r2 + 0.5) continue;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        x1 += ux * r1; y1 += uy * r1; x2 -= ux * r2; y2 -= uy * r2;
      }
      g += `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${INK2}" stroke-width="${w}" stroke-linecap="${o.bondz === 'trim' ? 'butt' : 'round'}"${dash}/>`;
    } else {
      const a = m.atoms[it.i], r = rad(it.i), x = X(it.i), y = Y(it.i);
      const tip = live ? `<title>${a.e}${it.i + 1}${a.q !== null ? '  q = ' + (a.q >= 0 ? '+' : MINUS) + Math.abs(a.q).toFixed(3) : ''}</title>` : '';
      g += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${colorOf(a)}" stroke="${INK2}" stroke-width="1.1"${live ? ` data-i="${it.i}"` : ''}>${tip}</circle>`;
      bb.add(x - r, y - r, x + r, y + r);
      if (live) hits.push([it.i, x, y, r]);
      if (live && scene.pick === it.i)              // 距離の 1 個目として選択中の原子
        g += `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r + 4)}" fill="none" stroke="#eb6834" stroke-width="2.5" pointer-events="none"/>`;
    }
  }

  // --- 数値(距離・ラベル) ---
  /** 白い下地つきの文字(複数行) */
  const boxedText = (lines: string[], x: number, y: number, fs: number, col: string, italic: boolean): string => {
    const font = `${italic ? 'italic ' : ''}${fs}px Arial`, lh = fs * 1.05;
    const w = Math.max(...lines.map(l => textWidth(l, font))), h = lh * lines.length;
    bb.add(x - w / 2 - 2, y - h / 2 - 1, x + w / 2 + 2, y + h / 2 + 1);
    let t = `<rect x="${num(x - w / 2 - 2)}" y="${num(y - h / 2 - 1)}" width="${num(w + 4)}" height="${num(h + 2)}" fill="#ffffff" fill-opacity="0.88" pointer-events="none"/>`;
    lines.forEach((l, k) => {
      t += `<text x="${num(x)}" y="${num(y + (k - (lines.length - 1) / 2) * lh + fs * 0.35)}" text-anchor="middle" font-family="${FONT}" font-size="${fs}"${italic ? ' font-style="italic"' : ''} fill="${col}" pointer-events="none">${escapeXml(l)}</text>`;
    });
    return t;
  };
  if (o.num) {
    const mid = (b: Pair): [number, number] => [(X(b[0]) + X(b[1])) / 2, (Y(b[0]) + Y(b[1])) / 2];
    for (const b of (o.md ? T.contacts : []).concat(scene.links).filter(bothVisible))
      g += boxedText([T.D[b[0]][b[1]].toFixed(2)], ...mid(b), o.fs * 0.83, INK2, true);

    // ラベルは、周りの原子・結合の中点・他のラベルから最も離れた向きに置く
    const obstacles: [number, number, number][] = [];       // [x, y, 原子の番号(結合の中点は −1)]
    m.atoms.forEach((_, i) => { if (vis[i]) obstacles.push([X(i), Y(i), i]); });
    T.bonds.concat(T.contacts, scene.links).filter(bothVisible).forEach(b => obstacles.push([...mid(b), -1]));
    const placed: [number, number][] = [];
    for (const i of [...scene.labels].filter(k => k < n && vis[k]).sort((a, b) => a - b)) {
      const a = m.atoms[i], lines = [a.e + (i + 1)].concat(a.q !== null ? [formatCharge(a.q)] : []);
      const off = rad(i) + (lines.length > 1 ? 0.48 : 0.36) * s * (o.fs / 12);
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
      g += boxedText(lines, best[1], best[2], o.fs, INK, false);
    }
  }

  // --- 枠:画面では固定(回しても動かない)、保存では図の内容に合わせる ---
  if (live) { const L = scene.lim * s; bb.x0 = -L; bb.x1 = L; bb.y0 = -L * 0.82; bb.y1 = L * 0.82; }
  else { bb.x0 -= PAD; bb.y0 -= PAD; bb.x1 += PAD; bb.y1 += PAD; }
  let y = bb.y1 + 6, extra = '';
  const cx = (bb.x0 + bb.x1) / 2;

  if (o.leg && useQ) {                              // カラーバー
    const w = 190, h = 11, x0 = cx - w / 2;
    extra += `<defs><linearGradient id="npa-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${NEG}"/><stop offset="0.5" stop-color="${ZERO}"/><stop offset="1" stop-color="${POS}"/></linearGradient></defs>`;
    extra += `<polygon points="${num(x0 - 9)},${num(y + h / 2)} ${num(x0)},${num(y)} ${num(x0)},${num(y + h)}" fill="${NEG}"/><polygon points="${num(x0 + w + 9)},${num(y + h / 2)} ${num(x0 + w)},${num(y)} ${num(x0 + w)},${num(y + h)}" fill="${POS}"/>`;
    extra += `<rect x="${num(x0)}" y="${num(y)}" width="${w}" height="${h}" fill="url(#npa-g)" stroke="#e1e0d9" stroke-width="0.8"/>`;
    for (let k = 0; k <= 4; k++) {
      const tx = x0 + w * k / 4, v = -o.qr + o.qr * k / 2;
      const label = (v < 0 ? MINUS : '') + Math.abs(v).toFixed(o.qr % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1');
      extra += `<line x1="${num(tx)}" y1="${num(y + h)}" x2="${num(tx)}" y2="${num(y + h + 3)}" stroke="${INK2}" stroke-width="0.8"/>`;
      extra += `<text x="${num(tx)}" y="${num(y + h + 14)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${INK2}">${label}</text>`;
    }
    extra += `<text x="${num(cx)}" y="${num(y + h + 28)}" text-anchor="middle" font-family="${FONT}" font-size="10.5" fill="${INK2}">NPA atomic charge (e)</text>`;
    bb.widen(x0 - 16, x0 + w + 16);
    y += h + 36;
  } else if (o.leg) {                               // 元素の凡例
    const els = [...new Set(m.atoms.filter((_, i) => vis[i]).map(a => a.e))].sort((a, b) => ZOF[a] - ZOF[b]);
    const cell = 40, w = cell * els.length, x0 = cx - w / 2;
    els.forEach((e, k) => {
      extra += `<circle cx="${num(x0 + cell * k + 10)}" cy="${num(y + 8)}" r="6.5" fill="${elementColor(e, o.preset, scene.custom)}" stroke="${INK2}" stroke-width="1"/>`;
      extra += `<text x="${num(x0 + cell * k + 20)}" y="${num(y + 12)}" font-family="${FONT}" font-size="11" fill="${INK2}">${e}</text>`;
    });
    bb.widen(x0 - 6, x0 + w + 6);
    y += 26;
  }

  const noteText = o.note ? (o.noteText.trim() || autoNote(scene, o)) : '';
  if (noteText) {                                   // 注記(幅に合わせて折り返す)
    const font = '9.5px Arial', maxW = Math.max(bb.x1 - bb.x0 - 16, 340), lines = [''];
    for (const word of noteText.split(/\s+/)) {
      const last = lines[lines.length - 1], t = last ? last + ' ' + word : word;
      if (textWidth(t, font) > maxW && last) lines.push(word); else lines[lines.length - 1] = t;
    }
    lines.forEach((l, k) => {
      extra += `<text x="${num(cx)}" y="${num(y + 10 + k * 12.5)}" text-anchor="middle" font-family="${FONT}" font-size="9.5" fill="${INK2}">${escapeXml(l)}</text>`;
    });
    const half = Math.max(...lines.map(l => textWidth(l, font))) / 2 + 8;
    bb.widen(cx - half, cx + half);
    y += 6 + lines.length * 12.5;
  }
  bb.y1 = y + 6;

  const W = bb.x1 - bb.x0, H = bb.y1 - bb.y0;
  const background = (live || !o.transparent)
    ? `<rect x="${num(bb.x0)}" y="${num(bb.y0)}" width="${num(W)}" height="${num(H)}" fill="#ffffff"/>` : '';
  const size = live ? '' : ` width="${num(W)}" height="${num(H)}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(bb.x0)} ${num(bb.y0)} ${num(W)} ${num(H)}"${size}>${background}${g}${extra}</svg>`;
  return {svg, W, H, hits};
}
