(function() {
  "use strict";
  let uid = 0;
  class Combobox {
    constructor(o) {
      this.input = o.input;
      this.native = o.native;
      this.options = o.options || [];
      this.customSearch = o.search || null;
      this.allowCustom = Boolean(o.allowCustom);
      this.limit = o.limit || 60;
      this.emptyText = o.emptyText || "No matches";
      this.loading = false;
      this.results = [];
      this.active = -1;
      uid += 1;
      this.listId = `combo-list-${uid}`;
      this.root = document.createElement("div");
      this.root.className = "combo";
      this.input.parentNode.insertBefore(this.root, this.input);
      this.root.appendChild(this.input);
      this.list = document.createElement("ul");
      this.list.className = "combo__list";
      this.list.id = this.listId;
      this.list.setAttribute("role", "listbox");
      this.list.hidden = true;
      this.root.appendChild(this.list);
      this.input.classList.add("combo__input");
      this.input.setAttribute("role", "combobox");
      this.input.setAttribute("aria-autocomplete", "list");
      this.input.setAttribute("aria-expanded", "false");
      this.input.setAttribute("aria-controls", this.listId);
      this.input.setAttribute("autocomplete", "off");
      this.input.spellcheck = false;
      this.native._combo = this;
      this.input.addEventListener("input", () => this.onType());
      this.input.addEventListener("focus", () => {
        this.input.select();
        this.open("");
      });
      this.input.addEventListener("click", () => {
        if (this.list.hidden) this.open("");
      });
      this.input.addEventListener("keydown", e => this.onKey(e));
      this.input.addEventListener("blur", () => this.commitTyped());
      this.list.addEventListener("mousedown", e => {
        const li = e.target.closest("[data-i]");
        e.preventDefault();
        if (li) this.choose(this.results[Number(li.dataset.i)]);
      });
      this.sync();
    }
    static fromSelect(select, extra = {}) {
      if (select._combo) return select._combo;
      const input = document.createElement("input");
      input.type = "text";
      input.id = `${select.id}-combo`;
      const placeholderOpt = Array.from(select.options).find(op => op.value === "");
      input.placeholder = extra.placeholder || (placeholderOpt ? placeholderOpt.textContent.trim() + "…" : "Search…");
      select.parentNode.insertBefore(input, select);
      select.classList.add("combo__native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      const label = select.id && document.querySelector(`label[for="${select.id}"]`);
      if (label) label.htmlFor = input.id;
      const options = Array.from(select.options).filter(op => op.value !== "").map(op => ({
        value: op.value,
        label: op.textContent.trim()
      }));
      const combo = new Combobox({
        input: input,
        native: select,
        options: options,
        ...extra
      });
      combo.root.appendChild(select);
      return combo;
    }
    sync() {
      const v = this.native.value;
      const match = this.options.find(o => o.value === v);
      this.input.value = match ? match.label : this.allowCustom ? v : "";
    }
    setOptions(options) {
      this.options = options;
      this.loading = false;
      this.sync();
      if (!this.list.hidden) this.open(this.input.value === this.selectedLabel() ? "" : this.input.value);
    }
    setLoading(on) {
      this.loading = on;
    }
    selectedLabel() {
      const match = this.options.find(o => o.value === this.native.value);
      return match ? match.label : "";
    }
    search(query) {
      if (this.customSearch) return this.customSearch(query);
      const q = query.trim().toLowerCase();
      if (!q) return this.options;
      const starts = [];
      const contains = [];
      for (const o of this.options) {
        const l = o.label.toLowerCase();
        if (l.startsWith(q) || o.value.toLowerCase() === q) starts.push(o); else if (l.includes(q)) contains.push(o);
      }
      return starts.concat(contains);
    }
    onType() {
      if (!this.allowCustom && this.native.value && this.input.value !== this.selectedLabel()) {
        this.native.value = "";
        this.native.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
      this.open(this.input.value);
    }
    open(query) {
      this.results = this.loading ? [] : this.search(query).slice(0, this.limit);
      this.active = this.results.length ? 0 : -1;
      const current = this.results.findIndex(o => o.value === this.native.value);
      if (current >= 0) this.active = current;
      this.render();
      this.list.hidden = false;
      this.input.setAttribute("aria-expanded", "true");
    }
    close() {
      this.list.hidden = true;
      this.input.setAttribute("aria-expanded", "false");
      this.input.removeAttribute("aria-activedescendant");
    }
    render() {
      const esc = s => String(s).replace(/[&<>"]/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      }[c]));
      if (this.loading) {
        this.list.innerHTML = `<li class="combo__empty">Loading…</li>`;
        return;
      }
      if (!this.results.length) {
        const hint = this.allowCustom && this.input.value.trim() ? `Press Enter to use “${esc(this.input.value.trim())}”` : this.emptyText;
        this.list.innerHTML = `<li class="combo__empty">${hint}</li>`;
        return;
      }
      this.list.innerHTML = this.results.map((o, i) => `\n        <li role="option" id="${this.listId}-${i}" data-i="${i}" class="combo__option${i === this.active ? " is-active" : ""}"\n            aria-selected="${o.value === this.native.value}">\n          <span class="combo__label">${esc(o.label)}</span>\n          ${o.badge ? `<span class="combo__badge">${esc(o.badge)}</span>` : ""}\n          ${o.detail ? `<span class="combo__detail">${esc(o.detail)}</span>` : ""}\n        </li>`).join("");
      this.highlight();
    }
    highlight() {
      this.list.querySelectorAll(".combo__option").forEach((li, i) => li.classList.toggle("is-active", i === this.active));
      if (this.active >= 0) {
        const li = this.list.querySelector(`[data-i="${this.active}"]`);
        this.input.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({
          block: "nearest"
        });
      } else {
        this.input.removeAttribute("aria-activedescendant");
      }
    }
    onKey(e) {
      const openList = !this.list.hidden;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!openList) return this.open("");
        if (this.results.length) {
          this.active = (this.active + 1) % this.results.length;
          this.highlight();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (openList && this.results.length) {
          this.active = (this.active - 1 + this.results.length) % this.results.length;
          this.highlight();
        }
      } else if (e.key === "Enter") {
        if (!openList) return;
        e.preventDefault();
        if (this.active >= 0) this.choose(this.results[this.active]); else if (this.allowCustom) this.commitTyped(true);
      } else if (e.key === "Escape") {
        if (openList) {
          e.preventDefault();
          this.close();
          if (!this.allowCustom) this.sync();
        }
      } else if (e.key === "Tab" && openList && this.active >= 0 && this.input.value.trim() && this.input.value !== this.selectedLabel()) {
        this.choose(this.results[this.active], false);
      }
    }
    choose(option, keepFocus = true) {
      if (!option) return;
      const changed = this.native.value !== option.value;
      this.native.value = option.value;
      this.input.value = option.label;
      this.close();
      if (changed) this.native.dispatchEvent(new Event("change", {
        bubbles: true
      }));
      if (keepFocus && document.activeElement !== this.input) this.input.focus({
        preventScroll: true
      });
      this.close();
    }
    commitTyped(force) {
      if (!force && document.activeElement === this.input) return;
      const typed = this.input.value.trim();
      this.close();
      if (typed === this.selectedLabel() && typed) return;
      if (!typed) {
        if (this.native.value) {
          this.native.value = "";
          this.native.dispatchEvent(new Event("change", {
            bubbles: true
          }));
        }
        return;
      }
      const lower = typed.toLowerCase();
      const exact = this.options.find(o => o.label.toLowerCase() === lower || o.value.toLowerCase() === lower) || (this.search(typed).length === 1 ? this.search(typed)[0] : null);
      if (exact) return this.choose(exact, false);
      if (this.allowCustom) {
        if (this.native.value !== typed) {
          this.native.value = typed;
          this.native.dispatchEvent(new Event("change", {
            bubbles: true
          }));
        }
        this.input.value = typed;
        return;
      }
      this.native.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
  }
  Combobox.enhanceAll = function(root = document) {
    root.querySelectorAll("select[data-searchable]").forEach(s => Combobox.fromSelect(s));
  };
  Combobox.syncAll = function(root = document) {
    root.querySelectorAll(".combo__native, input[type=hidden]").forEach(el => el._combo && el._combo.sync());
  };
  window.Combobox = Combobox;
})();