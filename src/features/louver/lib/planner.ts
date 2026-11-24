import {
  HAND_MAX,
  HAND_MIN,
  bankClearanceAt,
  leafAngleAt,
  openIntervals,
  switchPoints,
} from "./kinematics";
import { sweepTurn, type SweepBlock } from "./sweep";
import type { ElbowMode, GameDocument, LouverBank } from "@/shared/types";

const PLAN_GRAIN = 1;
const WIDTH_EPSILON = 1e-9;

export type WheelAction =
  | { type: "turn"; fromHand: number; toHand: number; mode: ElbowMode; clearAngle: number }
  | { type: "switch"; hand: number; fromMode: ElbowMode; toMode: ElbowMode };

export interface WheelPlan {
  feasible: boolean;
  goalHand: number;
  goalMode: ElbowMode;
  clearance: number;
  actions: WheelAction[];
  /** 不可行时：两种肘形各自够宽的读数区间。 */
  openIntervals: {
    front: { from: number; to: number }[];
    rear: { from: number; to: number }[];
  };
  block?: SweepBlock;
  reason?: string;
}

interface Node {
  hand: number;
  mode: ElbowMode;
}

interface Edge {
  prev: Node;
  action: WheelAction;
}

function keyOf(node: Node): string {
  return `${node.mode}@${node.hand}`;
}

function sameNode(a: Node, b: Node): boolean {
  return a.hand === b.hand && a.mode === b.mode;
}

/** 换形动作只在两肘门形重合的换形点合法，且不转动叶片，无需扫掠。 */
function switchNeighbors(bank: LouverBank, node: Node): Node[] {
  const points = switchPoints(bank);
  if (!points.some((point) => Math.abs(point - node.hand) <= 1e-9)) return [];
  const other: ElbowMode = node.mode === "front" ? "rear" : "front";
  return [{ hand: node.hand, mode: other }];
}

function turnNeighbors(node: Node): Node[] {
  const neighbors: Node[] = [];
  if (node.hand > HAND_MIN) neighbors.push({ hand: node.hand - PLAN_GRAIN, mode: node.mode });
  if (node.hand < HAND_MAX) neighbors.push({ hand: node.hand + PLAN_GRAIN, mode: node.mode });
  return neighbors;
}

/**
 * 不拆杆的调门规划：在 (手轮读数 × 肘形) 状态图上 BFS。
 * 转边要通过整段扫掠检查（中途碰人/碰箱即断），换形边只在换形点出现。
 * 另一种肘形上够宽的结果不会被算作当前可过——必须沿真实可达状态走到。
 */
export function planWheel(
  document: GameDocument,
  bank: LouverBank,
  width: number,
): WheelPlan {
  const enough = (node: Node) =>
    bankClearanceAt(document.level, bank, node.hand, node.mode) + WIDTH_EPSILON >= width;
  const start: Node = { hand: Math.round(bank.hand), mode: bank.mode };
  const prev = new Map<string, Edge>();
  const queue: Node[] = [start];
  const seen = new Set<string>([keyOf(start)]);
  const goals: Node[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (enough(node)) goals.push(node);
    const candidates: { next: Node; action: WheelAction }[] = [];
    for (const next of turnNeighbors(node)) {
      // 探针必须站在当前 BFS 节点上，只扫这 1° 边；整条路径的安全性由逐边累积保证。
      const probe: LouverBank = { ...bank, hand: node.hand, mode: node.mode };
      const sweep = sweepTurn(document, probe, next.hand, node.mode);
      if (!sweep.clear) continue;
      candidates.push({
        next,
        action: {
          type: "turn",
          fromHand: node.hand,
          toHand: next.hand,
          mode: node.mode,
          clearAngle: leafAngleAt(probe, next.hand, node.mode),
        },
      });
    }
    for (const next of switchNeighbors(bank, node)) {
      candidates.push({
        next,
        action: {
          type: "switch",
          hand: node.hand,
          fromMode: node.mode,
          toMode: next.mode,
        },
      });
    }
    for (const { next, action } of candidates) {
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      prev.set(key, { prev: node, action });
      queue.push(next);
    }
  }

  const intervals = {
    front: openIntervals(document.level, bank, "front", width),
    rear: openIntervals(document.level, bank, "rear", width),
  };

  if (goals.length === 0) {
    return {
      feasible: false,
      goalHand: start.hand,
      goalMode: start.mode,
      clearance: bankClearanceAt(document.level, bank, start.hand, start.mode),
      actions: [],
      openIntervals: intervals,
      reason: "可达状态里没有任何读数能给这件货留出净空。",
    };
  }

  const goal = goals[0];
  const actions = reconstruct(prev, start, goal);
  return {
    feasible: true,
    goalHand: goal.hand,
    goalMode: goal.mode,
    clearance: bankClearanceAt(document.level, bank, goal.hand, goal.mode),
    actions,
    openIntervals: intervals,
  };
}

/** 不可行时定位离目标最近的够宽状态，并给出从当前状态转过去时第一处卡转。 */
export function diagnoseBlock(
  document: GameDocument,
  bank: LouverBank,
  width: number,
): { node: Node; block?: SweepBlock } | null {
  const targets: Node[] = [];
  for (let hand = HAND_MIN; hand <= HAND_MAX; hand += PLAN_GRAIN) {
    for (const mode of ["front", "rear"] as ElbowMode[]) {
      if (bankClearanceAt(document.level, bank, hand, mode) + WIDTH_EPSILON >= width) {
        targets.push({ hand, mode });
      }
    }
  }
  if (targets.length === 0) return null;
  const start: Node = { hand: Math.round(bank.hand), mode: bank.mode };
  const node = targets.reduce((best, candidate) =>
    stateDistance(candidate, start) < stateDistance(best, start) ? candidate : best,
  );
  if (node.mode === start.mode) {
    const probe: LouverBank = { ...bank, hand: start.hand, mode: start.mode };
    const sweep = sweepTurn(document, probe, node.hand, node.mode);
    return { node, block: sweep.block };
  }
  const point = switchPoints(bank).reduce((best, value) =>
    Math.abs(value - start.hand) < Math.abs(best - start.hand) ? value : best,
  );
  const probe: LouverBank = { ...bank, hand: start.hand, mode: start.mode };
  const sweep = sweepTurn(document, probe, point, start.mode);
  return { node, block: sweep.block };
}

function stateDistance(node: Node, start: Node): number {
  const modePenalty = node.mode === start.mode ? 0 : 1000;
  return Math.abs(node.hand - start.hand) + modePenalty;
}

function reconstruct(prev: Map<string, Edge>, start: Node, goal: Node): WheelAction[] {
  const raw: WheelAction[] = [];
  let cursor = goal;
  while (!sameNode(cursor, start)) {
    const edge = prev.get(keyOf(cursor));
    if (!edge) break;
    raw.push(edge.action);
    cursor = edge.prev;
  }
  raw.reverse();
  return mergeTurns(raw);
}

/** 把逐度的小转合并成一段连续转动，换形动作保留为独立一步。 */
function mergeTurns(actions: WheelAction[]): WheelAction[] {
  const merged: WheelAction[] = [];
  for (const action of actions) {
    const last = merged[merged.length - 1];
    if (
      action.type === "turn" &&
      last?.type === "turn" &&
      last.mode === action.mode &&
      Math.abs(last.toHand - action.fromHand) < 1e-9
    ) {
      last.toHand = action.toHand;
      last.clearAngle = action.clearAngle;
    } else {
      merged.push(structuredClone(action));
    }
  }
  return merged;
}
