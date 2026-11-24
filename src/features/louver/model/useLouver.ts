import { computed, type Ref } from "vue";
import {
  currentClearance,
  leafAngle,
  switchPoints,
} from "../lib/kinematics";
import {
  atWheel,
  findBank,
  switchElbow,
  turnWheel,
} from "../lib/operations";
import {
  diagnoseBlock,
  planWheel,
  type WheelPlan,
} from "../lib/planner";
import { BODY_WIDTH, louverPassFor } from "../lib/passage";
import type { GameDocument, LouverBank } from "@/shared/types";

export interface LouverPlanView extends WheelPlan {
  bankId: string;
  width: number;
  blockText?: string;
}

export function useLouver(document: Ref<GameDocument>) {
  const banks = computed(() => document.value.level.louverBanks);
  const active = computed(() => document.value.level.louverBanks.length > 0);
  const widths = computed(() => document.value.level.haulWidths);
  const haulWidth = computed(() => document.value.level.haulWidth);

  function setHaulWidth(width: number): void {
    if (document.value.level.haulWidths.includes(width)) {
      document.value.level.haulWidth = width;
    }
  }

  function angleOf(bank: LouverBank): number {
    return leafAngle(bank);
  }

  function clearanceOf(bank: LouverBank): number {
    return currentClearance(document.value.level, bank);
  }

  function wheelOccupied(bank: LouverBank): boolean {
    return atWheel(document.value, bank);
  }

  function switchableAt(bank: LouverBank): number[] {
    return switchPoints(bank);
  }

  /**
   * 盘面预览：沿当前真实状态连续扫描，给出不用拆杆的调门经过；
   * 走不通时指出够宽区间与第一处转不开的位置。
   */
  function preview(bankId: string): LouverPlanView | null {
    const bank = findBank(document.value, bankId);
    if (!bank) return null;
    const width = document.value.level.haulWidth;
    const plan = planWheel(document.value, bank, width);
    if (plan.feasible) return { ...plan, bankId, width };
    const diagnosis = diagnoseBlock(document.value, bank, width);
    const failed: LouverPlanView = {
      ...plan,
      bankId,
      width,
      blockText: diagnosis?.block
        ? `转到 ${diagnosis.block.hand.toFixed(1)}° 转不开：${diagnosis.block.detail}`
        : plan.reason,
    };
    return failed;
  }

  /** 按预览逐动作落盘，全程复用同一套扫掠守卫，防止预览与执行不一致。 */
  function execute(bankId: string): { ok: boolean; message: string } {
    const bank = findBank(document.value, bankId);
    if (!bank) return { ok: false, message: "找不到这组百叶门。" };
    const view = preview(bankId);
    if (!view || !view.feasible) {
      return { ok: false, message: view?.blockText ?? "这段门调不出来。" };
    }
    for (const action of view.actions) {
      if (action.type === "turn") {
        const outcome = turnWheel(document.value, bank, action.toHand - bank.hand);
        if (!outcome.ok) return outcome;
      } else {
        const outcome = switchElbow(document.value, bank);
        if (!outcome.ok) return outcome;
      }
    }
    return {
      ok: true,
      message:
        `已按预览调到 ${view.goalMode === "front" ? "前" : "后"}肘 ` +
        `${view.goalHand.toFixed(1)}°，净空 ${(view.clearance * 100).toFixed(0)}% 格宽。`,
    };
  }

  function nudge(bankId: string, delta: number): { ok: boolean; message: string } {
    const bank = findBank(document.value, bankId);
    if (!bank) return { ok: false, message: "找不到这组百叶门。" };
    return turnWheel(document.value, bank, delta);
  }

  function toggleElbow(bankId: string): { ok: boolean; message: string } {
    const bank = findBank(document.value, bankId);
    if (!bank) return { ok: false, message: "找不到这组百叶门。" };
    return switchElbow(document.value, bank);
  }

  /** 人空手走到百叶格时的净空校验。 */
  function bodyBlockedAt(x: number, y: number): string | null {
    const result = louverPassFor(document.value, { x, y }, BODY_WIDTH);
    if (!result || result.pass) return null;
    return result.reason;
  }

  /** 推箱进入百叶格时按当前选定货物宽度校验，绝不采用另一肘形的终点宽度。 */
  function haulBlockedAt(x: number, y: number): string | null {
    const result = louverPassFor(document.value, { x, y }, document.value.level.haulWidth);
    if (!result || result.pass) return null;
    return result.reason;
  }

  return {
    banks,
    active,
    widths,
    haulWidth,
    setHaulWidth,
    angleOf,
    clearanceOf,
    wheelOccupied,
    switchableAt,
    preview,
    execute,
    nudge,
    toggleElbow,
    bodyBlockedAt,
    haulBlockedAt,
  };
}
