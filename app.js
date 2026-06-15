const DAYS_PER_MONTH = 30.4375;
const MAX_MONTHS = 1200;
const STORAGE_KEY = "fire-countdown-inputs";

const scenarioMeta = {
  optimistic: { label: "楽観", color: "#23b083" },
  standard: { label: "標準", color: "#147f72" },
  pessimistic: { label: "悲観", color: "#ef6a4d" },
};

const fields = {
  currentAssets: document.querySelector("#current-assets"),
  monthlyContribution: document.querySelector("#monthly-contribution"),
  extraInvestment: document.querySelector("#extra-investment"),
  targetAssets: document.querySelector("#target-assets"),
  standardRate: document.querySelector("#standard-rate"),
  optimisticRate: document.querySelector("#optimistic-rate"),
  pessimisticRate: document.querySelector("#pessimistic-rate"),
};

const moneyFields = [
  fields.currentAssets,
  fields.monthlyContribution,
  fields.extraInvestment,
  fields.targetAssets,
];

const fieldEntries = Object.entries(fields);

const output = {
  validationPanel: document.querySelector("#validation-panel"),
  targetDate: document.querySelector("#target-date"),
  targetDateNote: document.querySelector("#target-date-note"),
  remainingPeriod: document.querySelector("#remaining-period"),
  daysSavedLabel: document.querySelector("#days-saved-label"),
  daysSaved: document.querySelector("#days-saved"),
  scenarioBody: document.querySelector("#scenario-body"),
  scenarioLegend: document.querySelector("#scenario-legend"),
  stackedChart: document.querySelector("#stacked-chart"),
  stackedChartDetail: document.querySelector("#stacked-chart-detail"),
  scenarioChart: document.querySelector("#scenario-chart"),
};

function readNumber(input) {
  if (input.value.trim() === "") {
    return null;
  }

  const value = Number(input.value.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function formatMoneyInput(input) {
  const digits = input.value.replace(/[^\d]/g, "");
  input.value = digits === "" ? "" : new Intl.NumberFormat("ja-JP").format(Number(digits));
}

function readInputs() {
  return {
    currentAssets: Math.max(0, readNumber(fields.currentAssets) ?? 0),
    monthlyContribution: Math.max(0, readNumber(fields.monthlyContribution) ?? 0),
    extraInvestment: Math.max(0, readNumber(fields.extraInvestment) ?? 0),
    targetAssets: Math.max(0, readNumber(fields.targetAssets) ?? 0),
    standardRate: readNumber(fields.standardRate) ?? 0,
    optimisticRate: readNumber(fields.optimisticRate),
    pessimisticRate: readNumber(fields.pessimisticRate),
  };
}

function validateInputs(inputs) {
  const messages = [];

  if (inputs.targetAssets <= inputs.currentAssets) {
    messages.push({
      type: "error",
      text: "目標資産額は現在資産額より大きくしてください。",
    });
  }

  if (inputs.monthlyContribution === 0) {
    messages.push({
      type: "warning",
      text: "毎月追加投資額が0円です。利回りだけで到達する前提になります。",
    });
  }

  [
    ["標準シナリオ年利", inputs.standardRate],
    ["楽観シナリオ年利", inputs.optimisticRate],
    ["悲観シナリオ年利", inputs.pessimisticRate],
  ].forEach(([label, rate]) => {
    if (rate !== null && rate <= -100) {
      messages.push({
        type: "error",
        text: `${label}は-100%より大きい値にしてください。`,
      });
    }
  });

  if (inputs.optimisticRate !== null && inputs.optimisticRate < inputs.standardRate) {
    messages.push({
      type: "warning",
      text: "楽観シナリオ年利は標準シナリオ以上にすると比較しやすくなります。",
    });
  }

  if (inputs.pessimisticRate !== null && inputs.pessimisticRate > inputs.standardRate) {
    messages.push({
      type: "warning",
      text: "悲観シナリオ年利は標準シナリオ以下にすると比較しやすくなります。",
    });
  }

  return messages;
}

function updateValidationPanel(messages) {
  output.validationPanel.hidden = messages.length === 0;
  output.validationPanel.replaceChildren(
    ...messages.map((message) => {
      const item = document.createElement("p");
      item.className = `validation-message ${message.type}`;
      item.textContent = message.text;
      return item;
    }),
  );
}

function interpolateAchievementDays(previousAssets, currentAssets, targetAssets, month) {
  const monthlyGain = currentAssets - previousAssets;
  if (monthlyGain <= 0) {
    return month * DAYS_PER_MONTH;
  }

  const monthProgress = (targetAssets - previousAssets) / monthlyGain;
  const clampedProgress = Math.min(1, Math.max(0, monthProgress));
  return (month - 1 + clampedProgress) * DAYS_PER_MONTH;
}

function simulate({ currentAssets, monthlyContribution, targetAssets, annualRate }) {
  let assets = currentAssets;
  let principal = currentAssets;
  const monthlyRate = annualRate / 100 / 12;
  const history = [{ month: 0, assets, principal, gain: Math.max(0, assets - principal) }];

  if (targetAssets <= 0 || currentAssets >= targetAssets) {
    return {
      reached: true,
      months: 0,
      days: 0,
      finalAssets: assets,
      principal,
      gain: assets - principal,
      history,
    };
  }

  if (monthlyContribution <= 0 && monthlyRate <= 0) {
    return {
      reached: false,
      months: null,
      days: null,
      finalAssets: assets,
      principal,
      gain: assets - principal,
      history,
    };
  }

  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    const previousAssets = assets;
    assets = assets * (1 + monthlyRate) + monthlyContribution;
    principal += monthlyContribution;
    history.push({
      month,
      assets,
      principal,
      gain: assets - principal,
    });

    if (assets >= targetAssets) {
      const days = interpolateAchievementDays(previousAssets, assets, targetAssets, month);
      return {
        reached: true,
        months: month,
        days,
        finalAssets: assets,
        principal,
        gain: assets - principal,
        history,
      };
    }
  }

  return {
    reached: false,
    months: null,
    days: null,
    finalAssets: assets,
    principal,
    gain: assets - principal,
    history,
  };
}

function buildScenarios(inputs) {
  const base = {
    currentAssets: inputs.currentAssets,
    monthlyContribution: inputs.monthlyContribution,
    targetAssets: inputs.targetAssets,
  };

  const scenarios = [];

  if (inputs.optimisticRate !== null) {
    scenarios.push({
      key: "optimistic",
      rate: inputs.optimisticRate,
      result: simulate({ ...base, annualRate: inputs.optimisticRate }),
    });
  }

  scenarios.push({
    key: "standard",
    rate: inputs.standardRate,
    result: simulate({ ...base, annualRate: inputs.standardRate }),
  });

  if (inputs.pessimisticRate !== null) {
    scenarios.push({
      key: "pessimistic",
      rate: inputs.pessimisticRate,
      result: simulate({ ...base, annualRate: inputs.pessimisticRate }),
    });
  }

  return scenarios;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.round(days));
  return next;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatRate(value) {
  return `${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatShortMoney(value) {
  const rounded = Math.round(value);
  if (rounded >= 10000 && rounded % 10000 === 0) {
    return `${new Intl.NumberFormat("ja-JP").format(rounded / 10000)}万円`;
  }
  return `${new Intl.NumberFormat("ja-JP").format(rounded)}円`;
}

function formatPeriod(days) {
  if (days === null) {
    return "到達見込みなし";
  }

  const totalDays = Math.max(0, Math.round(days));
  const years = Math.floor(totalDays / 365);
  const afterYears = totalDays - years * 365;
  const months = Math.floor(afterYears / DAYS_PER_MONTH);
  const remainingDays = Math.round(afterYears - months * DAYS_PER_MONTH);

  if (totalDays === 0) {
    return "達成済み";
  }

  const parts = [];
  if (years > 0) {
    parts.push(`${years}年`);
  }
  if (months > 0) {
    parts.push(`${months}か月`);
  }
  if (remainingDays > 0 || parts.length === 0) {
    parts.push(`${remainingDays}日`);
  }
  return parts.join("");
}

function formatDaysSaved(days) {
  const savedDays = Math.max(0, days);
  if (savedDays > 0 && savedDays < 1) {
    return "1日未満";
  }
  return `${Math.round(savedDays)}日`;
}

function getAchievementDate(result) {
  if (!result.reached) {
    return null;
  }
  return addDays(new Date(), result.days);
}

function updateMainResults(inputs, standardResult) {
  const date = getAchievementDate(standardResult);

  if (standardResult.reached) {
    output.targetDate.textContent = formatDate(date);
    output.targetDateNote.textContent =
      standardResult.months === 0 ? "目標資産額に到達済み" : "標準シナリオ";
    output.remainingPeriod.textContent = formatPeriod(standardResult.days);
  } else {
    output.targetDate.textContent = "到達見込みなし";
    output.targetDateNote.textContent = "条件を変更すると再計算されます";
    output.remainingPeriod.textContent = "到達見込みなし";
  }

  const boosted = simulate({
    currentAssets: inputs.currentAssets + inputs.extraInvestment,
    monthlyContribution: inputs.monthlyContribution,
    targetAssets: inputs.targetAssets,
    annualRate: inputs.standardRate,
  });

  output.daysSavedLabel.textContent =
    inputs.extraInvestment > 0 ? `${formatShortMoney(inputs.extraInvestment)}短縮効果` : "追加投資短縮効果";

  if (!standardResult.reached && !boosted.reached) {
    output.daysSaved.textContent = "算出不可";
  } else if (standardResult.months === 0) {
    output.daysSaved.textContent = "達成済み";
  } else if (!standardResult.reached && boosted.reached) {
    output.daysSaved.textContent = "到達可能に改善";
  } else {
    output.daysSaved.textContent = formatDaysSaved(standardResult.days - boosted.days);
  }
}

function updateScenarioTable(scenarios) {
  output.scenarioBody.innerHTML = scenarios
    .map(({ key, rate, result }) => {
      const meta = scenarioMeta[key];
      const date = getAchievementDate(result);
      const dateLabel = date ? formatDate(date) : "到達見込みなし";
      return `
        <tr>
          <td>
            <span class="scenario-name">
              <span class="dot" style="--dot-color: ${meta.color}"></span>
              ${meta.label}
            </span>
          </td>
          <td data-label="年利">${formatRate(rate)}</td>
          <td data-label="達成予定日">${dateLabel}</td>
          <td data-label="残り期間">${formatPeriod(result.days)}</td>
        </tr>
      `;
    })
    .join("");
}

function yearlyPoints(history) {
  if (history.length === 0) {
    return [];
  }

  const points = history.filter((point) => point.month % 12 === 0);
  const last = history[history.length - 1];
  if (points[points.length - 1] !== last) {
    points.push(last);
  }
  return points;
}

function clearSvg(svg) {
  svg.replaceChildren();
}

function setViewBox(svg, width, height) {
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
}

function createSvgElement(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function addText(svg, text, attrs) {
  const node = createSvgElement("text", attrs);
  node.textContent = text;
  svg.append(node);
}

function drawGrid(svg, plot, maxValue) {
  const lines = 4;
  for (let index = 0; index <= lines; index += 1) {
    const ratio = index / lines;
    const y = plot.bottom - plot.height * ratio;
    svg.append(
      createSvgElement("line", {
        x1: plot.left,
        y1: y,
        x2: plot.right,
        y2: y,
        stroke: "#dbe2dc",
        "stroke-width": "1",
      }),
    );
    addText(svg, compactMoney(maxValue * ratio), {
      x: plot.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "axis-label",
    });
  }
}

function compactMoney(value) {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}億`;
  }
  if (value >= 10000) {
    return `${Math.round(value / 10000).toLocaleString("ja-JP")}万`;
  }
  return `${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatChartPointLabel(point) {
  if (point.month === 0) {
    return "現在";
  }
  return `${Math.round(point.month / 12)}年後`;
}

function showStackedChartDetail(point) {
  output.stackedChartDetail.hidden = false;
  output.stackedChartDetail.innerHTML = `
    <div>
      <span>時点</span>
      <strong>${formatChartPointLabel(point)}</strong>
    </div>
    <div>
      <span>元本</span>
      <strong>${formatMoney(point.principal)}</strong>
    </div>
    <div>
      <span>運用益</span>
      <strong>${formatMoney(point.gain)}</strong>
    </div>
    <div>
      <span>総資産</span>
      <strong>${formatMoney(point.assets)}</strong>
    </div>
  `;
}

function drawStackedChart(result) {
  const svg = output.stackedChart;
  clearSvg(svg);
  setViewBox(svg, 720, 320);
  output.stackedChartDetail.hidden = true;

  if (!result.history.length) {
    return;
  }

  const data = yearlyPoints(result.history).slice(0, 28);
  const plot = { left: 68, right: 694, top: 26, bottom: 270 };
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;
  const maxValue = Math.max(...data.map((point) => Math.max(point.assets, point.principal)), 1);
  const barGap = 8;
  const barWidth = Math.max(10, plot.width / data.length - barGap);

  drawGrid(svg, plot, maxValue);

  data.forEach((point, index) => {
    const x = plot.left + index * (plot.width / data.length) + barGap / 2;
    const principalHeight = (Math.max(0, point.principal) / maxValue) * plot.height;
    const gainHeight = (Math.max(0, point.gain) / maxValue) * plot.height;
    const principalY = plot.bottom - principalHeight;
    const gainY = principalY - gainHeight;
    const barTop = Math.min(principalY, gainY);
    const barHeight = Math.max(8, plot.bottom - barTop);

    svg.append(
      createSvgElement("rect", {
        x,
        y: principalY,
        width: barWidth,
        height: principalHeight,
        rx: 3,
        fill: scenarioMeta.standard.color,
      }),
    );
    svg.append(
      createSvgElement("rect", {
        x,
        y: gainY,
        width: barWidth,
        height: gainHeight,
        rx: 3,
        fill: scenarioMeta.pessimistic.color,
      }),
    );

    const selection = createSvgElement("rect", {
      x: x - 3,
      y: barTop - 3,
      width: barWidth + 6,
      height: barHeight + 6,
      rx: 5,
      fill: "none",
      stroke: "#17211f",
      "stroke-width": "2",
      opacity: "0",
      class: "stacked-bar-selection",
    });
    svg.append(selection);

    const activate = () => {
      svg.querySelectorAll(".stacked-bar-selection").forEach((node) => {
        node.setAttribute("opacity", "0");
      });
      selection.setAttribute("opacity", "1");
      showStackedChartDetail(point);
    };

    const hitArea = createSvgElement("rect", {
      x: x - barGap / 2,
      y: plot.top,
      width: barWidth + barGap,
      height: plot.height,
      fill: "transparent",
      tabindex: "0",
      role: "button",
      "aria-label": `${formatChartPointLabel(point)} 元本 ${formatMoney(point.principal)} 運用益 ${formatMoney(point.gain)}`,
      class: "stacked-bar-hit-area",
    });
    hitArea.addEventListener("pointerdown", activate);
    hitArea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    svg.append(hitArea);

    if (index === 0 || index === data.length - 1 || point.month % 60 === 0) {
      addText(svg, `${Math.round(point.month / 12)}年`, {
        x: x + barWidth / 2,
        y: 296,
        "text-anchor": "middle",
        class: "axis-label",
      });
    }
  });
}

function linePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function formatAchievementMonthLabel(days) {
  if (days === 0) {
    return "達成済み";
  }

  const totalMonths = Math.max(0, Math.round(days / DAYS_PER_MONTH));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];

  if (years > 0) {
    parts.push(`${years}年`);
  }
  if (months > 0 || parts.length === 0) {
    parts.push(`${months}か月`);
  }

  return `${parts.join("")}後`;
}

function drawScenarioChart(scenarios, targetAssets) {
  const svg = output.scenarioChart;
  clearSvg(svg);
  setViewBox(svg, 720, 370);

  const histories = scenarios.map((scenario) => ({
    ...scenario,
    points: yearlyPoints(scenario.result.history),
  }));
  const allPoints = histories.flatMap((scenario) => scenario.points);

  if (!allPoints.length) {
    return;
  }

  const plot = { left: 68, right: 694, top: 26, bottom: 258 };
  const axisLabelY = 284;
  const achievementLabelStartY = 312;
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;
  const maxMonth = Math.max(...allPoints.map((point) => point.month), 1);
  const maxValue = Math.max(...allPoints.map((point) => point.assets), targetAssets, 1);

  drawGrid(svg, plot, maxValue);

  const targetY = plot.bottom - (targetAssets / maxValue) * plot.height;
  svg.append(
    createSvgElement("line", {
      x1: plot.left,
      y1: targetY,
      x2: plot.right,
      y2: targetY,
      stroke: "#c9911d",
      "stroke-width": "2",
      "stroke-dasharray": "7 7",
    }),
  );
  addText(svg, "目標資産", {
    x: plot.right,
    y: targetY - 8,
    "text-anchor": "end",
    class: "axis-label",
  });

  histories.forEach(({ key, points }) => {
    const coords = points.map((point) => ({
      x: plot.left + (point.month / maxMonth) * plot.width,
      y: plot.bottom - (point.assets / maxValue) * plot.height,
    }));

    svg.append(
      createSvgElement("path", {
        d: linePath(coords),
        fill: "none",
        stroke: scenarioMeta[key].color,
        "stroke-width": "4",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    );
  });

  histories
    .filter(({ result }) => result.reached)
    .forEach(({ key, result }, index) => {
      const meta = scenarioMeta[key];
      const achievementMonth = result.days / DAYS_PER_MONTH;
      const x = plot.left + (achievementMonth / maxMonth) * plot.width;
      const labelX = Math.min(plot.right - 4, Math.max(plot.left + 4, x));
      const labelY = achievementLabelStartY + index * 16;
      const textAnchor = labelX > plot.right - 80 ? "end" : labelX < plot.left + 80 ? "start" : "middle";

      svg.append(
        createSvgElement("line", {
          x1: x,
          y1: plot.top,
          x2: x,
          y2: labelY - 10,
          stroke: meta.color,
          "stroke-width": "2",
          "stroke-dasharray": "5 7",
          opacity: "0.72",
          class: "achievement-line",
        }),
      );

      addText(svg, formatAchievementMonthLabel(result.days), {
        x: labelX,
        y: labelY,
        "text-anchor": textAnchor,
        fill: meta.color,
        class: "achievement-axis-label",
      });
    });

  [0, Math.round(maxMonth / 2), maxMonth].forEach((month, index) => {
    const x = plot.left + (month / maxMonth) * plot.width;
    addText(svg, `${Math.round(month / 12)}年`, {
      x,
      y: axisLabelY,
      "text-anchor": index === 0 ? "start" : index === 2 ? "end" : "middle",
      class: "axis-label",
    });
  });
}

function updateScenarioLegend(scenarios) {
  const scenarioItems = scenarios
    .map(({ key }) => {
      const meta = scenarioMeta[key];
      return `<span><i class="swatch" style="--swatch-color: ${meta.color}"></i>${meta.label}</span>`;
    })
    .join("");

  output.scenarioLegend.innerHTML = `${scenarioItems}<span><i class="swatch" style="--swatch-color: #c9911d"></i>目標資産</span>`;
}

function render() {
  const inputs = readInputs();
  updateValidationPanel(validateInputs(inputs));
  const scenarios = buildScenarios(inputs);
  const standard = scenarios.find((scenario) => scenario.key === "standard");

  updateMainResults(inputs, standard.result);
  updateScenarioTable(scenarios);
  updateScenarioLegend(scenarios);
  drawStackedChart(standard.result);
  drawScenarioChart(scenarios, inputs.targetAssets);
}

function restoreSavedInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return;
    }

    fieldEntries.forEach(([key, field]) => {
      if (typeof saved[key] === "string") {
        field.value = saved[key];
      }
    });
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
}

function saveInputs() {
  try {
    const values = Object.fromEntries(
      fieldEntries.map(([key, field]) => [key, field.value]),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage may be unavailable in private browsing or restricted webviews.
  }
}

restoreSavedInputs();

Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    if (moneyFields.includes(field)) {
      formatMoneyInput(field);
    }
    saveInputs();
    render();
  });
});

moneyFields.forEach(formatMoneyInput);
saveInputs();
render();
