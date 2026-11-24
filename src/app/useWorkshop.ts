import { ref } from "vue";
import { useAtlas } from "@/features/atlas";
import { useGadget } from "@/features/gadget";
import { useHauler } from "@/features/hauler";
import { useLedger } from "@/features/ledger";
import { useLouver, type LouverPlanView } from "@/features/louver";
import { loadInitial, useVoyage } from "@/features/voyage";
import type { Notice } from "@/shared/commands";
import type { Dir } from "@/shared/types";

export function useWorkshop() {
  const document = ref(loadInitial());
  const notice = ref<Notice>({
    tone: "info",
    message: "把对得上的箱子压上踏板，门和地板会跟着变。",
  });
  const atlas = useAtlas(document);
  const hauler = useHauler(document);
  const gadget = useGadget(document);
  const ledger = useLedger(document);
  const voyage = useVoyage(document);
  const louver = useLouver(document);
  const planView = ref<LouverPlanView | null>(null);

  function notify(next: Notice): void {
    notice.value = next;
  }

  function move(dir: Dir): void {
    const result = hauler.tryMove(dir);
    if (!result.moved) {
      if (result.reason === "cleared") {
        notify({ tone: "warn", message: "本关已通关。重置或另选关卡后再推。" });
      } else {
        notify({ tone: "warn", message: "这一步走不通。" });
      }
      return;
    }
    gadget.refresh();
    planView.value = null;
    const tick = ledger.afterMove(result);
    if (tick.cleared) {
      voyage.commitClear();
      notify({
        tone: "success",
        message: `通关，用了 ${document.value.attempt.steps} 步。最佳记录已写入目录。`,
      });
    }
  }

  function nudgeWheel(bankId: string, delta: number): void {
    const outcome = louver.nudge(bankId, delta);
    planView.value = null;
    notify({ tone: outcome.ok ? "info" : "warn", message: outcome.message });
  }

  function toggleElbow(bankId: string): void {
    const outcome = louver.toggleElbow(bankId);
    planView.value = null;
    notify({ tone: outcome.ok ? "info" : "warn", message: outcome.message });
  }

  function previewWheel(bankId: string): void {
    const plan = louver.preview(bankId);
    planView.value = plan;
    if (!plan) return;
    notify({
      tone: plan.feasible ? "success" : "warn",
      message: plan.feasible
        ? `预览给出 ${plan.actions.length} 步调门经过，终点净空 ${(plan.clearance * 100).toFixed(0)}%。`
        : `预览判定转不开：${plan.blockText ?? plan.reason}`,
    });
  }

  function executePlan(bankId: string): void {
    const outcome = louver.execute(bankId);
    planView.value = louver.preview(bankId);
    notify({ tone: outcome.ok ? "success" : "warn", message: outcome.message });
  }

  function chooseWidth(value: number): void {
    louver.setHaulWidth(value);
    planView.value = null;
    notify({ tone: "info", message: `已选货物宽度 ${(value * 100).toFixed(0)}% 格宽，预览与通行按它校验。` });
  }

  function reset(): void {
    voyage.resetLevel();
    planView.value = null;
    notify({ tone: "info", message: "已重置当前关卡，最佳记录仍在。" });
  }

  function selectLevel(id: string): void {
    voyage.openLevel(id);
    planView.value = null;
    notify({
      tone: "info",
      message: `进入「${document.value.level.title}」。${document.value.level.blurb}`,
    });
  }

  return {
    document,
    notice,
    atlas,
    hauler,
    gadget,
    ledger,
    voyage,
    louver,
    planView,
    move,
    nudgeWheel,
    toggleElbow,
    previewWheel,
    executePlan,
    chooseWidth,
    reset,
    selectLevel,
  };
}
