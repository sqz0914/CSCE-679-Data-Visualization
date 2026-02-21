// =========================
// Configuration (no magic numbers)
// =========================
const CONFIG = {
  csvPath: "temperature_daily.csv",
  yearsToShow: 10,

  // Layout
  margin: { top: 64, right: 140, bottom: 18, left: 92 },
  cell: { width: 86, height: 62, gapX: 16, gapY: 18 },
  mini: { pad: 8, stroke: 2 },

  // Temperature domain and color mapping
  tempDomain: [0, 40], // Celsius
  colorInterpolator: d3.interpolateSpectral, // reversed via domain

  // Legend
  legend: { width: 18, height: 240, tickCount: 5 },

  // Labels
  months: [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ],

  // Axis offsets to match the example spacing
  axis: {
    gutter: 5,
    innerPad: 10,
    tickSize: 6,
    xTickPadding: 4,
    yTickPadding: 8
  },

  // Tooltip offset
  tooltipOffset: { x: 12, y: 12 }
};

// =========================
// Utilities
// =========================
const parseDate = d3.timeParse("%Y-%m-%d");
const formatYear = d3.format("d");

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// =========================
// Chart state
// =========================
const state = {
  mode: "max", // background encoding mode
  years: [],
  monthly: [],
  byKey: new Map()
};

// =========================
// DOM scaffolding
// =========================
const root = d3.select("#chart");
const tooltip = root.append("div").attr("class", "tooltip");
const toggleBtn = d3.select("#toggleBtn");

// SVG
const svg = root.append("svg").attr("width", "100%").attr("height", "auto");
const g = svg.append("g");

// Layers
const axesG = g.append("g");
const gridG = g.append("g");
const legendG = g.append("g");

// Toggle via button (no title click)
if (!toggleBtn.empty()) {
  toggleBtn.text("Show MIN");
  toggleBtn.on("click", () => {
    state.mode = state.mode === "max" ? "min" : "max";
    toggleBtn.text(state.mode === "max" ? "Show MIN" : "Show MAX");
    update();
  });
}

// =========================
// Data preparation
// =========================
function prepareData(rows) {
  const records = rows
    .map((d) => {
      const date = parseDate(d.date);
      return {
        date,
        year: date.getFullYear(),
        monthIndex: date.getMonth(), // 0-11
        monthLabel: CONFIG.months[date.getMonth()],
        day: date.getDate(),
        max: +d.max_temperature,
        min: +d.min_temperature
      };
    })
    .filter((d) => d.date && Number.isFinite(d.max) && Number.isFinite(d.min));

  const allYears = Array.from(new Set(records.map((d) => d.year))).sort(d3.ascending);
  state.years = allYears.slice(-CONFIG.yearsToShow);

  const filtered = records.filter((d) => state.years.includes(d.year));
  const grouped = d3.group(filtered, (d) => `${d.year}-${String(d.monthIndex + 1).padStart(2, "0")}`);

  const monthlyCells = [];
  const byKey = new Map();

  for (const year of state.years) {
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      const daily = grouped.get(key) ?? [];
      daily.sort((a, b) => d3.ascending(a.day, b.day));

      const monthMax = daily.length ? d3.max(daily, (d) => d.max) : null;
      const monthMin = daily.length ? d3.min(daily, (d) => d.min) : null;

      const cell = {
        key,
        year,
        monthIndex: m,
        monthLabel: CONFIG.months[m],
        monthKeyLabel: key,
        daily,
        monthMax,
        monthMin
      };

      monthlyCells.push(cell);
      byKey.set(key, cell);
    }
  }

  state.monthly = monthlyCells;
  state.byKey = byKey;
}

// =========================
// Scales
// =========================
function createScales() {
  const { cell } = CONFIG;

  const gridWidth = state.years.length * cell.width + (state.years.length - 1) * cell.gapX;
  const gridHeight = 12 * cell.height + (12 - 1) * cell.gapY;
  const axisX = CONFIG.margin.left + CONFIG.axis.gutter;
  const axisY = CONFIG.margin.top + CONFIG.axis.gutter;

  // grid starts AFTER the axis line plus an inner pad
  const gridLeft = axisX + CONFIG.axis.innerPad;
  const gridTop = axisY + CONFIG.axis.innerPad;

  const width =
    CONFIG.margin.left +
    CONFIG.axis.gutter +
    CONFIG.axis.innerPad +
    gridWidth +
    CONFIG.margin.right;

  const height =
    CONFIG.margin.top +
    CONFIG.axis.gutter +
    CONFIG.axis.innerPad +
    gridHeight +
    CONFIG.margin.bottom;

  svg.attr("viewBox", [0, 0, width, height]);

  // Band positions for cells
  const x = d3
    .scaleBand()
    .domain(state.years.map(String))
    .range([gridLeft, gridLeft + gridWidth]);

  const y = d3
    .scaleBand()
    .domain(CONFIG.months)
    .range([gridTop, gridTop + gridHeight]);

  // Color mapping (reverse so low is blue-ish, high is red-ish)
  const color = d3
    .scaleSequential(CONFIG.colorInterpolator)
    .domain([CONFIG.tempDomain[1], CONFIG.tempDomain[0]]);

  // Mini chart scales
  const miniInnerW = cell.width - CONFIG.mini.pad * 2;
  const miniInnerH = cell.height - CONFIG.mini.pad * 2;

  const miniY = d3
    .scaleLinear()
    .domain(CONFIG.tempDomain)
    .range([miniInnerH, 0]);

  return { x, y, color, width, height, gridWidth, gridHeight, miniInnerW, miniInnerH, miniY };
}

// =========================
// Axes (with visible axis lines and tick marks)
// =========================
function renderAxes(scales) {
  const { x, y } = scales;

  const axisX = CONFIG.margin.left + CONFIG.axis.gutter;
  const axisY = CONFIG.margin.top + CONFIG.axis.gutter;

  const gridLeft = axisX + CONFIG.axis.innerPad;
  const gridTop = axisY + CONFIG.axis.innerPad;

  const xAxis = d3
    .axisTop(x)
    .tickSize(CONFIG.axis.tickSize)
    .tickPadding(CONFIG.axis.xTickPadding)
    .tickSizeOuter(0);

  const yAxis = d3
    .axisLeft(y)
    .tickSize(CONFIG.axis.tickSize)
    .tickPadding(CONFIG.axis.yTickPadding)
    .tickSizeOuter(0);

  const xAxisG = axesG
    .selectAll("g.x-axis")
    .data([null])
    .join("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${axisY})`)
    .call(xAxis);

  const yAxisG = axesG
    .selectAll("g.y-axis")
    .data([null])
    .join("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${axisX},0)`)
    .call(yAxis);

  // Make sure default domain lines are crisp
  xAxisG.select(".domain").attr("stroke", "#000").attr("shape-rendering", "crispEdges");
  yAxisG.select(".domain").attr("stroke", "#000").attr("shape-rendering", "crispEdges");

  // ---- Force axes to "cross" visually by extending the domain lines ----
  const extG = axesG.selectAll("g.axis-extensions").data([null]).join("g").attr("class", "axis-extensions");

  // Extend x-axis domain line leftwards so it reaches the y-axis at axisX
  extG
    .selectAll("line.x-domain-left")
    .data([null])
    .join("line")
    .attr("class", "x-domain-left")
    .attr("x1", axisX)
    .attr("x2", gridLeft)
    .attr("y1", axisY)
    .attr("y2", axisY)
    .attr("stroke", "#000")
    .attr("shape-rendering", "crispEdges");

  // Extend y-axis domain line upward so it reaches the x-axis at axisY
  extG
    .selectAll("line.y-domain-up")
    .data([null])
    .join("line")
    .attr("class", "y-domain-up")
    .attr("x1", axisX)
    .attr("x2", axisX)
    .attr("y1", axisY)
    .attr("y2", gridTop)
    .attr("stroke", "#000")
    .attr("shape-rendering", "crispEdges");
}

// =========================
// Grid + interaction
// =========================
function cellValueForMode(cell) {
  return state.mode === "max" ? cell.monthMax : cell.monthMin;
}

function renderGrid(scales) {
  const { x, y, color, miniInnerW, miniInnerH, miniY } = scales;
  const { cell } = CONFIG;

  // One clipPath per cell
  const defs = svg.selectAll("defs").data([null]).join("defs");
  defs
    .selectAll("clipPath")
    .data(state.monthly, (d) => d.key)
    .join(
      (enter) => {
        const cp = enter.append("clipPath").attr("id", (d) => `clip-${d.key}`);
        cp.append("rect")
          .attr("x", CONFIG.mini.pad)
          .attr("y", CONFIG.mini.pad)
          .attr("width", miniInnerW)
          .attr("height", miniInnerH);
        return cp;
      },
      (update) => update,
      (exit) => exit.remove()
    );

  const cells = gridG
    .selectAll("g.cell")
    .data(state.monthly, (d) => d.key)
    .join("g")
    .attr("class", "cell")
    .attr("transform", (d) => `translate(${x(String(d.year))},${y(d.monthLabel)})`);

  // Background
  cells
    .selectAll("rect.bg")
    .data((d) => [d])
    .join("rect")
    .attr("class", "bg")
    .attr("width", cell.width)
    .attr("height", cell.height)
    .attr("fill", (d) => {
      const v = cellValueForMode(d);
      return v == null ? "#fff" : color(v);
    });

  // Mini lines
  const maxLine = d3
    .line()
    .defined((d) => Number.isFinite(d.max))
    .x((d) => {
      const n = daysInMonth(d.year, d.monthIndex);
      const xMini = d3.scaleLinear().domain([1, n]).range([0, miniInnerW]);
      return CONFIG.mini.pad + xMini(d.day);
    })
    .y((d) => CONFIG.mini.pad + miniY(d.max));

  const minLine = d3
    .line()
    .defined((d) => Number.isFinite(d.min))
    .x((d) => {
      const n = daysInMonth(d.year, d.monthIndex);
      const xMini = d3.scaleLinear().domain([1, n]).range([0, miniInnerW]);
      return CONFIG.mini.pad + xMini(d.day);
    })
    .y((d) => CONFIG.mini.pad + miniY(d.min));

  cells
    .selectAll("path.mini-line-max")
    .data((d) => [d])
    .join("path")
    .attr("class", "mini-line-max")
    .attr("clip-path", (d) => `url(#clip-${d.key})`)
    .attr("d", (d) => (d.daily.length ? maxLine(d.daily) : null));

  cells
    .selectAll("path.mini-line-min")
    .data((d) => [d])
    .join("path")
    .attr("class", "mini-line-min")
    .attr("clip-path", (d) => `url(#clip-${d.key})`)
    .attr("d", (d) => (d.daily.length ? minLine(d.daily) : null));

  // Tooltip
  cells
    .on("mouseenter", (event, d) => {
      if (d.monthMax == null || d.monthMin == null) return;
      tooltip
        .style("opacity", 1)
        .html(`Date: ${d.monthKeyLabel}, max: ${d.monthMax}, min: ${d.monthMin}`);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", `${event.clientX + CONFIG.tooltipOffset.x}px`)
        .style("top", `${event.clientY + CONFIG.tooltipOffset.y}px`);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
}

// =========================
// Legend
// =========================
function renderLegend(scales) {
  const { color, width } = scales;
  const { legend } = CONFIG;

  const x0 = width - CONFIG.margin.right + 12;
  const y0 = CONFIG.margin.top + 8;

  legendG.attr("transform", `translate(${x0},${y0})`);

  const defs = svg.selectAll("defs").data([null]).join("defs");
  const grad = defs
    .selectAll("linearGradient")
    .data([null])
    .join("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "0%")
    .attr("y1", "0%")
    .attr("y2", "100%");

  const stops = d3.range(0, 1.00001, 0.1).map((t) => ({
    t,
    value: CONFIG.tempDomain[0] + t * (CONFIG.tempDomain[1] - CONFIG.tempDomain[0])
  }));

  grad
    .selectAll("stop")
    .data(stops)
    .join("stop")
    .attr("offset", (d) => `${d.t * 100}%`)
    .attr("stop-color", (d) => color(d.value));

  legendG
    .selectAll("rect.legend-bar")
    .data([null])
    .join("rect")
    .attr("class", "legend-bar")
    .attr("width", legend.width)
    .attr("height", legend.height)
    .attr("fill", "url(#legend-gradient)");

  const legendScale = d3.scaleLinear().domain(CONFIG.tempDomain).range([0, legend.height]);

  const labelsG = legendG
    .selectAll("g.legend-labels")
    .data([null])
    .join("g")
    .attr("class", "legend-labels");

  labelsG
    .selectAll("text.legend-label")
    .data([CONFIG.tempDomain[0], CONFIG.tempDomain[1]])
    .join("text")
    .attr("class", "legend-label")
    .attr("x", legend.width + 8)
    .attr("y", (d) => legendScale(d))
    .text((d) => `${d} Celsius`);

  labelsG
    .selectAll("line.legend-tick")
    .data(legendScale.ticks(legend.tickCount))
    .join("line")
    .attr("class", "legend-tick")
    .attr("x1", 0)
    .attr("x2", legend.width)
    .attr("y1", (d) => legendScale(d))
    .attr("y2", (d) => legendScale(d))
    .attr("stroke", "#000")
    .attr("stroke-opacity", 0.12);
}

// =========================
// Main update
// =========================
function update() {
  const scales = createScales();
  renderAxes(scales);
  renderGrid(scales);
  renderLegend(scales);
}

// =========================
// Load and render
// =========================
d3.csv(CONFIG.csvPath).then((rows) => {
  prepareData(rows);
  update();
});