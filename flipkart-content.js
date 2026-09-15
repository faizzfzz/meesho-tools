// Flipkart Seller Hub Autofill engine (seller.flipkart.com).
//
// Built from a live investigation report (2026-09) that found TWO structurally
// different edit surfaces which need different fill strategies:
//
// 1. "Add a Single Listing" wizard (also "Manage Variants -> Add a new variant"):
//    tabs are real role="tab" buttons; only the ACTIVE tab's panel has any DOM
//    content - inactive tabs are unmounted, not just hidden. No id/name/data-testid
//    on fields; every dropdown (single or multi) is a custom component whose
//    closed-state input is a decoy search box, not the real control. See the
//    per-kind handlers below for what actually works for each control type.
//    The "Variant addition" tab is gated: blocked with a "Fix errors first" banner
//    until Image addition + Price/Stock + Product Description are all complete.
//
// 2. "Edit Listing" drawer (pencil icon on an existing single/non-variant SKU):
//    one long scrollable form, everything mounted at once, no tab gating. This
//    surface behaves like a normal page, so it reuses the same generic
//    selector-based engine the Meesho tool uses (see fkFillField/fkAutoScanDrawer).
//
// Duplicate-id-across-variant-rows (the Meesho bug) could not be confirmed or
// ruled out live - no variant listing was available to test against. Flag any
// autofill weirdness on a variant grid specifically.

function fkIsValidDomain(){
  return window.location.hostname === "seller.flipkart.com";
}

let fkHighlightOverlay = null;
let fkStopCaptureButton = null;
let fkStopAutofillButton = null;
let fkIsCaptureMode = false;
let fkIsAutofilling = false;
let fkShouldStopAutofill = false;
let fkCurrentProfileId = null;

function fkSleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fkInitializeUI(){
  if(!fkIsValidDomain()) return;
  fkHighlightOverlay = fkCreateOverlay();
  fkStopCaptureButton = fkCreateStopCaptureButton();
  fkStopAutofillButton = fkCreateStopAutofillButton();
}

// ─── Generic helpers (shared by the drawer path and plain wizard fields) ──────

function fkParseAndQuerySelector(selector){
  if(!selector) return null;
  const parts = selector.split("||");
  const base = parts[0];
  const index = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  const matches = document.querySelectorAll(base);
  return matches.length === 0 ? null : (matches[index] || null);
}

function fkWaitForElement(selector, timeout = 300){
  return new Promise(resolve => {
    const check = () => fkParseAndQuerySelector(selector);
    const found = check();
    if(found) return resolve(found);
    const observer = new MutationObserver(() => {
      const el = check();
      if(el){ observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

function fkWaitForTextElement(text, timeout = 2500){
  return new Promise(resolve => {
    const needle = text.toLowerCase().trim();
    const check = () => {
      const nodes = document.querySelectorAll('li, div[role="option"], p, span');
      for(const node of nodes){
        if(node.offsetParent === null) continue;
        const t = node.innerText ? node.innerText.toLowerCase().trim() : "";
        if(t === needle || t.includes(needle)) return node.closest('li, div[role="option"]') || node;
      }
      return null;
    };
    const found = check();
    if(found) return resolve(found);
    const observer = new MutationObserver(() => {
      const el = check();
      if(el){ observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

function fkSetNativeValue(el, value){
  const proto = Object.getPrototypeOf(el);
  const protoSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if(protoSetter){
    protoSetter.call(el, value);
  }else{
    el.value = value;
  }
}

function fkIsDropdown(el){
  if(el.tagName === "SELECT") return false;
  if(el.readOnly) return true;
  const role = el.getAttribute("role");
  const hasPopup = el.getAttribute("aria-haspopup");
  const autocomplete = el.getAttribute("aria-autocomplete");
  return role === "combobox" || hasPopup === "listbox" || autocomplete === "list" || autocomplete === "both";
}

// Plain generic fill: native <select>/<input>. Confirmed reliable for the
// drawer surface's fields, and for the wizard's plain text/number inputs.
async function fkFillField(el, value){
  el.scrollIntoView({ behavior: "instant", block: "center" });
  await fkSleep(50);

  if(el.tagName === "SELECT"){
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if(el.tagName === "INPUT" && fkIsDropdown(el)){
    // Best-effort generic combobox handling for anything not covered by the
    // wizard's dedicated dropdown/tag-input handlers below.
    el.focus();
    el.click();
    fkSetNativeValue(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    const option = await fkWaitForTextElement(value, 2000);
    if(option){
      option.scrollIntoView({ behavior: "instant", block: "center" });
      option.click();
    }
    await fkSleep(100);
    document.body.click();
    return;
  }

  if(el.readOnly || el.disabled) return;
  const sanitized = el.type === "number" ? String(value).trim().replace(/[^0-9.\-+eE]/g, "") : value;
  fkSetNativeValue(el, sanitized);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fkIsCapturableElement(el){
  if(!el || el.offsetParent === null) return false;
  if(el.disabled) return false;
  const tag = el.tagName;
  if(tag === "INPUT"){
    const type = (el.type || "text").toLowerCase();
    return !["button","submit","reset","hidden","file","checkbox","radio","image"].includes(type) && !!(el.value && el.value.trim());
  }
  if(tag === "TEXTAREA" || tag === "SELECT") return !!(el.value && el.value.trim());
  const role = el.getAttribute && el.getAttribute("role");
  if(el.isContentEditable || role === "combobox"){
    const text = (el.innerText || el.textContent || "").trim();
    return !!text;
  }
  return false;
}

// ─── Visual feedback (overlay / toasts / flash effects) ────────────────────────

function fkCreateOverlay(){
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.backgroundColor = "rgba(40, 116, 240, 0.3)";
  el.style.border = "2px solid #2874f0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "999999";
  el.style.display = "none";
  el.style.transition = "all 0.1s ease";
  document.body.appendChild(el);
  return el;
}

function fkShowToast(message, isError = false){
  const el = document.createElement("div");
  el.innerText = message;
  el.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isError ? "linear-gradient(180deg, #ff4444 0%, #cc0000 100%)" : "linear-gradient(180deg, #2874f0 0%, #1f5cc0 100%)"};
    color: #fff;
    padding: 12px 20px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    border-radius: 6px;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    opacity: 0;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = "1");
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function fkFlashElement(el, color, label){
  if(!el) return;
  const outline = el.style.outline, boxShadow = el.style.boxShadow, transition = el.style.transition;
  el.style.transition = "all 0.2s ease";
  el.style.outline = `3px solid ${color}`;
  el.style.boxShadow = `0 0 20px ${color}`;
  if(label){
    const rect = el.getBoundingClientRect();
    const tag = document.createElement("div");
    tag.innerText = label;
    tag.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY - 26}px;
      background: ${color};
      color: #fff;
      padding: 3px 10px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      font-weight: bold;
      border-radius: 4px;
      z-index: 1000000;
      pointer-events: none;
    `;
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 800);
  }
  setTimeout(() => {
    el.style.outline = outline;
    el.style.boxShadow = boxShadow;
    el.style.transition = transition;
  }, 500);
}

function fkShowFillEffect(el){ fkFlashElement(el, "#2874f0", "✓ FILLED"); }
function fkShowSkipEffect(el){ fkFlashElement(el, "#ffaa00", "» SKIP"); }
function fkShowScanCaptureEffect(el){ fkFlashElement(el, "#29d8ff", "⚑ CAPTURED"); }

function fkShowNotFoundEffect(label){
  const el = document.createElement("div");
  const text = label.length > 30 ? "..." + label.slice(-27) : label;
  el.innerHTML = `<span style="color:#ff6666">✕</span> NOT FOUND: ${text}`;
  el.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: #222;
    color: #ff6666;
    padding: 6px 16px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: bold;
    border-radius: 6px;
    z-index: 1000000;
    pointer-events: none;
    white-space: nowrap;
    max-width: 90vw;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function fkHideOverlay(){
  if(fkHighlightOverlay) fkHighlightOverlay.style.display = "none";
}

function fkCreateStopCaptureButton(){
  const btn = document.createElement("button");
  btn.id = "flipkart-autofill-stop-btn";
  btn.innerText = "✕ Stop Capture";
  btn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000001;
    background: #d32f2f;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: none;
  `;
  btn.addEventListener("click", fkStopCaptureMode);
  document.body.appendChild(btn);
  return btn;
}

function fkStopCaptureMode(){
  fkIsCaptureMode = false;
  fkCurrentProfileId = null;
  document.body.style.cursor = "default";
  fkHideOverlay();
  if(fkStopCaptureButton) fkStopCaptureButton.style.display = "none";
  fkShowToast("Capture Mode OFF");
}

function fkStartCaptureMode(profileId){
  fkIsCaptureMode = true;
  fkCurrentProfileId = profileId;
  document.body.style.cursor = "crosshair";
  if(fkStopCaptureButton) fkStopCaptureButton.style.display = "block";
  fkShowToast("Capture Mode ON - click a plain text/number field (dropdowns and tag fields: use Auto Scan instead)");
}

function fkCreateStopAutofillButton(){
  const btn = document.createElement("button");
  btn.id = "flipkart-autofill-stop-autofill-btn";
  btn.innerText = "⬛ STOP AUTOFILL";
  btn.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000001;
    background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
    color: white;
    border: 3px solid #fff;
    padding: 12px 24px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: none;
  `;
  btn.addEventListener("click", () => {
    fkShouldStopAutofill = true;
    fkShowToast("STOPPING...");
  });
  document.body.appendChild(btn);
  return btn;
}

function fkShowStopAutofillButton(){ if(fkStopAutofillButton) fkStopAutofillButton.style.display = "block"; }
function fkHideStopAutofillButton(){ if(fkStopAutofillButton) fkStopAutofillButton.style.display = "none"; }

// ─── Wizard ("Add a Single Listing") support ───────────────────────────────────

const FK_WIZARD_TABS = [
  "Image addition",
  "Price, Stock and Shipping Information",
  "Product Description",
  "Additional Description",
  "Variant addition"
];

function fkIsWizardPage(){
  return !!document.querySelector('[role="tablist"] button[class*="TabBase"]');
}

function fkGetTabButtons(){
  return Array.from(document.querySelectorAll('[role="tablist"] button[class*="TabBase"]'));
}

function fkFindTabButton(tabTitle){
  return fkGetTabButtons().find(b => (b.textContent || "").includes(tabTitle));
}

async function fkSwitchToTab(tabTitle){
  const btn = fkFindTabButton(tabTitle);
  if(!btn) return false;
  btn.click();
  await fkSleep(400); // let the panel mount and any autosave from the previous tab settle
  return true;
}

function fkIsVariantTabBlocked(){
  return /fix errors first/i.test(document.body.innerText);
}

function fkGetActiveTabPanel(){
  const panels = document.querySelectorAll('[class*="TabPanelWrapper"]');
  const active = Array.from(panels).find(p => p.offsetParent !== null && p.innerHTML.length > 0);
  return active || document.body;
}

function fkGetWizardRows(){
  return Array.from(fkGetActiveTabPanel().querySelectorAll('[class*="EditAttributeItemWrapper"]'));
}

function fkGetRowLabel(row){
  const labelEl = row.querySelector('[class*="AttributeItemLabelName"]');
  if(!labelEl) return null;
  return (labelEl.textContent || "").trim().replace(/\s*\*$/, "");
}

function fkFindRowByLabel(labelText){
  const needle = labelText.trim().toLowerCase();
  return fkGetWizardRows().find(row => {
    const label = fkGetRowLabel(row);
    return label && label.toLowerCase() === needle;
  }) || null;
}

function fkGetOpenDropdownContainer(){
  const containers = document.querySelectorAll('[class*="DropdownContent"]');
  return Array.from(containers).find(c => c.offsetParent !== null) || null;
}

// Heuristic click target to open a row's dropdown: the search box that identifies a
// dropdown row is hidden (offsetParent === null) while closed, so we can't click it
// directly. The row's direct children are (in every case checked) a label wrapper and
// a control wrapper; clicking the control wrapper (the one NOT containing the label)
// opens it. This wasn't independently re-verified beyond the two dropdown fields
// already confirmed in the investigation - if a given field doesn't open, that's the
// first thing to check.
async function fkOpenDropdownForRow(row){
  const labelEl = row.querySelector('[class*="AttributeItemLabelName"]');
  let controlArea = null;
  for(const child of row.children){
    if(labelEl && child.contains(labelEl)) continue;
    controlArea = child;
  }
  (controlArea || row).click();
  await fkSleep(250);
}

async function fkCloseOpenDropdown(){
  document.body.click();
  await fkSleep(150);
}

// Reads the ACTUAL selected state of a single/multi-select row by opening it and
// inspecting the real radio/checkbox controls, rather than trusting the closed-state
// summary text (which for multi-select only ever shows a count, e.g. "2 Selected").
async function fkCaptureDropdownSelection(row){
  await fkOpenDropdownForRow(row);
  const container = fkGetOpenDropdownContainer();
  if(!container){ await fkCloseOpenDropdown(); return null; }

  let result = null;
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const radios = container.querySelectorAll('input[type="radio"]');

  if(checkboxes.length > 0){
    const checked = Array.from(checkboxes)
      .filter(c => c.checked)
      .map(c => c.id)
      .filter(id => id && !/select_all$/i.test(id));
    result = checked.length ? { kind: "multi-select", value: checked } : null;
  }else if(radios.length > 0){
    const checked = Array.from(radios).find(r => r.checked);
    result = checked ? { kind: "single-select", value: checked.value } : null;
  }

  await fkCloseOpenDropdown();
  return result;
}

// Classifies + reads a row that ISN'T a dropdown (plain input or tag input), or
// returns null if it looks like a dropdown (caller should use
// fkCaptureDropdownSelection instead, since that needs to open the row).
function fkReadSimpleRow(row){
  const tagContainer = row.querySelector('[class*="rti--container"]');
  if(tagContainer){
    const pills = Array.from(tagContainer.querySelectorAll('[class*="rti--tag"]'))
      .map(p => (p.textContent || "").replace(/[×x]\s*$/i, "").trim())
      .filter(Boolean);
    return pills.length ? { kind: "tag-input", value: pills } : null;
  }

  const directInput = Array.from(row.querySelectorAll("input")).find(i =>
    i.offsetParent !== null && !/search$/i.test(i.id || "")
  );
  if(directInput && (directInput.type === "text" || directInput.type === "number")){
    const value = (directInput.value || "").trim();
    return value ? { kind: directInput.type === "number" ? "number" : "text", value } : null;
  }

  return null;
}

function fkRowLooksLikeDropdown(row){
  return !!row.querySelector('input[id*="search" i]');
}

async function fkAutoScanWizardTab(profileId, tabTitle){
  const rows = fkGetWizardRows();
  let saved = 0;

  for(const row of rows){
    if(fkIsAutofilling) break; // safety, shouldn't normally happen during a scan
    const label = fkGetRowLabel(row);
    if(!label) continue;

    let record = null;
    const simple = fkReadSimpleRow(row);
    if(simple){
      record = { tab: tabTitle, label, kind: simple.kind, value: simple.value };
    }else if(fkRowLooksLikeDropdown(row)){
      const captured = await fkCaptureDropdownSelection(row);
      if(captured) record = { tab: tabTitle, label, kind: captured.kind, value: captured.value };
    }

    if(!record) continue;

    fkShowScanCaptureEffect(row);
    const ok = await new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: "SAVE_FIELD",
        payload: { profileId, store: "flipkartProfiles", field: record }
      }, res => resolve(!chrome.runtime.lastError && res && res.success));
    });
    if(ok) saved++;
    await fkSleep(70);
  }

  return saved;
}

// Writes a captured {kind, value} into a wizard row. Returns true/false.
async function fkFillWizardField(row, kind, value){
  if(kind === "text" || kind === "number"){
    const input = Array.from(row.querySelectorAll("input")).find(i => i.offsetParent !== null && !/search$/i.test(i.id || ""));
    if(!input) return false;
    const sanitized = kind === "number" ? String(value).trim().replace(/[^0-9.\-+eE]/g, "") : value;
    fkSetNativeValue(input, sanitized);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  if(kind === "single-select"){
    await fkOpenDropdownForRow(row);
    const container = fkGetOpenDropdownContainer();
    if(!container){ await fkCloseOpenDropdown(); return false; }
    const radio = Array.from(container.querySelectorAll('input[type="radio"]')).find(r => r.value === value);
    if(!radio){ await fkCloseOpenDropdown(); return false; }
    radio.click();
    await fkSleep(150);
    return true;
  }

  if(kind === "multi-select"){
    await fkOpenDropdownForRow(row);
    const container = fkGetOpenDropdownContainer();
    if(!container){ await fkCloseOpenDropdown(); return false; }
    const wanted = Array.isArray(value) ? value : [value];
    let anyOk = false;
    for(const optionId of wanted){
      const box = container.querySelector(`input[id="${CSS.escape(optionId)}"]`) || document.getElementById(optionId);
      if(box && !box.checked){ box.click(); anyOk = true; await fkSleep(80); }
      else if(box && box.checked){ anyOk = true; }
    }
    await fkCloseOpenDropdown();
    return anyOk;
  }

  if(kind === "tag-input"){
    const container = row.querySelector('[class*="rti--container"]');
    if(!container) return false;
    container.click();
    await fkSleep(150);
    const input = container.querySelector("input");
    if(!input) return false;
    const wanted = Array.isArray(value) ? value : [value];
    for(const tag of wanted){
      fkSetNativeValue(input, tag);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // react-tag-input-component only commits a tag on a real keydown - plain
      // input/change/blur events (the generic 5-step sequence) never reach it.
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      await fkSleep(120);
    }
    input.blur();
    return true;
  }

  return false;
}

// ─── Auto Scan (dispatches by page type) ───────────────────────────────────────

async function fkAutoScanDrawerFields(profileId){
  const candidates = Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"]'));
  const seen = new Set();
  const captured = [];

  for(const el of candidates){
    if(!fkIsCapturableElement(el)) continue;
    const selector = typeof getStableSelector === "function" ? getStableSelector(el) : null;
    if(!selector || seen.has(selector)) continue;
    const rawValue = "value" in el ? el.value : (el.innerText || el.textContent || "");
    const value = (rawValue || "").toString().trim();
    if(!value) continue;
    seen.add(selector);
    captured.push({ el, selector, value, type: el.type || el.getAttribute("role") || el.tagName.toLowerCase() });
  }

  if(captured.length === 0) return 0;

  let saved = 0;
  for(const item of captured){
    item.el.scrollIntoView({ behavior: "instant", block: "center" });
    fkShowScanCaptureEffect(item.el);
    const ok = await new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: "SAVE_FIELD",
        payload: { profileId, store: "flipkartProfiles", field: { selector: item.selector, type: item.type, value: item.value } }
      }, res => resolve(!chrome.runtime.lastError && res && res.success));
    });
    if(ok) saved++;
    await fkSleep(90);
  }
  return saved;
}

async function fkAutoScanFields(profileId){
  if(fkIsCaptureMode) fkStopCaptureMode();
  if(fkIsAutofilling) return void fkShowToast("Autofill running, please wait!", true);
  if(!profileId) return void fkShowToast("Error: No profile selected", true);

  fkShowToast("Scanning page for fields....");
  await fkSleep(150);

  if(!fkIsWizardPage()){
    const saved = await fkAutoScanDrawerFields(profileId);
    fkShowToast(saved > 0 ? `Auto Scan complete! Captured ${saved} field(s)` : "No filled fields found on this page", saved === 0);
    return;
  }

  let totalSaved = 0;
  for(const tabTitle of FK_WIZARD_TABS){
    const switched = await fkSwitchToTab(tabTitle);
    if(!switched) continue;
    if(tabTitle === "Variant addition" && fkIsVariantTabBlocked()) continue; // not accessible yet, nothing to scan
    totalSaved += await fkAutoScanWizardTab(profileId, tabTitle);
  }
  fkShowToast(totalSaved > 0 ? `Auto Scan complete! Captured ${totalSaved} field(s) across tabs` : "No filled fields found across any tab", totalSaved === 0);
}

// ─── Autofill (dispatches by page type, and by record shape per field) ────────

async function fkAutofillWizard(profileData, profileId){
  const tabFields = new Map();   // tabTitle -> [{tab,label,kind,value}]
  const plainFields = [];        // [{field:{selector,type,value}, done:false}] - manually
                                  // captured on the wizard's always-mounted plain inputs

  for(const field of profileData.fields){
    if(field.tab && field.label){
      if(!tabFields.has(field.tab)) tabFields.set(field.tab, []);
      tabFields.get(field.tab).push(field);
    }else if(field.selector){
      plainFields.push({ field, done: false });
    }
  }

  let filledCount = 0, skippedCount = 0;
  const notFound = [];

  const reportMissing = (label, kind, value) => {
    skippedCount++;
    notFound.push({ selector: label, type: kind, value });
  };

  for(const tabTitle of FK_WIZARD_TABS){
    if(fkShouldStopAutofill) break;
    const labelFields = tabFields.get(tabTitle) || [];
    const anyPlainPending = plainFields.some(p => !p.done);
    if(labelFields.length === 0 && !anyPlainPending) continue;

    const switched = await fkSwitchToTab(tabTitle);
    if(!switched){
      labelFields.forEach(f => reportMissing(`${tabTitle} › ${f.label}`, f.kind, f.value));
      continue;
    }
    if(tabTitle === "Variant addition" && fkIsVariantTabBlocked()){
      labelFields.forEach(f => reportMissing(`${tabTitle} › ${f.label}`, f.kind, f.value));
      continue;
    }

    for(const entry of plainFields){
      if(entry.done || fkShouldStopAutofill) continue;
      const el = fkParseAndQuerySelector(entry.field.selector);
      if(!el) continue;
      entry.done = true;
      const current = el.value ? el.value.trim() : "";
      if(current === String(entry.field.value).trim()){
        fkShowSkipEffect(el); skippedCount++; await fkSleep(80); continue;
      }
      try{
        await fkFillField(el, entry.field.value); fkShowFillEffect(el); filledCount++; await fkSleep(150);
      }catch(e){}
    }

    for(const field of labelFields){
      if(fkShouldStopAutofill) break;
      const row = fkFindRowByLabel(field.label);
      if(!row){ fkShowNotFoundEffect(field.label); reportMissing(`${tabTitle} › ${field.label}`, field.kind, field.value); continue; }
      try{
        const ok = await fkFillWizardField(row, field.kind, field.value);
        if(ok){ fkShowFillEffect(row); filledCount++; }
        else{ fkShowNotFoundEffect(field.label); reportMissing(`${tabTitle} › ${field.label}`, field.kind, field.value); }
      }catch(e){
        reportMissing(`${tabTitle} › ${field.label}`, field.kind, field.value);
      }
      await fkSleep(200); // let the wizard's autosave settle before the next write/tab switch
    }
  }

  plainFields.forEach(entry => {
    if(!entry.done) reportMissing(entry.field.selector, entry.field.type, entry.field.value);
  });

  return { filledCount, skippedCount, notFound };
}

async function fkAutofillDrawer(profileData){
  let filledCount = 0, skippedCount = 0;
  const notFound = [];

  for(const field of profileData.fields){
    if(fkShouldStopAutofill) break;
    if(!field.selector){ skippedCount++; continue; } // wizard-shaped field, not usable here
    const el = fkParseAndQuerySelector(field.selector) || await fkWaitForElement(field.selector);
    if(el){
      const current = el.value ? el.value.trim() : "";
      if(current === String(field.value).trim()){
        fkShowSkipEffect(el); skippedCount++; await fkSleep(100); continue;
      }
      if(current && !fkIsDropdown(el) && el.tagName !== "SELECT"){
        fkShowSkipEffect(el); skippedCount++; await fkSleep(100); continue;
      }
      try{
        await fkFillField(el, field.value); fkShowFillEffect(el); filledCount++; await fkSleep(150);
      }catch(e){}
    }else{
      fkShowNotFoundEffect(field.selector); skippedCount++;
      notFound.push({ selector: field.selector, type: field.type, value: field.value });
    }
  }

  return { filledCount, skippedCount, notFound };
}

async function fkAutofillProfile(profileData, profileId){
  if(!profileData || !profileData.fields) return;
  if(fkIsAutofilling) return void fkShowToast("Autofill already running!", true);
  fkIsAutofilling = true;
  fkShouldStopAutofill = false;
  fkShowStopAutofillButton();

  const result = fkIsWizardPage()
    ? await fkAutofillWizard(profileData, profileId)
    : await fkAutofillDrawer(profileData);

  if(!fkShouldStopAutofill) fkShowToast(`Done! Filled: ${result.filledCount}, Skipped: ${result.skippedCount}`);
  fkIsAutofilling = false;
  fkShouldStopAutofill = false;
  fkHideStopAutofillButton();

  if(profileId){
    try{
      await chrome.storage.local.set({ ["flipkartAutofillReport_" + profileId]: { filled: result.filledCount, skipped: result.skippedCount, notFound: result.notFound, ts: Date.now() } });
    }catch(e){}
  }
}

// ─── Wiring ─────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg.action === "FK_PING"){ sendResponse({ ready: true }); return true; }
  if(msg.action === "FK_START_CAPTURE"){ fkStartCaptureMode(msg.profileId); sendResponse({ success: true }); return true; }
  if(msg.action === "FK_START_AUTOSCAN"){ fkStopCaptureMode(); fkAutoScanFields(msg.profileId); sendResponse({ success: true }); return true; }
  if(msg.action === "FK_AUTOFILL"){ fkStopCaptureMode(); fkAutofillProfile(msg.data, msg.profileId); sendResponse({ success: true }); return true; }
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape" && fkIsCaptureMode) fkStopCaptureMode();
});

document.addEventListener("mouseover", e => {
  if(!fkIsCaptureMode) return;
  const t = e.target;
  if(["INPUT","TEXTAREA","SELECT"].includes(t.tagName)){
    const r = t.getBoundingClientRect();
    if(fkHighlightOverlay){
      fkHighlightOverlay.style.width = r.width + "px";
      fkHighlightOverlay.style.height = r.height + "px";
      fkHighlightOverlay.style.top = (window.scrollY + r.top) + "px";
      fkHighlightOverlay.style.left = (window.scrollX + r.left) + "px";
      fkHighlightOverlay.style.display = "block";
    }
  }else{
    fkHideOverlay();
  }
});

// Manual click-to-capture: reliable for plain text/number inputs (always mounted on
// both surfaces). Dropdown and tag-input fields on the wizard should be captured via
// Auto Scan instead, which knows how to open each control and read its real state.
document.addEventListener("click", async e => {
  if(!fkIsCaptureMode) return;
  const raw = e.target;
  const t = raw && raw.closest ? raw.closest('input,textarea,select,[contenteditable="true"],[role="combobox"]') : raw;
  if(!t) return;
  e.preventDefault(); e.stopPropagation();
  const selector = typeof getStableSelector === "function" ? getStableSelector(t) : null;
  if(!selector) return void fkShowToast("Error: Selector util not loaded", true);
  const currentVal = ("value" in t ? t.value : t.innerText || "").toString();
  const entered = prompt(`Save field: ${selector}\nValue:`, currentVal);
  if(entered !== null){
    chrome.runtime.sendMessage({
      action: "SAVE_FIELD",
      payload: { profileId: fkCurrentProfileId, store: "flipkartProfiles", field: { selector, type: t.type || t.getAttribute("role") || t.tagName.toLowerCase(), value: entered } }
    }, res => {
      if(chrome.runtime.lastError) return void fkShowToast("Error Saving Field", true);
      fkShowToast(res && res.success ? "Field Saved!" : "Error Saving", !(res && res.success));
    });
  }
}, true);

fkInitializeUI();
