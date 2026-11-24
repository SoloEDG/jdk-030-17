import { clearanceOf, leafAngle } from "./kinematics";
import type { GameDocument, LouverBank, LouverDoor, RuntimeLevel, Vec } from "@/shared/types";

/** 人自身的通行宽度（格宽比例），用于无货移动时的净空判定。 */
export const BODY_WIDTH = 0.3;

export function louverAt(level: RuntimeLevel, at: Vec): LouverDoor | undefined {
  return level.louvers.find((door) => door.x === at.x && door.y === at.y);
}

function bankOf(level: RuntimeLevel, door: LouverDoor): LouverBank | undefined {
  return level.louverBanks.find((bank) => bank.doorIds.includes(door.id));
}

/** 某个百叶格在当前门形下的真实净空。 */
export function clearanceAtCell(level: RuntimeLevel, at: Vec): number | null {
  const door = louverAt(level, at);
  if (!door) return null;
  const bank = bankOf(level, door);
  if (!bank) return clearanceOf(door, 0);
  return clearanceOf(door, leafAngle(bank));
}

export interface LouverPass {
  pass: boolean;
  clearance: number;
  required: number;
  reason: string;
}

/**
 * 通行判定只看当前肘形的真实门形——另一种肘形上够宽的结果绝不算数。
 */
export function louverPassFor(
  document: GameDocument,
  at: Vec,
  required: number,
): LouverPass | null {
  const level = document.level;
  const door = louverAt(level, at);
  if (!door) return null;
  const bank = bankOf(level, door);
  const angle = bank ? leafAngle(bank) : 0;
  const clearance = clearanceOf(door, angle);
  if (clearance + 1e-9 < required) {
    return {
      pass: false,
      clearance,
      required,
      reason:
        `百叶净空只有 ${(clearance * 100).toFixed(0)}% 格宽，` +
        `货物要 ${(required * 100).toFixed(0)}%；${bank ? `当前为${bank.mode === "front" ? "前" : "后"}肘 ${bank.hand.toFixed(1)}°` : ""}`,
    };
  }
  return {
    pass: true,
    clearance,
    required,
    reason: `净空 ${(clearance * 100).toFixed(0)}% 格宽，足够 ${(required * 100).toFixed(0)}% 的货通过。`,
  };
}

export function louverBlockSummary(document: GameDocument, at: Vec, required: number): string {
  const result = louverPassFor(document, at, required);
  if (!result) return "";
  return result.reason;
}
