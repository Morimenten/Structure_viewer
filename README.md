# NPA Structure Viewer

[日本語の README](README.ja.md)

A browser-only tool that draws molecular structures colored by NPA (natural population analysis) charges from Gaussian output.
Drop a `.log` file, rotate the structure with the mouse, and save the figure as PNG or SVG.

**Open the app → https://morimenten.github.io/Structure_viewer/**

The interface is in Japanese. The Japanese labels are given in parentheses below.

<!-- Put a screenshot at docs/screenshot.png and uncomment the next line (do not use an unpublished structure)
![screenshot](docs/screenshot.png)
-->

## Features

- **No installation.** Open the page in a browser.
- **Your files stay on your computer.** Reading and drawing happen entirely in the browser; nothing is uploaded.
- **What you see is what you save.** The figure on screen is exported as it is.

## Supported files

| File | What is read | Display |
|---|---|---|
| `.log` | Last geometry, NPA charges, level of theory | Colored by NPA charge (by element if there is no NPA table) |
| `.com` / `.gjf` | Cartesian coordinates | Structure only, colored by element |

- A `.log` file needs the NPA table ("Summary of Natural Population Analysis"), which is printed with `pop=nbo` and similar keywords.
- For a `.log` file with several geometries (such as an optimization), the last geometry and the NPA charges printed after it are used.

## Usage

1. Open the page and drop a `.log`, `.com`, or `.gjf` file. You can also use the file button (ファイルを選ぶ).
2. Drag to choose the orientation.
3. Click atoms to add labels or distances.
4. Click "PNG を保存" (save PNG) or "SVG を保存" (save SVG).

### Controls

| Action | Result |
|---|---|
| Drag | Rotate |
| Shift + drag, or right-drag | Rotate in the plane of the screen |
| Arrow keys | Rotate in 5° steps |
| Click an atom | Toggle its label, or add a distance (chosen under クリックの動作, "click action") |

### Settings

- **Color (表示):** by NPA charge or by element. Element colors come in three palettes, and each element's color can be changed.
- **Show or hide:** H atoms, numbers (charge labels and distances), the color bar or element legend, and the footnote.
- **Bond overlap (結合の重なり):** show depth, stop at atom edges, or draw all bonds behind atoms.
- **Metal contacts (金属との接触):** a dashed line is drawn when the distance is less than (sum of covalent radii) × this value. The default is 1.15.
- **Other:** charge color range (±0.5 to ±2.0 e), font size, atom size, PNG resolution, transparent background.

## How the figure is drawn

- **Bonds:** two atoms are bonded when their distance is less than (sum of covalent radii) × 1.15. Bond orders are not distinguished.
- **Metals:** groups 1–12, lanthanides, and actinides are treated as metals. Their contacts are drawn as dashed lines.
- **Charge colors:** blue for negative, off-white for zero, red for positive. Charges beyond the selected range take the end color.
- **Initial orientation:** set from the principal axes of the heavy-atom coordinates, with the longest direction horizontal.
- **Charge labels:** values from the `.log` file, rounded to two decimal places.

## Limitations

- `.com` / `.gjf` files in Z-matrix format cannot be read. Use Cartesian coordinates.
- Input files with `geom=check` or `geom=allcheck` cannot be shown, because the coordinates are not in the file. Use the `.log` file from the calculation.
- For open-shell `.log` files, the tool is meant to read the total-density NPA table, but this has not been tested enough.
- Tested in Chrome only. Safari and Firefox are untested.
- Bonds and metal contacts are judged from distances alone, so they may not match the real bonding, for example in transition states. Check the figure before you use it.
- Always check the displayed numbers against the original `.log` file.

## Offline use

Save [npa-viewer.html](https://morimenten.github.io/Structure_viewer/npa-viewer.html) (right-click the link and choose "Save Link As") and open it in a browser. It is a single file with the CSS and JavaScript included, and it needs no internet connection.

## Development

Written in TypeScript and built with [Vite](https://vite.dev/). No UI framework (such as Vue or React) is used.

```
Structure_viewer/
├── index.html          Page structure only
├── src/
│   ├── main.ts         Entry point: drop, rotate, click, settings, save
│   ├── parse.ts        Reads .log / .com / .gjf
│   ├── geometry.ts     Bonds and metal contacts, formula, initial orientation, rotation
│   ├── render.ts       Builds the figure (SVG); the same function serves the screen and the export
│   ├── colors.ts       Charge colors and element colors
│   ├── elements.ts     Element data: covalent radii, metals, default colors
│   ├── export.ts       Saves SVG and PNG
│   ├── types.ts        Data types: atom, molecule, figure options
│   └── style.css       Styles
├── tests/              Automated tests (Node.js built-in test runner)
├── tools/build-single.mjs   Makes the single-file offline version (runs at the end of the build)
└── .github/workflows/deploy.yml   Tests and deployment to GitHub Pages
```

`parse.ts`, `geometry.ts`, `render.ts`, `colors.ts`, and `elements.ts` do not touch the DOM, so they are tested without a browser. Only `main.ts` and `export.ts` touch the page.

### Setup

Install [Node.js](https://nodejs.org/) 22.18 or later, then run this once in the repository folder:

```
npm install
```

### Commands

| Task | Command |
|---|---|
| Run locally (the page reloads when you save a file) | `npm run dev`, then open the URL it prints |
| Type check | `npm run typecheck` |
| Test | `npm test` |
| Build for deployment | `npm run build` → `dist/` (`dist/npa-viewer.html` is the offline version) |
| Preview the build | `npm run preview` |

The tests run the TypeScript files directly in Node.js, which strips the type annotations. For this reason the source avoids TypeScript syntax that produces runtime code, such as enums. The `erasableSyntaxOnly` option in `tsconfig.json` enforces this.

### Deployment

A push to `main` makes GitHub Actions run the type check, the tests, and the build, and then deploy to GitHub Pages. If the type check or a test fails, nothing is deployed.

Once, before the first deployment, set Settings → Pages → Build and deployment → Source to **GitHub Actions**.

## Version history

| Version | Changes |
|---|---|
| v1.3 | No change in features. Rewritten in TypeScript and built with Vite. A push now tests and deploys automatically |
| v1.2 | No change in features. HTML, CSS, and JavaScript split into separate files; automated tests added |
| v1.1 | Bond overlap can be chosen from three modes. License notice added |
| v1.0 | First release |

## License

Copyright © 2026 Morimenten

This tool is released under the [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) license. The full text is in [LICENSE](LICENSE).

- **You may** use, copy, redistribute, and modify the tool for noncommercial purposes.
- **You must** credit the author (Morimenten), link to this repository, name the license, and state any changes you made.
- **You may not** use the tool for commercial purposes. For commercial use, please open an Issue.

The license covers the tool itself, meaning the code in this repository. Figures you make with the tool come from your own calculation data, and you are free to use them. You do not need the author's permission to use them in papers or presentations.

## Citation

If you mention this tool in a paper or presentation, please cite it as:

```
NPA Structure Viewer v1.3, Morimenten, https://github.com/Morimenten/Structure_viewer
```

## Data sources

- **Covalent radii:** Cordero, B.; Gómez, V.; Platero-Prats, A. E.; Revés, M.; Echeverría, J.; Cremades, E.; Barragán, F.; Alvarez, S. Covalent radii revisited. *Dalton Trans.* **2008**, 2832–2838. DOI: [10.1039/b801115j](https://doi.org/10.1039/b801115j)
  (No literature values exist for Bk and heavier elements, so 2.00 Å is used as a placeholder.)
- **Default element colors:** the [Jmol](https://jmol.sourceforge.net/jscolors/) color scheme

## Disclaimer

- This is an unofficial tool. It is not affiliated with Gaussian, Inc. or the developers of NBO. Gaussian is a registered trademark of Gaussian, Inc.
- The tool is provided as is, with no guarantee that it works or that its results are correct.

## Bug reports and requests

Please use [Issues](https://github.com/Morimenten/Structure_viewer/issues). Do not attach unpublished calculation data.
