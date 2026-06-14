const DAYS_PER_MONTH = 30.4375;
const MAX_MONTHS = 1200;
const EXTRA_INVESTMENT = 10000;

const scenarioMeta = {
  optimistic: { label: "楽観", color: "#23b083" },
  standard: { label: "標準", color: "#147f72" },
  pessimistic: { label: "悲観", color: "#ef6a4d" },
};

const fields = {
  currentAssets: document.querySelector("#current-assets"),
  monthlyContribution: document.querySelector("#monthly-contribution"),
  targetAssets: document.querySelector("#target-assets"),
  standardRate: document.querySelector("#standard-rate"),
  optimisticRate: document.querySelector("#optimistic-rate"),
  pessimisticRate: document.querySelector("#pessimistic-rate"),
};

const output = {
  targetDate: document.querySelector("#target-date"),
  targetDateNote: document.querySelector("#target-date-note"),
  remainingPeriod: document.querySelector("#remaining-period"),
  daysSaved: document.querySelector("#days-saved"),
  finalAssets: document.querySelector("#final-assets"),
  totalPrincipal: document.querySelector("#total-principal"),
  investmentGain: document.querySelector("#investment-gain"),
  scenarioBody: document.querySelector("#scenario-body"),
  scenarioLegend: document.querySelector("#scenario-legend"),
  stackedChart: document.querySelector("#stacked-chart"),
  scenarioChart: document.querySelector("#scenario-chart"),
};

function readNumber(input) {
  if (input.value.trim() === "") {
    return null;
  }

  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function readInputs() {
  return {
    currentAssets: Math.max(0, readNumber(fields.currentAssets) ?? 0),
    monthlyContribution: Math.max(0, readNumber(fields.monthlyContribution) ?? 0),
    targetAssets: Math.max(0, readNumber(fields.targetAssets) ?? 0),
    standardRate: readNumber(fields.standardRate) ?? 0,
    optimisticRate: readNumber(fields.optimisticRate),
    pessimisticRate: readNumber(fields.pessimisticRate),
  };
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
    assets = assets * (1 + monthlyRate) + monthlyContribution;
    principal += monthlyContribution;
    history.push({
      month,
      assets,
      principal,
      gain: assets - principal,
    });

    if (assets >= targetAssets) {
      return {
        reached: true,
        months: month,
        days: month * DAYS_PER_MONTH,
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
      standardResult.months === 0 ? "目標資産額に到達済み" : "標準シナリオで算出";
    output.remainingPeriod.textContent = formatPeriod(standardResult.days);
  } else {
    output.targetDate.textContent = "到達見込みなし";
    output.targetDateNote.textContent = "条件を変更すると再計算されます";
    output.remainingPeriod.textContent = "到達見込みなし";
  }

  const boosted = simulate({
    currentAssets: inputs.currentAssets + EXTRA_INVESTMENT,
    monthlyContribution: inputs.monthlyContribution,
    targetAssets: inputs.targetAssets,
    annualRate: inputs.standardRate,
  });

  if (!standardResult.reached && !boosted.reached) {
    output.daysSaved.textContent = "算出不可";
  } else if (standardResult.months === 0) {
    output.daysSaved.textContent = "達成済み";
  } else if (!standardResult.reached && boosted.reached) {
    output.daysSaved.textContent = "到達可能に改善";
  } else {
    const saved = Math.max(0, Math.round(standardResult.days - boosted.days));
    output.daysSaved.textContent = `${saved}日`;
  }

  output.finalAssets.textContent = standardResult.reached
    ? formatMoney(standardResult.finalAssets)
    : "到達見込みなし";
  output.totalPrincipal.textContent = formatMoney(standardResult.principal);
  output.investmentGain.textContent = formatMoney(standardResult.gain);
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

function drawStackedChart(result) {
  const svg = output.stackedChart;
  clearSvg(svg);
  setViewBox(svg, 720, 320);

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

function drawScenarioChart(scenarios, targetAssets) {
  const svg = output.scenarioChart;
  clearSvg(svg);
  setViewBox(svg, 720, 320);

  const histories = scenarios.map((scenario) => ({
    ...scenario,
    points: yearlyPoints(scenario.result.history).slice(0, 28),
  }));
  const allPoints = histories.flatMap((scenario) => scenario.points);

  if (!allPoints.length) {
    return;
  }

  const plot = { left: 68, right: 694, top: 26, bottom: 270 };
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

  [0, Math.round(maxMonth / 2), maxMonth].forEach((month, index) => {
    const x = plot.left + (month / maxMonth) * plot.width;
    addText(svg, `${Math.round(month / 12)}年`, {
      x,
      y: 296,
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
  const scenarios = buildScenarios(inputs);
  const standard = scenarios.find((scenario) => scenario.key === "standard");

  updateMainResults(inputs, standard.result);
  updateScenarioTable(scenarios);
  updateScenarioLegend(scenarios);
  drawStackedChart(standard.result);
  drawScenarioChart(scenarios, inputs.targetAssets);
}

Object.values(fields).forEach((field) => {
  field.addEventListener("input", render);
});

render();
