"use strict";
(() => {
  // ../analyzer/dist/chunk-5HGFXDSJ.js
  var NUTRIENTS = [
    {
      key: "calories",
      label: "Calories",
      unit: "kcal",
      dp: 0,
      required: true,
      parent: null
    },
    { key: "fat", label: "Fat", unit: "g", dp: 1, required: true, parent: null },
    {
      key: "sat_fat",
      label: "Saturates",
      unit: "g",
      dp: 1,
      required: false,
      parent: "fat"
    },
    {
      key: "mono_fat",
      label: "Mono-unsaturates",
      unit: "g",
      dp: 1,
      required: false,
      parent: "fat"
    },
    {
      key: "poly_fat",
      label: "Poly-unsaturates",
      unit: "g",
      dp: 1,
      required: false,
      parent: "fat"
    },
    {
      key: "carbs",
      label: "Carbohydrates",
      unit: "g",
      dp: 1,
      required: true,
      parent: null
    },
    {
      key: "sugar",
      label: "Sugars",
      unit: "g",
      dp: 1,
      required: false,
      parent: "carbs"
    },
    {
      key: "fiber",
      label: "Fiber",
      unit: "g",
      dp: 1,
      required: false,
      parent: null
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      dp: 1,
      required: true,
      parent: null
    },
    {
      key: "sodium",
      label: "Sodium",
      unit: "mg",
      dp: 0,
      required: false,
      parent: null
    },
    {
      key: "alcohol",
      label: "Alcohol",
      unit: "g",
      dp: 1,
      required: false,
      parent: null
    }
  ];

  // ../renderer/dist/index.js
  var EMPTY_MACROS = Object.fromEntries(
    NUTRIENTS.filter((n) => n.required).map((n) => [n.key, 0])
  );
  var SVG = {
    // Clock (sync timer) — Lucide Clock
    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    // Hourglass (async timer) — Lucide Hourglass
    hourglass: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M17 2v4.172a2 2 0 0 0-.586 1.414L12 12 7.586 7.586A2 2 0 0 1 7 6.172V2"/></svg>`,
    // Thermometer — Lucide Thermometer
    thermometer: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`
  };
  var PRINT_ICONS = {
    hourglass: SVG.hourglass,
    timer: SVG.clock,
    thermometer: SVG.thermometer,
    caretRight: "\u2192",
    arrowRight: "\u2192",
    arrowUDownLeft: "\u21B5",
    warning: "\u26A0",
    pencilSimple: "\u270E",
    clock: SVG.clock,
    fire: "\u25B3",
    knife: "\u2014",
    scales: "\u2696",
    clockCounterClockwise: "\u21BA"
  };
  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0) {
      return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
    }
    return `${m}m`;
  }
  function formatAxisTime(realTime, opts) {
    const { timeMode, targetTime, maxRealTime } = opts;
    if (timeMode === "reverse") {
      const diff = maxRealTime - realTime;
      if (diff === 0) return "T-0";
      return `T-${formatTime(diff)}`;
    }
    if (timeMode === "target" && targetTime) {
      const [th, tm] = targetTime.split(":").map(Number);
      if (th !== void 0 && tm !== void 0 && !Number.isNaN(th) && !Number.isNaN(tm)) {
        const diff = maxRealTime - realTime;
        const totalTargetMins = th * 60 + tm;
        const timeAtTick = totalTargetMins - diff;
        const normalizedTime = (timeAtTick % 1440 + 1440) % 1440;
        const rh = Math.floor(normalizedTime / 60);
        const rm = normalizedTime % 60;
        const d = /* @__PURE__ */ new Date();
        d.setHours(rh, rm, 0, 0);
        return new Intl.DateTimeFormat(void 0, {
          hour: "numeric",
          minute: "2-digit"
        }).format(d);
      }
    }
    return formatTime(realTime);
  }
  var TOOLTIP_WIDTH = 220;
  var TOOLTIP_HEIGHT = 80;
  function escapeHtml2(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function computeDefaultTargetTime(maxRealTime) {
    const now = /* @__PURE__ */ new Date();
    now.setMinutes(now.getMinutes() + maxRealTime);
    const m = Math.round(now.getMinutes() / 15) * 15 % 60;
    const h = now.getHours() + (m === 0 && now.getMinutes() > 30 ? 1 : 0);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  function getMaxRealTime(container2) {
    const wrapper = container2.querySelector(".gantt-wrapper");
    return Number(wrapper?.dataset.maxRealTime ?? 0);
  }
  function attachGanttInteractivity(container2, initial) {
    const state = { ...initial };
    if (!state.targetTime) {
      state.targetTime = computeDefaultTargetTime(getMaxRealTime(container2));
    }
    let tooltipEl = null;
    let tooltipBlock = null;
    function buildTooltipHTML(block) {
      const label = block.dataset.label ?? "";
      const tooltipText = block.dataset.tooltip ?? "";
      const temperature = block.dataset.temperature;
      const start = Number(block.dataset.start ?? 0);
      const end = Number(block.dataset.end ?? 0);
      const duration = block.dataset.duration ?? "";
      const maxRealTime = getMaxRealTime(container2);
      const axisOpts = {
        timeMode: state.timeMode,
        targetTime: state.targetTime,
        maxRealTime
      };
      const header = label ? `<div class="tooltip-header"><strong>${escapeHtml2(label)}</strong>${temperature ? `<span class="temp-badge-tooltip">\u{1F321}\uFE0F ${escapeHtml2(temperature)}</span>` : ""}</div>` : "";
      const body = tooltipText && tooltipText !== label ? `<div class="tooltip-text">${escapeHtml2(tooltipText)}</div>` : "";
      return `${header}
      <div class="tooltip-time">
        <span class="time-badge">${formatAxisTime(start, axisOpts)}</span>
        <span class="time-arrow">\u2192</span>
        <span class="time-badge">${formatAxisTime(end, axisOpts)}</span>
        <span class="time-duration">(${duration}m)</span>
      </div>
      ${body}`;
    }
    function showTooltip(block, x, y) {
      if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "gantt-tooltip-fixed";
        document.body.appendChild(tooltipEl);
      }
      tooltipBlock = block;
      tooltipEl.innerHTML = buildTooltipHTML(block);
      positionTooltip(x, y);
    }
    function positionTooltip(x, y) {
      if (!tooltipEl) return;
      let left = x + 15;
      let top = y + 15;
      if (left + TOOLTIP_WIDTH > window.innerWidth) left = x - TOOLTIP_WIDTH - 15;
      if (top + TOOLTIP_HEIGHT > window.innerHeight)
        top = y - TOOLTIP_HEIGHT - 15;
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    }
    function hideTooltip() {
      tooltipBlock = null;
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
    }
    function onMouseMove(e) {
      const target = e.target;
      const block = target.closest(".time-block");
      if (block && container2.contains(block)) {
        showTooltip(block, e.clientX, e.clientY);
      } else if (tooltipEl) {
        hideTooltip();
      }
    }
    function onMouseLeave() {
      hideTooltip();
    }
    function applyOptions() {
      const maxRealTime = getMaxRealTime(container2);
      const axisOpts = {
        timeMode: state.timeMode,
        targetTime: state.targetTime,
        maxRealTime
      };
      container2.querySelectorAll(".axis-tick").forEach((tick) => {
        const label = tick.querySelector(".tick-label");
        const realTime = Number(tick.dataset.realTime ?? 0);
        if (label) label.textContent = formatAxisTime(realTime, axisOpts);
      });
      const select = container2.querySelector(".time-select");
      if (select && select.value !== state.timeMode)
        select.value = state.timeMode;
      const targetInput = container2.querySelector(".target-time-input");
      if (targetInput && targetInput.value !== state.targetTime) {
        targetInput.value = state.targetTime;
      }
      const targetWrapper = container2.querySelector(
        ".target-time-wrapper"
      );
      if (targetWrapper) {
        targetWrapper.hidden = state.timeMode !== "target";
      }
      const compactInput = container2.querySelector(
        ".compact-toggle-input"
      );
      if (compactInput) compactInput.checked = state.isCompactMode;
      const wrapper = container2.querySelector(".gantt-wrapper");
      if (wrapper) wrapper.classList.toggle("is-compact", state.isCompactMode);
      if (tooltipEl && tooltipBlock) {
        tooltipEl.innerHTML = buildTooltipHTML(tooltipBlock);
      }
    }
    function onChange(e) {
      const target = e.target;
      if (target.matches(".time-select")) {
        state.timeMode = target.value;
        applyOptions();
      } else if (target.matches(".target-time-input")) {
        state.targetTime = target.value;
        applyOptions();
      } else if (target.matches(".compact-toggle-input")) {
        state.isCompactMode = target.checked;
        applyOptions();
      }
    }
    container2.addEventListener("mousemove", onMouseMove);
    container2.addEventListener("mouseleave", onMouseLeave);
    container2.addEventListener("change", onChange);
    applyOptions();
    return {
      getOptions() {
        return { ...state };
      },
      setOptions(opts) {
        Object.assign(state, opts);
        applyOptions();
      },
      dispose() {
        container2.removeEventListener("mousemove", onMouseMove);
        container2.removeEventListener("mouseleave", onMouseLeave);
        container2.removeEventListener("change", onChange);
        hideTooltip();
      }
    };
  }

  // src/gantt-webview-entry.ts
  var container = document.getElementById("content");
  var handle = attachGanttInteractivity(container, {
    timeMode: "forward",
    targetTime: "",
    isCompactMode: false
  });
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.command === "updateContent") {
      const preserved = handle.getOptions();
      container.innerHTML = message.html;
      handle.setOptions(preserved);
    }
  });
})();
