// 画面の操作をまとめる入口。
// ファイルを読む(parse.ts)→ 状態を作る(scene.ts)→ 構造を計算する(geometry.ts)→ 図を作る(render.ts)→ 保存する(export.ts)

import { ZOF } from './elements.ts';
import { elementColor } from './colors.ts';
import { parseAny } from './parse.ts';
import { topology, rotated, copyMat } from './geometry.ts';
import { buildSVG, autoNote } from './render.ts';
import { download, svgBlob, svgToPng } from './export.ts';
import { createScene, withName, heavyAtoms, metalsAndLigands, toggleLabel, pickForDistance, describe, exportStem } from './scene.ts';
import type { Current, LoadedMolecule } from './scene.ts';
import type { BondOverlap, CustomColors, Figure, Hit, Options, Preset, TextWidth } from './types.ts';

const COLOR_STORAGE_KEY = 'npaviewer.colors';
const ARROW_STEP = 12.5;          // 矢印キー 1 回分のドラッグ量(px)= 5°
const CLICK_TOLERANCE = 4;        // これ未満の移動はクリックとみなす(px)

// =============================================================================
// 画面の部品
// =============================================================================
/** id で部品を取る。index.html にない id を書いたら、その場で気づけるようにエラーにする */
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`index.html に id="${id}" がありません`);
  return e as T;
}
const input = (id: string) => el<HTMLInputElement>(id);
const select = (id: string) => el<HTMLSelectElement>(id);
const view = el('view');

// =============================================================================
// 状態
// =============================================================================
let current: Current | null = null;
let hits: Hit[] = [];              // クリックの当たり判定(render のたびに更新)
const custom: CustomColors = loadCustomColors();

function loadCustomColors(): CustomColors {
  try { return (JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY) ?? '{}') as CustomColors | null) ?? {}; }
  catch { return {}; }
}
function saveCustomColors(): void {
  try { localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(custom)); } catch { /* 保存できなくても動かす */ }
}

/** 右側の設定。図の設定(Options)に、図そのものには関係しない項目を足したもの */
interface Settings extends Options {
  /** 金属との接触の倍率 */
  mcut: number;
  /** PNG の解像度の倍率 */
  pngScale: number;
  /** 原子をクリックしたときの動作 */
  clickMode: 'label' | 'dist';
}

function readSettings(): Settings {
  const mode = document.querySelector<HTMLInputElement>('input[name=mode]:checked');
  return {
    colorMode: input('cme').checked ? 'e' : 'q',
    h: input('showh').checked, num: input('shownum').checked, md: input('showmd').checked,
    leg: input('showleg').checked, note: input('shownote').checked, noteText: input('note').value,
    mcut: parseFloat(input('mcut').value), qr: parseFloat(select('qrange').value),
    fs: parseFloat(input('fs').value), asz: parseFloat(input('asz').value),
    preset: select('preset').value as Preset, bondz: select('bondz').value as BondOverlap,
    transparent: input('transparent').checked, pngScale: parseFloat(select('pngscale').value),
    clickMode: mode?.value === 'dist' ? 'dist' : 'label',
  };
}

// =============================================================================
// 描く
// =============================================================================
const measureCtx = document.createElement('canvas').getContext('2d');
const textWidth: TextWidth = (text, font) => {
  if (!measureCtx) return text.length * 6;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};

function render(): void {
  if (!current) return;
  const s = readSettings();
  input('note').placeholder = autoNote(current, s) || '注記(自動)';
  const figure = buildSVG(current, s, {live: true, textWidth});
  hits = figure.hits;
  view.innerHTML = figure.svg;
}

/** 保存用の図(枠を内容に合わせたもの) */
function exportFigure(): Figure | null {
  return current && buildSVG(current, readSettings(), {live: false, textWidth});
}

// =============================================================================
// 読み込む
// =============================================================================
function showError(msg: string): void {
  const e = el('err');
  e.textContent = msg;
  e.style.display = msg ? 'block' : 'none';
}

const messageOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

function loadText(name: string, text: string): boolean {
  let mol: LoadedMolecule;
  try { mol = withName(parseAny(name, text), name); }
  catch (e) { showError(`${name} を読めませんでした。\n${messageOf(e)}`); return false; }
  showError(mol.warn);
  current = createScene(mol, readSettings().mcut, custom);

  input('note').value = '';
  input('cmq').disabled = !mol.hasQ;
  input('cmq').checked = mol.hasQ;
  input('cme').checked = !mol.hasQ;
  el('drop').style.display = 'none';
  el<HTMLButtonElement>('bpng').disabled = el<HTMLButtonElement>('bsvg').disabled = false;
  el('info').style.display = 'block';
  el('info').textContent = describe(mol);
  buildSwatches();
  render();
  return true;
}

function loadFile(file: File | null | undefined): void {
  if (file) file.text().then(t => loadText(file.name, t), e => showError('ファイルを読めませんでした: ' + messageOf(e)));
}

function initFileInput(): void {
  const stage = el('stage');
  for (const type of ['dragenter', 'dragover'] as const)
    document.addEventListener(type, e => { e.preventDefault(); stage.classList.add('over'); });
  document.addEventListener('dragleave', e => { e.preventDefault(); if (e.relatedTarget === null) stage.classList.remove('over'); });
  document.addEventListener('drop', e => {                  // ページのどこにドロップしても読む
    e.preventDefault();
    stage.classList.remove('over');
    loadFile(e.dataTransfer?.files[0]);
  });
  for (const id of ['file', 'file2'])
    input(id).addEventListener('change', () => { loadFile(input(id).files?.[0]); input(id).value = ''; });
}

// =============================================================================
// 回す・クリックする
// =============================================================================
/** 画面上の位置にある、いちばん手前の原子(結合の線やラベルが重なっていても拾う) */
function atomAt(clientX: number, clientY: number): number | null {
  const m = view.querySelector('svg')?.getScreenCTM();
  if (!m) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  for (let k = hits.length - 1; k >= 0; k--) {
    const [i, x, y, r] = hits[k];
    if (Math.hypot(pt.x - x, pt.y - y) <= Math.max(r, 7)) return i;
  }
  return null;
}

function clickAtom(i: number): void {
  const c = current;
  if (!c) return;
  if (readSettings().clickMode === 'label') toggleLabel(c, i);
  else pickForDistance(c, i);
  render();
}

function rotate(dx: number, dy: number, roll: boolean): void {
  if (!current) return;
  current.R = rotated(current.R, dx, dy, roll);
  render();
}

function initPointer(): void {
  let drag: {x: number; y: number; roll: boolean; moved: number; atom: number | null} | null = null;
  view.addEventListener('pointerdown', e => {
    if (!current) return;
    drag = {x: e.clientX, y: e.clientY, roll: e.button === 2 || e.shiftKey, moved: 0, atom: atomAt(e.clientX, e.clientY)};
    try { view.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  view.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < CLICK_TOLERANCE) return;
    drag.x = e.clientX; drag.y = e.clientY;
    rotate(dx, -dy, drag.roll);
  });
  view.addEventListener('pointerup', () => {
    if (drag && drag.moved < CLICK_TOLERANCE && drag.atom !== null) clickAtom(drag.atom);
    drag = null;
  });
  view.addEventListener('pointercancel', () => { drag = null; });
  view.addEventListener('contextmenu', e => e.preventDefault());
}

function initKeyboard(): void {
  const steps: Record<string, [number, number]> =
    {ArrowLeft: [-ARROW_STEP, 0], ArrowRight: [ARROW_STEP, 0], ArrowUp: [0, ARROW_STEP], ArrowDown: [0, -ARROW_STEP]};
  document.addEventListener('keydown', e => {
    const step = steps[e.key], t = e.target;
    const typing = (t instanceof HTMLInputElement && t.type !== 'checkbox' && t.type !== 'radio') ||
      t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
    if (!step || !current || typing) return;
    rotate(step[0], step[1], false);
    e.preventDefault();
  });
}

// =============================================================================
// 設定
// =============================================================================
function initSettings(): void {
  for (const id of ['bondz', 'cmq', 'cme', 'showh', 'shownum', 'showmd', 'showleg', 'shownote', 'qrange', 'transparent'])
    el(id).addEventListener('change', render);
  document.querySelectorAll('input[name=mode]').forEach(r =>
    r.addEventListener('change', () => { if (current) current.pick = null; render(); }));

  input('mcut').addEventListener('input', () => {
    el('mcut_o').textContent = parseFloat(input('mcut').value).toFixed(2);
    if (current) { current.topo = topology(current.mol.atoms, readSettings().mcut); render(); }
  });
  input('fs').addEventListener('input', () => { el('fs_o').textContent = input('fs').value; render(); });
  input('asz').addEventListener('input', () => { el('asz_o').textContent = parseFloat(input('asz').value).toFixed(2); render(); });
  input('note').addEventListener('input', render);
  el('noteauto').onclick = () => { input('note').value = ''; render(); };

  /** ボタンを押したら、いまの構造に変更を加えて描き直す */
  const onClick = (id: string, change: (c: Current) => void) => {
    el(id).onclick = () => { if (current) { change(current); render(); } };
  };
  onClick('reset', c => { c.R = copyMat(c.R0); });
  onClick('lab_all', c => { c.labels = new Set(heavyAtoms(c.mol)); });
  onClick('lab_metal', c => { c.labels = new Set(metalsAndLigands(c.topo)); });
  onClick('lab_none', c => { c.labels = new Set(); });
  onClick('link_none', c => { c.links = []; c.pick = null; });
}

// ----- 元素の色 -----
/** いまの構造に含まれる元素の色見本を並べる */
function buildSwatches(): void {
  const box = el('swatches');
  box.innerHTML = '';
  if (!current) return;
  const preset = readSettings().preset;
  const elements = [...new Set(current.mol.atoms.map(a => a.e))].sort((a, b) => ZOF[a] - ZOF[b]);
  for (const e of elements) {
    const label = document.createElement('label'), picker = document.createElement('input');
    picker.type = 'color';
    picker.value = elementColor(e, preset, custom).toLowerCase();
    picker.setAttribute('aria-label', e + ' の色');
    picker.addEventListener('input', () => {
      (custom[preset] ??= {})[e] = picker.value;
      saveCustomColors();
      input('cme').checked = true;                          // 色を変えたら、元素の色の表示に切り替える
      render();
    });
    label.append(picker, e);
    box.appendChild(label);
  }
}

function initColors(): void {
  select('preset').addEventListener('change', () => { buildSwatches(); render(); });
  el('colreset').onclick = () => { delete custom[readSettings().preset]; saveCustomColors(); buildSwatches(); render(); };
}

// =============================================================================
// 保存
// =============================================================================
function initExport(): void {
  const stem = (c: Current) => exportStem(c.mol, readSettings().colorMode);
  el('bsvg').onclick = () => {
    const figure = exportFigure();
    if (current && figure) download(stem(current) + '.svg', svgBlob(figure.svg));
  };
  el('bpng').onclick = () => {
    const figure = exportFigure(), c = current;
    if (!c || !figure) return;
    svgToPng(figure.svg, figure.W, figure.H, readSettings().pngScale)
      .then(blob => download(stem(c) + '.png', blob), e => showError(messageOf(e)));
  };
}

initFileInput();
initPointer();
initKeyboard();
initSettings();
initColors();
initExport();

// 動作確認(自動テスト)用。画面の機能はこれに依存しない
declare global {
  interface Window {
    NPAV: {readonly state: Current | null; loadText: typeof loadText; render: typeof render; exportFigure: typeof exportFigure};
  }
}
window.NPAV = {get state() { return current; }, loadText, render, exportFigure};
