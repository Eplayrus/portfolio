;(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ls = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    set(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  };

  // =========================
  // Theme
  // =========================
  const THEME_KEY = "ui_kit_theme";
  const initTheme = () => {
    const mode = ls.get(THEME_KEY, "auto");
    applyTheme(mode);
  };

  const applyTheme = (mode) => {
    let t = mode;
    if (mode === "auto") {
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      t = prefersDark ? "dark" : "light";
    }
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.themeMode = mode;
    ls.set(THEME_KEY, mode);
  };

  const toggleTheme = () => {
    const mode = document.documentElement.dataset.themeMode || "auto";
    const next = mode === "auto" ? "dark" : mode === "dark" ? "light" : "auto";
    applyTheme(next);
    toast("info", "Тема", `Режим: ${next}`);
  };

  // =========================
  // Toast
  // =========================
  const toastHost = $(".ui-toasts");
  let toastTimer = null;

  function toast(type = "info", title = "Toast", body = "…", opts = {}) {
    if (!toastHost) return;

    const icons = { success: "✅", warning: "⚠️", danger: "⛔", info: "ℹ️" };
    const node = document.createElement("div");
    node.className = `ui-toast ui-toast--${type}`;
    node.role = "status";

    node.innerHTML = `
      <div class="ui-toast__icon" aria-hidden="true">${icons[type] || "ℹ️"}</div>
      <div>
        <div class="ui-toast__title">${escapeHTML(title)}</div>
        <div class="ui-toast__body">${escapeHTML(body)}</div>
      </div>
      <button class="ui-btn ui-btn--ghost ui-btn--xs ui-toast__close" type="button" aria-label="Закрыть">✕</button>
    `;

    const close = () => node.remove();
    node.querySelector(".ui-toast__close").addEventListener("click", close);

    toastHost.appendChild(node);

    const ttl = opts.ttl ?? 1800;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(close, ttl);
  }

  // =========================
  // Copy code
  // =========================
  async function copyFromSelector(sel) {
    const el = $(sel);
    if (!el) return;
    const text = el.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Скопировано", "Код в буфере обмена.");
    } catch {
      toast("danger", "Не вышло", "Clipboard недоступен в этом контексте.");
    }
  }

  // =========================
  // Dropdown (a11y)
  // =========================
  function closeAllDropdowns(except = null) {
    $$("[data-dropdown-button]").forEach(btn => {
      if (except && btn === except) return;
      const menu = getDropdownMenu(btn);
      if (!menu) return;
      btn.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    });
  }

  function getDropdownMenu(btn) {
    const id = btn.getAttribute("aria-controls");
    return id ? document.getElementById(id) : btn.closest(".ui-dropdown")?.querySelector("[data-dropdown-menu]");
  }

  function openDropdown(btn) {
    const menu = getDropdownMenu(btn);
    if (!menu) return;
    closeAllDropdowns(btn);
    btn.setAttribute("aria-expanded", "true");
    menu.hidden = false;

    // focus first item
    const first = menu.querySelector('[role="menuitem"]');
    first?.focus();
  }

  function toggleDropdown(btn) {
    const menu = getDropdownMenu(btn);
    if (!menu) return;
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      btn.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      btn.focus();
    } else {
      openDropdown(btn);
    }
  }

  function onDropdownKeydown(e, btn, menu) {
    const items = $$('[role="menuitem"]', menu);
    const idx = items.indexOf(document.activeElement);

    if (e.key === "Escape") {
      e.preventDefault();
      btn.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      btn.focus();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[Math.min(items.length - 1, idx + 1)] || items[0];
      next?.focus();
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[Math.max(0, idx - 1)] || items[items.length - 1];
      prev?.focus();
    }

    if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    }

    if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  // =========================
  // Tabs (a11y)
  // =========================
  function initTabs(root) {
    const tabs = $$('[role="tab"]', root);
    const panels = $$('[role="tabpanel"]', root);

    function activate(tab) {
      tabs.forEach(t => {
        const selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
      });

      panels.forEach(p => {
        p.hidden = p.id !== tab.getAttribute("aria-controls");
      });

      tab.focus();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (e) => {
        const i = tabs.indexOf(tab);

        if (e.key === "ArrowRight") {
          e.preventDefault();
          activate(tabs[(i + 1) % tabs.length]);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          activate(tabs[(i - 1 + tabs.length) % tabs.length]);
        }
        if (e.key === "Home") {
          e.preventDefault();
          activate(tabs[0]);
        }
        if (e.key === "End") {
          e.preventDefault();
          activate(tabs[tabs.length - 1]);
        }
      });
    });
  }

  // =========================
  // Modal (focus trap + ESC)
  // =========================
  let activeModal = null;
  let lastFocus = null;

  function getFocusable(root) {
    const sel = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");
    return $$(sel, root).filter(el => el.offsetParent !== null);
  }

  function openModal(modal) {
    if (!modal) return;
    if (!modal.hidden) return;

    lastFocus = document.activeElement;
    activeModal = modal;

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    const focusables = getFocusable(modal);
    (focusables[0] || modal).focus?.();

    document.addEventListener("keydown", onModalKeydown, true);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onModalKeydown, true);

    const toFocus = lastFocus;
    activeModal = null;
    lastFocus = null;
    toFocus?.focus?.();
  }

  function onModalKeydown(e) {
    if (!activeModal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal(activeModal);
      return;
    }

    if (e.key === "Tab") {
      const focusables = getFocusable(activeModal);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // =========================
  // Fake loading
  // =========================
  function fakeLoad(btn) {
    btn.dataset.loading = "true";
    btn.setAttribute("aria-busy", "true");
    const prev = btn.textContent;
    btn.textContent = "Загрузка";
    setTimeout(() => {
      btn.dataset.loading = "false";
      btn.removeAttribute("aria-busy");
      btn.textContent = prev;
      toast("success", "Готово", "Fake loading завершён.");
    }, 1200);
  }

  // =========================
  // Delegated handlers
  // =========================
  document.addEventListener("click", (e) => {
    const t = e.target;

    // Theme toggle
    if (t.closest("[data-theme-toggle]")) {
      toggleTheme();
      return;
    }

    // Copy
    const copyBtn = t.closest("[data-copy]");
    if (copyBtn) {
      const sel = copyBtn.getAttribute("data-copy");
      copyFromSelector(sel);
      return;
    }

    // Toast trigger
    const toastBtn = t.closest("[data-toast]");
    if (toastBtn) {
      const type = toastBtn.getAttribute("data-toast");
      toast(type, "Toast", `Тип: ${type}`);
      return;
    }

    // Open modal
    const openBtn = t.closest("[data-modal-open]");
    if (openBtn) {
      const sel = openBtn.getAttribute("data-modal-open");
      const modal = $(sel);
      openModal(modal);
      return;
    }

    // Close modal
    if (t.closest("[data-modal-close]")) {
      const modal = t.closest(".ui-modal");
      closeModal(modal);
      return;
    }

    // Dropdown toggle
    const ddBtn = t.closest("[data-dropdown-button]");
    if (ddBtn) {
      e.preventDefault();
      toggleDropdown(ddBtn);
      return;
    }
  });

  // Close dropdown on outside click
  document.addEventListener("pointerdown", (e) => {
    const inside = e.target.closest(".ui-dropdown");
    if (!inside) closeAllDropdowns();
  });

  // Dropdown keyboard
  document.addEventListener("keydown", (e) => {
    // dropdown
    const menu = e.target.closest("[data-dropdown-menu]");
    if (menu) {
      const dropdown = menu.closest(".ui-dropdown");
      const btn = dropdown?.querySelector("[data-dropdown-button]");
      if (btn) onDropdownKeydown(e, btn, menu);
      return;
    }

    // escape closes dropdowns globally
    if (e.key === "Escape") closeAllDropdowns();
  });

  // Demo buttons
  $("#btnDemoToast")?.addEventListener("click", () => {
    toast("info", "Привет", "Это demo toast.");
  });

  $("#btnFakeLoad")?.addEventListener("click", (e) => fakeLoad(e.currentTarget));

  // Init tabs
  $$("[data-tabs]").forEach(initTabs);

  // Init theme
  initTheme();

  // helper
  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
