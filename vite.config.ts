import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                     // GitHub Pages の https://<ユーザー名>.github.io/<リポジトリ名>/ の下でも動くように、相対パスにする
  build: { target: 'es2022' },
});
