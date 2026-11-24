import assert from "node:assert/strict";
import { getLevel, hydrate } from "../src/features/voyage/lib/catalog";
import { evaluateGadgets } from "../src/features/gadget/lib/power";
import { isPassable } from "../src/features/gadget/lib/passable";
import { applyMove } from "../src/features/hauler/lib/push";
import {
  bankClearanceAt,
  leafAngleAt,
  modesCoincide,
  switchPoints,
} from "../src/features/louver/lib/kinematics";
import { planWheel, diagnoseBlock } from "../src/features/louver/lib/planner";
import { sweepTurn } from "../src/features/louver/lib/sweep";
import { turnWheel, switchElbow } from "../src/features/louver/lib/operations";
import { louverPassFor } from "../src/features/louver/lib/passage";
import { DIR_VEC, type Dir, type GameDocument, type LouverBank } from "../src/shared/types";

const WIDE_06 = 0.28;
const WIDE_07 = 0.295;
const NARROW = 0.15;

function docFor(levelId: string): GameDocument {
  const level = hydrate(getLevel(levelId));
  const doc: GameDocument = {
    version: 1,
    currentLevelId: levelId,
    level,
    attempt: { steps: 0, status: "playing" },
    records: {},
  };
  evaluateGadgets(doc);
  return doc;
}

function bankOf(doc: GameDocument, id: string): LouverBank {
  const bank = doc.level.louverBanks.find((item) => item.id === id);
  assert.ok(bank, `缺少手轮组 ${id}`);
  return bank;
}

// ---- 旧关回归：未装百叶时新字段为空，踏板仍是唯一开关 ----
{
  const doc = docFor("latch-01");
  assert.equal(doc.level.louverBanks.length, 0);
  assert.equal(doc.level.louvers.length, 0);
  assert.equal(doc.level.haulWidths.length, 0);
  const door = doc.level.doors[0];
  assert.equal(door.open, false);
  const [plate] = doc.level.plates;
  const box = doc.level.boxes[0];
  box.x = plate.x;
  box.y = plate.y;
  evaluateGadgets(doc);
  assert.equal(door.open, true);
  console.log("✓ 旧关 latch-01 仍听原踏板，百叶字段为空");
}

// ---- 窄缝：人能侧身过，箱子推不过（latch-06 的人回路） ----
{
  const doc = docFor("latch-06");
  const gap = { x: 7, y: 5 };
  assert.equal(isPassable(doc, gap), true);
  assert.equal(isPassable(doc, gap, { forbidBox: true, ignorePlayer: true }), false);
  console.log("✓ 窄缝只容人过，推箱被挡");
}

// ---- 双肘百叶：两种肘形同读数门形不同，换形点唯一且重合 ----
{
  const doc = docFor("latch-06");
  const bank = bankOf(doc, "bank1");
  assert.equal(bank.hand, 60);
  assert.equal(leafAngleAt(bank, 30, "front"), 45);
  assert.equal(leafAngleAt(bank, 30, "rear"), 30);
  assert.equal(modesCoincide(bank, 30), false);
  const points = switchPoints(bank);
  assert.deepEqual(points, [60]);
  assert.equal(leafAngleAt(bank, 60, "front"), 60);
  assert.equal(leafAngleAt(bank, 60, "rear"), 60);
  assert.equal(modesCoincide(bank, 60), true);
  console.log("✓ 同读数前后肘门形不同，仅 60° 为合法换形点");
}

// ---- 宽货预览：前肘任何读数都不够，规划必须经过 60° 换形再用后肘开大 ----
{
  const doc = docFor("latch-06");
  const bank = bankOf(doc, "bank1");
  doc.level.haulWidth = WIDE_06;
  // 前肘叶角恒在 30°–75°，最佳净空（h=0, θ=30）仍不足宽货
  const frontBest = bankClearanceAt(doc.level, bank, 0, "front");
  assert.ok(frontBest < WIDE_06, `前肘最宽 ${frontBest} 竟够 ${WIDE_06}`);
  // 后肘 h=25 时叶角 25°，净空应足够
  const rearAt25 = bankClearanceAt(doc.level, bank, 25, "rear");
  assert.ok(rearAt25 >= WIDE_06);
  const plan = planWheel(doc, bank, WIDE_06);
  assert.equal(plan.feasible, true);
  assert.equal(plan.goalMode, "rear");
  assert.ok(plan.goalHand <= 25);
  const hasSwitch = plan.actions.some(
    (action) => action.type === "switch" && action.hand === 60,
  );
  assert.ok(hasSwitch, "规划里缺少 60° 换形动作");
  console.log("✓ 宽货规划：前肘不够 → 60° 换形 → 后肘开大，全程不拆杆");
}

// ---- 非换形点禁止换形；换形点允许 ----
{
  const doc = docFor("latch-06");
  const bank = bankOf(doc, "bank1");
  doc.level.player = { ...bank.wheel };
  let outcome = switchElbow(doc, bank); // 初始 60° 恰好是换形点，先移开
  assert.equal(outcome.ok, true);
  assert.equal(bank.mode, "rear");
  outcome = turnWheel(doc, bank, -10); // 到 50°，两肘门形已不同
  assert.equal(outcome.ok, true);
  outcome = switchElbow(doc, bank);
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /不能换形/);
  console.log("✓ 换形守卫：非重合读数拒绝，重合点放行");
}

// ---- 通行判定只认当前肘形，不许借用另一肘的终点宽度 ----
{
  const doc = docFor("latch-06");
  const louverCell = { x: 5, y: 5 };
  doc.level.haulWidth = WIDE_06;
  const blocked = louverPassFor(doc, louverCell, WIDE_06);
  assert.ok(blocked && blocked.pass === false);
  const bank = bankOf(doc, "bank1");
  doc.level.player = { ...bank.wheel };
  // 60° 换形 → 后肘 → 关到 25°，此时真实净空够宽
  switchElbow(doc, bank);
  turnWheel(doc, bank, 25 - bank.hand);
  const pass = louverPassFor(doc, louverCell, WIDE_06);
  assert.ok(pass && pass.pass === true);
  // 回 60° 切回前肘，再回到 25°（前肘 θ=42.5°），立刻不够
  turnWheel(doc, bank, 60 - bank.hand);
  switchElbow(doc, bank);
  turnWheel(doc, bank, 25 - bank.hand);
  const blockedAgain = louverPassFor(doc, louverCell, WIDE_06);
  assert.ok(blockedAgain && blockedAgain.pass === false);
  console.log("✓ 通行只按当前真实门形，另一肘形的宽度不被采用");
}

// ---- 转不开：叶片扫入停箱邻格，整段判卡，预览给区间与第一处卡转 ----
{
  const doc = docFor("latch-07");
  const bank = bankOf(doc, "bank2");
  doc.level.haulWidth = WIDE_07;
  doc.level.player = { ...bank.wheel };
  const turn = turnWheel(doc, bank, 0 - bank.hand); // 从 90° 关向 0°
  assert.equal(turn.ok, false);
  assert.match(turn.message, /转不动/);
  // 箱在 (4,6)，叶角 20° 对应手轮 20°；从 90° 关小时首个命中点在 20° 附近
  const sweep = sweepTurn(doc, bank, 0);
  assert.equal(sweep.clear, false);
  assert.ok(sweep.block, "扫掠应报告卡转");
  assert.ok(sweep.block.hand <= 20.6 && sweep.block.hand >= 19, `卡转角度异常 ${sweep.block?.hand}`);
  assert.equal(sweep.block?.reason, "box");
  const plan = planWheel(doc, bank, WIDE_07);
  assert.equal(plan.feasible, false);
  assert.ok(plan.openIntervals.front.length > 0);
  const diagnosis = diagnoseBlock(doc, bank, WIDE_07);
  assert.ok(diagnosis?.block, "诊断应给出第一处卡转");
  console.log("✓ 宽货转不开：中途碰箱即整段拒绝，预览报告受阻区间与卡转角度");
}

// ---- 同关窄货在禁区之前即可通过，证明不是门本身坏掉 ----
{
  const doc = docFor("latch-07");
  const bank = bankOf(doc, "bank2");
  doc.level.haulWidth = NARROW;
  doc.level.player = { ...bank.wheel };
  const plan = planWheel(doc, bank, NARROW);
  assert.equal(plan.feasible, true);
  // 窄货只需 θ≤59.3°（手轮约 59°）；可达下限是 21°，目标必然落在 [21,60]，全程不碰 20° 禁区
  assert.ok(
    plan.goalHand >= 21 && plan.goalHand <= 60,
    `窄货目标手轮 ${plan.goalHand} 异常`,
  );
  const turn = turnWheel(doc, bank, plan.goalHand - bank.hand);
  assert.equal(turn.ok, true);
  const pass = louverPassFor(doc, { x: 3, y: 6 }, NARROW);
  assert.ok(pass && pass.pass);
  console.log("✓ 窄货所需开度小，在不越过扫掠禁区的行程内即可通过");
}

// ---- 人站在门格上，门一开转就碰身，不能用终点宽度放行 ----
{
  const doc = docFor("latch-06");
  const bank = bankOf(doc, "bank1");
  doc.level.player = { x: 5, y: 5 }; // 直接站在百叶门格
  const outcome = turnWheel(doc, bank, -10);
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /人/);
  console.log("✓ 人挡扫掠路径时首角度即卡转，终点再宽也不放行");
}

// ---- 端到端：latch-06 可在不拆杆的前提下推箱通关 ----
// 求解分两层：先求手轮不拆杆可达的离散门形配置，再在走位 BFS 里于手轮格切换配置。
{
  const doc = docFor("latch-06");
  doc.level.haulWidth = WIDE_06;
  const bank = bankOf(doc, "bank1");
  const dirs: Dir[] = ["n", "e", "s", "w"];

  // 第一层：(手轮读数 × 肘形) 上的可达配置，转边过扫掠、换形只在换形点
  interface WheelState { hand: number; mode: "front" | "rear" }
  const wheelKey = (s: WheelState) => `${s.mode}@${s.hand}`;
  const wheelStart: WheelState = { hand: bank.hand, mode: bank.mode };
  const wheelSeen = new Set<string>([wheelKey(wheelStart)]);
  const wheelQueue: WheelState[] = [wheelStart];
  const reachableConfigs: WheelState[] = [];
  while (wheelQueue.length > 0) {
    const node = wheelQueue.shift()!;
    reachableConfigs.push(node);
    const addWheel = (s: WheelState) => {
      const key = wheelKey(s);
      if (!wheelSeen.has(key)) {
        wheelSeen.add(key);
        wheelQueue.push(s);
      }
    };
    for (const target of [node.hand - 1, node.hand + 1]) {
      if (target < 0 || target > 90) continue;
      const probe: LouverBank = { ...bank, hand: node.hand, mode: node.mode };
      if (sweepTurn(doc, probe, target, node.mode).clear) {
        addWheel({ hand: target, mode: node.mode });
      }
    }
    if (switchPoints(bank).some((p) => Math.abs(p - node.hand) < 1e-9)) {
      addWheel({ hand: node.hand, mode: node.mode === "front" ? "rear" : "front" });
    }
  }
  assert.ok(reachableConfigs.some((c) => c.mode === "rear" && c.hand <= 25), "手轮应可达后肘小角度配置");

  // 第二层：对每个"不拆杆可达且净空够宽"的门形，各跑一次纯推箱 BFS。
  // 调门在扛货之前完成，推箱期间门形保持——与真实操作顺序一致。
  const goals = doc.level.tiles
    .flatMap((row, y) => row.map((tile, x) => ({ x, y, tile })))
    .filter((cell) => cell.tile === "goal");

  interface SearchNode {
    px: number;
    py: number;
    boxes: { x: number; y: number }[];
  }
  const stateKey = (n: SearchNode) =>
    `${n.px},${n.py}|${n.boxes.map((b) => `${b.x},${b.y}`).join(";")}`;
  const initialBoxes = doc.level.boxes.map((b) => ({ x: b.x, y: b.y }));

  const freshStart = docFor("latch-06").level.player;
  const initialPlayer = { ...freshStart };

  function solveAt(config: WheelState): { solved: boolean; states: number } {
    bank.hand = config.hand;
    bank.mode = config.mode;
    const start: SearchNode = {
      px: initialPlayer.x,
      py: initialPlayer.y,
      boxes: structuredClone(initialBoxes),
    };
    const seen = new Set<string>([stateKey(start)]);
    const queue: SearchNode[] = [start];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (goals.every((g) => node.boxes.some((b) => b.x === g.x && b.y === g.y))) {
        return { solved: true, states: seen.size };
      }
      doc.level.player = { x: node.px, y: node.py };
      doc.level.boxes.forEach((b, i) => {
        b.x = node.boxes[i].x;
        b.y = node.boxes[i].y;
      });
      for (const dir of dirs) {
        const before = structuredClone({ player: doc.level.player, boxes: doc.level.boxes });
        const result = applyMove(doc, dir);
        if (result.moved) {
          const next: SearchNode = {
            px: doc.level.player.x,
            py: doc.level.player.y,
            boxes: doc.level.boxes.map((b) => ({ x: b.x, y: b.y })),
          };
          const key = stateKey(next);
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(next);
          }
        }
        doc.level.player = before.player;
        doc.level.boxes = before.boxes;
      }
    }
    return { solved: false, states: seen.size };
  }

  let finalConfig: WheelState | null = null;
  let totalStates = 0;
  for (const config of reachableConfigs) {
    if (bankClearanceAt(doc.level, bank, config.hand, config.mode) < WIDE_06 - 1e-9) continue;
    doc.level.player = { ...initialPlayer };
    const outcome = solveAt(config);
    totalStates += outcome.states;
    if (outcome.solved) {
      finalConfig = config;
      break;
    }
  }

  assert.ok(finalConfig, `latch-06 应能推箱通关，但所有可达门形下均无解（累计 ${totalStates} 状态）`);
  assert.equal(finalConfig.mode, "rear");
  assert.ok(finalConfig.hand <= 25, `通关时手轮应在后肘小角度，实际 ${finalConfig.hand}`);
  bank.hand = finalConfig.hand;
  bank.mode = "rear";
  assert.ok(louverPassFor(doc, { x: 5, y: 5 }, WIDE_06)?.pass);
  bank.mode = "front";
  assert.equal(louverPassFor(doc, { x: 5, y: 5 }, WIDE_06)?.pass, false);
  console.log(
    `✓ 端到端求解成功（${reachableConfigs.length} 个可达门形，累计 ${totalStates} 个走位状态），通关门形为后肘 ${finalConfig.hand}°`,
  );
}

console.log("\n全部断言通过。");
