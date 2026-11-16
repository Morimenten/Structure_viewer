// vite build の出力(dist/index.html と dist/assets/*)から、1 つの HTML にまとめた版を作る(dist/npa-viewer.html)。
// CSS と JavaScript を埋め込むので、ダウンロードしてダブルクリックで開くだけで動く(オフライン用)。
// npm run build の最後に自動で実行される。
import { readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const read = path => readFile(new URL(path, dist), 'utf8');

let html = await read('index.html');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*\bhref="\.\/(assets\/[^"]+\.css)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1)
  throw new Error(`dist/index.html の形が想定と違います(script ${scripts.length} 個、stylesheet ${styles.length} 個)`);

const js = (await read(scripts[0][1])).replace(/<\/script/g, '<\\/script');
const css = await read(styles[0][1]);
html = html.replace(scripts[0][0], () => `<script type="module">\n${js}</script>`)
           .replace(styles[0][0], () => `<style>\n${css}</style>`);
if (/(src|href)="\.\/assets\//.test(html)) throw new Error('埋め込めていないファイルが残っています');

await writeFile(new URL('npa-viewer.html', dist), html);
console.log(`dist/npa-viewer.html (${(html.length / 1024).toFixed(0)} KB)`);
