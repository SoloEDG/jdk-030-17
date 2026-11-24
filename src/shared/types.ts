export type Dir = "n" | "e" | "s" | "w";
export type TileKind = "wall" | "floor" | "goal" | "gap" | "narrowGap";
export type BoxKind = "timber" | "iron" | "glass";
export type FloorMorph = "bridge" | "seal";
/** 两种肘形：相同手轮读数，从前侧或后侧进入连杆，门形可以不同。 */
export type ElbowMode = "front" | "rear";
export type AttemptStatus = "playing" | "cleared";

export interface Vec {
  x: number;
  y: number;
}

export interface Box {
  id: string;
  kind: BoxKind;
  x: number;
  y: number;
  /** 货物宽度（格宽比例）。扛货过百叶门时按它校验净空。 */
  width?: number;
}

export interface Plate {
  id: string;
  x: number;
  y: number;
  accept: BoxKind;
  doorIds: string[];
  floorIds: string[];
  powered: boolean;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

/**
 * 一片百叶门格。叶片在格内等距排列，转角由所属手轮经肘形连杆决定。
 * guard 表示叶角收小到 fromAngle 以下后，叶片会探入相邻格，该格站人或放箱即卡转。
 */
export interface LouverDoor {
  id: string;
  x: number;
  y: number;
  blades: number;
  thickness: number;
  guards?: { x: number; y: number; fromAngle: number }[];
}

/** 一组联动百叶门：一只手轮、一排门、两种肘形映射。 */
export interface LouverBank {
  id: string;
  title: string;
  /** 手轮所在格，人必须站在这里调门。 */
  wheel: Vec;
  doorIds: string[];
  /** 叶角（度）= slope × 手轮读数 + offset。 */
  front: { slope: number; offset: number };
  rear: { slope: number; offset: number };
  /** 配置声称的换形点（度）；运行时还要核验两肘形在此确实重合。 */
  switchAt: number[];
  hand: number;
  mode: ElbowMode;
}

export interface FloorPatch {
  id: string;
  x: number;
  y: number;
  morph: FloorMorph;
  active: boolean;
}

export interface RuntimeLevel {
  id: string;
  title: string;
  blurb: string;
  width: number;
  height: number;
  tiles: TileKind[][];
  player: Vec;
  boxes: Box[];
  plates: Plate[];
  doors: Door[];
  floors: FloorPatch[];
  louvers: LouverDoor[];
  louverBanks: LouverBank[];
  /** 本关可搬运的货物宽度（格宽比例）；为空表示未装百叶，仍听原踏板。 */
  haulWidths: number[];
  haulWidth: number;
}

export interface Attempt {
  steps: number;
  status: AttemptStatus;
}

export interface LevelRecord {
  bestSteps: number;
  clearedAt: number;
}

export interface GameDocument {
  version: 1;
  currentLevelId: string;
  level: RuntimeLevel;
  attempt: Attempt;
  records: Record<string, LevelRecord>;
}

export interface MoveResult {
  moved: boolean;
  pushed: boolean;
  boxId?: string;
  reason?: "blocked" | "cleared" | "idle";
}

export const BOX_LABEL: Record<BoxKind, string> = {
  timber: "木箱",
  iron: "铁箱",
  glass: "玻璃箱",
};

export const DIR_VEC: Record<Dir, Vec> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};
