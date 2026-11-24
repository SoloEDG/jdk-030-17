import { cellAt, inBounds } from "@/features/atlas/lib/grid";
import { BODY_WIDTH, louverPassFor } from "@/features/louver/lib/passage";
import { sameCell } from "@/shared/document";
import type { GameDocument, Vec } from "@/shared/types";

export interface PassQuery {
  ignoreBoxId?: string;
  ignorePlayer?: boolean;
  /** 穿越百叶门所需的宽度（格宽比例），默认按人的身宽校验。 */
  requiredWidth?: number;
  /** 调用方正在推箱进入该格；窄缝只容人过，此时必须拦截。 */
  forbidBox?: boolean;
}

function groundOpen(document: GameDocument, x: number, y: number): boolean {
  const tile = cellAt(document.level, x, y);
  if (tile == null) return false;
  const patch = document.level.floors.find((floor) => floor.x === x && floor.y === y);
  if (patch?.morph === "seal" && patch.active) return false;
  if (patch?.morph === "bridge" && patch.active) return true;
  return tile !== "wall" && tile !== "gap";
}

export function isPassable(document: GameDocument, at: Vec, query: PassQuery = {}): boolean {
  if (!inBounds(document.level, at.x, at.y)) return false;
  if (!groundOpen(document, at.x, at.y)) return false;
  // 窄缝格：人可以侧身过，推箱时永远进不去。
  if (query.forbidBox === true && cellAt(document.level, at.x, at.y) === "narrowGap") {
    return false;
  }
  const louver = louverPassFor(document, at, query.requiredWidth ?? BODY_WIDTH);
  if (louver && !louver.pass) return false;
  const door = document.level.doors.find((item) => item.x === at.x && item.y === at.y);
  if (door && !door.open) return false;
  const box = document.level.boxes.find(
    (item) => sameCell(item, at) && item.id !== query.ignoreBoxId,
  );
  if (box) return false;
  if (!query.ignorePlayer && sameCell(document.level.player, at)) return false;
  return true;
}

export function describeBlock(document: GameDocument, at: Vec): string {
  if (!inBounds(document.level, at.x, at.y)) return "边界";
  if (!groundOpen(document, at.x, at.y)) return "地面封闭";
  if (cellAt(document.level, at.x, at.y) === "narrowGap") return "窄缝只容人过";
  const louver = louverPassFor(document, at, BODY_WIDTH);
  if (louver && !louver.pass) return `百叶净空不足：${louver.reason}`;
  const door = document.level.doors.find((item) => item.x === at.x && item.y === at.y);
  if (door && !door.open) return "门闩关闭";
  if (document.level.boxes.some((item) => sameCell(item, at))) return "箱子占据";
  if (sameCell(document.level.player, at)) return "人占据";
  return "可通行";
}
