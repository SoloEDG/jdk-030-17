import type {
  ElbowMode,
  LouverBank,
  LouverDoor,
  RuntimeLevel,
} from "@/shared/types";

export const HAND_MIN = 0;
export const HAND_MAX = 90;
export const HAND_STEP = 0.5;
const ANGLE_EPSILON = 0.1;

export interface ElbowCurve {
  slope: number;
  offset: number;
}

function clampAngle(angle: number): number {
  return Math.min(HAND_MAX, Math.max(HAND_MIN, angle));
}

export function curveOf(bank: LouverBank, mode: ElbowMode): ElbowCurve {
  return mode === "front" ? bank.front : bank.rear;
}

/** 某只手轮在指定读数与肘形下，叶片实际转角（度，已夹到 0–90）。 */
export function leafAngleAt(bank: LouverBank, hand: number, mode: ElbowMode): number {
  const curve = curveOf(bank, mode);
  return clampAngle(curve.slope * hand + curve.offset);
}

/** 当前状态下的叶片转角。 */
export function leafAngle(bank: LouverBank): number {
  return leafAngleAt(bank, bank.hand, bank.mode);
}

export function bankDoors(level: RuntimeLevel, bank: LouverBank): LouverDoor[] {
  return bank.doorIds
    .map((id) => level.louvers.find((door) => door.id === id))
    .filter((door): door is LouverDoor => Boolean(door));
}

/**
 * 单片百叶门在某叶角下的净空（格宽比例）。
 * 间距 spacing = 1/叶片数；投影后扣掉叶厚，夹到非负。
 */
export function clearanceOf(door: LouverDoor, angle: number): number {
  const spacing = 1 / door.blades;
  const projected = spacing * Math.cos((angle * Math.PI) / 180);
  return Math.max(0, projected - door.thickness);
}

/** 一排联动门的净空取最窄的一片。 */
export function bankClearanceAt(
  level: RuntimeLevel,
  bank: LouverBank,
  hand: number,
  mode: ElbowMode,
): number {
  const angle = leafAngleAt(bank, hand, mode);
  const doors = bankDoors(level, bank);
  if (doors.length === 0) return 0;
  return Math.min(...doors.map((door) => clearanceOf(door, angle)));
}

export function currentClearance(level: RuntimeLevel, bank: LouverBank): number {
  return bankClearanceAt(level, bank, bank.hand, bank.mode);
}

/** 两种肘形在该读数下是否得到同一个门形（换形的物理前提）。 */
export function modesCoincide(bank: LouverBank, hand: number): boolean {
  const front = leafAngleAt(bank, hand, "front");
  const rear = leafAngleAt(bank, hand, "rear");
  return Math.abs(front - rear) <= ANGLE_EPSILON;
}

/**
 * 实际可用的换形点：配置声称的位置中，两种肘形确实重合者。
 * 换形只能在这里发生——别的读数下前后肘门形不同，硬切等于拆杆。
 */
export function switchPoints(bank: LouverBank): number[] {
  return [...bank.switchAt]
    .filter((hand) => hand >= HAND_MIN && hand <= HAND_MAX && modesCoincide(bank, hand))
    .sort((a, b) => a - b);
}

export function isSwitchable(bank: LouverBank): boolean {
  return switchPoints(bank).some((hand) => Math.abs(hand - bank.hand) <= ANGLE_EPSILON);
}

export function nearestSwitchPoint(bank: LouverBank): number | null {
  const points = switchPoints(bank);
  if (points.length === 0) return null;
  return points.reduce((best, point) =>
    Math.abs(point - bank.hand) < Math.abs(best - bank.hand) ? point : best,
  );
}

/** 该肘形下净空够宽的连续读数区间。 */
export function openIntervals(
  level: RuntimeLevel,
  bank: LouverBank,
  mode: ElbowMode,
  width: number,
): { from: number; to: number }[] {
  const intervals: { from: number; to: number }[] = [];
  let openFrom: number | null = null;
  for (let hand = HAND_MIN; hand <= HAND_MAX + 1e-9; hand += HAND_STEP) {
    const enough = bankClearanceAt(level, bank, hand, mode) + 1e-9 >= width;
    if (enough && openFrom === null) openFrom = hand;
    if (!enough && openFrom !== null) {
      intervals.push({ from: openFrom, to: Math.max(openFrom, hand - HAND_STEP) });
      openFrom = null;
    }
  }
  if (openFrom !== null) intervals.push({ from: openFrom, to: HAND_MAX });
  return intervals;
}

export function formatAngle(value: number): string {
  return `${value.toFixed(1)}°`;
}
