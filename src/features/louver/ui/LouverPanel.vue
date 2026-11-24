<script setup lang="ts">
import { computed } from "vue";
import type { LouverPlanView } from "../model/useLouver";
import type { GameDocument, LouverBank } from "@/shared/types";

const props = defineProps<{
  document: GameDocument;
  plan: LouverPlanView | null;
  angleOf: (bank: LouverBank) => number;
  clearanceOf: (bank: LouverBank) => number;
  wheelOccupied: (bank: LouverBank) => boolean;
  switchableAt: (bank: LouverBank) => number[];
}>();

const emit = defineEmits<{
  nudge: [bankId: string, delta: number];
  toggleElbow: [bankId: string];
  preview: [bankId: string];
  execute: [bankId: string];
  width: [value: number];
}>();

const level = computed(() => props.document.level);

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function modeLabel(mode: string): string {
  return mode === "front" ? "前肘" : "后肘";
}

function intervalText(intervals: { from: number; to: number }[]): string {
  if (intervals.length === 0) return "全行程都不够宽";
  return intervals.map((item) => `${item.from.toFixed(0)}°–${item.to.toFixed(0)}°`).join("，");
}
</script>

<template>
  <section class="panel louver" aria-label="联动百叶门">
    <h2>联动百叶门</h2>
    <p class="lede">
      一排门只跟一只手轮联动；相同读数从前后肘进入，门形可以不同。换形只能在两肘重合的换形点。
    </p>

    <h3>货物宽度</h3>
    <div class="widths">
      <button
        v-for="value in level.haulWidths"
        :key="value"
        type="button"
        :class="{ current: level.haulWidth === value }"
        @click="emit('width', value)"
      >
        {{ pct(value) }} 格宽
      </button>
    </div>

    <div v-for="bank in level.louverBanks" :key="bank.id" class="bank">
      <h3>
        {{ bank.title }}
        <span class="mode-tag">{{ modeLabel(bank.mode) }}</span>
      </h3>
      <ul class="bank-state">
        <li>手轮读数 <b>{{ bank.hand.toFixed(1) }}°</b> · 叶片转角 <b>{{ angleOf(bank).toFixed(1) }}°</b></li>
        <li>当前最窄净空 <b :class="{ tight: clearanceOf(bank) < level.haulWidth }">{{ pct(clearanceOf(bank)) }}</b> · 货物要 {{ pct(level.haulWidth) }}</li>
        <li :class="{ live: wheelOccupied(bank) }">
          {{ wheelOccupied(bank) ? "人已站在手轮格，可以调门" : `人需走到手轮格 (${bank.wheel.x},${bank.wheel.y})` }}
        </li>
        <li>换形点：{{ switchableAt(bank).length ? switchableAt(bank).map((v) => `${v}°`).join("、") : "无" }}</li>
      </ul>

      <div class="wheel-controls">
        <button type="button" @click="emit('nudge', bank.id, -5)">手轮 −5°</button>
        <button type="button" @click="emit('nudge', bank.id, 5)">手轮 +5°</button>
        <button type="button" @click="emit('toggleElbow', bank.id)">换肘形</button>
      </div>

      <div class="plan-controls">
        <button type="button" class="accent" @click="emit('preview', bank.id)">盘面预览调门经过</button>
        <button type="button" class="accent" @click="emit('execute', bank.id)">按预览一次调好</button>
      </div>

      <div v-if="plan && plan.bankId === bank.id" class="plan" :class="{ fail: !plan.feasible }">
        <template v-if="plan.feasible">
          <p class="plan-title">
            可行：转到 {{ modeLabel(plan.goalMode) }} {{ plan.goalHand.toFixed(1) }}°，净空 {{ pct(plan.clearance) }}
          </p>
          <ol>
            <li v-for="(action, index) in plan.actions" :key="index">
              <template v-if="action.type === 'turn'">
                {{ action.mode === "front" ? "前肘" : "后肘" }}连续转动
                {{ action.fromHand.toFixed(0) }}° → {{ action.toHand.toFixed(0) }}°
              </template>
              <template v-else>
                在 {{ action.hand.toFixed(0) }}° 换形：{{ modeLabel(action.fromMode) }} → {{ modeLabel(action.toMode) }}
              </template>
            </li>
          </ol>
        </template>
        <template v-else>
          <p class="plan-title">这一段转不开</p>
          <p class="hint">前肘够宽区间：{{ intervalText(plan.openIntervals.front) }}</p>
          <p class="hint">后肘够宽区间：{{ intervalText(plan.openIntervals.rear) }}</p>
          <p class="block-text">{{ plan.blockText ?? plan.reason }}</p>
        </template>
      </div>
    </div>
  </section>
</template>
