import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLog, parseCom, parseAny, methodFromRoute, symbolOf } from '../src/parse.ts';

const water = readFileSync(new URL('./fixtures/water.log', import.meta.url), 'utf8');

test('log: 最後の構造と NPA 電荷を読む', () => {
  const m = parseLog(water);
  assert.deepEqual(m.atoms.map(a => a.e), ['O', 'H', 'H']);
  assert.deepEqual(m.atoms[0].p, [0, 0, 0.119]);            // 2 つ目(最後)の Standard orientation
  assert.deepEqual(m.atoms.map(a => a.q), [-0.95, 0.475, 0.475]);
  assert.equal(m.hasQ, true);
  assert.equal(m.warn, '');
});

test('log: 複数行に続く route から計算レベルを読む', () => {
  assert.equal(parseLog(water).method, 'B3LYP-D3(BJ)/6-31G(d), SMD(water)');
});

test('log: NPA の表がなければ電荷なし', () => {
  const m = parseLog(water.split(' Summary of Natural Population Analysis')[0] + '\n Normal termination of Gaussian 16\n');
  assert.equal(m.hasQ, false);
  assert.equal(m.atoms[0].q, null);
});

test('log: NPA の原子数が構造と合わなければ電荷を使わず、注意を出す', () => {
  const m = parseLog(water.replace(/^ {6}H {4}3 .*\n/m, ''));
  assert.equal(m.hasQ, false);
  assert.match(m.warn, /原子数/);
});

test('log: Normal termination で終わっていなければ注意を出す', () => {
  assert.match(parseLog(water.replace(/ Normal termination.*\n/, '')).warn, /Normal termination/);
});

test('log: 座標がなければエラー', () => {
  assert.throws(() => parseLog('not a gaussian log'), /座標/);
});

test('com: Cartesian 座標を読む(固定フラグ・Fragment・原子番号の表記も)', () => {
  const m = parseCom(`%nproc=4
#p opt b3lyp/6-31g(d)

title

0 1
 C   0.000  0.000  0.000
 O   0  1.210  0.000  0.000
 H(Fragment=1)  -0.540  0.940  0.000
 1,-0.540,-0.940,0.000

`);
  assert.deepEqual(m.atoms.map(a => a.e), ['C', 'O', 'H', 'H']);
  assert.deepEqual(m.atoms[1].p, [1.21, 0, 0]);
  assert.deepEqual(m.atoms[3].p, [-0.54, -0.94, 0]);
  assert.equal(m.hasQ, false);
  assert.equal(m.method, 'B3LYP/6-31G(d)');
});

test('com: geom=allcheck は座標がないと伝える', () => {
  assert.throws(() => parseCom('%chk=a.chk\n# M062X def2TZVP guess=read geom=allcheck pop=NBO\n\n'), /geom=check/);
});

test('com: Z-matrix は読めないと伝える', () => {
  assert.throws(() => parseCom('# hf/3-21g\n\nwater\n\n0 1\nO\nH 1 0.96\nH 1 0.96 2 104.5\n\n'), /Z-matrix/);
});

test('parseAny: 拡張子で種類を決める。不明なら中身で判断する', () => {
  assert.equal(parseAny('a.log', water).kind, 'log');
  assert.equal(parseAny('a.txt', water).kind, 'log');
  assert.equal(parseAny('a.gjf', '# hf/sto-3g\n\nt\n\n0 1\nH 0 0 0\nH 0 0 0.74\n\n').kind, 'com');
});

test('methodFromRoute: いろいろな書き方', () => {
  const cases: Record<string, string> = {
    '# M062X def2TZVP guess=read geom=allcheck pop=NBO': 'M06-2X/def2-TZVP',
    '#p pbe1pbe/def2tzvp empiricaldispersion=gd3bj scrf=(smd,solvent=dichloroethane) pop=nbo': 'PBE0-D3(BJ)/def2-TZVP, SMD(dichloroethane)',
    '# opt=(ts,calcfc,noeigentest) freq ub3lyp/6-311+g(d,p) scrf=(solvent=thf)': 'B3LYP/6-311+G(d,p), PCM(thf)',
    '# wb97xd/genecp opt': 'ωB97X-D/genecp',
    '# opt freq': '',
  };
  for (const [route, expected] of Object.entries(cases)) assert.equal(methodFromRoute(route), expected, route);
});

test('symbolOf', () => {
  assert.equal(symbolOf('c'), 'C');
  assert.equal(symbolOf('CL'), 'Cl');
  assert.equal(symbolOf('C(Fragment=1)'), 'C');
  assert.equal(symbolOf('C-CA-0.1'), 'C');
  assert.equal(symbolOf('30'), 'Zn');
  assert.equal(symbolOf('-1.0'), null);
});
