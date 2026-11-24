import { createId } from "@/shared/document";
import type {
  BoxKind,
  ElbowMode,
  FloorMorph,
  LouverDoor,
  RuntimeLevel,
  TileKind,
} from "@/shared/types";

export interface LevelBlueprint {
  id: string;
  title: string;
  blurb: string;
  rows: string[];
  player: { x: number; y: number };
  boxes: { kind: BoxKind; x: number; y: number; width?: number }[];
  plates: {
    accept: BoxKind;
    x: number;
    y: number;
    doorIds: string[];
    floorIds: string[];
  }[];
  doors: { id: string; x: number; y: number }[];
  floors: { id: string; x: number; y: number; morph: FloorMorph }[];
  louvers?: LouverDoor[];
  louverBanks?: LouverBankBlueprint[];
  haulWidths?: number[];
}

export interface LouverBankBlueprint {
  id: string;
  title: string;
  wheel: { x: number; y: number };
  doorIds: string[];
  front: { slope: number; offset: number };
  rear: { slope: number; offset: number };
  switchAt: number[];
  initialMode?: ElbowMode;
  initialHand?: number;
}

function tilesOf(rows: string[]): TileKind[][] {
  return rows.map((row) =>
    [...row].map((ch) => {
      if (ch === "#") return "wall";
      if (ch === "*") return "goal";
      if (ch === "~") return "gap";
      if (ch === "|") return "narrowGap";
      // L/W/B 是百叶门、手轮、停箱位的标注，底层均为地板。
      return "floor";
    }),
  );
}

export const LEVELS: LevelBlueprint[] = [
  {
    id: "latch-01",
    title: "门闩入门",
    blurb: "木箱压上木踏板才会开门。多出来的箱子用来压住开关。",
    rows: [
      "#########",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "###...###",
      "#......*#",
      "#......*#",
      "#########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 3, y: 3 },
      { kind: "timber", x: 4, y: 3 },
      { kind: "timber", x: 3, y: 7 },
    ],
    plates: [{ accept: "timber", x: 3, y: 4, doorIds: ["d1"], floorIds: [] }],
    doors: [{ id: "d1", x: 4, y: 5 }],
    floors: [],
  },
  {
    id: "latch-02",
    title: "认材",
    blurb: "铁踏板只认铁箱。木箱压上去门不会动。",
    rows: [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "####...###",
      "#.......*#",
      "#.......*#",
      "##########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 5, y: 4 },
      { kind: "iron", x: 6, y: 3 },
      { kind: "timber", x: 3, y: 7 },
    ],
    plates: [{ accept: "iron", x: 6, y: 4, doorIds: ["d1"], floorIds: [] }],
    doors: [{ id: "d1", x: 5, y: 5 }],
    floors: [],
  },
  {
    id: "latch-03",
    title: "架桥",
    blurb: "木踏板升起缺口上的桥板。铁箱过桥后，木箱去压本侧目标。",
    rows: [
      "###########",
      "#........*#",
      "#.........#",
      "#.........#",
      "#~~~~~~~~~#",
      "#.........#",
      "#........*#",
      "#.........#",
      "###########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 3, y: 2 },
      { kind: "iron", x: 4, y: 3 },
    ],
    plates: [{ accept: "timber", x: 3, y: 3, doorIds: [], floorIds: ["b1", "b2", "b3"] }],
    doors: [],
    floors: [
      { id: "b1", x: 3, y: 4, morph: "bridge" },
      { id: "b2", x: 4, y: 4, morph: "bridge" },
      { id: "b3", x: 5, y: 4, morph: "bridge" },
    ],
  },
  {
    id: "latch-04",
    title: "封廊",
    blurb: "先把一只木箱送进左侧目标，再压踏板。踏板会封住那条廊并打开右侧的门。",
    rows: [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "##.##..###",
      "#*......*#",
      "#........#",
      "##########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 2, y: 6 },
      { kind: "timber", x: 4, y: 2 },
      { kind: "timber", x: 6, y: 4 },
    ],
    plates: [{ accept: "timber", x: 4, y: 3, doorIds: ["d1"], floorIds: ["s1"] }],
    doors: [{ id: "d1", x: 5, y: 5 }],
    floors: [{ id: "s1", x: 2, y: 5, morph: "seal" }],
  },
  {
    id: "latch-05",
    title: "双色闸",
    blurb: "玻璃踏板与木踏板各管一扇门。两只箱子都要过闸到达目标。",
    rows: [
      "###########",
      "#.........#",
      "#.........#",
      "#.........#",
      "##...#...##",
      "#.........#",
      "#*.......*#",
      "#.........#",
      "###########",
    ],
    player: { x: 1, y: 2 },
    boxes: [
      { kind: "timber", x: 2, y: 2 },
      { kind: "glass", x: 8, y: 2 },
      { kind: "timber", x: 3, y: 3 },
      { kind: "glass", x: 7, y: 3 },
    ],
    plates: [
      { accept: "timber", x: 2, y: 3, doorIds: ["west"], floorIds: [] },
      { accept: "glass", x: 8, y: 3, doorIds: ["east"], floorIds: [] },
    ],
    doors: [
      { id: "west", x: 3, y: 4 },
      { id: "east", x: 7, y: 4 },
    ],
    floors: [],
  },
  {
    id: "latch-06",
    title: "双肘百叶",
    blurb:
      "隔墙只有两处通道：右端窄口人能绕行、箱子推过去即进死角；箱子只能走中间的百叶。前肘叶角最低 30° 宽货过不去，在 60° 换形点切后肘才能开大。",
    rows: [
      "#########",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#####L#|#",
      "#.......#",
      "#W....**#",
      "#########",
    ],
    player: { x: 1, y: 1 },
    boxes: [
      { kind: "timber", x: 4, y: 2, width: 0.28 },
      { kind: "timber", x: 5, y: 3, width: 0.28 },
    ],
    plates: [],
    doors: [],
    floors: [],
    louvers: [
      { id: "lv1", x: 5, y: 5, blades: 3, thickness: 0.02 },
    ],
    louverBanks: [
      {
        id: "bank1",
        title: "下室手轮",
        wheel: { x: 2, y: 7 },
        doorIds: ["lv1"],
        front: { slope: 0.5, offset: 30 },
        rear: { slope: 1, offset: 0 },
        switchAt: [60],
        initialMode: "front",
        initialHand: 60,
      },
    ],
    haulWidths: [0.15, 0.28],
  },
  {
    id: "latch-07",
    title: "转不开的一段",
    blurb:
      "叶片收小到 20° 以下就探进东侧邻格，那里停着箱子。宽货要的开度在探入禁区之内，预览只能指出哪一段转不开；换 15% 窄货则在禁区之外就能过门。",
    rows: [
      "##########",
      "#........#",
      "#........#",
      "#........#",
      "#........#",
      "##########",
      "#W.LB...*#",
      "#........#",
      "##########",
    ],
    player: { x: 1, y: 6 },
    boxes: [
      { kind: "timber", x: 4, y: 6, width: 0.295 },
    ],
    plates: [],
    doors: [],
    floors: [],
    louvers: [
      {
        id: "lv2",
        x: 3,
        y: 6,
        blades: 3,
        thickness: 0.02,
        guards: [{ x: 4, y: 6, fromAngle: 20 }],
      },
    ],
    louverBanks: [
      {
        id: "bank2",
        title: "廊口手轮",
        wheel: { x: 1, y: 6 },
        doorIds: ["lv2"],
        front: { slope: 1, offset: 0 },
        rear: { slope: 1, offset: -30 },
        switchAt: [],
        initialMode: "front",
        initialHand: 90,
      },
    ],
    haulWidths: [0.15, 0.295],
  },
];

export function getLevel(id: string): LevelBlueprint {
  const found = LEVELS.find((level) => level.id === id);
  if (!found) throw new Error(`未知关卡 ${id}`);
  return found;
}

export function hydrate(blueprint: LevelBlueprint): RuntimeLevel {
  return {
    id: blueprint.id,
    title: blueprint.title,
    blurb: blueprint.blurb,
    width: blueprint.rows[0].length,
    height: blueprint.rows.length,
    tiles: tilesOf(blueprint.rows),
    player: { ...blueprint.player },
    boxes: blueprint.boxes.map((box) => ({ ...box, id: createId(box.kind) })),
    plates: blueprint.plates.map((plate, index) => ({
      ...plate,
      id: `p-${blueprint.id}-${index}`,
      powered: false,
    })),
    doors: blueprint.doors.map((door) => ({ ...door, open: false })),
    floors: blueprint.floors.map((floor) => ({ ...floor, active: false })),
    louvers: (blueprint.louvers ?? []).map((louver) => structuredClone(louver)),
    louverBanks: (blueprint.louverBanks ?? []).map((bank) => ({
      id: bank.id,
      title: bank.title,
      wheel: { ...bank.wheel },
      doorIds: [...bank.doorIds],
      front: { ...bank.front },
      rear: { ...bank.rear },
      switchAt: [...bank.switchAt],
      hand: bank.initialHand ?? 0,
      mode: bank.initialMode ?? "front",
    })),
    haulWidths: blueprint.haulWidths ?? [],
    haulWidth: blueprint.haulWidths?.[0] ?? 0,
  };
}
