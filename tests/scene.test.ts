import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLog, parseCom } from '../src/parse.ts';
import { createScene, withName, toggleLabel, pickForDistance, describe, exportStem, defaultLabels } from '../src/scene.ts';
import { topology } from '../src/geometry.ts';

const water = withName(parseLog(readFileSync(new URL('./fixtures/water.log', import.meta.url), 'utf8')), 'water.log');

test('createScene: 名前・既定のラベル・最初の向きを用意する', () => {
  const c = createScene(water, 1.15, {});
  assert.equal(c.mol.stem, 'water');
  assert.deepEqual([...c.labels], [0]);                     // 重原子(O)だけ
  assert.deepEqual(c.R0, c.R);
  assert.notEqual(c.R0, c.R);                               // 別の行列(回しても R0 は変わらない)
  assert.deepEqual(c.links, []);
  assert.equal(c.pick, null);
});

test('defaultLabels: 金属があれば金属と配位原子', () => {
  const mol = parseCom('# hf/sto-3g\n\nt\n\n0 1\nCu 0 0 0\nN 2 0 0\nC 3.4 0 0\n\n');
  assert.deepEqual([...defaultLabels(mol, topology(mol.atoms))].sort(), [0, 1]);
});

test('toggleLabel: 付ける / 消す', () => {
  const c = createScene(water, 1.15, {});
  toggleLabel(c, 1);
  assert.ok(c.labels.has(1));
  toggleLabel(c, 1);
  assert.ok(!c.labels.has(1));
});

test('pickForDistance: 2 つ選ぶと追加、同じ組をもう一度選ぶと削除、同じ原子で選択解除', () => {
  const c = createScene(water, 1.15, {});
  pickForDistance(c, 2);
  assert.equal(c.pick, 2);
  pickForDistance(c, 2);
  assert.equal(c.pick, null);
  pickForDistance(c, 2); pickForDistance(c, 1);
  assert.deepEqual(c.links, [[1, 2]]);                      // 小さい番号が先
  pickForDistance(c, 1); pickForDistance(c, 2);
  assert.deepEqual(c.links, []);
});

test('describe と exportStem', () => {
  const d = describe(water);
  assert.ok(d.startsWith('water.log — H2O、3 原子、B3LYP'), d);
  assert.ok(d.endsWith('NPA 電荷あり(合計 +0.00)'), d);
  assert.equal(exportStem(water, 'q'), 'water_NPA');
  assert.equal(exportStem(water, 'e'), 'water_structure');
});
