(function () {
  "use strict";

  const selectedTags = new Set();
  const selectedDropdownTags = new Map();
  const selectedTemplatesByCategory = new Map();
  const selectedCustomTagsByCategory = new Map();
  const selectedTemplateTagsByCategory = new Map();
  const templateCatalogByCategory = new Map();

  let currentMode = "mj";
  let outputTitleGenerationSeq = 0;

  const freeTextEl = document.getElementById("free-text");
  const outputPositive = document.getElementById("output-positive");
  const outputNegative = document.getElementById("output-negative");
  const outputSettings = document.getElementById("output-settings");
  const outputGeneratedTitleEl = document.getElementById(
    "output-generated-title"
  );
  const outputNegativeWrap = document.getElementById("output-negative-wrap");
  const outputSettingsWrap = document.getElementById("output-settings-wrap");
  const generateBtn = document.getElementById("generate-btn");
  const refineBtn = document.getElementById("refine-btn");
  const saveFavoriteBtn = document.getElementById("save-favorite-btn");
  const generationStatusEl = document.getElementById("generation-status");
  const copyPositiveBtn = document.getElementById("copy-positive-btn");
  const copyNegativeBtn = document.getElementById("copy-negative-btn");
  const clearBtn = document.getElementById("clear-btn");
  const aspectDisplay = document.getElementById("aspect-display");
  const aspectRadios = document.querySelectorAll('input[name="aspect_ratio"]');
  const mjParamsEl = document.getElementById("mj-params");
  const sdxlParamsEl = document.getElementById("sdxl-params");
  const mjVersion = document.getElementById("mj-version");
  const mjQuality = document.getElementById("mj-quality");
  const mjStyle = document.getElementById("mj-style");
  const mjStylize = document.getElementById("mj-stylize");
  const mjChaos = document.getElementById("mj-chaos");
  const mjWeird = document.getElementById("mj-weird");
  const sdxlSteps = document.getElementById("sdxl-steps");
  const sdxlCfg = document.getElementById("sdxl-cfg");
  const sdxlSampler = document.getElementById("sdxl-sampler");
  const sdxlScheduler = document.getElementById("sdxl-scheduler");
  const modelSelect = document.getElementById("model-select");
  const modelStatusEl = document.getElementById("model-status");
  const generationStatusTextEl = document.getElementById(
    "generation-status-text"
  );
  const modeOptions = document.querySelectorAll(".output-mode-option");
  const tagSelectEls = Array.from(document.querySelectorAll(".tag-select"));
  const categoryTemplateSelectEls = Array.from(
    document.querySelectorAll(".category-template-select")
  );
  const templateEditOpenBtns = Array.from(
    document.querySelectorAll(".template-edit-open-btn")
  );
  const templateListEls = Array.from(document.querySelectorAll(".template-list"));
  const tagCategoryRandomizeBtns = Array.from(
    document.querySelectorAll(".tag-category-randomize-btn")
  );
  const tagsRandomizeBtn = document.getElementById("tags-randomize-btn");
  const DEFAULT_MODEL = "llama-3.1-8b-instant";

  const warmModels = new Set();
  let warmupSeq = 0;
  let currentWarmupSeq = 0;
  let currentWarmupModel = null;
  const modelMeta = new Map();

  const SELECTED_CLASS = "is-selected";

  const categoryTemplatesBootstrap =
    (window.CATEGORY_TEMPLATES && typeof window.CATEGORY_TEMPLATES === "object")
      ? window.CATEGORY_TEMPLATES
      : {};

  function getCategoryTemplateMap(category) {
    if (!templateCatalogByCategory.has(category)) {
      templateCatalogByCategory.set(category, new Map());
    }
    return templateCatalogByCategory.get(category);
  }

  function registerTemplate(template) {
    if (!template || typeof template !== "object") return;
    const category = String(template.category || "").trim();
    const id = String(template.id || "").trim();
    if (!category || !id) return;
    const map = getCategoryTemplateMap(category);
    map.set(id, {
      id: id,
      label: String(template.label || id).trim() || id,
      category: category,
      tags: Array.isArray(template.tags)
        ? template.tags.map(function (tag) {
            return String(tag || "").trim();
          }).filter(Boolean)
        : [],
      is_predefined: template.is_predefined === true,
    });
  }

  Object.keys(categoryTemplatesBootstrap).forEach(function (category) {
    const items = categoryTemplatesBootstrap[category];
    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      registerTemplate(item);
    });
  });

  function syncSelectedTags() {
    selectedTags.clear();
    selectedCustomTagsByCategory.clear();
    selectedTemplateTagsByCategory.clear();

    selectedDropdownTags.forEach(function (value) {
      if (value) selectedTags.add(value);
    });
    document.querySelectorAll(".tag-group").forEach(function (group) {
      const selectEl = group.querySelector(".tag-select");
      const category = selectEl
        ? (selectEl.getAttribute("data-category") || "").trim()
        : "";
      if (!category) return;

      const customTags = Array.from(
        group.querySelectorAll(".tag-btn-custom." + SELECTED_CLASS)
      )
        .map(function (btn) {
          return (btn.getAttribute("data-tag") || "").trim();
        })
        .filter(Boolean);
      if (customTags.length) {
        selectedCustomTagsByCategory.set(category, customTags);
        customTags.forEach(function (tag) {
          selectedTags.add(tag);
        });
      }

      const selectedTemplateIds = selectedTemplatesByCategory.get(category) || [];
      const templateMap = getCategoryTemplateMap(category);
      const templateTags = [];
      selectedTemplateIds.forEach(function (templateId) {
        const entry = templateMap.get(templateId);
        if (!entry || !Array.isArray(entry.tags)) return;
        entry.tags.forEach(function (tag) {
          const safe = String(tag || "").trim();
          if (!safe) return;
          templateTags.push(safe);
          selectedTags.add(safe);
        });
      });
      if (templateTags.length) {
        selectedTemplateTagsByCategory.set(category, templateTags);
      }
    });
  }

  function setDropdownSelection(category, value) {
    if (!category) return;
    const trimmed = (value || "").trim();
    if (trimmed) {
      selectedDropdownTags.set(category, trimmed);
    } else {
      selectedDropdownTags.delete(category);
    }
  }

  tagSelectEls.forEach(function (selectEl) {
    const category = selectEl.getAttribute("data-category") || "";
    setDropdownSelection(category, selectEl.value);
    selectEl.addEventListener("change", function () {
      setDropdownSelection(category, selectEl.value);
      syncSelectedTags();
    });
  });
  syncSelectedTags();

  function syncAspectDisplay() {
    const checked = document.querySelector(
      'input[name="aspect_ratio"]:checked'
    );
    if (checked && aspectDisplay) {
      aspectDisplay.textContent = checked.value;
    }
  }

  aspectRadios.forEach(function (radio) {
    radio.addEventListener("change", syncAspectDisplay);
  });
  syncAspectDisplay();

  function applyModeUi() {
    if (mjParamsEl) mjParamsEl.hidden = currentMode !== "mj";
    if (sdxlParamsEl) sdxlParamsEl.hidden = currentMode !== "sdxl";
    if (outputNegativeWrap) {
      outputNegativeWrap.hidden = currentMode !== "sdxl";
    }
    if (outputSettingsWrap) {
      outputSettingsWrap.hidden = currentMode !== "sdxl";
    }
    modeOptions.forEach(function (btn) {
      const m = btn.getAttribute("data-mode");
      const on = m === currentMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function clearOutputs() {
    outputTitleGenerationSeq += 1;
    if (outputPositive) outputPositive.value = "";
    if (outputNegative) outputNegative.value = "";
    if (outputSettings) outputSettings.value = "";
    applyGeneratedTitle("");
    setOutputHasContent(false);
  }

  const MJ_FLAG_RE = /\s*--(?:ar|v|q|s|c|w|style|stylize|chaos|weird|niji|iw|seed)\s+\S+/gi;
  const MJ_WEIGHT_RE = /::-?\d+(?:\.\d+)?/g;

  function stripMjFlags(text) {
    if (!text) return "";
    return String(text).replace(MJ_FLAG_RE, "").trim();
  }

  function stripMjWeights(text) {
    if (!text) return "";
    return String(text)
      .replace(MJ_WEIGHT_RE, "")
      .replace(/::/g, ", ")
      .replace(/\s*,\s*,+/g, ", ")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .trim();
  }

  function isBrokenPromptOutput(text) {
    const s = String(text || "").trim();
    if (!s) return true;
    if (/^\[Request failed:/i.test(s)) return true;
    if (/^\[Error:/i.test(s)) return true;
    if (/^\[Refine failed:/i.test(s)) return true;
    if (/^\[Refine error:/i.test(s)) return true;
    return false;
  }

  function fallbackTitleFromPrompt(positiveForTitle) {
    const raw = String(positiveForTitle || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const max = 72;
    if (raw.length <= max) return raw;
    return raw.slice(0, max).trim() + "\u2026";
  }

  function applyGeneratedTitle(text) {
    if (!outputGeneratedTitleEl) return;
    const t = String(text || "").trim();
    if (!t) {
      outputGeneratedTitleEl.hidden = true;
      outputGeneratedTitleEl.textContent = "";
      return;
    }
    outputGeneratedTitleEl.hidden = false;
    outputGeneratedTitleEl.textContent = t;
  }

  function scheduleGeneratedTitleFromOutput(modelName) {
    outputTitleGenerationSeq += 1;
    const seq = outputTitleGenerationSeq;
    const rawPositive = outputPositive ? outputPositive.value : "";
    const trimmed = rawPositive.trim();
    if (!trimmed || isBrokenPromptOutput(trimmed)) {
      applyGeneratedTitle("");
      return;
    }
    const base =
      currentMode === "mj" ? stripMjFlags(rawPositive) : trimmed;
    const promptForApi = base.trim();
    if (!promptForApi) {
      applyGeneratedTitle(fallbackTitleFromPrompt(trimmed));
      return;
    }
    if (outputGeneratedTitleEl) {
      outputGeneratedTitleEl.hidden = false;
      outputGeneratedTitleEl.textContent = "\u2026";
    }
    const activeModel =
      modelName ||
      (modelSelect && modelSelect.value ? modelSelect.value : DEFAULT_MODEL);
    (async function () {
      try {
        const resp = await fetch("/prompt-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptForApi, model: activeModel }),
        });
        if (seq !== outputTitleGenerationSeq) return;
        let title = "";
        if (resp.ok) {
          const data = await resp.json();
          if (data && typeof data.title === "string" && data.title.trim()) {
            title = data.title.trim();
          }
        }
        if (!title) {
          title = fallbackTitleFromPrompt(promptForApi);
        }
        if (seq !== outputTitleGenerationSeq) return;
        applyGeneratedTitle(title);
      } catch {
        if (seq !== outputTitleGenerationSeq) return;
        applyGeneratedTitle(fallbackTitleFromPrompt(promptForApi));
      }
    })();
  }

  function setOutputHasContent(hasContent) {
    const has = !!hasContent;
    if (refineBtn) refineBtn.disabled = !has;
    if (saveFavoriteBtn) saveFavoriteBtn.hidden = !has;
  }

  function setGenerating(isGenerating) {
    if (!generationStatusEl) return;
    generationStatusEl.hidden = !isGenerating;
  }

  function setGenerationStatusText(text) {
    if (generationStatusTextEl) {
      generationStatusTextEl.textContent = text;
    }
  }

  function setModelStatus(state, text) {
    if (!modelStatusEl) return;
    modelStatusEl.dataset.state = state || "idle";
    modelStatusEl.textContent = text || "";
  }

  function formatModelLabel(name) {
    const meta = modelMeta.get(name);
    if (!meta) return name;
    const displayName = meta.label || name;
    const bits = [];
    if (meta.size_gb) bits.push(meta.size_gb + " GB");
    if (meta.parameter_size && !meta.label) bits.push(meta.parameter_size);
    return bits.length ? displayName + " (" + bits.join(", ") + ")" : displayName;
  }

  function isOpenRouterModel(modelName) {
    const meta = modelMeta.get(modelName);
    return !!(meta && meta.provider === "openrouter");
  }

  async function warmupModel(modelName) {
    if (!modelName) return;
    if (warmModels.has(modelName)) {
      setModelStatus("warm", formatModelLabel(modelName) + " ready.");
      return;
    }

    warmupSeq += 1;
    const mySeq = warmupSeq;
    currentWarmupSeq = mySeq;
    currentWarmupModel = modelName;

    const label = formatModelLabel(modelName);
    const started = Date.now();
    const isOpenRouter = isOpenRouterModel(modelName);
    setModelStatus(
      "warming",
      isOpenRouter
        ? "Checking " + label + "..."
        : "Warming up " + label + "... (first load can take 30-60 s)"
    );
    const tick = isOpenRouter
      ? null
      : setInterval(function () {
          if (currentWarmupSeq !== mySeq) return;
          const secs = Math.floor((Date.now() - started) / 1000);
          setModelStatus(
            "warming",
            "Warming up " + label + "... " + secs + " s elapsed"
          );
        }, 1000);

    try {
      const resp = await fetch("/warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      if (tick) clearInterval(tick);
      if (currentWarmupSeq !== mySeq) return;

      if (!resp.ok) {
        setModelStatus(
          "error",
          "Warmup failed for " + label + " (HTTP " + resp.status + ")"
        );
        return;
      }
      const data = await resp.json();
      if (currentWarmupSeq !== mySeq) return;

      if (data && data.ok) {
        warmModels.add(modelName);
        const loadTxt =
          typeof data.load_seconds === "number" && data.load_seconds > 0
            ? " (loaded in " + data.load_seconds + " s)"
            : "";
        setModelStatus("warm", label + " ready" + loadTxt + ".");
      } else {
        const errMsg = data && data.error ? data.error : "unknown error";
        setModelStatus("error", "Warmup failed for " + label + ": " + errMsg);
      }
    } catch (err) {
      if (tick) clearInterval(tick);
      if (currentWarmupSeq !== mySeq) return;
      setModelStatus(
        "error",
        "Warmup failed for " + label + ": " + (err && err.message ? err.message : err)
      );
    }
  }

  modeOptions.forEach(function (opt) {
    opt.addEventListener("click", function () {
      const mode = opt.getAttribute("data-mode");
      if (!mode || mode === currentMode) return;
      currentMode = mode;
      applyModeUi();
      clearOutputs();
    });
  });
  applyModeUi();

  function addCustomTagFromRow(addBtn) {
    const row = addBtn.closest(".custom-tag-row");
    if (!row) return;
    const input = row.querySelector(".custom-tag-input");
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    if (selectedTags.has(raw)) return;

    const group = row.closest(".tag-group");
    if (!group) return;
    const customTagList = group.querySelector(".custom-tag-list");
    if (!customTagList) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn tag-btn-custom " + SELECTED_CLASS;
    btn.setAttribute("data-tag", raw);
    btn.setAttribute("aria-pressed", "true");

    const labelSpan = document.createElement("span");
    labelSpan.className = "tag-label";
    labelSpan.textContent = raw;

    const removeSpan = document.createElement("span");
    removeSpan.className = "tag-remove";
    removeSpan.setAttribute("aria-label", "Remove tag");
    removeSpan.textContent = "\u00d7";

    btn.appendChild(labelSpan);
    btn.appendChild(removeSpan);

    customTagList.appendChild(btn);
    syncSelectedTags();
    input.value = "";
  }

  function findTemplateListEl(category) {
    return templateListEls.find(function (el) {
      return (el.getAttribute("data-category") || "") === category;
    }) || null;
  }

  function ensureSelectedTemplateIds(category) {
    if (!selectedTemplatesByCategory.has(category)) {
      selectedTemplatesByCategory.set(category, []);
    }
    return selectedTemplatesByCategory.get(category);
  }

  function removeSelectedTemplate(category, templateId) {
    const current = ensureSelectedTemplateIds(category);
    const next = current.filter(function (id) {
      return id !== templateId;
    });
    selectedTemplatesByCategory.set(category, next);
    renderSelectedTemplates(category);
    syncSelectedTags();
  }

  function renderSelectedTemplates(category) {
    const listEl = findTemplateListEl(category);
    if (!listEl) return;
    listEl.innerHTML = "";
    const ids = ensureSelectedTemplateIds(category);
    const templateMap = getCategoryTemplateMap(category);
    ids.forEach(function (templateId) {
      const template = templateMap.get(templateId);
      if (!template) return;
      const chip = document.createElement("span");
      chip.className = "template-chip";
      chip.setAttribute("data-template-id", templateId);
      chip.textContent = template.label;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "template-chip__remove";
      removeBtn.setAttribute("aria-label", "Remove template");
      removeBtn.textContent = "\u00d7";
      removeBtn.addEventListener("click", function () {
        removeSelectedTemplate(category, templateId);
      });
      chip.appendChild(removeBtn);
      listEl.appendChild(chip);
    });
  }

  function collectCategoryTagsForTemplate(category) {
    const tags = [];
    const selectedDropdown = selectedDropdownTags.get(category);
    if (selectedDropdown) tags.push(selectedDropdown);

    const customTags = selectedCustomTagsByCategory.get(category) || [];
    customTags.forEach(function (tag) {
      if (!tags.includes(tag)) tags.push(tag);
    });

    const templateTags = selectedTemplateTagsByCategory.get(category) || [];
    templateTags.forEach(function (tag) {
      if (!tags.includes(tag)) tags.push(tag);
    });
    return tags;
  }

  function appendTemplateOption(selectEl, template) {
    if (!selectEl || !template) return;
    const opt = document.createElement("option");
    opt.value = template.id;
    opt.textContent = template.label + (template.is_predefined ? " (predefined)" : "");
    opt.setAttribute("data-template-tags", (template.tags || []).join(" || "));
    opt.setAttribute("data-is-predefined", template.is_predefined ? "true" : "false");
    selectEl.appendChild(opt);
  }

  function updateTemplateOption(selectEl, template) {
    if (!selectEl || !template) return;
    const opt = Array.from(selectEl.options).find(function (option) {
      return option.value === template.id;
    });
    if (!opt) {
      appendTemplateOption(selectEl, template);
      return;
    }
    opt.textContent = template.label + (template.is_predefined ? " (predefined)" : "");
    opt.setAttribute("data-template-tags", (template.tags || []).join(" || "));
    opt.setAttribute("data-is-predefined", template.is_predefined ? "true" : "false");
  }

  function findTemplateSelectForCategory(category) {
    return categoryTemplateSelectEls.find(function (el) {
      return (el.getAttribute("data-category") || "") === category;
    }) || null;
  }

  function findTemplateEditButtonForCategory(category) {
    return templateEditOpenBtns.find(function (btn) {
      return (btn.getAttribute("data-category") || "") === category;
    }) || null;
  }

  function syncTemplateEditButton(category) {
    const selectEl = findTemplateSelectForCategory(category);
    const editBtn = findTemplateEditButtonForCategory(category);
    if (!selectEl || !editBtn) return;
    const template = getCategoryTemplateMap(category).get(selectEl.value);
    const canEdit = !!(template && template.is_predefined !== true);
    editBtn.disabled = !canEdit;
    editBtn.title = canEdit ? "" : "Only saved templates can be edited.";
  }

  function parseTemplateTagsInput(value) {
    const seen = new Set();
    const tags = [];
    String(value || "")
      .split(/\r?\n|,/)
      .forEach(function (raw) {
        const tag = String(raw || "").trim();
        const key = tag.toLowerCase();
        if (!tag || seen.has(key)) return;
        seen.add(key);
        tags.push(tag);
      });
    return tags;
  }

  document.querySelectorAll(".custom-tag-add").forEach(function (addBtn) {
    addBtn.addEventListener("click", function () {
      addCustomTagFromRow(addBtn);
    });
    const row = addBtn.closest(".custom-tag-row");
    const input = row && row.querySelector(".custom-tag-input");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addCustomTagFromRow(addBtn);
        }
      });
    }
  });

  document.querySelectorAll(".template-add-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const category = (btn.getAttribute("data-category") || "").trim();
      if (!category) return;
      const selectEl = categoryTemplateSelectEls.find(function (el) {
        return (el.getAttribute("data-category") || "") === category;
      });
      if (!selectEl || !selectEl.value) return;
      const selectedIds = ensureSelectedTemplateIds(category);
      if (!selectedIds.includes(selectEl.value)) {
        selectedIds.push(selectEl.value);
      }
      selectedTemplatesByCategory.set(category, selectedIds);
      renderSelectedTemplates(category);
      syncSelectedTags();
    });
  });

  function flushCustomTagInputForCategory(category) {
    const cat = String(category || "").trim();
    if (!cat) return;
    const esc = cat.replace(/"/g, '\\"');
    const input = document.querySelector(
      '.custom-tag-row .custom-tag-input[data-category="' + esc + '"]'
    );
    if (!input || !input.value.trim()) return;
    const row = input.closest(".custom-tag-row");
    if (!row) return;
    const addBtn = row.querySelector(".custom-tag-add");
    if (addBtn) addCustomTagFromRow(addBtn);
  }

  categoryTemplateSelectEls.forEach(function (selectEl) {
    const category = (selectEl.getAttribute("data-category") || "").trim();
    syncTemplateEditButton(category);
    selectEl.addEventListener("change", function () {
      syncTemplateEditButton(category);
    });
  });

  async function persistCategoryTemplate(category, label, explicitTags) {
    const trimmed = String(label || "").trim();
    if (!trimmed || !category) {
      return { ok: false, error: "Missing name or category." };
    }

    const tags = Array.isArray(explicitTags) ? explicitTags : collectCategoryTagsForTemplate(category);
    if (!tags.length) {
      return {
        ok: false,
        error: "Select or add at least one tag in this category first.",
      };
    }

    try {
      const resp = await fetch("/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: trimmed,
          category: category,
          tags: tags,
        }),
      });
      if (!resp.ok) {
        let detail = "";
        try {
          const errBody = await resp.json();
          if (errBody && typeof errBody.error === "string") {
            detail = ": " + errBody.error;
          }
        } catch {
          /* noop */
        }
        return {
          ok: false,
          error: "Could not create template (HTTP " + resp.status + ")" + detail + ".",
        };
      }
      const created = await resp.json();
      registerTemplate(created);

      const selectEl = categoryTemplateSelectEls.find(function (el) {
        return (el.getAttribute("data-category") || "") === category;
      });
      if (selectEl) {
        appendTemplateOption(selectEl, created);
        selectEl.value = created.id;
      }
      syncTemplateEditButton(category);
      const selectedIds = ensureSelectedTemplateIds(category);
      if (!selectedIds.includes(created.id)) {
        selectedIds.push(created.id);
      }
      selectedTemplatesByCategory.set(category, selectedIds);
      renderSelectedTemplates(category);
      syncSelectedTags();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          "Could not reach the server: " +
          (err && err.message ? err.message : String(err)),
      };
    }
  }

  async function updateCategoryTemplate(templateId, category, label, tags) {
    const trimmed = String(label || "").trim();
    if (!templateId || !trimmed || !category) {
      return { ok: false, error: "Missing template, name, or category." };
    }
    if (!Array.isArray(tags) || !tags.length) {
      return { ok: false, error: "Add at least one tag to this template." };
    }

    try {
      const resp = await fetch("/templates/" + encodeURIComponent(templateId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: trimmed,
          category: category,
          tags: tags,
        }),
      });
      if (!resp.ok) {
        let detail = "";
        try {
          const errBody = await resp.json();
          if (errBody && typeof errBody.error === "string") {
            detail = ": " + errBody.error;
          }
        } catch {
          /* noop */
        }
        return {
          ok: false,
          error: "Could not update template (HTTP " + resp.status + ")" + detail + ".",
        };
      }
      const updated = await resp.json();
      registerTemplate(updated);
      const selectEl = findTemplateSelectForCategory(category);
      if (selectEl) {
        updateTemplateOption(selectEl, updated);
        selectEl.value = updated.id;
      }
      renderSelectedTemplates(category);
      syncTemplateEditButton(category);
      syncSelectedTags();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          "Could not reach the server: " +
          (err && err.message ? err.message : String(err)),
      };
    }
  }

  (function TemplateCreateModal() {
    const modal = document.getElementById("template-create-modal");
    const titleEl = document.getElementById("template-create-modal-title");
    const nameInput = document.getElementById("template-create-name-input");
    const tagsInput = document.getElementById("template-create-tags-input");
    const nameError = document.getElementById("template-create-name-error");
    const confirmBtn = document.getElementById("template-create-confirm-btn");
    const cancelBtn = document.getElementById("template-create-cancel-btn");
    if (!modal || !nameInput || !tagsInput || !confirmBtn || !cancelBtn) return;

    let pendingCategory = "";
    let pendingTemplateId = "";
    let isSaving = false;
    const defaultErrorText =
      nameError && nameError.textContent ? nameError.textContent : "Please enter a name.";

    function showError(message) {
      if (!nameError) return;
      nameError.textContent = message || defaultErrorText;
      nameError.hidden = false;
    }

    function hideError() {
      if (!nameError) return;
      nameError.hidden = true;
      nameError.textContent = defaultErrorText;
    }

    function closeModal() {
      modal.hidden = true;
      hideError();
      pendingCategory = "";
      pendingTemplateId = "";
      isSaving = false;
      confirmBtn.disabled = false;
    }

    function setModalMode(mode) {
      const isEdit = mode === "edit";
      if (titleEl) titleEl.textContent = isEdit ? "Edit template" : "Create template";
      confirmBtn.textContent = isEdit ? "Save" : "Create";
    }

    function openCreateModal(category) {
      const cat = String(category || "").trim();
      if (!cat) return;
      flushCustomTagInputForCategory(cat);
      syncSelectedTags();
      pendingCategory = cat;
      pendingTemplateId = "";
      setModalMode("create");
      hideError();
      nameInput.value = "";
      tagsInput.value = collectCategoryTagsForTemplate(cat).join("\n");
      isSaving = false;
      confirmBtn.disabled = false;
      modal.hidden = false;
      setTimeout(function () {
        nameInput.focus();
      }, 0);
    }

    function openEditModal(category, templateId) {
      const cat = String(category || "").trim();
      const id = String(templateId || "").trim();
      const template = getCategoryTemplateMap(cat).get(id);
      if (!cat || !template || template.is_predefined === true) return;
      pendingCategory = cat;
      pendingTemplateId = id;
      setModalMode("edit");
      hideError();
      nameInput.value = template.label || "";
      tagsInput.value = (template.tags || []).join("\n");
      isSaving = false;
      confirmBtn.disabled = false;
      modal.hidden = false;
      setTimeout(function () {
        nameInput.focus();
        nameInput.select();
      }, 0);
    }

    function confirmSave() {
      if (isSaving) return;
      const label = (nameInput.value || "").trim();
      if (!label) {
        showError("Please enter a name.");
        nameInput.focus();
        return;
      }
      const category = pendingCategory;
      if (!category) {
        showError("No category selected. Reopen the dialog and try again.");
        return;
      }
      const tags = parseTemplateTagsInput(tagsInput.value);
      if (!tags.length) {
        showError("Add at least one tag.");
        tagsInput.focus();
        return;
      }
      hideError();
      isSaving = true;
      confirmBtn.disabled = true;
      const savePromise = pendingTemplateId
        ? updateCategoryTemplate(pendingTemplateId, category, label, tags)
        : persistCategoryTemplate(category, label, tags);
      savePromise
        .then(function (result) {
          if (result && result.ok) {
            closeModal();
            return;
          }
          showError((result && result.error) || "Could not create template.");
        })
        .finally(function () {
          isSaving = false;
          confirmBtn.disabled = false;
        });
    }

    document.querySelectorAll(".template-create-open-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openCreateModal((btn.getAttribute("data-category") || "").trim());
      });
    });

    templateEditOpenBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const category = (btn.getAttribute("data-category") || "").trim();
        const selectEl = findTemplateSelectForCategory(category);
        if (!selectEl || !selectEl.value) return;
        openEditModal(category, selectEl.value);
      });
    });

    confirmBtn.addEventListener("click", confirmSave);
    cancelBtn.addEventListener("click", closeModal);
    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    });
    tagsInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Escape") return;
        if (modal.hidden) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        closeModal();
      },
      true
    );
  })();

  document.addEventListener("click", function (e) {
    const removeEl = e.target.closest(".tag-remove");
    const btn = e.target.closest(".tag-btn");
    if (!btn) return;

    if (removeEl && btn.classList.contains("tag-btn-custom")) {
      e.preventDefault();
      e.stopPropagation();
      btn.remove();
      syncSelectedTags();
      return;
    }

    if (removeEl) return;

    if (btn.classList.contains(SELECTED_CLASS)) {
      btn.classList.remove(SELECTED_CLASS);
      btn.setAttribute("aria-pressed", "false");
    } else {
      btn.classList.add(SELECTED_CLASS);
      btn.setAttribute("aria-pressed", "true");
    }
    syncSelectedTags();
  });

  function pickRandomDropdownOption(selectEl) {
    const choices = Array.from(selectEl.options).filter(function (option) {
      return !!option.value;
    });
    if (!choices.length) return "";
    const selected = choices[Math.floor(Math.random() * choices.length)];
    return selected.value;
  }

  function randomizeSingleTagDropdown(selectEl, shouldSync) {
    if (!selectEl) return;
    const category = selectEl.getAttribute("data-category") || "";
    const hasTemplateSelections =
      (selectedTemplatesByCategory.get(category) || []).length > 0;
    const hasCustomTags =
      (selectedCustomTagsByCategory.get(category) || []).length > 0;
    if (hasTemplateSelections || hasCustomTags) {
      return;
    }
    const randomValue = pickRandomDropdownOption(selectEl);
    selectEl.value = randomValue;
    setDropdownSelection(category, randomValue);
    if (shouldSync !== false) {
      syncSelectedTags();
    }
  }

  function randomizeTagDropdowns() {
    syncSelectedTags();
    tagSelectEls.forEach(function (selectEl) {
      randomizeSingleTagDropdown(selectEl, false);
    });
    syncSelectedTags();
  }

  if (tagsRandomizeBtn) {
    tagsRandomizeBtn.addEventListener("click", randomizeTagDropdowns);
  }

  tagCategoryRandomizeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const category = btn.getAttribute("data-category") || "";
      if (!category) return;
      const matchingSelect = tagSelectEls.find(function (selectEl) {
        return (selectEl.getAttribute("data-category") || "") === category;
      });
      randomizeSingleTagDropdown(matchingSelect, true);
    });
  });

  function getAspectRatioValue() {
    const checked = document.querySelector(
      'input[name="aspect_ratio"]:checked'
    );
    return checked ? checked.value : "1:1";
  }

  function appendMjParamFlags(streamedText) {
    const base = stripMjWeights(streamedText);
    const parts = [];
    parts.push("--ar " + getAspectRatioValue());
    if (mjVersion && mjVersion.value) parts.push(mjVersion.value.trim());
    if (mjQuality && mjQuality.value) parts.push(mjQuality.value.trim());
    if (mjStyle && mjStyle.value.trim()) parts.push(mjStyle.value.trim());
    if (mjStylize && mjStylize.value) parts.push("--s " + mjStylize.value.trim());
    if (mjChaos && mjChaos.value) parts.push("--c " + mjChaos.value.trim());
    if (mjWeird && mjWeird.value) parts.push("--w " + mjWeird.value.trim());
    const flags = parts.join(" ");
    if (!base) return flags;
    return base + " " + flags;
  }

  function getSelectedOptionText(selectEl) {
    if (!selectEl) return "";
    const idx = selectEl.selectedIndex;
    if (idx < 0 || !selectEl.options[idx]) return "";
    return selectEl.options[idx].textContent.trim();
  }

  function getSdxlGenerationSettingsText() {
    return [
      "\u2022 Steps: " + (sdxlSteps && sdxlSteps.value ? sdxlSteps.value : ""),
      "\u2022 CFG Scale: " + (sdxlCfg && sdxlCfg.value ? sdxlCfg.value : ""),
      "\u2022 Sampler: " + getSelectedOptionText(sdxlSampler),
      "\u2022 Scheduler: " + getSelectedOptionText(sdxlScheduler),
    ].join("\n");
  }

  function parseSdxlOutput(text) {
    const t = text.trim();
    const negMatch = t.match(/\bNEGATIVE\s*:\s*/i);
    if (!negMatch) return null;
    const negIndex = negMatch.index;
    const before = t.slice(0, negIndex);
    const after = t.slice(negIndex + negMatch[0].length).trim();
    const posMatch = before.match(/\bPOSITIVE\s*:\s*([\s\S]*)/i);
    if (!posMatch) return null;
    const positive = posMatch[1].trim();
    return { positive: positive, negative: ensureRequiredNegativeTerms(after) };
  }

  function ensureRequiredNegativeTerms(negativeText) {
    const requiredTerms = [
      "signature",
      "signed",
      "autograph",
      "watermark",
      "logo",
      "text",
      "username",
      "artist name",
      "copyright",
    ];
    const rawTerms = (negativeText || "")
      .split(",")
      .map(function (term) {
        return term.trim();
      })
      .filter(Boolean);
    const seen = new Set(
      rawTerms.map(function (term) {
        return term.toLowerCase();
      })
    );

    requiredTerms.forEach(function (term) {
      if (!seen.has(term)) {
        rawTerms.push(term);
        seen.add(term);
      }
    });

    return rawTerms.join(", ");
  }

  function ensureModelOptions(models, defaultModel) {
    if (!modelSelect) return;

    modelMeta.clear();
    const names = [];
    if (Array.isArray(models)) {
      models.forEach(function (m) {
        let name = "";
        let meta = null;
        if (typeof m === "string") {
          name = m.trim();
        } else if (m && typeof m === "object" && typeof m.name === "string") {
          name = m.name.trim();
          meta = {
            size_gb: typeof m.size_gb === "number" ? m.size_gb : null,
            family: typeof m.family === "string" ? m.family : null,
            parameter_size:
              typeof m.parameter_size === "string" ? m.parameter_size : null,
            provider: typeof m.provider === "string" ? m.provider : null,
            label: typeof m.label === "string" ? m.label : null,
            disabled: m.disabled === true,
          };
        }
        if (!name) return;
        if (meta) modelMeta.set(name, meta);
        names.push(name);
      });
    }

    const fallbackModel =
      typeof defaultModel === "string" && defaultModel.trim()
        ? defaultModel.trim()
        : DEFAULT_MODEL;
    const optionValues = names.length ? names : [fallbackModel];
    modelSelect.innerHTML = "";

    function optionTextFor(model) {
      const meta = modelMeta.get(model);
      if (meta && meta.label) {
        if (meta.parameter_size) {
          return meta.label + " (" + meta.parameter_size + ")";
        }
        return meta.label;
      }
      if (meta && meta.size_gb) {
        return model + "  (" + meta.size_gb + " GB)";
      }
      return model;
    }

    function makeOption(model) {
      const meta = modelMeta.get(model);
      const opt = document.createElement("option");
      opt.value = model;
      opt.textContent = optionTextFor(model);
      if (meta && meta.disabled) {
        opt.disabled = true;
        opt.textContent += " - unavailable";
      }
      return opt;
    }

    const grouped = { ollama: [], openrouter: [], other: [] };
    optionValues.forEach(function (model) {
      const meta = modelMeta.get(model);
      const provider = (meta && meta.provider) || "other";
      if (provider === "ollama") grouped.ollama.push(model);
      else if (provider === "openrouter") grouped.openrouter.push(model);
      else grouped.other.push(model);
    });

    function appendGroup(label, arr) {
      if (!arr.length) return;
      const og = document.createElement("optgroup");
      og.label = label;
      arr.forEach(function (model) {
        og.appendChild(makeOption(model));
      });
      modelSelect.appendChild(og);
    }

    if (grouped.ollama.length > 0 || grouped.openrouter.length > 0) {
      appendGroup("Ollama (local)", grouped.ollama);
      appendGroup("OpenRouter (cloud)", grouped.openrouter);
      grouped.other.forEach(function (model) {
        modelSelect.appendChild(makeOption(model));
      });
    } else {
      optionValues.forEach(function (model) {
        modelSelect.appendChild(makeOption(model));
      });
    }

    function isEnabled(model) {
      const meta = modelMeta.get(model);
      return !(meta && meta.disabled);
    }

    const enabledValues = optionValues.filter(isEnabled);
    const preferred =
      enabledValues.includes(DEFAULT_MODEL)
        ? DEFAULT_MODEL
        : enabledValues.includes(fallbackModel)
          ? fallbackModel
          : enabledValues[0] || optionValues[0];
    modelSelect.value = preferred;
  }

  async function loadModels() {
    if (!modelSelect) return;
    ensureModelOptions([], DEFAULT_MODEL);
    try {
      const resp = await fetch("/models");
      if (!resp.ok) {
        setModelStatus(
          "error",
          "Could not load model list (HTTP " + resp.status + ")."
        );
        return;
      }
      const data = await resp.json();
      ensureModelOptions(data.models, data.default_model);
      if (data && data.error) {
        setModelStatus("error", data.error);
      } else if (
        !Array.isArray(data.models) ||
        data.models.length === 0
      ) {
        setModelStatus(
          "error",
          "Ollama returned no models. Run 'ollama list' to confirm installations."
        );
      } else {
        setModelStatus("idle", "");
      }
    } catch (err) {
      setModelStatus(
        "error",
        "Could not reach /models: " +
          (err && err.message ? err.message : err)
      );
    }
  }

  async function loadUserTemplates() {
    try {
      const resp = await fetch("/templates");
      if (!resp.ok) return;
      const items = await resp.json();
      if (!Array.isArray(items)) return;
      items.forEach(function (template) {
        registerTemplate(template);
      });
      categoryTemplateSelectEls.forEach(function (selectEl) {
        const category = (selectEl.getAttribute("data-category") || "").trim();
        if (!category) return;
        const currentIds = new Set(
          Array.from(selectEl.options).map(function (opt) {
            return String(opt.value || "").trim();
          })
        );
        const templateMap = getCategoryTemplateMap(category);
        templateMap.forEach(function (template, templateId) {
          if (!currentIds.has(templateId)) {
            appendTemplateOption(selectEl, template);
          }
        });
      });
    } catch {
      /* noop */
    }
  }

  async function runGenerate(extra) {
    const freeText = freeTextEl ? freeTextEl.value : "";
    syncSelectedTags();
    const selectedByCategory = {};
    tagSelectEls.forEach(function (selectEl) {
      const category = (selectEl.getAttribute("data-category") || "").trim();
      if (!category) return;
      const predefinedTags = [];
      if (selectEl.value) {
        predefinedTags.push(selectEl.value);
      }
      const customTags = (selectedCustomTagsByCategory.get(category) || []).slice();
      const templateIds = (selectedTemplatesByCategory.get(category) || []).slice();
      const templateTags = (selectedTemplateTagsByCategory.get(category) || []).slice();
      const allTags = [];
      predefinedTags.concat(customTags, templateTags).forEach(function (tag) {
        const safe = String(tag || "").trim();
        if (safe && !allTags.includes(safe)) allTags.push(safe);
      });
      selectedByCategory[category] = {
        predefined_tags: predefinedTags,
        custom_tags: customTags,
        template_ids: templateIds,
        template_tags: templateTags,
        all_tags: allTags,
      };
    });
    const payload = Object.assign(
      {
        tags: Array.from(selectedTags),
        selected_by_category: selectedByCategory,
        free_text: freeText,
        output_mode: currentMode,
        model:
          modelSelect && modelSelect.value
            ? modelSelect.value
            : DEFAULT_MODEL,
      },
      extra || {}
    );

    clearOutputs();
    generateBtn.disabled = true;
    setGenerating(true);

    const activeModel = payload.model;
    const startedAt = Date.now();
    let firstTokenAt = null;
    setGenerationStatusText("Thinking...");
    const statusTick = setInterval(function () {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      if (firstTokenAt === null) {
        const loadingMsg =
          warmModels.has(activeModel) || isOpenRouterModel(activeModel)
            ? "Thinking... " + secs + " s"
            : "Loading " + activeModel + " into memory... " + secs + " s";
        setGenerationStatusText(loadingMsg);
      } else {
        setGenerationStatusText("Streaming... " + secs + " s");
      }
    }, 500);

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errText = "";
        try {
          const errJson = await response.json();
          if (
            errJson &&
            errJson.error === "missing_category_tags" &&
            Array.isArray(errJson.missing_categories) &&
            errJson.missing_categories.length
          ) {
            errText =
              "Missing tags for categories: " +
              errJson.missing_categories.join(", ") +
              ".";
          } else if (errJson && typeof errJson.message === "string") {
            errText = errJson.message;
          } else if (errJson && typeof errJson.error === "string") {
            errText = errJson.error;
          } else {
            errText = JSON.stringify(errJson || {});
          }
        } catch {
          errText = await response.text();
        }
        if (outputPositive) {
          outputPositive.value =
            "[Request failed: " + response.status + "] " + (errText || "");
        }
        return;
      }

      if (!response.body) {
        const full = await response.text();
        if (currentMode === "mj") {
          if (outputPositive) outputPositive.value = appendMjParamFlags(full);
        } else if (currentMode === "sdxl") {
          const parsed = parseSdxlOutput(full);
          if (parsed && outputPositive && outputNegative) {
            outputPositive.value = parsed.positive;
            outputNegative.value = parsed.negative;
            if (outputSettings) {
              outputSettings.value = getSdxlGenerationSettingsText();
            }
          } else if (outputPositive) {
            outputPositive.value = full;
            if (outputNegative) outputNegative.value = "";
            if (outputSettings) outputSettings.value = "";
          }
        } else if (outputPositive) {
          outputPositive.value = full;
        }
        return;
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && firstTokenAt === null) {
          firstTokenAt = Date.now();
          warmModels.add(activeModel);
        }
        accumulated += value;
        if (outputPositive) {
          outputPositive.value = accumulated;
          outputPositive.scrollTop = outputPositive.scrollHeight;
        }
      }

      if (currentMode === "mj") {
        if (outputPositive) {
          outputPositive.value = appendMjParamFlags(accumulated);
        }
      } else if (currentMode === "sdxl") {
        const parsed = parseSdxlOutput(accumulated);
        if (parsed && outputPositive && outputNegative) {
          outputPositive.value = parsed.positive;
          outputNegative.value = parsed.negative;
          if (outputSettings) {
            outputSettings.value = getSdxlGenerationSettingsText();
          }
        } else if (outputPositive) {
          outputPositive.value = accumulated;
          if (outputNegative) outputNegative.value = "";
          if (outputSettings) outputSettings.value = "";
        }
      }
    } catch (err) {
      if (outputPositive) {
        outputPositive.value =
          "[Error: " + (err && err.message ? err.message : err) + "]";
      }
    } finally {
      clearInterval(statusTick);
      generateBtn.disabled = false;
      setGenerating(false);
      setOutputHasContent(!!(outputPositive && outputPositive.value.trim()));
      if (warmModels.has(activeModel)) {
        const label = formatModelLabel(activeModel);
        const totalSecs = Math.max(
          0,
          Math.round((Date.now() - startedAt) / 1000)
        );
        setModelStatus(
          "warm",
          label + " ready (last run: " + totalSecs + " s)."
        );
      }
      scheduleGeneratedTitleFromOutput(activeModel);
    }
  }

  async function runRefine() {
    if (!outputPositive || !refineBtn) return;
    const currentText = outputPositive.value || "";
    if (!currentText.trim()) return;

    const basePrompt =
      currentMode === "mj"
        ? stripMjWeights(stripMjFlags(currentText))
        : currentText.trim();
    if (!basePrompt) return;

    const activeModel =
      modelSelect && modelSelect.value ? modelSelect.value : DEFAULT_MODEL;

    refineBtn.disabled = true;
    generateBtn.disabled = true;
    if (saveFavoriteBtn) saveFavoriteBtn.hidden = true;
    setGenerating(true);

    const startedAt = Date.now();
    let firstTokenAt = null;
    setGenerationStatusText("Refining...");
    const statusTick = setInterval(function () {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      if (firstTokenAt === null) {
        setGenerationStatusText("Refining... " + secs + " s");
      } else {
        setGenerationStatusText("Refining (streaming)... " + secs + " s");
      }
    }, 500);

    outputPositive.value = "";

    try {
      const response = await fetch("/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: basePrompt, model: activeModel }),
      });

      if (!response.ok) {
        const errText = await response.text();
        outputPositive.value =
          "[Refine failed: " + response.status + "] " + (errText || "");
        return;
      }

      let accumulated = "";
      if (!response.body) {
        accumulated = await response.text();
        outputPositive.value = accumulated;
      } else {
        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && firstTokenAt === null) {
            firstTokenAt = Date.now();
            warmModels.add(activeModel);
          }
          accumulated += value;
          outputPositive.value = accumulated;
          outputPositive.scrollTop = outputPositive.scrollHeight;
        }
      }

      const refined = accumulated.trim();
      if (currentMode === "mj") {
        outputPositive.value = appendMjParamFlags(refined);
      } else {
        outputPositive.value = refined;
      }
    } catch (err) {
      outputPositive.value =
        "[Refine error: " + (err && err.message ? err.message : err) + "]";
    } finally {
      clearInterval(statusTick);
      generateBtn.disabled = false;
      refineBtn.disabled = false;
      setGenerating(false);
      setOutputHasContent(!!outputPositive.value.trim());
      scheduleGeneratedTitleFromOutput(activeModel);
    }
  }

  generateBtn.addEventListener("click", function () {
    runGenerate({});
  });

  if (refineBtn) {
    refineBtn.addEventListener("click", function () {
      runRefine();
    });
  }

  if (modelSelect) {
    modelSelect.addEventListener("change", function () {
      const name = modelSelect.value;
      if (name) warmupModel(name);
    });
  }

  (async function initializeModels() {
    await loadModels();
    if (modelSelect && modelSelect.value) {
      warmupModel(modelSelect.value);
    }
  })();

  (async function initializeTemplates() {
    await loadUserTemplates();
    tagSelectEls.forEach(function (selectEl) {
      const category = (selectEl.getAttribute("data-category") || "").trim();
      if (!category) return;
      selectedTemplatesByCategory.set(category, []);
      renderSelectedTemplates(category);
    });
    syncSelectedTags();
  })();

  async function copyTextareaValue(textareaEl) {
    if (!textareaEl) return;
    const text = textareaEl.value || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const wasReadOnly = textareaEl.readOnly;
      textareaEl.readOnly = false;
      textareaEl.select();
      textareaEl.setSelectionRange(0, text.length);
      try {
        document.execCommand("copy");
      } finally {
        textareaEl.readOnly = wasReadOnly;
      }
    }
  }

  if (copyPositiveBtn) {
    copyPositiveBtn.addEventListener("click", function () {
      copyTextareaValue(outputPositive);
    });
  }

  if (copyNegativeBtn) {
    copyNegativeBtn.addEventListener("click", function () {
      copyTextareaValue(outputNegative);
    });
  }

  function resetTagSelection() {
    document.querySelectorAll(".tag-btn-custom").forEach(function (btn) {
      btn.remove();
    });
    tagSelectEls.forEach(function (selectEl) {
      selectEl.value = "";
      const category = selectEl.getAttribute("data-category") || "";
      selectedDropdownTags.delete(category);
    });
    selectedTemplatesByCategory.forEach(function (_, category) {
      selectedTemplatesByCategory.set(category, []);
      renderSelectedTemplates(category);
    });
    syncSelectedTags();
  }

  function clearAllBuilderState() {
    resetTagSelection();
    if (freeTextEl) freeTextEl.value = "";
    clearOutputs();
    const defaultAspect = document.querySelector(
      'input[name="aspect_ratio"][value="1:1"]'
    );
    if (defaultAspect) {
      defaultAspect.checked = true;
    }
    syncAspectDisplay();
  }

  clearBtn.addEventListener("click", function () {
    clearAllBuilderState();
  });

  function findSelectForTag(tagValue) {
    const safeTag = String(tagValue || "").trim();
    if (!safeTag) return null;
    for (let i = 0; i < tagSelectEls.length; i += 1) {
      const selectEl = tagSelectEls[i];
      if (!selectEl || selectEl.value) continue;
      const hasOption = Array.from(selectEl.options).some(function (option) {
        return option.value === safeTag;
      });
      if (hasOption) return selectEl;
    }
    return null;
  }

  function addCustomTagProgrammatically(tagValue, preferredCategory) {
    const safe = String(tagValue || "").trim();
    if (!safe) return;
    if (selectedTags.has(safe)) return;

    let row = null;
    if (preferredCategory) {
      const esc = preferredCategory.replace(/"/g, '\\"');
      row = document.querySelector(
        '.custom-tag-row .custom-tag-input[data-category="' + esc + '"]'
      );
      if (row) row = row.closest(".custom-tag-row");
    }
    if (!row) {
      row = document.querySelector(".custom-tag-row");
    }
    if (!row) return;

    const group = row.closest(".tag-group");
    if (!group) return;
    const customTagList = group.querySelector(".custom-tag-list");
    if (!customTagList) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn tag-btn-custom " + SELECTED_CLASS;
    btn.setAttribute("data-tag", safe);
    btn.setAttribute("aria-pressed", "true");

    const labelSpan = document.createElement("span");
    labelSpan.className = "tag-label";
    labelSpan.textContent = safe;

    const removeSpan = document.createElement("span");
    removeSpan.className = "tag-remove";
    removeSpan.setAttribute("aria-label", "Remove tag");
    removeSpan.textContent = "\u00d7";

    btn.appendChild(labelSpan);
    btn.appendChild(removeSpan);
    customTagList.appendChild(btn);
    syncSelectedTags();
  }

  function applyTagsFromFavorite(tags) {
    if (!Array.isArray(tags)) return;
    tags.forEach(function (tag) {
      if (!tag || typeof tag !== "string") return;
      const matchingSelect = findSelectForTag(tag);
      if (matchingSelect) {
        matchingSelect.value = tag;
        const category = matchingSelect.getAttribute("data-category") || "";
        setDropdownSelection(category, tag);
      } else {
        addCustomTagProgrammatically(tag, "Subject");
      }
    });
    syncSelectedTags();
  }

  function setModeProgrammatically(mode) {
    if (!mode || (mode !== "mj" && mode !== "sdxl")) return;
    if (mode === currentMode) return;
    currentMode = mode;
    applyModeUi();
  }

  (function FavoritesManager() {
    const STORAGE_KEY = "promptFavorites";
    const MIGRATED_KEY = "promptFavoritesMigrated";
    const listEl = document.getElementById("favorites-list");
    const emptyEl = document.getElementById("favorites-empty");
    const modal = document.getElementById("favorite-save-modal");
    const nameInput = document.getElementById("favorite-name-input");
    const nameError = document.getElementById("favorite-name-error");
    const confirmBtn = document.getElementById("favorite-confirm-btn");
    const cancelBtn = document.getElementById("favorite-cancel-btn");

    if (!listEl || !modal || !nameInput || !confirmBtn || !cancelBtn) return;

    let favorites = [];

    function sanitizeFavorites(items) {
      if (!Array.isArray(items)) return [];
      return items.filter(function (f) {
        return f && typeof f === "object" && typeof f.id === "string";
      });
    }

    function loadLegacyLocalFavorites() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return sanitizeFavorites(parsed);
      } catch {
        return [];
      }
    }

    function markLegacyMigrated() {
      try {
        localStorage.setItem(MIGRATED_KEY, "1");
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }

    function hasLegacyMigrationMarker() {
      try {
        return localStorage.getItem(MIGRATED_KEY) === "1";
      } catch {
        return false;
      }
    }

    async function fetchFavorites() {
      try {
        const resp = await fetch("/saved-prompts");
        if (!resp.ok) {
          favorites = [];
          return;
        }
        const data = await resp.json();
        favorites = sanitizeFavorites(data);
      } catch {
        favorites = [];
      }
    }

    function formatRelative(ts) {
      if (!ts || typeof ts !== "number") return "";
      const diff = Date.now() - ts;
      const secs = Math.floor(diff / 1000);
      if (secs < 60) return "just now";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return mins + "m ago";
      const hours = Math.floor(mins / 60);
      if (hours < 24) return hours + "h ago";
      const days = Math.floor(hours / 24);
      if (days < 7) return days + "d ago";
      try {
        return new Date(ts).toLocaleDateString();
      } catch {
        return days + "d ago";
      }
    }

    function makePreview(text) {
      const raw = String(text || "").replace(/\s+/g, " ").trim();
      if (raw.length <= 160) return raw;
      return raw.slice(0, 160).trim() + "\u2026";
    }

    function render() {
      listEl.innerHTML = "";
      if (!favorites.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      const sorted = favorites
        .slice()
        .sort(function (a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        });

      sorted.forEach(function (fav) {
        listEl.appendChild(buildCard(fav));
      });
    }

    function buildCard(fav) {
      const card = document.createElement("article");
      card.className = "favorite-card";
      card.setAttribute("role", "listitem");
      card.dataset.favId = fav.id;

      const header = document.createElement("div");
      header.className = "favorite-card-header";

      const name = document.createElement("h3");
      name.className = "favorite-name";
      name.textContent = fav.name || "(unnamed)";
      header.appendChild(name);

      const meta = document.createElement("span");
      meta.className = "favorite-meta";

      const badge = document.createElement("span");
      badge.className = "favorite-mode-badge";
      badge.dataset.mode = fav.mode === "sdxl" ? "sdxl" : "mj";
      badge.textContent = fav.mode === "sdxl" ? "SDXL" : "MJ";
      meta.appendChild(badge);

      const time = document.createElement("span");
      time.textContent = formatRelative(fav.createdAt);
      meta.appendChild(time);

      header.appendChild(meta);
      card.appendChild(header);

      const preview = document.createElement("p");
      preview.className = "favorite-preview";
      preview.textContent = makePreview(fav.positive || "");
      card.appendChild(preview);

      const actions = document.createElement("div");
      actions.className = "favorite-card-actions";

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "btn";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", function () {
        loadIntoBuilder(fav);
      });
      actions.appendChild(loadBtn);

      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "btn btn-primary";
      useBtn.textContent = "Use in new generation";
      useBtn.addEventListener("click", function () {
        useInNewGeneration(fav);
      });
      actions.appendChild(useBtn);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-delete";
      delBtn.textContent = "Delete";
      delBtn.setAttribute("aria-label", "Delete favorite " + (fav.name || ""));
      delBtn.addEventListener("click", function () {
        if (!confirm('Delete favorite "' + (fav.name || "") + '"?')) return;
        deleteById(fav.id);
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      return card;
    }

    function deleteById(id) {
      (async function () {
        try {
          await fetch("/saved-prompts/" + encodeURIComponent(id), {
            method: "DELETE",
          });
        } catch {
          /* noop */
        } finally {
          await fetchFavorites();
          render();
        }
      })();
    }

    function snapshotCurrent(name) {
      const positiveRaw = outputPositive ? outputPositive.value : "";
      const negativeRaw = outputNegative ? outputNegative.value : "";
      const cleanedPositive =
        currentMode === "mj"
          ? stripMjWeights(stripMjFlags(positiveRaw))
          : positiveRaw.trim();
      return {
        name: String(name || "").trim() || "Untitled favorite",
        mode: currentMode === "sdxl" ? "sdxl" : "mj",
        positive: cleanedPositive,
        negative: currentMode === "sdxl" ? negativeRaw.trim() : "",
        tags: Array.from(selectedTags),
        freeText: freeTextEl ? freeTextEl.value : "",
        createdAt: Date.now(),
      };
    }

    function loadIntoBuilder(fav) {
      if (!fav) return;

      setModeProgrammatically(fav.mode);
      resetTagSelection();
      applyTagsFromFavorite(fav.tags);

      if (freeTextEl) {
        freeTextEl.value = typeof fav.freeText === "string" ? fav.freeText : "";
      }

      if (outputPositive) {
        const positive = typeof fav.positive === "string" ? fav.positive : "";
        outputPositive.value =
          fav.mode === "mj" && positive ? appendMjParamFlags(positive) : positive;
      }
      if (outputNegative) {
        outputNegative.value =
          fav.mode === "sdxl" && typeof fav.negative === "string"
            ? fav.negative
            : "";
      }
      if (outputSettings) {
        outputSettings.value =
          fav.mode === "sdxl" ? getSdxlGenerationSettingsText() : "";
      }

      setOutputHasContent(!!(outputPositive && outputPositive.value.trim()));

      outputTitleGenerationSeq += 1;
      applyGeneratedTitle("");

      const target = document.querySelector(".output-panel");
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function useInNewGeneration(fav) {
      if (!fav) return;
      setModeProgrammatically(fav.mode);
      resetTagSelection();
      applyTagsFromFavorite(fav.tags);
      if (freeTextEl) {
        freeTextEl.value = typeof fav.freeText === "string" ? fav.freeText : "";
      }
      if (outputPositive) outputPositive.value = "";
      if (outputNegative) outputNegative.value = "";
      if (outputSettings) outputSettings.value = "";
      setOutputHasContent(false);
      runGenerate({});
    }

    function openModal() {
      if (!outputPositive || !outputPositive.value.trim()) return;
      if (nameError) nameError.hidden = true;
      let suggestion = "";
      if (
        outputGeneratedTitleEl &&
        !outputGeneratedTitleEl.hidden &&
        outputGeneratedTitleEl.textContent.trim() &&
        outputGeneratedTitleEl.textContent.trim() !== "\u2026"
      ) {
        suggestion = outputGeneratedTitleEl.textContent.trim();
      }
      if (!suggestion) {
        suggestion = makePreview(
          currentMode === "mj"
            ? stripMjFlags(outputPositive.value)
            : outputPositive.value
        )
          .slice(0, 48)
          .trim();
      }
      nameInput.value = suggestion;
      modal.hidden = false;
      setTimeout(function () {
        nameInput.focus();
        nameInput.select();
      }, 0);
    }

    function closeModal() {
      modal.hidden = true;
      if (nameError) nameError.hidden = true;
    }

    function confirmSave() {
      (async function () {
      const name = (nameInput.value || "").trim();
      if (!name) {
        if (nameError) nameError.hidden = false;
        nameInput.focus();
        return;
      }
      const entry = snapshotCurrent(name);
      try {
        const resp = await fetch("/saved-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (!resp.ok) return;
      } catch {
        return;
      }
      await fetchFavorites();
      render();
      closeModal();
      })();
    }

    async function migrateLegacyFavoritesIfNeeded() {
      if (hasLegacyMigrationMarker()) return;
      const legacy = loadLegacyLocalFavorites();
      if (!legacy.length) {
        markLegacyMigrated();
        return;
      }
      if (favorites.length > 0) {
        markLegacyMigrated();
        return;
      }
      for (const item of legacy) {
        try {
          const payload = {
            name: String(item.name || "").trim() || "Untitled favorite",
            mode: item.mode === "sdxl" ? "sdxl" : "mj",
            positive: String(item.positive || "").trim(),
            negative: String(item.negative || "").trim(),
            tags: Array.isArray(item.tags) ? item.tags : [],
            freeText: typeof item.freeText === "string" ? item.freeText : "",
            createdAt:
              typeof item.createdAt === "number" && item.createdAt > 0
                ? item.createdAt
                : Date.now(),
          };
          if (!payload.positive) continue;
          await fetch("/saved-prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch {
          /* noop */
        }
      }
      markLegacyMigrated();
    }

    if (saveFavoriteBtn) {
      saveFavoriteBtn.addEventListener("click", openModal);
    }
    confirmBtn.addEventListener("click", confirmSave);
    cancelBtn.addEventListener("click", closeModal);
    nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || modal.hidden) return;
      const tmplModal = document.getElementById("template-create-modal");
      if (tmplModal && !tmplModal.hidden) return;
      closeModal();
    });

    (async function initializeFavorites() {
      await fetchFavorites();
      await migrateLegacyFavoritesIfNeeded();
      await fetchFavorites();
      render();
    })();
  })();
})();
