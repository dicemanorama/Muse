---
name: MJ SDXL parameter upgrades
overview: Upgrade Midjourney and SDXL parameter UX and prompt post-processing to align with the requested 2026-friendly controls while preserving existing tag/repo/streaming behavior.
todos:
  - id: update-mj-panel
    content: Expand MJ parameter UI in index.html with new selects/defaults and quality/version polish
    status: completed
  - id: update-mj-flag-builder
    content: Update appendMjParamFlags() to include all MJ parameters in required order
    status: completed
  - id: append-sdxl-settings
    content: Append Generation settings block to SDXL negative output after parsing
    status: completed
  - id: ux-safety-pass
    content: Adjust output area/readability if needed and verify no regressions in existing interactions
    status: completed
  - id: optional-mj-system-prompt
    content: Polish MJ_SYSTEM_PROMPT wording to reinforce parameter separation
    status: completed
isProject: false
---

# Midjourney + SDXL Parameter Upgrade Plan

## Scope
Implement targeted UI and frontend logic updates in:
- [f:\Muse\prompt-builder\templates\index.html](f:\Muse\prompt-builder\templates\index.html)
- [f:\Muse\prompt-builder\static\script.js](f:\Muse\prompt-builder\static\script.js)
- [f:\Muse\prompt-builder\config.py](f:\Muse\prompt-builder\config.py) (optional prompt wording polish)

## Implementation Steps
1. Update Midjourney controls in `index.html` inside `#mj-params`.
   - Keep existing `Version`, `Quality`, and `Style` rows.
   - Make version clearly labeled with `--v 7` as default selected option.
   - Replace quality choices with `--q 1`, `--q 2`, `--q 4` (remove `--q 0.5`).
   - Add new rows for `Stylize (--s)`, `Chaos (--c)`, and `Weird (--w)` with requested option sets and defaults.
   - Keep class usage consistent with existing `param-row`, `param-label`, `param-select` to avoid layout regressions.
   - Add short helper text near new controls (small inline hint text) if it fits current panel styling cleanly.

2. Extend MJ param handling in `script.js`.
   - Bind DOM references for new MJ selects.
   - Refactor `appendMjParamFlags()` to append flags in exact order:
     - `--ar {aspect}`
     - selected version (e.g. `--v 7`)
     - selected quality
     - selected style (if non-empty)
     - `--s {stylize}`
     - `--c {chaos}`
     - `--w {weird}`
   - Ensure only non-empty values are appended.
   - Preserve existing MJ streaming and all non-MJ behaviors.

3. Add SDXL generation settings summary in `script.js` after final parse.
   - Read values from `#sdxl-steps`, `#sdxl-cfg`, `#sdxl-sampler`, and `#sdxl-scheduler`.
   - Append a formatted `Generation settings:` block to the negative prompt output when SDXL parse succeeds.
   - Reuse both response paths (non-stream and stream-finalization) so output is consistent.

4. Ensure SDXL negative output area remains usable.
   - Increase effective space via rows and/or rely on existing output styling plus scroll behavior.
   - If needed, apply minimal CSS adjustment in [f:\Muse\prompt-builder\static\style.css](f:\Muse\prompt-builder\static\style.css) to guarantee readability without breaking responsiveness.

5. Optional prompt polish in `config.py`.
   - Slightly tighten `MJ_SYSTEM_PROMPT` wording to emphasize descriptive content only and that all MJ flags are appended by the app.

## Validation Checklist
- MJ mode output appends flags in correct order and with no empty flags.
- Default MJ controls: version `--v 7`, quality list only `1/2/4`, requested defaults for stylize/chaos/weird.
- SDXL mode still parses `POSITIVE:` / `NEGATIVE:` and now includes readable generation settings block.
- Existing features still work: tag selection/custom tags, repo manager + roll, clear all, copy, mode toggle, aspect display, streaming behavior.