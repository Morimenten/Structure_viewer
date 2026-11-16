import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLog } from '../src/parse.ts';
import { topology, frameOf, identity } from '../src/geometry.ts';
import type { Options, Scene, TextWidth } from '../src/types.ts';
import { buildSVG, autoNote, formatCharge } from '../src/render.ts';
import { chargeColor, elementColor } from '../src/colors.ts';

const textWidth: TextWidth = (text, font) => text.length * parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '10') * 0.55;    // ブラウザなしで動かすための代用
const mol = parseLog(readFileSync(new URL('./fixtures/water.log', import.meta.url), 'utf8'));
const scene = (over: Partial<Scene> = {}): Scene => ({mol, topo: topology(mol.atoms), R: identity(), ...frameOf(mol.atoms),
  labels: new Set([0]), links: [], pick: null, custom: {}, ...over});
const options = (over: Partial<Options> = {}): Options => ({colorMode: 'q', h: true, num: true, md: true, leg: true, note: true, noteText: '',
  qr: 1, fs: 12, asz: 1, preset: 'jmol', bondz: 'depth', transparent: false, ...over});
const count = (s: string, re: RegExp) => (s.match(re) || []).length;
const draw = (sc: Scene, o: Options, live = false) => buildSVG(sc, o, {live, textWidth});

test('原子は丸、結合は線になる。H を消すと結合も消える', () => {
  const a = draw(scene(), options({leg: false})).svg;
  assert.equal(count(a, /<circle /g), 3);
  assert.equal(count(a, /<line /g), 2);
  const b = draw(scene(), options({leg: false, h: false})).svg;
  assert.equal(count(b, /<circle /g), 1);
  assert.equal(count(b, /<line /g), 0);
});

test('電荷の色:O は負(青寄り)、H は正(赤寄り)', () => {
  const svg = draw(scene(), options()).svg;
  assert.ok(svg.includes(`fill="${chargeColor(-0.95, 1)}"`));
  assert.ok(svg.includes(`fill="${chargeColor(0.475, 1)}"`));
  assert.ok(svg.includes('npa-g'));                         // カラーバー
});

test('元素の色:凡例が付き、変更した色が使われる', () => {
  const svg = draw(scene({custom: {jmol: {O: '#123456'}}}), options({colorMode: 'e'})).svg;
  assert.ok(svg.includes('fill="#123456"'));
  assert.ok(svg.includes(`fill="${elementColor('H', 'jmol')}"`));
  assert.ok(!svg.includes('npa-g'));
});

test('ラベルは「元素+番号」と電荷。数値を消すとラベルも距離も出ない', () => {
  const sc = scene({links: [[1, 2]]});
  const a = draw(sc, options({leg: false, note: false})).svg;
  assert.ok(a.includes('>O1<') && a.includes(`>${formatCharge(-0.95)}<`));
  assert.ok(a.includes('>1.51<'));                          // H···H の距離
  assert.equal(count(draw(sc, options({leg: false, note: false, num: false})).svg, /<text /g), 0);
});

test('結合の重なり:back は線がすべて丸より先、trim は線が丸の縁で止まる', () => {
  const order = (s: string) => [...s.matchAll(/<(line|circle) /g)].map(m => m[1]).join(' ');
  assert.equal(order(draw(scene(), options({leg: false, bondz: 'back'})).svg), 'line line circle circle circle');
  const full = draw(scene(), options({leg: false, bondz: 'depth'})).svg, trim = draw(scene(), options({leg: false, bondz: 'trim'})).svg;
  const len = (s: string) => { const m = (/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/.exec(s) ?? []).slice(1).map(Number); return Math.hypot(m[2] - m[0], m[3] - m[1]); };
  assert.ok(len(trim) < len(full));
});

test('画面用は枠が固定で当たり判定つき、保存用は大きさつき', () => {
  const live = draw(scene(), options(), true), saved = draw(scene(), options(), false);
  assert.equal(live.hits.length, 3);
  assert.ok(live.svg.includes('data-i="0"') && !saved.svg.includes('data-i'));
  assert.ok(/<svg [^>]*width="/.test(saved.svg) && !/<svg [^>]*width="/.test(live.svg));
  const turned = draw(scene({R: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]}), options(), true);
  const viewBox = (s: string) => /viewBox="[^"]+"/.exec(s)?.[0];
  assert.equal(viewBox(turned.svg), viewBox(live.svg));
});

test('背景:透明にすると保存用の白い下地がなくなる', () => {
  assert.ok(draw(scene(), options()).svg.includes('fill="#ffffff"/>'));
  assert.ok(!/^<svg[^>]*><rect/.test(draw(scene(), options({transparent: true})).svg));
});

test('注記:自動の文と、手で書いた文(記号はエスケープ)', () => {
  assert.equal(autoNote(scene(), options({h: false})), 'NPA charges (e), B3LYP-D3(BJ)/6-31G(d), SMD(water). H atoms omitted. Colors clipped at ±1.0 e.');
  assert.match(autoNote(scene(), options({qr: 0.5})), /\(O exceeds this range\)/);
  assert.ok(draw(scene(), options({noteText: 'a < b & c'})).svg.includes('a &lt; b &amp; c'));
});
