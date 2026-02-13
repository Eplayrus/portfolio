;(() => {
  // Mini-Figma (no libs)
  // - Add rect/text
  // - Drag & resize with handles
  // - Snap to grid + basic guides snapping (edges/centers)
  // - Undo/redo via snapshot history
  // - Export layout JSON

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const els = {
    canvas: $("#canvas"),
    guideX: $("#guideX"),
    guideY: $("#guideY"),

    addRect: $("#addRect"),
    addText: $("#addText"),

    snap: $("#snap"),
    grid: $("#grid"),
    guides: $("#guides"),

    undo: $("#undo"),
    redo: $("#redo"),
    dup: $("#dup"),
    del: $("#del"),

    exportBtn: $("#export"),
    clear: $("#clear"),

    propsEmpty: $("#propsEmpty"),
    props: $("#props"),
    px: $("#px"),
    py: $("#py"),
    pw: $("#pw"),
    ph: $("#ph"),
    pfill: $("#pfill"),
    ptext: $("#ptext"),
    propsMeta: $("#propsMeta"),

    modal: $("#modal"),
    exportBox: $("#exportBox"),
    closeModal: $("#closeModal"),
    copy: $("#copy"),
    saveFile: $("#saveFile"),

    theme: $("#theme"),
    zoom: $("#zoom"),
    zoomLabel: $("#zoomLabel"),

    docMeta: $("#docMeta"),

    toast: $("#toast"),
    toastTitle: $("#toastTitle"),
    toastBody: $("#toastBody"),
  };

  const CATS = {
    rect: { minW: 40, minH: 30 },
    text: { minW: 60, minH: 34 },
  };

  const state = {
    theme: "auto",
    zoom: 1,

    snap: true,
    grid: 10,
    guides: true,

    items: [],
    selectedId: null,

    history: [],
    hIndex: -1,

    drag: null, // {type:'move'|'resize', id, start, base, handle}
    toastTimer: null,
  };

  init();

  function init() {
    // defaults
    els.snap.checked = state.snap;
    els.guides.checked = state.guides;
    els.grid.value = String(state.grid);

    applyTheme("auto");
    applyZoom(1);

    bindUI();
    seedDemo();
  }

  function seedDemo() {
    state.items = [
      makeRect(120, 90, 220, 140, "#7c5cff"),
      makeRect(410, 130, 260, 110, "#22c55e"),
      makeText(230, 290, 320, 90, "Двойной клик по тексту\nчтобы редактировать"),
    ];
    commit("seed", true);
    select(state.items[0].id);
    toast("Готово", "Демо-элементы добавлены.");
  }

  // ---------------------- Models ----------------------
  function uid() {
    return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function makeRect(x, y, w, h, fill = "#7c5cff") {
    return {
      id: uid(),
      type: "rect",
      x, y, w, h,
      fill,
      text: "",
    };
  }

  function makeText(x, y, w, h, text = "Текст") {
    return {
      id: uid(),
      type: "text",
      x, y, w, h,
      fill: "#7c5cff",
      text,
    };
  }

  function cloneDoc() {
    return {
      theme: state.theme,
      zoom: state.zoom,
      snap: state.snap,
      grid: state.grid,
      guides: state.guides,
      items: structuredClone(state.items),
      selectedId: state.selectedId,
    };
  }

  function restoreDoc(doc) {
    state.theme = doc.theme;
    state.zoom = doc.zoom;
    state.snap = doc.snap;
    state.grid = doc.grid;
    state.guides = doc.guides;
    state.items = structuredClone(doc.items || []);
    state.selectedId = doc.selectedId || null;

    els.snap.checked = state.snap;
    els.guides.checked = state.guides;
    els.grid.value = String(state.grid);

    applyTheme(state.theme);
    applyZoom(state.zoom);

    render();
    updateProps();
    updateMeta();
  }

  // ---------------------- History ----------------------
  function commit(reason = "", replace = false) {
    const snap = cloneDoc();

    // Drop redo branch if we commit after undo
    if (state.hIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.hIndex + 1);
    }

    if (replace && state.history.length) {
      state.history[state.history.length - 1] = snap;
      state.hIndex = state.history.length - 1;
    } else {
      state.history.push(snap);
      state.hIndex = state.history.length - 1;
    }

    updateHistoryButtons();
    updateMeta(reason);
  }

  function undo() {
    if (state.hIndex <= 0) return;
    state.hIndex--;
    restoreDoc(state.history[state.hIndex]);
    updateHistoryButtons();
    toast("Undo", "Шаг назад.");
  }

  function redo() {
    if (state.hIndex >= state.history.length - 1) return;
    state.hIndex++;
    restoreDoc(state.history[state.hIndex]);
    updateHistoryButtons();
    toast("Redo", "Шаг вперёд.");
  }

  function updateHistoryButtons() {
    els.undo.disabled = state.hIndex <= 0;
    els.redo.disabled = state.hIndex >= state.history.length - 1;
    els.undo.style.opacity = els.undo.disabled ? 0.55 : 1;
    els.redo.style.opacity = els.redo.disabled ? 0.55 : 1;
  }

  // ---------------------- Rendering ----------------------
  function render() {
    // keep guides on top, then items
    const keep = new Set([els.guideX, els.guideY]);
    $$(".item", els.canvas).forEach((n) => n.remove());

    for (const it of state.items) {
      const div = document.createElement("div");
      div.className = `item ${it.type}` + (it.id === state.selectedId ? " selected" : "");
      div.dataset.id = it.id;
      div.dataset.type = it.type;
      div.style.left = it.x + "px";
      div.style.top = it.y + "px";
      div.style.width = it.w + "px";
      div.style.height = it.h + "px";

      if (it.type === "rect") {
        div.style.background = hexToRgba(it.fill, 0.25);
        div.style.borderColor = hexToRgba(it.fill, 0.35);
      }

      if (it.type === "text") {
        div.style.borderColor = "rgba(124,92,255,.35)";
        div.style.background = "rgba(255,255,255,.03)";
        div.style.color = "var(--text)";
      }

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = it.type === "text" ? it.text : "";
      div.appendChild(label);

      // handles only for selected
      if (it.id === state.selectedId) {
        for (const h of ["nw","n","ne","e","se","s","sw","w"]) {
          const hd = document.createElement("div");
          hd.className = `handle ${h}`;
          hd.dataset.handle = h;
          div.appendChild(hd);
        }
      }

      els.canvas.appendChild(div);
    }

    updateCanvasGrid();
    updateProps();
    updateMeta();
  }

  function updateCanvasGrid() {
    const step = Math.max(4, Math.min(64, Number(state.grid) || 10));
    // matches CSS background but updates the step
    els.canvas.style.background =
      `linear-gradient(0deg, rgba(255,255,255,.02), rgba(255,255,255,.02)),` +
      `repeating-linear-gradient(0deg, var(--grid), var(--grid) 1px, transparent 1px, transparent ${step}px),` +
      `repeating-linear-gradient(90deg, var(--grid), var(--grid) 1px, transparent 1px, transparent ${step}px)`;
  }

  function updateMeta(reason = "") {
    const sel = getSelected();
    const r = reason ? ` • ${reason}` : "";
    els.docMeta.textContent = `${state.items.length} элементов • zoom ${Math.round(state.zoom*100)}% • grid ${state.grid}px${r}`;

    if (sel) {
      els.propsMeta.textContent = `id: ${sel.id.slice(0, 10)}… • ${sel.type}`;
    }
  }

  function updateProps() {
    const it = getSelected();
    if (!it) {
      els.props.hidden = true;
      els.propsEmpty.hidden = false;
      els.del.disabled = true;
      els.dup.disabled = true;
      return;
    }

    els.del.disabled = false;
    els.dup.disabled = false;

    els.props.hidden = false;
    els.propsEmpty.hidden = true;

    els.px.value = String(Math.round(it.x));
    els.py.value = String(Math.round(it.y));
    els.pw.value = String(Math.round(it.w));
    els.ph.value = String(Math.round(it.h));
    els.pfill.value = normalizeHex(it.fill || "#7c5cff");

    if (it.type === "text") {
      els.ptext.disabled = false;
      els.ptext.value = it.text;
    } else {
      els.ptext.disabled = true;
      els.ptext.value = "";
    }
  }

  // ---------------------- Interaction ----------------------
  function bindUI() {
    // Add buttons
    els.addRect.addEventListener("click", () => {
      const { x, y } = centeredPoint();
      const it = makeRect(x, y, 200, 120, randomNiceColor());
      state.items.push(it);
      select(it.id);
      commit("add rect");
      render();
    });

    els.addText.addEventListener("click", () => {
      const { x, y } = centeredPoint();
      const it = makeText(x, y, 260, 80, "Текст");
      state.items.push(it);
      select(it.id);
      commit("add text");
      render();
    });

    // Snap/grid/guides
    els.snap.addEventListener("change", () => {
      state.snap = !!els.snap.checked;
      commit("snap toggle");
    });

    els.guides.addEventListener("change", () => {
      state.guides = !!els.guides.checked;
      commit("guides toggle");
    });

    els.grid.addEventListener("change", () => {
      state.grid = clamp(Number(els.grid.value) || 10, 4, 64);
      els.grid.value = String(state.grid);
      updateCanvasGrid();
      commit("grid");
    });

    // History
    els.undo.addEventListener("click", undo);
    els.redo.addEventListener("click", redo);

    // Duplicate/delete
    els.dup.addEventListener("click", duplicateSelected);
    els.del.addEventListener("click", deleteSelected);

    // Export
    els.exportBtn.addEventListener("click", openExport);
    els.closeModal.addEventListener("click", closeExport);
    els.modal.addEventListener("click", (e) => {
      if (e.target === els.modal) closeExport();
    });

    els.copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(els.exportBox.value);
        toast("Скопировано", "JSON в буфере обмена.");
      } catch {
        toast("Не вышло", "Браузер не дал доступ к clipboard.");
      }
    });

    els.saveFile.addEventListener("click", () => {
      const blob = new Blob([els.exportBox.value], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mini-figma-layout.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Сохранено", "Файл .json скачан.");
    });

    // Clear
    els.clear.addEventListener("click", () => {
      state.items = [];
      state.selectedId = null;
      commit("clear");
      render();
    });

    // Theme
    els.theme.addEventListener("click", () => {
      const next = state.theme === "auto" ? "dark" : state.theme === "dark" ? "light" : "auto";
      applyTheme(next);
      commit("theme");
    });

    // Zoom
    els.zoom.addEventListener("input", () => {
      const z = Number(els.zoom.value) / 100;
      applyZoom(z);
      // don't commit on every input, it's annoying
      updateMeta("zoom");
    });

    els.zoom.addEventListener("change", () => commit("zoom"));

    // Property inputs
    const applyProp = () => {
      const it = getSelected();
      if (!it) return;

      it.x = Number(els.px.value) || 0;
      it.y = Number(els.py.value) || 0;
      it.w = Math.max(minW(it), Number(els.pw.value) || it.w);
      it.h = Math.max(minH(it), Number(els.ph.value) || it.h);
      it.fill = els.pfill.value || it.fill;
      if (it.type === "text") it.text = els.ptext.value;

      if (state.snap) {
        it.x = snap(it.x);
        it.y = snap(it.y);
        it.w = snap(it.w);
        it.h = snap(it.h);
      }

      commit("props");
      render();
    };

    [els.px, els.py, els.pw, els.ph, els.pfill].forEach((n) => n.addEventListener("change", applyProp));
    els.ptext.addEventListener("change", applyProp);

    // Canvas click selection
    els.canvas.addEventListener("pointerdown", onCanvasPointerDown);

    // HTML5 drag drop from sidebar
    $$(".dragCard").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.drag);
        e.dataTransfer.effectAllowed = "copy";
      });
    });

    els.canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    els.canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const t = e.dataTransfer.getData("text/plain");
      const pt = canvasPointFromClient(e.clientX, e.clientY);
      if (!pt) return;

      if (t === "rect") {
        const it = makeRect(pt.x - 90, pt.y - 60, 180, 120, randomNiceColor());
        addItemAt(it);
      }
      if (t === "text") {
        const it = makeText(pt.x - 130, pt.y - 40, 260, 80, "Текст");
        addItemAt(it);
      }
    });

    // Keyboard
    window.addEventListener("keydown", onKey);

    // Double click to edit text
    els.canvas.addEventListener("dblclick", (e) => {
      const itemEl = e.target.closest(".item");
      if (!itemEl) return;
      const it = findItem(itemEl.dataset.id);
      if (!it || it.type !== "text") return;
      startTextEdit(it.id);
    });

    render();
  }

  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      redo();
      return;
    }

    if (ctrl && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateSelected();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      // avoid deleting text while editing
      const sel = getSelected();
      if (sel && !isEditingText(sel.id)) {
        e.preventDefault();
        deleteSelected();
      }
      return;
    }

    if (e.key.toLowerCase() === "r" && !ctrl) {
      e.preventDefault();
      els.addRect.click();
      return;
    }

    if (e.key.toLowerCase() === "t" && !ctrl) {
      e.preventDefault();
      els.addText.click();
      return;
    }

    // Nudge with arrows
    const sel = getSelected();
    if (!sel || isEditingText(sel.id)) return;

    const step = e.shiftKey ? 10 : 1;
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const before = { x: sel.x, y: sel.y };
      if (e.key === "ArrowLeft") sel.x -= step;
      if (e.key === "ArrowRight") sel.x += step;
      if (e.key === "ArrowUp") sel.y -= step;
      if (e.key === "ArrowDown") sel.y += step;
      if (state.snap) {
        sel.x = snap(sel.x);
        sel.y = snap(sel.y);
      }
      // commit only when changed
      if (sel.x !== before.x || sel.y !== before.y) {
        commit("nudge");
        render();
      }
    }
  }

  function addItemAt(it) {
    if (state.snap) {
      it.x = snap(it.x);
      it.y = snap(it.y);
      it.w = snap(it.w);
      it.h = snap(it.h);
    }
    state.items.push(it);
    select(it.id);
    commit("drop/add");
    render();
  }

  function centeredPoint() {
    // Put new elements near current viewport center
    const wrap = els.canvas.parentElement;
    const cx = wrap.scrollLeft + wrap.clientWidth / 2;
    const cy = wrap.scrollTop + wrap.clientHeight / 2;
    return { x: Math.round(cx / state.zoom) - 120, y: Math.round(cy / state.zoom) - 80 };
  }

  function onCanvasPointerDown(e) {
    // ignore when clicking modal etc.
    if (e.button !== 0) return;

    const itemEl = e.target.closest(".item");

    // click empty = deselect
    if (!itemEl) {
      select(null);
      render();
      return;
    }

    const id = itemEl.dataset.id;
    select(id);

    // handle resize
    const handleEl = e.target.closest(".handle");
    if (handleEl) {
      startResize(e, id, handleEl.dataset.handle);
      return;
    }

    // move
    startMove(e, id);
  }

  function startMove(e, id) {
    const it = findItem(id);
    if (!it) return;
    if (isEditingText(id)) return;

    const pt = canvasPointFromClient(e.clientX, e.clientY);
    if (!pt) return;

    state.drag = {
      kind: "move",
      id,
      start: { x: pt.x, y: pt.y },
      base: { x: it.x, y: it.y, w: it.w, h: it.h },
      committed: false,
    };

    els.canvas.setPointerCapture(e.pointerId);
    els.canvas.addEventListener("pointermove", onPointerMove);
    els.canvas.addEventListener("pointerup", onPointerUp);
    els.canvas.addEventListener("pointercancel", onPointerUp);
  }

  function startResize(e, id, handle) {
    const it = findItem(id);
    if (!it) return;
    if (isEditingText(id)) return;

    const pt = canvasPointFromClient(e.clientX, e.clientY);
    if (!pt) return;

    state.drag = {
      kind: "resize",
      id,
      handle,
      start: { x: pt.x, y: pt.y },
      base: { x: it.x, y: it.y, w: it.w, h: it.h },
      committed: false,
    };

    els.canvas.setPointerCapture(e.pointerId);
    els.canvas.addEventListener("pointermove", onPointerMove);
    els.canvas.addEventListener("pointerup", onPointerUp);
    els.canvas.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    const d = state.drag;
    if (!d) return;
    const it = findItem(d.id);
    if (!it) return;

    const pt = canvasPointFromClient(e.clientX, e.clientY);
    if (!pt) return;

    const dx = pt.x - d.start.x;
    const dy = pt.y - d.start.y;

    // reset guides
    hideGuides();

    if (d.kind === "move") {
      let nx = d.base.x + dx;
      let ny = d.base.y + dy;

      ({ x: nx, y: ny } = applySnapsMove(it.id, nx, ny, it.w, it.h));

      it.x = nx;
      it.y = ny;

      // cheap live update
      const el = itemNode(it.id);
      if (el) {
        el.style.left = it.x + "px";
        el.style.top = it.y + "px";
      }

      updateProps();
      updateMeta("move");
      d.committed = true;
      return;
    }

    if (d.kind === "resize") {
      let { x, y, w, h } = d.base;
      const minw = minW(it);
      const minh = minH(it);

      const handle = d.handle;

      // compute raw
      if (handle.includes("e")) w = d.base.w + dx;
      if (handle.includes("s")) h = d.base.h + dy;
      if (handle.includes("w")) {
        w = d.base.w - dx;
        x = d.base.x + dx;
      }
      if (handle.includes("n")) {
        h = d.base.h - dy;
        y = d.base.y + dy;
      }

      // clamp minimums
      if (w < minw) {
        if (handle.includes("w")) x -= (minw - w);
        w = minw;
      }
      if (h < minh) {
        if (handle.includes("n")) y -= (minh - h);
        h = minh;
      }

      // snaps (grid + guides)
      ({ x, y, w, h } = applySnapsResize(it.id, x, y, w, h, handle));

      it.x = x; it.y = y; it.w = w; it.h = h;

      const el = itemNode(it.id);
      if (el) {
        el.style.left = it.x + "px";
        el.style.top = it.y + "px";
        el.style.width = it.w + "px";
        el.style.height = it.h + "px";
      }

      updateProps();
      updateMeta("resize");
      d.committed = true;
      return;
    }
  }

  function onPointerUp(e) {
    els.canvas.releasePointerCapture?.(e.pointerId);
    els.canvas.removeEventListener("pointermove", onPointerMove);
    els.canvas.removeEventListener("pointerup", onPointerUp);
    els.canvas.removeEventListener("pointercancel", onPointerUp);

    hideGuides();

    const d = state.drag;
    state.drag = null;
    if (!d || !d.committed) {
      render();
      return;
    }

    // only commit if changed vs base
    const it = findItem(d.id);
    if (!it) {
      render();
      return;
    }

    const changed =
      it.x !== d.base.x || it.y !== d.base.y || it.w !== d.base.w || it.h !== d.base.h;

    if (changed) {
      commit(d.kind);
    }

    render();
  }

  // ---------------------- Snapping ----------------------
  function snap(v) {
    const g = Math.max(4, Number(state.grid) || 10);
    return Math.round(v / g) * g;
  }

  function applySnapsMove(id, x, y, w, h) {
    let nx = x, ny = y;

    if (state.snap) {
      nx = snap(nx);
      ny = snap(ny);
    }

    if (state.guides) {
      const res = snapToGuides(id, nx, ny, w, h);
      nx = res.x;
      ny = res.y;
    }

    // keep inside canvas
    ({ x: nx, y: ny } = keepInCanvas(nx, ny, w, h));
    return { x: nx, y: ny };
  }

  function applySnapsResize(id, x, y, w, h, handle) {
    let nx = x, ny = y, nw = w, nh = h;

    if (state.snap) {
      // snap edges, not just sizes
      const right = nx + nw;
      const bottom = ny + nh;

      let leftS = snap(nx);
      let topS = snap(ny);
      let rightS = snap(right);
      let bottomS = snap(bottom);

      // depending on handle, adjust corresponding edges
      if (handle.includes("w")) nx = leftS;
      if (handle.includes("n")) ny = topS;
      if (handle.includes("e")) rightS = snap(right);
      if (handle.includes("s")) bottomS = snap(bottom);

      nw = Math.max(minW(findItem(id)), rightS - nx);
      nh = Math.max(minH(findItem(id)), bottomS - ny);
    }

    if (state.guides) {
      const res = snapToGuides(id, nx, ny, nw, nh, handle);
      nx = res.x;
      ny = res.y;
      nw = res.w;
      nh = res.h;
    }

    // keep inside canvas
    ({ x: nx, y: ny, w: nw, h: nh } = keepResizeInCanvas(nx, ny, nw, nh));

    return { x: nx, y: ny, w: nw, h: nh };
  }

  function snapToGuides(id, x, y, w, h, handle) {
    // snap edges/center to other items within threshold
    const threshold = 6;

    const targets = state.items.filter((it) => it.id !== id);

    const edges = {
      left: x,
      right: x + w,
      cx: x + w / 2,
      top: y,
      bottom: y + h,
      cy: y + h / 2,
    };

    const candidatesX = [];
    const candidatesY = [];

    for (const t of targets) {
      const tEdges = {
        left: t.x,
        right: t.x + t.w,
        cx: t.x + t.w / 2,
        top: t.y,
        bottom: t.y + t.h,
        cy: t.y + t.h / 2,
      };

      // X compare
      for (const a of ["left","right","cx"]) {
        for (const b of ["left","right","cx"]) {
          const dist = tEdges[b] - edges[a];
          const ad = Math.abs(dist);
          if (ad <= threshold) {
            candidatesX.push({ dist, pos: tEdges[b] });
          }
        }
      }

      // Y compare
      for (const a of ["top","bottom","cy"]) {
        for (const b of ["top","bottom","cy"]) {
          const dist = tEdges[b] - edges[a];
          const ad = Math.abs(dist);
          if (ad <= threshold) {
            candidatesY.push({ dist, pos: tEdges[b] });
          }
        }
      }
    }

    // Choose nearest snap
    if (candidatesX.length) {
      candidatesX.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
      const best = candidatesX[0];

      // Move or resize: decide what to change
      if (!handle) {
        x += best.dist;
      } else {
        // resize: apply to edge that is being dragged, fallback to move
        if (handle.includes("w")) {
          const newLeft = best.pos;
          const newW = (x + w) - newLeft;
          x = newLeft;
          w = Math.max(minW(findItem(id)), newW);
        } else if (handle.includes("e")) {
          const newRight = best.pos;
          w = Math.max(minW(findItem(id)), newRight - x);
        } else {
          // center snaps: move x
          x += best.dist;
        }
      }

      showGuideY(best.pos);
    }

    if (candidatesY.length) {
      candidatesY.sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
      const best = candidatesY[0];

      if (!handle) {
        y += best.dist;
      } else {
        if (handle.includes("n")) {
          const newTop = best.pos;
          const newH = (y + h) - newTop;
          y = newTop;
          h = Math.max(minH(findItem(id)), newH);
        } else if (handle.includes("s")) {
          const newBottom = best.pos;
          h = Math.max(minH(findItem(id)), newBottom - y);
        } else {
          y += best.dist;
        }
      }

      showGuideX(best.pos);
    }

    return { x, y, w, h };
  }

  function showGuideX(y) {
    els.guideX.hidden = false;
    els.guideX.style.top = y + "px";
  }

  function showGuideY(x) {
    els.guideY.hidden = false;
    els.guideY.style.left = x + "px";
  }

  function hideGuides() {
    els.guideX.hidden = true;
    els.guideY.hidden = true;
  }

  function keepInCanvas(x, y, w, h) {
    const maxX = els.canvas.clientWidth - w;
    const maxY = els.canvas.clientHeight - h;
    return { x: clamp(x, 0, maxX), y: clamp(y, 0, maxY) };
  }

  function keepResizeInCanvas(x, y, w, h) {
    // keep top-left in bounds
    x = clamp(x, 0, els.canvas.clientWidth - minW({ type: "rect" }));
    y = clamp(y, 0, els.canvas.clientHeight - minH({ type: "rect" }));

    // keep bottom-right in bounds
    w = clamp(w, minW({ type: "rect" }), els.canvas.clientWidth - x);
    h = clamp(h, minH({ type: "rect" }), els.canvas.clientHeight - y);

    return { x, y, w, h };
  }

  // ---------------------- Text Editing ----------------------
  function startTextEdit(id) {
    const it = findItem(id);
    if (!it || it.type !== "text") return;

    const node = itemNode(id);
    if (!node) return;

    select(id);
    render();

    const label = node.querySelector(".label");
    if (!label) return;

    node.classList.add("editing");
    label.contentEditable = "true";
    label.focus();

    const before = it.text;

    const done = () => {
      label.contentEditable = "false";
      node.classList.remove("editing");

      const v = label.textContent || "";
      it.text = v;

      if (v !== before) {
        commit("edit text");
        toast("Текст", "Изменения сохранены.");
      }

      render();
      window.removeEventListener("pointerdown", outside);
      label.removeEventListener("keydown", keys);
      label.removeEventListener("blur", done);
    };

    const keys = (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        done();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        it.text = before;
        done();
      }
    };

    const outside = (e) => {
      if (!node.contains(e.target)) done();
    };

    label.addEventListener("keydown", keys);
    label.addEventListener("blur", done);
    window.addEventListener("pointerdown", outside, { capture: true });

    toast("Редактирование", "Ctrl+Enter чтобы сохранить, Esc чтобы отменить.");
  }

  function isEditingText(id) {
    const n = itemNode(id);
    return !!n && n.classList.contains("editing");
  }

  // ---------------------- Selection & Ops ----------------------
  function select(id) {
    state.selectedId = id;
  }

  function getSelected() {
    return state.selectedId ? findItem(state.selectedId) : null;
  }

  function findItem(id) {
    return state.items.find((x) => x.id === id) || null;
  }

  function itemNode(id) {
    return els.canvas.querySelector(`.item[data-id="${cssEscape(id)}"]`);
  }

  function deleteSelected() {
    const it = getSelected();
    if (!it) return;
    state.items = state.items.filter((x) => x.id !== it.id);
    state.selectedId = null;
    commit("delete");
    render();
    toast("Удалено", "Элемент исчез. Как и многие надежды.");
  }

  function duplicateSelected() {
    const it = getSelected();
    if (!it) return;

    const copy = structuredClone(it);
    copy.id = uid();
    copy.x += 14;
    copy.y += 14;
    state.items.push(copy);
    select(copy.id);
    commit("duplicate");
    render();
    toast("Duplicate", "Клон создан.");
  }

  // ---------------------- Export ----------------------
  function openExport() {
    const doc = {
      version: 1,
      createdAt: new Date().toISOString(),
      canvas: {
        width: els.canvas.clientWidth,
        height: els.canvas.clientHeight,
        grid: state.grid,
      },
      items: state.items,
    };
    els.exportBox.value = JSON.stringify(doc, null, 2);
    els.modal.hidden = false;
    els.modal.querySelector("textarea").focus();
  }

  function closeExport() {
    els.modal.hidden = true;
  }

  // ---------------------- Theme/Zoom ----------------------
  function applyTheme(mode) {
    state.theme = mode;

    let theme = mode;
    if (mode === "auto") {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = prefersDark ? "dark" : "light";
    }

    document.documentElement.dataset.theme = theme;
  }

  function applyZoom(z) {
    state.zoom = clamp(z, 0.5, 2);
    els.canvas.style.transform = `scale(${state.zoom})`;
    els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    els.zoom.value = String(Math.round(state.zoom * 100));

    // keep scroll area feeling sane
    const wrap = els.canvas.parentElement;
    wrap.style.paddingBottom = "60px";
  }

  // ---------------------- Geometry helpers ----------------------
  function canvasPointFromClient(clientX, clientY) {
    const rect = els.canvas.getBoundingClientRect();
    // Because canvas is scaled, convert back
    const x = (clientX - rect.left) / state.zoom;
    const y = (clientY - rect.top) / state.zoom;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function minW(it) {
    return CATS[it.type]?.minW ?? 40;
  }
  function minH(it) {
    return CATS[it.type]?.minH ?? 30;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function normalizeHex(hex) {
    // ensure #RRGGBB
    if (!hex) return "#7c5cff";
    const h = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(h)) return h;
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      return (
        "#" +
        h
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
      );
    }
    return "#7c5cff";
  }

  function hexToRgba(hex, a) {
    const h = normalizeHex(hex);
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function randomNiceColor() {
    const palette = ["#7c5cff", "#22c55e", "#f59e0b", "#38bdf8", "#ef4444", "#a855f7", "#14b8a6"];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_\-]/g, "\\$");
  }

  // ---------------------- Toast ----------------------
  function toast(title, body) {
    els.toastTitle.textContent = title;
    els.toastBody.textContent = body;
    els.toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => (els.toast.hidden = true), 1600);
  }

})();
