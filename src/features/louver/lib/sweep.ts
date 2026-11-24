import { sameCell } from "@/shared/document";
import {
  HAND_STEP,
  bankDoors,
  leafAngleAt,
} from "./kinematics";
import type {
  ElbowMode,
  GameDocument,
  LouverBank,
  LouverDoor,
  Vec,
} from "@/shared/types";

export interface SweepBlock {
  reason: "player" | "box";
  cell: Vec;
  hand: number;
  angle: number;
  detail: string;
}

export interface SweepResult {
  clear: boolean;
  block?: SweepBlock;
}

interface ActiveGuard {
  cell: Vec;
  fromAngle: number;
  door: LouverDoor;
}

function occupantAt(document: GameDocument, cell: Vec): SweepBlock["reason"] | null {
  if (sameCell(document.level.player, cell)) return "player";
  if (document.level.boxes.some((box) => sameCell(box, cell))) return "box";
  return null;
}

/**
 * 叶片转动过程中会扫到的格。
 * - 门格自身：任何转角下叶片都在格内，站人或放箱时整段转动都机械干涉（阈值 -∞）。
 * - 显式守卫：叶角收小到 fromAngle 以下时，叶片探出门框扫入相邻格。
 */
function guardsOf(document: GameDocument, bank: LouverBank): ActiveGuard[] {
  const guards: ActiveGuard[] = [];
  for (const door of bankDoors(document.level, bank)) {
    guards.push({ cell: { x: door.x, y: door.y }, fromAngle: Number.NEGATIVE_INFINITY, door });
    for (const guard of door.guards ?? []) {
      guards.push({ cell: { x: guard.x, y: guard.y }, fromAngle: guard.fromAngle, door });
    }
  }
  return guards;
}

/**
 * 从当前读数沿指定肘形连续转到 toHand，逐角度检查每一片叶子的扫掠范围。
 * 任何中间角度碰到人或箱都判卡转——不能因为终点够宽就假装整段转得过去。
 */
export function sweepTurn(
  document: GameDocument,
  bank: LouverBank,
  toHand: number,
  mode: ElbowMode = bank.mode,
): SweepResult {
  const from = bank.hand;
  if (Math.abs(toHand - from) < 1e-9) return { clear: true };
  const steps = Math.max(1, Math.ceil(Math.abs(toHand - from) / HAND_STEP));
  const stepSize = (toHand - from) / steps;
  const guards = guardsOf(document, bank);
  for (let i = 1; i <= steps; i += 1) {
    const hand = from + stepSize * i;
    const angle = leafAngleAt(bank, hand, mode);
    for (const guard of guards) {
      // 叶角收小到阈值以下，叶片才探出门框扫入邻格；门格自身守卫阈值为 -∞ 始终生效。
      if (angle > guard.fromAngle + 1e-9) continue;
      const reason = occupantAt(document, guard.cell);
      if (!reason) continue;
      return {
        clear: false,
        block: {
          reason,
          cell: guard.cell,
          hand,
          angle,
          detail:
            `${reason === "player" ? "人" : "箱子"}在 (${guard.cell.x},${guard.cell.y})，` +
            `手轮 ${hand.toFixed(1)}° 时叶片转角 ${angle.toFixed(1)}° 已扫入该格`,
        },
      };
    }
  }
  return { clear: true };
}
