# NPA Structure Viewer

Gaussian の計算結果から、NPA 電荷で色分けした構造図をブラウザだけで作るツールです。
`.log` をドラッグ&ドロップし、マウスで向きを決めて、PNG または SVG で保存します。

**使う → https://morimenten.github.io/Structure_viewer/**

> A browser-only tool that draws molecular structures colored by NPA (natural population analysis) charges from Gaussian `.log` files. Drop a file, rotate it with the mouse, and export a PNG or SVG. Files are read locally in your browser and are never uploaded. The interface is in Japanese.

<!-- スクリーンショットを docs/screenshot.png に置き、次の行のコメントを外してください(未発表の構造を載せないよう注意)
![screenshot](docs/screenshot.png)
-->

## 特徴

- **インストール不要。** ブラウザでページを開くだけで使えます。
- **ファイルを外部に送信しません。** 読み込みと作図はすべてブラウザの中で行います。
- **見たままを保存できます。** 画面に表示されている図が、そのまま PNG・SVG になります。

## 読めるファイル

| ファイル | 読む内容 | 表示 |
|---|---|---|
| `.log` | 最後の構造、NPA 電荷、計算レベル | NPA 電荷で色分け(NPA の表がなければ元素の色) |
| `.com` / `.gjf` | Cartesian 座標 | 元素の色で構造だけ |

- `.log` は、`pop=nbo` などで NPA の表(Summary of Natural Population Analysis)が出力されているものが対象です。
- 構造が複数ある `.log`(構造最適化など)は、最後の構造と、その後に出力された NPA 電荷を使います。

## 使い方

1. ページを開き、`.log` / `.com` / `.gjf` をドロップします(「ファイルを選ぶ」からも開けます)。
2. ドラッグして向きを決めます。
3. 原子をクリックして、ラベルや距離を付けます。
4. 「PNG を保存」または「SVG を保存」を押します。

### 操作

| 操作 | 動作 |
|---|---|
| ドラッグ | 回転 |
| Shift+ドラッグ / 右ドラッグ | 画面内での回転 |
| 矢印キー | 5° ずつ回転 |
| 原子をクリック | ラベルの表示切り替え、または距離の追加(「クリックの動作」で選択) |

### 設定

- **色:** 電荷の色(NPA)/ 元素の色。元素の色は配色を 3 種類から選べ、元素ごとに変更できます。
- **表示の切り替え:** H 原子、数値(電荷ラベル・距離)、カラーバーまたは元素の凡例、注記。
- **結合の重なり:** 前後を表示 / 原子の縁で止める / すべて原子の後ろに描く。
- **金属との接触:** 距離 < (共有結合半径の和) × 設定値 のとき、破線で結びます(既定 1.15)。
- **そのほか:** 電荷の色の範囲(±0.5〜2.0 e)、文字の大きさ、原子の大きさ、PNG の解像度、背景の透明化。

## 作図の方法

- **結合の判定:** 原子間距離 < (共有結合半径の和) × 1.15 のとき、結合として描きます。結合次数は区別しません。
- **金属:** 1・2 族、3〜12 族、ランタノイド、アクチノイドを金属として扱い、配位は破線で描きます。
- **電荷の色:** 負を青、0 を灰白色、正を赤とし、設定した範囲を超える電荷は端の色になります。
- **最初の向き:** 重原子の座標の主成分から決めます(最も広がった方向が横)。
- **ラベルの電荷:** `.log` の値を小数第 2 位に丸めて表示します。

## 制限

- Z-matrix 形式の `.com` / `.gjf` は読めません。Cartesian 座標のファイルを使ってください。
- `geom=check` / `geom=allcheck` の入力ファイルは、座標がファイルの中にないため表示できません。計算後の `.log` を使ってください。
- 開殻系の `.log` では、全電子の NPA の表を読む想定ですが、十分に検証していません。
- 動作は Chrome で確認しています。Safari と Firefox では未確認です。
- 結合と配位は距離だけで判定しているため、遷移状態などでは実際の結合と一致しないことがあります。図を使う前に確認してください。
- 表示される数値は、必ず元の `.log` と照らし合わせて確認してください。

## 自分の PC で使う(オフライン)

[npa-viewer.html](https://morimenten.github.io/Structure_viewer/npa-viewer.html) を保存して(リンクを右クリック →「リンク先を別名で保存」)、ブラウザで開くだけで動きます。CSS と JavaScript を 1 つのファイルにまとめた版で、インターネット接続は不要です。

## 開発

TypeScript で書き、[Vite](https://vite.dev/) でビルドしています。画面のフレームワーク(Vue・React など)は使っていません。

```
npa-viewer/
├── index.html          画面の構造だけ
├── src/
│   ├── main.ts         入口。画面の操作(ドロップ・回転・クリック・設定・保存)をまとめる
│   ├── parse.ts        .log / .com / .gjf を読む
│   ├── geometry.ts     結合・配位の判定、組成式、最初の向き、回転
│   ├── render.ts       図(SVG)を作る。画面表示と保存で同じ関数を使う
│   ├── colors.ts       電荷の色、元素の色
│   ├── elements.ts     元素のデータ(共有結合半径、金属の判定、標準の色)
│   ├── export.ts       SVG・PNG として保存する
│   ├── types.ts        データの形(原子、構造、図の設定など)
│   └── style.css       見た目
├── tests/              自動テスト(Node.js 標準のテスト機能)
├── tools/build-single.mjs   オフライン用の 1 ファイル版を作る(ビルドの最後に自動で実行)
└── .github/workflows/deploy.yml   テストと GitHub Pages への公開
```

`parse.ts`・`geometry.ts`・`render.ts`・`colors.ts`・`elements.ts` は画面(DOM)に触らないので、ブラウザなしでテストできます。画面に触るのは `main.ts` と `export.ts` だけです。

### 準備

[Node.js](https://nodejs.org/) 22.18 以上を入れて、リポジトリのフォルダで一度だけ次を実行します。

```
npm install
```

### コマンド

| やること | コマンド |
|---|---|
| 手元で動かす(保存すると画面が自動で更新される) | `npm run dev` → 表示された URL を開く |
| 型チェック | `npm run typecheck` |
| テスト | `npm test` |
| 公開用のファイルを作る | `npm run build` → `dist/`(`dist/npa-viewer.html` がオフライン用) |
| 作ったものを確認する | `npm run preview` |

テストは TypeScript のファイルを Node.js で直接実行しています(型の記述を取り除いて実行する Node.js の機能を使用)。そのため、ソースには enum など実行時のコードを生む TypeScript の構文を使っていません(`tsconfig.json` の `erasableSyntaxOnly` で禁止しています)。

### 公開

`main` に push すると、GitHub Actions が型チェック・テスト・ビルドをして、GitHub Pages に公開します。テストか型チェックが失敗したときは公開されません。

初回だけ、リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にしてください(「Deploy from a branch」のままだと、ビルド前のファイルが公開されて動きません)。

## 更新履歴

| バージョン | 内容 |
|---|---|
| v1.3 | 機能の変更なし。TypeScript で書き直し、Vite でビルドするようにした。push すると自動でテスト・公開される |
| v1.2 | 機能の変更なし。HTML・CSS・JavaScript を別のファイルに分け、自動テストを追加 |
| v1.1 | 結合の重なり方を 3 種類から選べるようにした。ライセンスの表示を追加 |
| v1.0 | 最初の公開版 |

## ライセンス

Copyright © 2026 Morimenten

このツールは [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) で公開しています。全文は [LICENSE](LICENSE) にあります。

- **できること:** 非営利目的での利用、複製、再配布、改変。
- **条件:** 作者名(Morimenten)、このリポジトリへのリンク、ライセンス名を表示し、変更した場合はその旨を示すこと。
- **できないこと:** 営利目的での利用。営利目的で使いたい場合は、Issue でご連絡ください。

このライセンスが対象とするのは、ツール本体(このリポジトリのコード)です。このツールで作った図は、利用者自身の計算データから作られたものであり、利用者が自由に使えます。論文や発表に使う場合、作者の許可は必要ありません。

## 引用

論文や発表でこのツールに触れる場合は、次のように書いてください。

```
NPA Structure Viewer v1.3, Morimenten, https://github.com/Morimenten/Structure_viewer
```

## 使用しているデータ

- **共有結合半径:** Cordero, B.; Gómez, V.; Platero-Prats, A. E.; Revés, M.; Echeverría, J.; Cremades, E.; Barragán, F.; Alvarez, S. Covalent radii revisited. *Dalton Trans.* **2008**, 2832–2838. DOI: [10.1039/b801115j](https://doi.org/10.1039/b801115j)
  (Bk 以降は文献値がないため、仮に 2.00 Å としています)
- **元素の色(標準):** [Jmol](https://jmol.sourceforge.net/jscolors/) の配色

## 免責

- このツールは Gaussian, Inc. および NBO の開発元とは関係のない、非公式のツールです。Gaussian は Gaussian, Inc. の登録商標です。
- このツールは現状のまま提供され、動作や結果の正しさは保証しません。

## 不具合の報告・要望

[Issues](https://github.com/Morimenten/Structure_viewer/issues) にお願いします。未発表の計算データは添付しないでください。
