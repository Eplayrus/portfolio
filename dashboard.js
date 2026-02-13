;(() => {
  /**
   * Dashboard (no libs)
   * - Filters (date range, category, search)
   * - Sorting
   * - Pagination
   * - Canvas charts (line & bar)
   * - localStorage settings
   * - Themes (dark/light)
   * - Skeleton loading & empty states
   */

  const LS_KEY = "mini_dashboard_settings_v1";
  const LS_DATA = "mini_dashboard_data_v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    from: $("#from"),
    to: $("#to"),
    cat: $("#cat"),
    q: $("#q"),
    sort: $("#sort"),
    pageSize: $("#pageSize"),
    prev: $("#prev"),
    next: $("#next"),
    pageLabel: $("#pageLabel"),
    countLabel: $("#countLabel"),
    rangePill: $("#rangePill"),
    kpiGrid: $("#kpiGrid"),
    line: $("#lineChart"),
    bar: $("#barChart"),
    chartMeta: $("#chartMeta"),
    tableMeta: $("#tableMeta"),
    tbody: $("#tbody"),
    empty: $("#emptyState"),
    btnEmptyReset: $("#btnEmptyReset"),
    btnReset: $("#btnReset"),
    btnTheme: $("#btnTheme"),
    btnSeed: $("#btnSeed"),
    tableSkeleton: $("#tableSkeleton"),
    tableReal: $("#tableReal"),
    toast: $("#toast"),
    toastTitle: $("#toastTitle"),
    toastBody: $("#toastBody"),
  };

  const CATS = [
    { key: "sales", label: "Продажи" },
    { key: "tasks", label: "Таски" },
    { key: "finance", label: "Финансы" },
    { key: "habits", label: "Привычки" },
  ];

  const DEFAULT_SETTINGS = {
    theme: "auto", // "dark" | "light" | "auto"
    filters: {
      from: "",
      to: "",
      cat: "all",
      q: "",
    },
    sort: "date_desc",
    pageSize: 10,
    page: 1,
  };

  const state = {
    settings: loadSettings(),
    raw: loadOrGenerateData(),
    view: [],
    pageCount: 1,
    isLoading: false,
    toastTimer: null,
  };

  initTheme(state.settings.theme);
  bindUI();
  hydrateForm();
  renderWithSkeleton();

  // -------------------- Data --------------------
  function loadOrGenerateData() {
    const stored = safeJSONParse(localStorage.getItem(LS_DATA));
    if (Array.isArray(stored) && stored.length) return stored;
    const data = generateDemoData();
    localStorage.setItem(LS_DATA, JSON.stringify(data));
    return data;
  }

  function generateDemoData(seed = Date.now()) {
    // deterministic-ish RNG from seed
    let s = seed % 2147483647;
    const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;

    const today = new Date();
    const days = 56;
    const notes = {
      sales: ["Подписка", "Апселл", "Продление", "Новый лид", "Партнёрка"],
      tasks: ["Багфикс", "Дизайн", "Рефактор", "Созвон", "Документация"],
      finance: ["Кэшбэк", "Инвест", "Комиссия", "Проценты", "Покупка"],
      habits: ["Спорт", "Чтение", "Сон", "Медитация", "Шаги"],
    };

    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - i));

      // number of events in a day
      const n = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) {
        const cat = CATS[Math.floor(rnd() * CATS.length)].key;
        let value;

        if (cat === "sales") value = Math.round(200 + rnd() * 1800);
        if (cat === "tasks") value = Math.round(1 + rnd() * 7); // hours or points
        if (cat === "finance") value = Math.round(-200 + rnd() * 900); // could be negative
        if (cat === "habits") value = Math.round(1 + rnd() * 1);

        const noteList = notes[cat];
        const note = noteList[Math.floor(rnd() * noteList.length)];

        out.push({
          id: `${d.toISOString().slice(0, 10)}_${cat}_${j}_${Math.floor(rnd() * 1e6)}`,
          date: d.toISOString().slice(0, 10),
          cat,
          note,
          value: cat === "habits" ? (rnd() > 0.25 ? 1 : 0) : value,
        });
      }
    }
    return out;
  }

  // -------------------- Settings --------------------
  function loadSettings() {
    const raw = safeJSONParse(localStorage.getItem(LS_KEY));
    if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SETTINGS);
    return deepMerge(structuredClone(DEFAULT_SETTINGS), raw);
  }

  function saveSettings(showToast = true) {
    localStorage.setItem(LS_KEY, JSON.stringify(state.settings));
    if (showToast) toast("Сохранено", "Настройки записаны в localStorage.");
  }

  function deepMerge(base, patch) {
    for (const k of Object.keys(patch || {})) {
      if (patch[k] && typeof patch[k] === "object" && !Array.isArray(patch[k])) {
        base[k] = deepMerge(base[k] || {}, patch[k]);
      } else {
        base[k] = patch[k];
      }
    }
    return base;
  }

  function safeJSONParse(v) {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }

  // -------------------- UI Binding --------------------
  function bindUI() {
    const onAnyChange = () => {
      state.settings.filters.from = els.from.value;
      state.settings.filters.to = els.to.value;
      state.settings.filters.cat = els.cat.value;
      state.settings.filters.q = els.q.value.trim();
      state.settings.sort = els.sort.value;
      state.settings.pageSize = Number(els.pageSize.value) || 10;
      state.settings.page = 1;
      saveSettings(false);
      renderWithSkeleton();
    };

    els.from.addEventListener("change", onAnyChange);
    els.to.addEventListener("change", onAnyChange);
    els.cat.addEventListener("change", onAnyChange);
    els.sort.addEventListener("change", onAnyChange);
    els.pageSize.addEventListener("change", onAnyChange);

    // Debounced search
    let t = null;
    els.q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(onAnyChange, 220);
    });

    els.prev.addEventListener("click", () => {
      if (state.settings.page > 1) {
        state.settings.page--;
        saveSettings(false);
        renderWithSkeleton();
      }
    });
    els.next.addEventListener("click", () => {
      if (state.settings.page < state.pageCount) {
        state.settings.page++;
        saveSettings(false);
        renderWithSkeleton();
      }
    });

    els.btnReset.addEventListener("click", () => {
      state.settings.filters = structuredClone(DEFAULT_SETTINGS.filters);
      state.settings.sort = DEFAULT_SETTINGS.sort;
      state.settings.pageSize = DEFAULT_SETTINGS.pageSize;
      state.settings.page = 1;
      saveSettings();
      hydrateForm();
      renderWithSkeleton();
    });

    els.btnEmptyReset.addEventListener("click", () => els.btnReset.click());

    els.btnTheme.addEventListener("click", () => {
      const cur = state.settings.theme;
      const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
      state.settings.theme = next;
      initTheme(next);
      saveSettings();
    });

    els.btnSeed.addEventListener("click", () => {
      const data = generateDemoData();
      state.raw = data;
      localStorage.setItem(LS_DATA, JSON.stringify(data));
      toast("Данные обновлены", "Демо-набор пересоздан.");
      renderWithSkeleton();
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (!e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        els.btnTheme.click();
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        els.btnReset.click();
      }
    });

    // Redraw charts on resize
    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (!state.isLoading) drawCharts();
      }, 150);
    });
  }

  function hydrateForm() {
    const s = state.settings;
    els.from.value = s.filters.from;
    els.to.value = s.filters.to;
    els.cat.value = s.filters.cat;
    els.q.value = s.filters.q;
    els.sort.value = s.sort;
    els.pageSize.value = String(s.pageSize);
  }

  function initTheme(mode) {
    const root = document.documentElement;
    let theme = mode;
    if (mode === "auto") {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = prefersDark ? "dark" : "light";
    }
    root.dataset.theme = theme;
  }

  // -------------------- Render --------------------
  function renderWithSkeleton() {
    // Skeleton loading (fake async)
    state.isLoading = true;
    showLoading(true);

    const delay = 450 + Math.floor(Math.random() * 250);
    window.setTimeout(() => {
      computeView();
      renderKPIs();
      renderTable();
      drawCharts();
      showLoading(false);
      state.isLoading = false;
    }, delay);
  }

  function showLoading(on) {
    // Table skeleton
    els.tableSkeleton.style.display = on ? "block" : "none";
    els.tableReal.style.display = on ? "none" : "block";

    // KPI skeletons
    if (on) {
      els.kpiGrid.innerHTML = "";
      for (let i = 0; i < 4; i++) {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <div class="hd"><h2>&nbsp;</h2><span class="pill">&nbsp;</span></div>
          <div class="bd">
            <div class="kpi">
              <div class="skeleton skeletonBig" style="width: 55%;"></div>
              <div class="skeleton skeletonText" style="width: 80%;"></div>
              <div class="skeleton" style="height:10px; border-radius:999px; margin-top:6px;"></div>
            </div>
          </div>`;
        els.kpiGrid.appendChild(div);
      }
    }

    // Charts placeholder
    if (on) {
      clearCanvas(els.line);
      clearCanvas(els.bar);
    }
  }

  function computeView() {
    const f = state.settings.filters;
    const q = (f.q || "").toLowerCase();

    let arr = state.raw.slice();

    if (f.from) {
      arr = arr.filter((x) => x.date >= f.from);
    }
    if (f.to) {
      arr = arr.filter((x) => x.date <= f.to);
    }
    if (f.cat && f.cat !== "all") {
      arr = arr.filter((x) => x.cat === f.cat);
    }
    if (q) {
      arr = arr.filter((x) => (x.note || "").toLowerCase().includes(q));
    }

    // Sort
    const [key, dir] = state.settings.sort.split("_");
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = key === "date" ? a.date : a.value;
      const bv = key === "date" ? b.date : b.value;
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });

    state.view = arr;
    state.pageCount = Math.max(1, Math.ceil(arr.length / state.settings.pageSize));
    state.settings.page = clamp(state.settings.page, 1, state.pageCount);

    // Meta labels
    const rangeText = formatRangeLabel(f.from, f.to);
    els.rangePill.textContent = `Диапазон: ${rangeText}`;

    const catLabel =
      f.cat === "all" ? "Все" : CATS.find((c) => c.key === f.cat)?.label || f.cat;
    const meta = `${catLabel} • ${rangeText} • ${arr.length} событий`;
    els.chartMeta.textContent = meta;
    els.tableMeta.textContent = meta;
  }

  function renderKPIs() {
    // KPIs computed from filtered view
    const arr = state.view;

    // Revenue: sum of sales values
    const sales = arr.filter((x) => x.cat === "sales");
    const revenue = sum(sales.map((x) => x.value));

    // Tasks completed: count tasks entries
    const tasks = arr.filter((x) => x.cat === "tasks");
    const tasksCount = tasks.length;

    // Finance: net sum of finance values
    const finance = arr.filter((x) => x.cat === "finance");
    const net = sum(finance.map((x) => x.value));

    // Habits: completion rate
    const habits = arr.filter((x) => x.cat === "habits");
    const done = habits.reduce((acc, x) => acc + (x.value ? 1 : 0), 0);
    const rate = habits.length ? done / habits.length : 0;

    // Simple deltas vs previous same-length period (rough)
    const f = state.settings.filters;
    const periodDays = getPeriodDays(f.from, f.to);
    const prevArr = periodDays ? filterByPrevPeriod(state.raw, f, periodDays) : [];
    const prevRevenue = sum(prevArr.filter((x) => x.cat === "sales").map((x) => x.value));
    const prevTasksCount = prevArr.filter((x) => x.cat === "tasks").length;
    const prevNet = sum(prevArr.filter((x) => x.cat === "finance").map((x) => x.value));
    const prevHabits = prevArr.filter((x) => x.cat === "habits");
    const prevRate = prevHabits.length
      ? prevHabits.reduce((acc, x) => acc + (x.value ? 1 : 0), 0) / prevHabits.length
      : 0;

    const kpis = [
      {
        title: "Выручка",
        value: formatMoney(revenue),
        sub: deltaText(revenue, prevRevenue),
        progress: clamp01(prevRevenue ? revenue / Math.max(prevRevenue, 1) : revenue ? 1 : 0.2),
      },
      {
        title: "Таски",
        value: String(tasksCount),
        sub: deltaText(tasksCount, prevTasksCount),
        progress: clamp01(prevTasksCount ? tasksCount / Math.max(prevTasksCount, 1) : tasksCount ? 1 : 0.2),
      },
      {
        title: "Фин. баланс",
        value: formatMoney(net),
        sub: deltaText(net, prevNet),
        progress: clamp01(prevNet ? (net - Math.min(prevNet, 0)) / (Math.abs(prevNet) + 1) : net ? 0.7 : 0.2),
      },
      {
        title: "Привычки",
        value: habits.length ? `${Math.round(rate * 100)}%` : "—",
        sub: habits.length ? deltaText(rate, prevRate, { isPercent: true }) : "нет данных",
        progress: habits.length ? clamp01(rate) : 0.15,
      },
    ];

    els.kpiGrid.innerHTML = "";

    for (const k of kpis) {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="hd">
          <h2>${escapeHTML(k.title)}</h2>
          <span class="pill">в фильтре</span>
        </div>
        <div class="bd">
          <div class="kpi">
            <div class="value">${escapeHTML(k.value)}</div>
            <div class="sub">${k.sub}</div>
            <div class="miniBar" aria-hidden="true"><span style="width:${Math.max(6, Math.round(k.progress * 100))}%;"></span></div>
          </div>
        </div>
      `;
      els.kpiGrid.appendChild(div);
    }
  }

  function renderTable() {
    const arr = state.view;

    if (!arr.length) {
      els.empty.style.display = "flex";
      els.tableReal.style.display = "none";
      return;
    }

    els.empty.style.display = "none";
    els.tableReal.style.display = "block";

    const pageSize = state.settings.pageSize;
    const page = state.settings.page;
    const start = (page - 1) * pageSize;
    const pageItems = arr.slice(start, start + pageSize);

    els.tbody.innerHTML = "";

    for (const it of pageItems) {
      const tr = document.createElement("tr");
      const cat = CATS.find((c) => c.key === it.cat);
      const catLabel = cat ? cat.label : it.cat;
      tr.innerHTML = `
        <td class="muted">${escapeHTML(it.date)}</td>
        <td><span class="tag"><span class="dot ${escapeHTML(it.cat)}"></span>${escapeHTML(catLabel)}</span></td>
        <td>${escapeHTML(it.note)}</td>
        <td style="text-align:right;" class="money">${formatCellValue(it)}</td>
      `;
      els.tbody.appendChild(tr);
    }

    els.pageLabel.textContent = `Стр. ${page} / ${state.pageCount}`;
    els.countLabel.textContent = `Показано ${pageItems.length} из ${arr.length}`;

    els.prev.disabled = page <= 1;
    els.next.disabled = page >= state.pageCount;
    els.prev.style.opacity = els.prev.disabled ? 0.55 : 1;
    els.next.style.opacity = els.next.disabled ? 0.55 : 1;
  }

  // -------------------- Charts --------------------
  function drawCharts() {
    const arr = state.view;
    drawLineChart(els.line, buildSeriesByDate(arr));
    drawBarChart(els.bar, buildTotalsByCategory(arr));
  }

  function buildSeriesByDate(arr) {
    // Aggregate by day: sum by category-weighted value
    // NOTE: tasks/habits are not money, but this is a demo. We normalize with weights.
    const weights = { sales: 1, finance: 1, tasks: 120, habits: 250 };
    const map = new Map();
    for (const x of arr) {
      const w = weights[x.cat] ?? 1;
      const v = x.value * w;
      map.set(x.date, (map.get(x.date) || 0) + v);
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ x: k, y: map.get(k) }));
  }

  function buildTotalsByCategory(arr) {
    const totals = { sales: 0, tasks: 0, finance: 0, habits: 0 };
    for (const x of arr) {
      totals[x.cat] = (totals[x.cat] || 0) + x.value;
    }
    return CATS.map((c) => ({ key: c.key, label: c.label, value: totals[c.key] || 0 }));
  }

  function setupHiDPICanvas(canvas) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(160, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function clearCanvas(canvas) {
    const { ctx, w, h } = setupHiDPICanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    // tiny placeholder line so it doesn't look broken
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--border").trim() ||
      "rgba(255,255,255,.10)";
    ctx.beginPath();
    ctx.moveTo(12, h / 2);
    ctx.lineTo(w - 12, h / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLineChart(canvas, series) {
    const { ctx, w, h } = setupHiDPICanvas(canvas);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 40, r: 14, t: 14, b: 28 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const border = cssVar("--border");
    const muted = cssVar("--muted");
    const accent = cssVar("--accent");

    // Grid
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ih / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + iw, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!series.length) {
      drawNoData(ctx, w, h, "Нет данных для линии");
      return;
    }

    const ys = series.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(1, maxY - minY);

    const xStep = series.length > 1 ? iw / (series.length - 1) : 0;

    const toX = (i) => pad.l + i * xStep;
    const toY = (val) => pad.t + ((maxY - val) / span) * ih;

    // Line
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    series.forEach((p, i) => {
      const x = toX(i);
      const y = toY(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = accent;
    ctx.lineTo(toX(series.length - 1), pad.t + ih);
    ctx.lineTo(toX(0), pad.t + ih);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Points
    ctx.fillStyle = accent;
    for (let i = 0; i < series.length; i++) {
      const x = toX(i);
      const y = toY(series[i].y);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Axis labels (min/max)
    ctx.fillStyle = muted;
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(compactNumber(maxY), 8, pad.t + 12);
    ctx.fillText(compactNumber(minY), 8, pad.t + ih);

    // X labels: first & last date
    const first = series[0].x;
    const last = series[series.length - 1].x;
    ctx.textAlign = "left";
    ctx.fillText(first, pad.l, pad.t + ih + 20);
    ctx.textAlign = "right";
    ctx.fillText(last, pad.l + iw, pad.t + ih + 20);
  }

  function drawBarChart(canvas, bars) {
    const { ctx, w, h } = setupHiDPICanvas(canvas);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 16, r: 16, t: 14, b: 34 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const border = cssVar("--border");
    const muted = cssVar("--muted");
    const accent = cssVar("--accent");

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ih);
    ctx.lineTo(pad.l + iw, pad.t + ih);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (!bars.length || bars.every((b) => b.value === 0)) {
      drawNoData(ctx, w, h, "Нет данных для столбиков");
      return;
    }

    const values = bars.map((b) => b.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const top = Math.max(Math.abs(minV), Math.abs(maxV));
    const span = Math.max(1, top);

    const n = bars.length;
    const gap = 10;
    const bw = Math.max(24, Math.floor((iw - gap * (n - 1)) / n));
    const totalW = bw * n + gap * (n - 1);
    const startX = pad.l + Math.max(0, Math.floor((iw - totalW) / 2));

    // Baseline for negative values
    const zeroY = pad.t + ih * (maxV / (maxV - minV || 1));

    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const x = startX + i * (bw + gap);
      const v = b.value;
      const barH = (Math.abs(v) / span) * (ih * 0.92);
      const y = v >= 0 ? zeroY - barH : zeroY;

      // color by category (simple)
      ctx.fillStyle = categoryColor(b.key) || accent;
      ctx.globalAlpha = 0.85;
      roundRect(ctx, x, y, bw, barH, 10);
      ctx.fill();
      ctx.globalAlpha = 1;

      // label
      ctx.fillStyle = muted;
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x + bw / 2, pad.t + ih + 22);
    }

    // Zero line
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(pad.l, zeroY);
    ctx.lineTo(pad.l + iw, zeroY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawNoData(ctx, w, h, text) {
    ctx.fillStyle = cssVar("--muted");
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, h / 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function categoryColor(cat) {
    const styles = getComputedStyle(document.documentElement);
    if (cat === "sales") return styles.getPropertyValue("--accent").trim();
    if (cat === "tasks") return styles.getPropertyValue("--warning").trim();
    if (cat === "finance") return styles.getPropertyValue("--accent2").trim();
    if (cat === "habits") return "#38bdf8";
    return styles.getPropertyValue("--accent").trim();
  }

  // -------------------- Helpers --------------------
  function sum(arr) {
    return arr.reduce((a, b) => a + (Number(b) || 0), 0);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function clamp01(v) {
    return clamp(v, 0, 1);
  }

  function formatMoney(n) {
    const sign = n < 0 ? "−" : "";
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString("ru-RU");
    return `${sign}${formatted} ₽`;
  }

  function formatCellValue(it) {
    if (it.cat === "tasks") return `${it.value} пт.`;
    if (it.cat === "habits") return it.value ? "✓" : "—";
    return formatMoney(it.value);
  }

  function compactNumber(n) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatRangeLabel(from, to) {
    if (!from && !to) return "всё время";
    if (from && !to) return `с ${from}`;
    if (!from && to) return `по ${to}`;
    return `${from} → ${to}`;
  }

  function deltaText(cur, prev, opts = {}) {
    const isPercent = !!opts.isPercent;
    if (prev === 0 && cur === 0) return `<span class="delta">0</span> vs прошлый период`;
    if (prev === 0 && cur !== 0) return `<span class="delta up">+∞</span> vs прошлый период`;

    const diff = cur - prev;
    const pct = prev ? diff / Math.abs(prev) : 0;

    const sign = diff >= 0 ? "+" : "";
    const cls = diff >= 0 ? "up" : "down";

    let main;
    if (isPercent) {
      main = `${sign}${Math.round(pct * 100)}%`;
    } else {
      main = `${sign}${Math.round(pct * 100)}%`;
    }

    return `<span class="delta ${cls}">${main}</span> vs прошлый период`;
  }

  function getPeriodDays(from, to) {
    // Only if both set
    if (!from || !to) return null;
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    const days = Math.round((b - a) / 86400000) + 1;
    return days > 0 ? days : null;
  }

  function filterByPrevPeriod(all, filters, periodDays) {
    // previous period directly preceding current 'from'
    if (!filters.from) return [];
    const from = new Date(filters.from);
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - periodDays);

    const a = prevFrom.toISOString().slice(0, 10);
    const b = prevTo.toISOString().slice(0, 10);

    let arr = all.filter((x) => x.date >= a && x.date <= b);
    if (filters.cat && filters.cat !== "all") arr = arr.filter((x) => x.cat === filters.cat);
    if (filters.q)
      arr = arr.filter((x) => (x.note || "").toLowerCase().includes(filters.q.toLowerCase()));
    return arr;
  }

  // -------------------- Toast --------------------
  function toast(title, body) {
    els.toastTitle.textContent = title;
    els.toastBody.textContent = body;
    els.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1600);
  }
})();
