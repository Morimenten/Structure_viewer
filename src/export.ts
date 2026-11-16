// ファイルとして保存する(SVG・PNG)

/** ブラウザのダウンロードとして保存する */
export function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.download = name;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const svgBlob = (svg: string): Blob =>
  new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg], {type: 'image/svg+xml'});

/**
 * SVG を PNG にする。
 * @param svg   width・height つきの SVG
 * @param W     SVG の幅(px)
 * @param H     SVG の高さ(px)
 * @param scale 解像度の倍率
 */
export function svgToPng(svg: string, W: number, H: number, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('PNG を作れませんでした'));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(W * scale);
      c.height = Math.round(H * scale);
      const ctx = c.getContext('2d');
      if (!ctx) { fail(); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? resolve(b) : fail(), 'image/png');
    };
    img.onerror = fail;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
