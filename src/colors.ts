// 色(電荷の色、元素の色、線と文字の色)

import { JMOL_COLORS, isMetal } from './elements.ts';
import type { CustomColors, Preset } from './types.ts';

export const NEG = '#2a78d6', ZERO = '#f0efec', POS = '#e34948';   // 電荷:負・0・正
export const INK = '#0b0b0b', INK2 = '#52514e';                    // 文字・線

const hex2rgb = (h: string): number[] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c: number[]): string => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** a と b を t(0〜1)の割合で混ぜる */
export function mix(a: string, b: string, t: number): string {
  const to = hex2rgb(b);
  return rgb2hex(hex2rgb(a).map((v, i) => v + (to[i] - v) * t));
}

/** 電荷 q の色。±range を超える電荷は端の色 */
export function chargeColor(q: number, range: number): string {
  const t = Math.max(-1, Math.min(1, q / range));
  return t < 0 ? mix(ZERO, NEG, -t) : mix(ZERO, POS, t);
}

/** 元素の色。利用者が変えた色(custom)があれば、それを使う */
export function elementColor(e: string, preset: Preset, custom: CustomColors = {}): string {
  const changed = custom[preset]?.[e];
  if (changed) return changed;
  const base = JMOL_COLORS[e] || '#FF1493';
  if (preset === 'pastel') return mix(base, '#ffffff', 0.5);
  if (preset === 'gray') return e === 'H' ? '#ffffff' : isMetal(e) ? '#6f6e6a' : e === 'C' ? '#c9c8c3' : '#9d9c97';
  return base;
}
