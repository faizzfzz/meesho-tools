// Generic Autofill engine for Flipkart Seller Hub (seller.flipkart.com).
//
// This intentionally has none of the Meesho-specific special-casing from
// autofill-content.js (duplicate per-size-variant ids, "copy to all sizes"
// checkbox, MUI-specific dropdown popup markup) because Flipkart's actual
// page structure hasn't been verified live yet. Plain text/number inputs and
// native <select> elements are handled reliably; custom autocomplete/combobox
// widgets get a best-effort generic handler (see fkFillField) that may need
// refinement once tested against the real page - same as we did for Meesho's
// price-field bug: reproduce live, then special-case what's actually there.

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
    const tag = document.createElement("div");
    tag.innerText = label;
    tag.style.cssText = `
      position: absolute;
      left: ${el.getBoundingClientRect().left + window.scrollX}px;
      top: ${el.getBoundingClientRect().top + window.scrollY - 26}px;
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

function fkShowNotFoundEffect(selector){
  const el = document.createElement("div");
  const label = selector.length > 30 ? "..." + selector.slice(-27) : selector;
  el.innerHTML = `<span style="color:#ff6666">✕</span> NOT FOUND: ${label}`;
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
  fkShowToast("Capture Mode ON - Press ESC or click Stop to exit");
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

function fkIsDropdown(el){
  if(el.tagName === "SELECT") return false;
  if(el.readOnly) return true;
  const role = el.getAttribute("role");
  const hasPopup = el.getAttribute("aria-haspopup");
  const autocomplete = el.getAttribute("aria-autocomplete");
  return role === "combobox" || hasPopup === "listbox" || autocomplete === "list" || autocomplete === "both";
}

async function fkFillField(el, value){
  el.scrollIntoView({ behavior: "instant", block: "center" });
  await fkSleep(50);

  if(el.tagName === "SELECT"){
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if(el.tagName === "INPUT" && fkIsDropdown(el)){
    // Best-effort generic handling for a custom combobox/autocomplete: type into the
    // field itself, then click a matching option if the page renders one. Flipkart's
    // real widget markup hasn't been verified - if this misses, capture that field
    // manually until we've reproduced its actual behavior live.
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

function fkShowScanCaptureEffect(el){ fkFlashElement(el, "#29d8ff", "⚑ CAPTURED"); }

async function fkAutoScanFields(profileId){
  if(fkIsCaptureMode) fkStopCaptureMode();
  if(fkIsAutofilling) return void fkShowToast("Autofill running, please wait!", true);
  if(!profileId) return void fkShowToast("Error: No profile selected", true);

  fkShowToast("Scanning page for fields....");
  await fkSleep(150);

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

  if(captured.length === 0) return void fkShowToast("No filled fields found on this page", true);

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
  fkShowToast(`Auto Scan complete! Captured ${saved} of ${captured.length} field(s)`);
}

async function fkAutofillProfile(profileData, profileId){
  if(!profileData || !profileData.fields) return;
  if(fkIsAutofilling) return void fkShowToast("Autofill already running!", true);
  fkIsAutofilling = true;
  fkShouldStopAutofill = false;
  fkShowStopAutofillButton();

  let filledCount = 0, skippedCount = 0;
  const notFound = [];

  for(const field of profileData.fields){
    if(fkShouldStopAutofill){
      fkShowToast(`STOPPED! Filled: ${filledCount}, Skipped: ${skippedCount}`);
      break;
    }
    const selector = field.selector, value = field.value;
    const el = fkParseAndQuerySelector(selector) || await fkWaitForElement(selector);

    if(el){
      const current = el.value ? el.value.trim() : "";
      if(current === value.trim()){
        fkShowSkipEffect(el); skippedCount++; await fkSleep(100); continue;
      }
      if(current && !fkIsDropdown(el) && el.tagName !== "SELECT"){
        fkShowSkipEffect(el); skippedCount++; await fkSleep(100); continue;
      }
      try{
        await fkFillField(el, value); fkShowFillEffect(el); filledCount++; await fkSleep(150);
      }catch(e){}
    }else{
      fkShowNotFoundEffect(selector); skippedCount++;
      notFound.push({ selector: field.selector, type: field.type, value: field.value });
    }
  }

  if(!fkShouldStopAutofill) fkShowToast(`Done! Filled: ${filledCount}, Skipped: ${skippedCount}`);
  fkIsAutofilling = false;
  fkShouldStopAutofill = false;
  fkHideStopAutofillButton();

  if(profileId){
    try{
      await chrome.storage.local.set({ ["flipkartAutofillReport_" + profileId]: { filled: filledCount, skipped: skippedCount, notFound, ts: Date.now() } });
    }catch(e){}
  }
}

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
