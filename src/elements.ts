// 元素のデータ(記号・共有結合半径・金属の判定・標準の色)

export const ELEMENTS = ('X H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As ' +
  'Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd ' +
  'Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am ' +
  'Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');

/** 元素記号 → 原子番号 */
export const ZOF: Record<string, number> = Object.fromEntries(ELEMENTS.map((e, z) => [e, z]));

// 共有結合半径(Å):Cordero, B. et al. Dalton Trans. 2008, 2832–2838 (DOI: 10.1039/b801115j)。
// Bk 以降は文献値がないので、仮に 2.00 としている。
const COVALENT_RADII = [0.31, 0.28, 1.28, 0.96, 0.84, 0.76, 0.71, 0.66, 0.57, 0.58, 1.66, 1.41, 1.21, 1.11, 1.07, 1.05,
  1.02, 1.06, 2.03, 1.76, 1.70, 1.60, 1.53, 1.39, 1.39, 1.32, 1.26, 1.24, 1.32, 1.22, 1.22, 1.20,
  1.19, 1.20, 1.20, 1.16, 2.20, 1.95, 1.90, 1.75, 1.64, 1.54, 1.47, 1.46, 1.42, 1.39, 1.45, 1.44,
  1.42, 1.39, 1.39, 1.38, 1.39, 1.40, 2.44, 2.15, 2.07, 2.04, 2.03, 2.01, 1.99, 1.98, 1.98, 1.96,
  1.94, 1.92, 1.92, 1.89, 1.90, 1.87, 1.87, 1.75, 1.70, 1.62, 1.51, 1.44, 1.41, 1.36, 1.36, 1.32,
  1.45, 1.46, 1.48, 1.40, 1.50, 1.50, 2.60, 2.21, 2.15, 2.06, 2.00, 1.96, 1.90, 1.87, 1.80, 1.69];

/** 共有結合半径(Å)。知らない記号は 1.5 */
export function covalentRadius(e: string): number {
  const z = ZOF[e];
  if (!z) return 1.5;
  return COVALENT_RADII[z - 1] ?? 2.0;
}

const S_BLOCK_METALS = ['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'];

/** 金属:1・2 族、3〜12 族、ランタノイド、アクチノイド */
export function isMetal(e: string): boolean {
  const z = ZOF[e] || 0;
  return S_BLOCK_METALS.includes(e) ||
    (z >= 21 && z <= 30) || (z >= 39 && z <= 48) || (z >= 57 && z <= 80) || (z >= 89 && z <= 112);
}

/** 図に描く丸の半径(Å) */
export const drawRadius = (e: string): number => 0.12 + 0.18 * covalentRadius(e);

/** 元素の標準色(Jmol の配色) */
export const JMOL_COLORS: Record<string, string> = {H:'#FFFFFF',He:'#D9FFFF',Li:'#CC80FF',Be:'#C2FF00',B:'#FFB5B5',C:'#909090',N:'#3050F8',O:'#FF0D0D',F:'#90E050',
  Ne:'#B3E3F5',Na:'#AB5CF2',Mg:'#8AFF00',Al:'#BFA6A6',Si:'#F0C8A0',P:'#FF8000',S:'#FFFF30',Cl:'#1FF01F',Ar:'#80D1E3',
  K:'#8F40D4',Ca:'#3DFF00',Sc:'#E6E6E6',Ti:'#BFC2C7',V:'#A6A6AB',Cr:'#8A99C7',Mn:'#9C7AC7',Fe:'#E06633',Co:'#F090A0',
  Ni:'#50D050',Cu:'#C88033',Zn:'#7D80B0',Ga:'#C28F8F',Ge:'#668F8F',As:'#BD80E3',Se:'#FFA100',Br:'#A62929',Kr:'#5CB8D1',
  Rb:'#702EB0',Sr:'#00FF00',Y:'#94FFFF',Zr:'#94E0E0',Nb:'#73C2C9',Mo:'#54B5B5',Tc:'#3B9E9E',Ru:'#248F8F',Rh:'#0A7D8C',
  Pd:'#006985',Ag:'#C0C0C0',Cd:'#FFD98F',In:'#A67573',Sn:'#668080',Sb:'#9E63B5',Te:'#D47A00',I:'#940094',Xe:'#429EB0',
  Cs:'#57178F',Ba:'#00C900',La:'#70D4FF',Ce:'#FFFFC7',Pr:'#D9FFC7',Nd:'#C7FFC7',Pm:'#A3FFC7',Sm:'#8FFFC7',Eu:'#61FFC7',
  Gd:'#45FFC7',Tb:'#30FFC7',Dy:'#1FFFC7',Ho:'#00FF9C',Er:'#00E675',Tm:'#00D452',Yb:'#00BF38',Lu:'#00AB24',Hf:'#4DC2FF',
  Ta:'#4DA6FF',W:'#2194D6',Re:'#267DAB',Os:'#266696',Ir:'#175487',Pt:'#D0D0E0',Au:'#FFD123',Hg:'#B8B8D0',Tl:'#A6544D',
  Pb:'#575961',Bi:'#9E4FB5',Th:'#00BAFF',U:'#008FFF'};
