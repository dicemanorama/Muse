(function () {
  "use strict";

  const selectedTags = new Set();
  const selectedDropdownTags = new Map();

  let currentMode = "mj";

  const freeTextEl = document.getElementById("free-text");
  const outputPositive = document.getElementById("output-positive");
  const outputNegative = document.getElementById("output-negative");
  const outputSettings = document.getElementById("output-settings");
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
  const tagCategoryRandomizeBtns = Array.from(
    document.querySelectorAll(".tag-category-randomize-btn")
  );
  const tagsRandomizeBtn = document.getElementById("tags-randomize-btn");
  const DEFAULT_MODEL = "hermes3:8b";

  const warmModels = new Set();
  let warmupSeq = 0;
  let currentWarmupSeq = 0;
  let currentWarmupModel = null;
  const modelMeta = new Map();

  const SELECTED_CLASS = "is-selected";

  function syncSelectedTags() {
    selectedTags.clear();
    selectedDropdownTags.forEach(function (value) {
      if (value) selectedTags.add(value);
    });
    document.querySelectorAll(".tag-btn-custom." + SELECTED_CLASS).forEach(function (btn) {
      const tag = (btn.getAttribute("data-tag") || "").trim();
      if (tag) selectedTags.add(tag);
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
    if (outputPositive) outputPositive.value = "";
    if (outputNegative) outputNegative.value = "";
    if (outputSettings) outputSettings.value = "";
    setOutputHasContent(false);
  }

  const MJ_FLAG_RE = /\s*--(?:ar|v|q|s|c|w|style|stylize|chaos|weird|niji|iw|seed)\s+\S+/gi;

  function stripMjFlags(text) {
    if (!text) return "";
    return String(text).replace(MJ_FLAG_RE, "").trim();
  }

  function setOutputHasContent(hasContent) {
    const has = !!hasContent;
    if (refineBtn) refineBtn.disabled = !has;
    if (saveFavoriteBtn) saveFavoriteBtn.hidden = !has;
  }

  let rolledRepoSubject = null;
  let rolledRepoStyle = null;

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

  function isGroqModel(modelName) {
    const meta = modelMeta.get(modelName);
    return !!(meta && meta.provider === "groq");
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
    const isGroq = isGroqModel(modelName);
    setModelStatus(
      "warming",
      isGroq
        ? "Checking " + label + "..."
        : "Warming up " + label + "... (first load can take 30-60 s)"
    );
    const tick = isGroq
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
    const randomValue = pickRandomDropdownOption(selectEl);
    selectEl.value = randomValue;
    const category = selectEl.getAttribute("data-category") || "";
    setDropdownSelection(category, randomValue);
    if (shouldSync !== false) {
      syncSelectedTags();
    }
  }

  function randomizeTagDropdowns() {
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
    const base = streamedText.trim();
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

    const grouped = { ollama: [], groq: [], other: [] };
    optionValues.forEach(function (model) {
      const meta = modelMeta.get(model);
      const provider = (meta && meta.provider) || "other";
      if (provider === "ollama") grouped.ollama.push(model);
      else if (provider === "groq") grouped.groq.push(model);
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

    if (grouped.ollama.length > 0 || grouped.groq.length > 0) {
      appendGroup("Ollama (local)", grouped.ollama);
      appendGroup("Groq (cloud)", grouped.groq);
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

  async function runGenerate(extra) {
    const freeText = freeTextEl ? freeTextEl.value : "";
    const generatedFromRoll = {
      repo_subject: rolledRepoSubject,
      repo_style: rolledRepoStyle,
    };
    const payload = Object.assign(
      {
        tags: Array.from(selectedTags),
        free_text: freeText,
        output_mode: currentMode,
        model:
          modelSelect && modelSelect.value
            ? modelSelect.value
            : DEFAULT_MODEL,
      },
      generatedFromRoll,
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
          warmModels.has(activeModel) || isGroqModel(activeModel)
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
        const errText = await response.text();
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
    }
  }

  async function runRefine() {
    if (!outputPositive || !refineBtn) return;
    const currentText = outputPositive.value || "";
    if (!currentText.trim()) return;

    const basePrompt =
      currentMode === "mj" ? stripMjFlags(currentText) : currentText.trim();
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

  (function RepoManager() {
    const selectEl = document.getElementById("repo-select");
    const newBtn = document.getElementById("repo-new-btn");
    const editBtn = document.getElementById("repo-edit-btn");
    const rollBtn = document.getElementById("roll-btn");
    const rollClearBtn = document.getElementById("roll-clear-btn");
    const rollResult = document.getElementById("roll-result");
    const rollSubjectBadge = document.getElementById("roll-subject-badge");
    const rollStyleBadge = document.getElementById("roll-style-badge");

    const modal = document.getElementById("repo-modal");
    const nameInput = document.getElementById("repo-name-input");
    const subjectsInput = document.getElementById("repo-subjects-input");
    const stylesInput = document.getElementById("repo-styles-input");
    const saveBtn = document.getElementById("repo-save-btn");
    const deleteBtn = document.getElementById("repo-delete-btn");
    const cancelBtn = document.getElementById("repo-cancel-btn");

    if (!selectEl || !newBtn || !editBtn || !rollBtn || !modal) return;

    const STORAGE_KEY = "repoSelectedId";
    let repos = [];
    let selectedId = localStorage.getItem(STORAGE_KEY) || null;
    let editingId = null;

    function getSelectedRepo() {
      if (!selectedId) return null;
      return repos.find(function (r) {
        return r && r.id === selectedId;
      }) || null;
    }

    function persistSelection() {
      if (selectedId) {
        localStorage.setItem(STORAGE_KEY, selectedId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    function refreshSelect() {
      selectEl.innerHTML = "";
      if (!repos.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "(no repos)";
        opt.disabled = true;
        opt.selected = true;
        selectEl.appendChild(opt);
        selectedId = null;
        persistSelection();
        return;
      }

      const hasSelected = repos.some(function (r) {
        return r && r.id === selectedId;
      });
      if (!hasSelected) {
        selectedId = repos[0].id;
      }

      repos.forEach(function (r) {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name || "(unnamed)";
        if (r.id === selectedId) opt.selected = true;
        selectEl.appendChild(opt);
      });
      persistSelection();
    }

    function openEditor(repo) {
      if (!repo) return;
      editingId = repo.id;
      nameInput.value = repo.name || "";
      subjectsInput.value = (repo.subjects || []).join(", ");
      stylesInput.value = (repo.styles || []).join(", ");
      modal.hidden = false;
    }

    function closeEditor() {
      editingId = null;
      modal.hidden = true;
    }

    function parseCsv(value) {
      return String(value || "")
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(function (s) {
          return s.length > 0;
        });
    }

    function clearRolledSelection() {
      rolledRepoSubject = null;
      rolledRepoStyle = null;
      if (rollResult) rollResult.hidden = true;
      if (rollSubjectBadge) rollSubjectBadge.textContent = "";
      if (rollStyleBadge) rollStyleBadge.textContent = "";
    }

    async function loadRepos() {
      try {
        const resp = await fetch("/repos");
        if (!resp.ok) return;
        const data = await resp.json();
        repos = Array.isArray(data) ? data : [];
      } catch {
        repos = [];
      }
      refreshSelect();
    }

    selectEl.addEventListener("change", function () {
      selectedId = selectEl.value || null;
      persistSelection();
      clearRolledSelection();
    });

    newBtn.addEventListener("click", async function () {
      try {
        const resp = await fetch("/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Repo" }),
        });
        if (!resp.ok) return;
        const created = await resp.json();
        repos.push(created);
        selectedId = created.id;
        refreshSelect();
        openEditor(created);
      } catch {
        /* noop */
      }
    });

    editBtn.addEventListener("click", function () {
      const repo = getSelectedRepo();
      if (!repo) return;
      openEditor(repo);
    });

    saveBtn.addEventListener("click", async function () {
      if (!editingId) return;
      const payload = {
        name: (nameInput.value || "").trim() || "New Repo",
        subjects: parseCsv(subjectsInput.value),
        styles: parseCsv(stylesInput.value),
      };
      try {
        const resp = await fetch(
          "/repos/" + encodeURIComponent(editingId),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!resp.ok) return;
        const updated = await resp.json();
        const idx = repos.findIndex(function (r) {
          return r && r.id === updated.id;
        });
        if (idx >= 0) {
          repos[idx] = updated;
        } else {
          repos.push(updated);
        }
        refreshSelect();
        closeEditor();
      } catch {
        /* noop */
      }
    });

    deleteBtn.addEventListener("click", async function () {
      if (!editingId) return;
      try {
        const resp = await fetch(
          "/repos/" + encodeURIComponent(editingId),
          { method: "DELETE" }
        );
        if (!resp.ok) return;
        repos = repos.filter(function (r) {
          return r && r.id !== editingId;
        });
        if (selectedId === editingId) {
          selectedId = repos.length ? repos[0].id : null;
        }
        refreshSelect();
        closeEditor();
      } catch {
        /* noop */
      }
    });

    cancelBtn.addEventListener("click", function () {
      closeEditor();
    });

    rollBtn.addEventListener("click", function () {
      const repo = getSelectedRepo();
      if (!repo) return;
      const subjects = Array.isArray(repo.subjects) ? repo.subjects : [];
      const styles = Array.isArray(repo.styles) ? repo.styles : [];
      if (!subjects.length || !styles.length) {
        clearRolledSelection();
        return;
      }
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const style = styles[Math.floor(Math.random() * styles.length)];
      rolledRepoSubject = subject;
      rolledRepoStyle = style;
      if (rollSubjectBadge) rollSubjectBadge.textContent = subject;
      if (rollStyleBadge) rollStyleBadge.textContent = style;
      if (rollResult) rollResult.hidden = false;
    });

    if (rollClearBtn) {
      rollClearBtn.addEventListener("click", function () {
        clearRolledSelection();
      });
    }

    loadRepos();
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
    const listEl = document.getElementById("favorites-list");
    const emptyEl = document.getElementById("favorites-empty");
    const modal = document.getElementById("favorite-save-modal");
    const nameInput = document.getElementById("favorite-name-input");
    const nameError = document.getElementById("favorite-name-error");
    const confirmBtn = document.getElementById("favorite-confirm-btn");
    const cancelBtn = document.getElementById("favorite-cancel-btn");

    if (!listEl || !modal || !nameInput || !confirmBtn || !cancelBtn) return;

    let favorites = [];

    function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          favorites = [];
          return;
        }
        const parsed = JSON.parse(raw);
        favorites = Array.isArray(parsed)
          ? parsed.filter(function (f) {
              return f && typeof f === "object" && typeof f.id === "string";
            })
          : [];
      } catch {
        favorites = [];
      }
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch {
        /* quota exceeded - silent */
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

    function makeId() {
      return (
        "fav_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 8)
      );
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
      favorites = favorites.filter(function (f) {
        return f.id !== id;
      });
      persist();
      render();
    }

    function snapshotCurrent(name) {
      const positiveRaw = outputPositive ? outputPositive.value : "";
      const negativeRaw = outputNegative ? outputNegative.value : "";
      const cleanedPositive =
        currentMode === "mj"
          ? stripMjFlags(positiveRaw)
          : positiveRaw.trim();
      return {
        id: makeId(),
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
      const suggestion = makePreview(
        currentMode === "mj"
          ? stripMjFlags(outputPositive.value)
          : outputPositive.value
      )
        .slice(0, 48)
        .trim();
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
      const name = (nameInput.value || "").trim();
      if (!name) {
        if (nameError) nameError.hidden = false;
        nameInput.focus();
        return;
      }
      const entry = snapshotCurrent(name);
      favorites.push(entry);
      persist();
      render();
      closeModal();
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
      if (e.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    load();
    render();
  })();
})();
