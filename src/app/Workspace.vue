<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { StageView, TileLegend } from "@/features/atlas";
import { GadgetPanel } from "@/features/gadget";
import { MoverHud } from "@/features/hauler";
import { StepMeter } from "@/features/ledger";
import { LouverPanel } from "@/features/louver";
import { LevelRail, RecordBoard } from "@/features/voyage";
import { dirFromKey, shouldCapture } from "./keys";
import { useWorkshop } from "./useWorkshop";

const shop = useWorkshop();
const { document, notice, planView } = shop;
const { title, blurb } = shop.atlas;
const { counts } = shop.hauler;
const { summary } = shop.gadget;
const { steps, status, coverage } = shop.ledger;
const { catalog, completed } = shop.voyage;
const {
  active: louverActive,
  angleOf,
  clearanceOf,
  wheelOccupied,
  switchableAt,
  banks,
} = shop.louver;

function onKey(event: KeyboardEvent): void {
  if (!shouldCapture(event)) return;
  const action = dirFromKey(event);
  if (!action) return;
  event.preventDefault();
  if (action === "reset") {
    shop.reset();
    return;
  }
  shop.move(action);
}

function onWheelKey(event: KeyboardEvent): void {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("input, textarea, select, button")) return;
  if (!louverActive.value || banks.value.length === 0) return;
  const bank = banks.value[0];
  if (event.key === "q" || event.key === "Q") {
    event.preventDefault();
    shop.nudgeWheel(bank.id, -5);
  } else if (event.key === "e" || event.key === "E") {
    event.preventDefault();
    shop.nudgeWheel(bank.id, 5);
  } else if (event.key === "f" || event.key === "F") {
    event.preventDefault();
    shop.toggleElbow(bank.id);
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("keydown", onWheelKey);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keydown", onWheelKey);
});
</script>

<template>
  <div class="workshop">
    <header class="mast">
      <div class="brand">
        <span class="mark" aria-hidden="true">闩</span>
        <div>
          <h1>栈闩工房</h1>
          <p>箱认踏板，板动门廊。一步一格，记下你走的路。</p>
        </div>
      </div>
      <p class="notice" :data-tone="notice.tone">{{ notice.message }}</p>
    </header>
    <div class="bench">
      <aside class="rail">
        <LevelRail :catalog="catalog" @select="shop.selectLevel" @reset="shop.reset" />
        <RecordBoard :completed="completed" />
      </aside>
      <main class="stage">
        <div class="stage-head">
          <h2>{{ title }}</h2>
          <p>{{ blurb }}</p>
        </div>
        <StageView :document="document" />
        <MoverHud :counts="counts" />
      </main>
      <aside class="side">
        <StepMeter :steps="steps" :status="status" :coverage="coverage" />
        <LouverPanel
          v-if="louverActive"
          :document="document"
          :plan="planView"
          :angle-of="angleOf"
          :clearance-of="clearanceOf"
          :wheel-occupied="wheelOccupied"
          :switchable-at="switchableAt"
          @nudge="shop.nudgeWheel"
          @toggle-elbow="shop.toggleElbow"
          @preview="shop.previewWheel"
          @execute="shop.executePlan"
          @width="shop.chooseWidth"
        />
        <GadgetPanel :document="document" :summary="summary" />
        <TileLegend />
      </aside>
    </div>
  </div>
</template>
