import { sameCell } from "@/shared/document";
import {
  HAND_MAX,
  HAND_MIN,
  HAND_STEP,
  isSwitchable,
  leafAngle,
  leafAngleAt,
} from "./kinematics";
import { sweepTurn } from "./sweep";
import type { ElbowMode, GameDocument, LouverBank } from "@/shared/types";

export interface WheelOutcome {
  ok: boolean;
  message: string;
}

export function findBank(document: GameDocument, bankId: string): LouverBank | undefined {
  return document.level.louverBanks.find((bank) => bank.id === bankId);
}

/** 人必须站在手轮所在格，否则手轮够不着。 */
export function atWheel(document: GameDocument, bank: LouverBank): boolean {
  return sameCell(document.level.player, bank.wheel);
}

/** 执行一次连续转动；整段扫掠通过才落盘，任何中间角度碰身/碰箱都拒绝。 */
export function turnWheel(
  document: GameDocument,
  bank: LouverBank,
  delta: number,
): WheelOutcome {
  if (!atWheel(document, bank)) {
    return { ok: false, message: "人不在手轮格，够不到这只手轮。" };
  }
  const target = Math.min(HAND_MAX, Math.max(HAND_MIN, bank.hand + delta));
  if (Math.abs(target - bank.hand) < 1e-9) {
    return { ok: false, message: "手轮已到行程尽头。" };
  }
  const sweep = sweepTurn(document, bank, target);
  if (!sweep.clear) {
    return {
      ok: false,
      message: sweep.block
        ? `转到 ${sweep.block.hand.toFixed(1)}° 就转不动了：${sweep.block.detail}。`
        : "这段转角转不过去。",
    };
  }
  bank.hand = target;
  return {
    ok: true,
    message: `手轮转到 ${target.toFixed(1)}°，叶片转角 ${leafAngle(bank).toFixed(1)}°。`,
  };
}

/** 换肘形：只接受两肘门形重合的换形点，其余位置硬切等于拆杆。 */
export function switchElbow(document: GameDocument, bank: LouverBank): WheelOutcome {
  if (!atWheel(document, bank)) {
    return { ok: false, message: "人不在手轮格，换不了肘形。" };
  }
  if (!isSwitchable(bank)) {
    return {
      ok: false,
      message: "当前读数下两种肘形门形不同，不能换形；先转到换形点。",
    };
  }
  const next: ElbowMode = bank.mode === "front" ? "rear" : "front";
  const before = leafAngleAt(bank, bank.hand, bank.mode);
  const after = leafAngleAt(bank, bank.hand, next);
  bank.mode = next;
  return {
    ok: true,
    message: `在 ${bank.hand.toFixed(1)}° 换形，前后肘同为 ${before.toFixed(1)}°（校验 ${after.toFixed(1)}°）。`,
  };
}

export { HAND_STEP };
