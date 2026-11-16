// このツールで使うデータの形

export type Vec3 = [number, number, number];
/** 向き。図の (右, 上, 手前) = R × (座標 − 中心) */
export type Mat3 = [Vec3, Vec3, Vec3];
/** 原子の番号(0 始まり)の組 */
export type Pair = [number, number];

export interface Atom {
  /** 元素記号 */
  e: string;
  /** 座標(Å) */
  p: Vec3;
  /** NPA 電荷。なければ null */
  q: number | null;
}

/** ファイルから読んだ構造 */
export interface Molecule {
  atoms: Atom[];
  /** すべての原子に電荷があるか */
  hasQ: boolean;
  /** 計算レベル(読めなければ '') */
  method: string;
  /** 読み込み時の注意(なければ '') */
  warn: string;
  kind: 'log' | 'com';
}

/** 結合と配位の判定結果 */
export interface Topology {
  /** 距離行列(Å) */
  D: Float64Array[];
  /** 金属を含まない結合 */
  bonds: Pair[];
  /** [金属, 配位原子] */
  contacts: Pair[];
  /** 金属原子の番号 */
  centers: number[];
}

export type ColorMode = 'q' | 'e';                      // 電荷の色 / 元素の色
export type Preset = 'jmol' | 'pastel' | 'gray';        // 元素の配色
export type BondOverlap = 'depth' | 'trim' | 'back';    // 結合の重なり
/** 利用者が変えた元素の色 {配色: {元素記号: 色}} */
export type CustomColors = Partial<Record<Preset, Record<string, string>>>;

/** 図に描く内容 */
export interface Scene {
  mol: Molecule;
  topo: Topology;
  R: Mat3;
  /** 図の中心 */
  origin: Vec3;
  /** 画面表示の枠の半分(Å) */
  lim: number;
  /** ラベルを付ける原子 */
  labels: Set<number>;
  /** 利用者が追加した距離 */
  links: Pair[];
  /** 距離の 1 個目として選択中の原子 */
  pick: number | null;
  custom: CustomColors;
}

/** 図の表示の設定 */
export interface Options {
  colorMode: ColorMode;
  /** H を描く */
  h: boolean;
  /** 数値(ラベル・距離)を描く */
  num: boolean;
  /** 金属–配位原子の距離を書く */
  md: boolean;
  /** カラーバー / 元素の凡例を付ける */
  leg: boolean;
  /** 注記を付ける */
  note: boolean;
  /** 注記の文(空なら自動) */
  noteText: string;
  /** 電荷の色の範囲(±e) */
  qr: number;
  /** 文字の大きさ(px) */
  fs: number;
  /** 原子の大きさの倍率 */
  asz: number;
  preset: Preset;
  bondz: BondOverlap;
  /** 背景を透明にする(保存時) */
  transparent: boolean;
}

/** クリックの当たり判定:[原子の番号, x, y, 半径] */
export type Hit = [number, number, number, number];

export interface Figure {
  svg: string;
  /** 幅・高さ(px) */
  W: number;
  H: number;
  /** 奥から手前の順。画面表示用のときだけ入る */
  hits: Hit[];
}

/** 文字列の幅(px)を測る関数。font は CSS の書式('12px Arial' など) */
export type TextWidth = (text: string, font: string) => number;
