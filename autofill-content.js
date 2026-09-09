const ALLOWED_ORIGIN="https://supplier.meesho.com",CATALOG_PAGE_PATTERN=/\/panel\/v3\/new\/cataloging\/[^\/]+\/catalogs\/single\/(add|edit)/;function isValidDomain(){return window.location.origin===ALLOWED_ORIGIN}function isCatalogPage(){return CATALOG_PAGE_PATTERN.test(window.location.pathname)}isValidDomain()&&isCatalogPage();let highlightOverlay=null,stopCaptureButton=null,stopAutofillButton=null,isCaptureMode=!1,isAutofilling=!1,shouldStopAutofill=!1,currentProfileId=null;function initializeUI(){isValidDomain()&&(highlightOverlay=createOverlay(),stopCaptureButton=createStopCaptureButton(),stopAutofillButton=createStopAutofillButton())}function parseAndQuerySelector(e){if(!e)return null;if(e.startsWith("SIZE:")){const t=e.match(/^SIZE:(.+?)::(.+)$/);if(!t)return null;const o=t[1],n=t[2],i=document.querySelectorAll(".css-1hw3sau");for(const e of i){const t=e.querySelector("p.css-twqx64");if(t&&t.innerText.trim()===o){const t=e.querySelector(n);if(t)return t}}return null}const t=e.split("||"),o=t[0],n=t.length>1?parseInt(t[1],10):0,i=document.querySelectorAll(o);return 0===i.length?null:i[n]||null}function waitForElement(e,t=300){return new Promise(o=>{const n=()=>parseAndQuerySelector(e),i=n();if(i)return o(i);const r=new MutationObserver(e=>{const t=n();t&&(r.disconnect(),o(t))});r.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{r.disconnect(),o(null)},t)})}function waitForTextElement(e,t=2500){return new Promise(o=>{const n=e.toLowerCase().trim(),i=()=>{const e=document.querySelectorAll('li, div[role="option"], p, span');for(const t of e){if(null===t.offsetParent)continue;const e=t.innerText?t.innerText.toLowerCase().trim():"";if(e===n)return t;if(e.includes(n))return t}return null},r=i();if(r)return o(r);const s=new MutationObserver(()=>{const e=i();e&&(s.disconnect(),o(e))});s.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{s.disconnect(),o(null)},t)})}function setNativeValue(e,t){const o=Object.getOwnPropertyDescriptor(e,"value")?.set,n=Object.getPrototypeOf(e),i=Object.getOwnPropertyDescriptor(n,"value")?.set;o&&o!==i||i?i.call(e,t):e.value=t}function createOverlay(){const e=document.createElement("div");return e.style.position="absolute",e.style.backgroundColor="rgba(106, 27, 154, 0.3)",e.style.border="2px solid #6a1b9a",e.style.pointerEvents="none",e.style.zIndex="999999",e.style.display="none",e.style.transition="all 0.1s ease",document.body.appendChild(e),e}function showToast(e,t=!1){const o=document.createElement("div");o.innerText=e,o.style.cssText=`\n    position: fixed;\n    bottom: 20px;\n    right: 20px;\n    background: ${t?"linear-gradient(180deg, #ff4444 0%, #cc0000 100%)":"linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)"};\n    color: ${t?"#fff":"#000"};\n    padding: 12px 20px;\n    font-family: 'VT323', monospace;\n    font-size: 16px;\n    font-weight: bold;\n    border: 2px solid ${t?"#ff6666":"#33ff9f"};\n    z-index: 1000000;\n    box-shadow: 0 4px 12px rgba(0,0,0,0.4);\n    opacity: 0;\n    transition: opacity 0.3s;\n    text-transform: uppercase;\n    letter-spacing: 1px;\n  `,document.body.appendChild(o),requestAnimationFrame(()=>o.style.opacity="1"),setTimeout(()=>{o.style.opacity="0",setTimeout(()=>o.remove(),300)},3e3)}function showFillEffect(e){if(!e)return;const t=e.style.outline,o=e.style.boxShadow,n=e.style.transition;e.style.transition="all 0.2s ease",e.style.outline="3px solid #00ff88",e.style.boxShadow="0 0 20px #00ff88, 0 0 40px #00ff8866, inset 0 0 10px #00ff8833";const i=document.createElement("div");i.innerText="\u2713 FILLED",i.style.cssText=`\n    position: absolute;\n    left: ${e.getBoundingClientRect().left+window.scrollX}px;\n    top: ${e.getBoundingClientRect().top+window.scrollY-30}px;\n    background: linear-gradient(180deg, #00ff88 0%, #00cc6a 100%);\n    color: #000;\n    padding: 4px 12px;\n    font-family: 'VT323', monospace;\n    font-size: 14px;\n    font-weight: bold;\n    border: 2px solid #33ff9f;\n    z-index: 1000000;\n    animation: floatUp 0.8s ease-out forwards;\n    pointer-events: none;\n  `,document.body.appendChild(i),setTimeout(()=>{e.style.outline=t,e.style.boxShadow=o,e.style.transition=n},500),setTimeout(()=>i.remove(),800)}function showSkipEffect(e){if(!e)return;const t=e.style.outline,o=e.style.boxShadow;e.style.outline="2px solid #ffaa00",e.style.boxShadow="0 0 10px #ffaa0066";const n=document.createElement("div");n.innerText="\xbb SKIP",n.style.cssText=`\n    position: absolute;\n    left: ${e.getBoundingClientRect().left+window.scrollX}px;\n    top: ${e.getBoundingClientRect().top+window.scrollY-25}px;\n    background: linear-gradient(180deg, #ffaa00 0%, #cc8800 100%);\n    color: #000;\n    padding: 3px 10px;\n    font-family: 'VT323', monospace;\n    font-size: 12px;\n    font-weight: bold;\n    border: 2px solid #ffcc44;\n    z-index: 1000000;\n    animation: floatUp 0.5s ease-out forwards;\n    pointer-events: none;\n  `,document.body.appendChild(n),setTimeout(()=>{e.style.outline=t,e.style.boxShadow=o},300),setTimeout(()=>n.remove(),500)}function showNotFoundEffect(e){const t=document.createElement("div"),o=e.length>30?"..."+e.slice(-27):e;t.innerHTML=`<span style="color:#ff6666">\u2715</span> NOT FOUND: ${o}`,t.style.cssText="\n    position: fixed;\n    top: 70px;\n    left: 50%;\n    transform: translateX(-50%);\n    background: linear-gradient(180deg, #444 0%, #222 100%);\n    color: #ff6666;\n    padding: 6px 16px;\n    font-family: 'VT323', monospace;\n    font-size: 14px;\n    font-weight: bold;\n    border: 2px solid #666;\n    z-index: 1000000;\n    animation: fadeOut 1s ease-out forwards;\n    pointer-events: none;\n    white-space: nowrap;\n    max-width: 90vw;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  ",document.body.appendChild(t),setTimeout(()=>t.remove(),1e3)}function initVisualEffectStyles(){if(document.getElementById("meesho-autofill-styles"))return;const e=document.createElement("style");e.id="meesho-autofill-styles",e.textContent="\n    @keyframes floatUp {\n      0% { opacity: 1; transform: translateY(0); }\n      100% { opacity: 0; transform: translateY(-20px); }\n    }\n    \n    @keyframes fadeOut {\n      0% { opacity: 1; }\n      70% { opacity: 1; }\n      100% { opacity: 0; }\n    }\n    \n    @keyframes pulseGlow {\n      0% { box-shadow: 0 0 10px #00ff88; }\n      50% { box-shadow: 0 0 25px #00ff88, 0 0 40px #00ff8866; }\n      100% { box-shadow: 0 0 10px #00ff88; }\n    }\n    \n    @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');\n  ",document.head.appendChild(e)}function hideOverlay(){highlightOverlay&&(highlightOverlay.style.display="none")}function createStopCaptureButton(){const e=document.createElement("button");return e.id="meesho-autofill-stop-btn",e.innerText="\u2715 Stop Capture",e.style.cssText="\n    position: fixed;\n    top: 20px;\n    right: 20px;\n    z-index: 1000001;\n    background: #d32f2f;\n    color: white;\n    border: none;\n    padding: 10px 20px;\n    border-radius: 8px;\n    font-size: 14px;\n    font-weight: bold;\n    cursor: pointer;\n    box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n    display: none;\n  ",e.addEventListener("click",stopCaptureMode),document.body.appendChild(e),e}function stopCaptureMode(){isCaptureMode=!1,currentProfileId=null,document.body.style.cursor="default",hideOverlay(),stopCaptureButton&&(stopCaptureButton.style.display="none"),showToast("Capture Mode OFF")}function startCaptureMode(e){isCaptureMode=!0,currentProfileId=e,document.body.style.cursor="crosshair",stopCaptureButton&&(stopCaptureButton.style.display="block"),showToast("Capture Mode ON - Press ESC or click Stop to exit")}function createStopAutofillButton(){const e=document.createElement("button");e.id="meesho-autofill-stop-autofill-btn",e.innerText="\u2b1b STOP AUTOFILL",e.style.cssText="\n    position: fixed;\n    top: 20px;\n    left: 50%;\n    transform: translateX(-50%);\n    z-index: 1000001;\n    background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);\n    color: white;\n    border: 3px solid #fff;\n    padding: 12px 24px;\n    font-family: 'VT323', monospace;\n    font-size: 18px;\n    font-weight: bold;\n    cursor: pointer;\n    box-shadow: 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3);\n    display: none;\n    text-transform: uppercase;\n    letter-spacing: 2px;\n    animation: pulse-stop 0.5s infinite alternate;\n  ";const t=document.createElement("style");return t.textContent="\n    @keyframes pulse-stop {\n      from { box-shadow: 0 4px 12px rgba(255,0,0,0.3); }\n      to { box-shadow: 0 4px 20px rgba(255,0,0,0.7); }\n    }\n  ",document.head.appendChild(t),e.addEventListener("click",()=>{shouldStopAutofill=!0,showToast("STOPPING...")}),document.body.appendChild(e),e}function showStopAutofillButton(){stopAutofillButton&&(stopAutofillButton.style.display="block")}function hideStopAutofillButton(){stopAutofillButton&&(stopAutofillButton.style.display="none")}function isDropdown(e){if("SELECT"===e.tagName)return!1;if(e.readOnly)return!0;const t=e.getAttribute("role"),o=e.getAttribute("aria-haspopup"),n=e.getAttribute("aria-autocomplete");return"combobox"===t||"listbox"===o||"list"===n||"both"===n}function waitForDropdownPopup(e=3e3){return new Promise(t=>{const o=[".MuiPopover-paper",".MuiMenu-paper",".MuiPopper-root",'div[role="presentation"] .MuiPaper-root','div[role="listbox"]','ul[role="listbox"]'],n=()=>{for(const e of o){const t=document.querySelector(e);if(t&&null!==t.offsetParent&&t.offsetWidth>0)return t}return null},i=n();if(i)return t(i);const r=new MutationObserver(()=>{const e=n();e&&(r.disconnect(),t(e))});r.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{r.disconnect(),t(null)},e)})}function waitForDropdownOptions(e=2e3){return new Promise(t=>{const o=[".MuiMenuItem-root",".MuiPopper-root li",'div[role="presentation"] li',".MuiPaper-root li",".MuiMenu-list li",'li[role="option"]'],n=()=>{for(const e of o){const t=document.querySelectorAll(e);for(const e of t)if(null!==e.offsetParent&&e.offsetWidth>0&&e.offsetHeight>0&&!e.querySelector("input"))return e}return null},i=n();if(i)return t(i);const r=new MutationObserver(()=>{const e=n();e&&(r.disconnect(),t(e))});r.observe(document.body,{childList:!0,subtree:!0,characterData:!0}),setTimeout(()=>{r.disconnect(),t(null)},e)})}async function fillField(e,t){if(e.scrollIntoView({behavior:"instant",block:"center"}),await new Promise(e=>setTimeout(e,50)),"SELECT"===e.tagName)return e.value=t,void e.dispatchEvent(new Event("change",{bubbles:!0}));if("INPUT"===e.tagName&&isDropdown(e)){const o=t.split(",").map(e=>e.trim()).filter(e=>e);for(const t of o){if(e.focus(),e.click(),e.dispatchEvent(new MouseEvent("mousedown",{bubbles:!0,cancelable:!0,view:window})),e.dispatchEvent(new MouseEvent("mouseup",{bubbles:!0,cancelable:!0,view:window})),!await waitForDropdownPopup(3e3)){showToast(`Error: Dropdown didn't open for "${t}"`,!0);continue}await new Promise(e=>setTimeout(e,50));const o=document.querySelector('.MuiPopover-paper input[placeholder="Search"], .MuiMenu-paper input[placeholder="Search"], .MuiPopper-root input[placeholder="Search"], div[role="presentation"] input[placeholder="Search"]');o&&(o.focus(),setNativeValue(o,t),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0})),await waitForDropdownOptions(2e3),await new Promise(e=>setTimeout(e,100)));let n=null,i=null;const r=[".MuiMenuItem-root",".MuiPopper-root li",'div[role="presentation"] li',".MuiPaper-root li",".MuiMenu-list li"];for(const e of r){const o=document.querySelectorAll(e);for(const e of o)if(null!==e.offsetParent&&e.offsetWidth>0&&e.offsetHeight>0){if(e.querySelector("input"))continue;if(i||(i=e),(e.innerText?e.innerText.trim():"")===t.trim()){n=e;break}}if(n)break}const s=n||i;if(s)s.scrollIntoView({behavior:"instant",block:"center"}),s.click(),await new Promise(e=>setTimeout(e,100));else{const e=await waitForTextElement(t,2e3);e?(e.scrollIntoView({behavior:"instant",block:"center"}),e.click(),await new Promise(e=>setTimeout(e,100))):showToast(`Error: Option "${t}" not found`,!0)}}return document.body.click(),void await new Promise(e=>setTimeout(e,50))}if(e.readOnly||e.disabled)return;const v="number"===e.type?String(t).trim().replace(/[^0-9.\-+eE]/g,""):t;return setNativeValue(e,v),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),void e.dispatchEvent(new Event("blur",{bubbles:!0}))}function waitForTextElement(e,t=2500){return new Promise(o=>{const n=e.toLowerCase().trim(),i=()=>{const e=document.querySelectorAll('li, div[role="option"], p, span, div.MuiMenuItem-root');for(const t of e){if(null===t.offsetParent)continue;const e=t.innerText?t.innerText.toLowerCase().trim():"";if(e===n||e.includes(n))return t.closest('li, div[role="option"]')||t}return null},r=i();if(r)return o(r);const s=new MutationObserver(()=>{const e=i();e&&(s.disconnect(),o(e))});s.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{s.disconnect(),o(null)},t)})}function isCapturableElement(e){if(!e||e.offsetParent===null)return!1;if(e.disabled)return!1;const t=e.tagName;if("INPUT"===t){const o=(e.type||"text").toLowerCase();return!["button","submit","reset","hidden","file","checkbox","radio","image"].includes(o)&&!!(e.value&&e.value.trim())}if("TEXTAREA"===t||"SELECT"===t)return!!(e.value&&e.value.trim());const o=e.getAttribute&&e.getAttribute("role");if(e.isContentEditable||"combobox"===o){const t=(e.innerText||e.textContent||"").trim();return!!t}return!1}
function showScanCaptureEffect(e){if(!e)return;const t=e.style.outline,o=e.style.boxShadow,n=e.style.transition;e.style.transition="all 0.2s ease",e.style.outline="3px solid #29d8ff",e.style.boxShadow="0 0 20px #29d8ff, 0 0 40px #29d8ff66, inset 0 0 10px #29d8ff33";const i=document.createElement("div");i.innerText="⚑ CAPTURED",i.style.cssText=`\n    position: absolute;\n    left: ${e.getBoundingClientRect().left+window.scrollX}px;\n    top: ${e.getBoundingClientRect().top+window.scrollY-30}px;\n    background: linear-gradient(180deg, #29d8ff 0%, #0090cc 100%);\n    color: #001018;\n    padding: 4px 12px;\n    font-family: 'VT323', monospace;\n    font-size: 14px;\n    font-weight: bold;\n    border: 2px solid #6fe8ff;\n    z-index: 1000000;\n    animation: floatUp 0.8s ease-out forwards;\n    pointer-events: none;\n  `,document.body.appendChild(i),setTimeout(()=>{e.style.outline=t,e.style.boxShadow=o,e.style.transition=n},600),setTimeout(()=>i.remove(),800)}
async function autoScanFields(profileId){if(isCaptureMode&&stopCaptureMode(),isAutofilling)return void showToast("Autofill running, please wait!",!0);if(!profileId)return void showToast("Error: No profile selected",!0);showToast("Scanning page for fields...."),await new Promise(e=>setTimeout(e,150));const candidates=Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"]')),seen=new Set,captured=[];for(const el of candidates){if(!isCapturableElement(el))continue;const selector="function"==typeof getStableSelector?getStableSelector(el):null;if(!selector||seen.has(selector))continue;const rawValue="value"in el?el.value:el.innerText||el.textContent||"",value=(rawValue||"").toString().trim();value&&(seen.add(selector),captured.push({el:el,selector:selector,value:value,type:el.type||el.getAttribute("role")||el.tagName.toLowerCase()}))}if(0===captured.length)return void showToast("No filled fields found on this page",!0);let saved=0;for(const item of captured){item.el.scrollIntoView({behavior:"instant",block:"center"}),showScanCaptureEffect(item.el);const ok=await new Promise(resolve=>{chrome.runtime.sendMessage({action:"SAVE_FIELD",payload:{profileId:profileId,field:{selector:item.selector,type:item.type,value:item.value}}},res=>{resolve(!chrome.runtime.lastError&&res&&res.success)})});ok&&saved++,await new Promise(e=>setTimeout(e,90))}showToast(`Auto Scan complete! Captured ${saved} of ${captured.length} field(s)`)}
async function autofillProfile(profileData,profileId){
  if(!profileData||!profileData.fields) return;
  if(isAutofilling) return void showToast("Autofill already running!",!0);
  isAutofilling=!0,shouldStopAutofill=!1,showStopAutofillButton();

  let copyToAllSizes=!1;
  try{
    const label=Array.from(document.querySelectorAll("p, span, div")).find(e=>e.innerText&&"Copy price details to all sizes"===e.innerText.trim());
    if(label){
      const box=label.closest(".MuiBox-root")||label.parentElement;
      if(box){
        const chk=box.querySelector('input[type="checkbox"]');
        chk&&chk.checked&&(copyToAllSizes=!0);
      }
    }
  }catch(e){}

  const sizeAwareIds=["meesho_price","only_wrong_return_price","product_mrp","inventory","supplier_gst_percent","hsn_code","product_weight_in_gms","supplier_product_id","product_name","color"];
  const filledIds=new Set();
  let filledCount=0,skippedCount=0;
  const notFound=[];

  for(const field of profileData.fields){
    if(shouldStopAutofill){
      showToast(`STOPPED! Filled: ${filledCount}, Skipped: ${skippedCount}`);
      break;
    }
    const selector=field.selector,value=field.value;
    let idMatch=null;
    const m=selector.match(/id=["']([^"']+)["']/)||selector.match(/#([a-zA-Z0-9_-]+)/);
    m&&(idMatch=m[1]);
    let el=null;
    if(idMatch&&sizeAwareIds.includes(idMatch)){
      const copyingThisId=copyToAllSizes&&["meesho_price","only_wrong_return_price","product_mrp","inventory"].includes(idMatch);
      // When "copy to all sizes" is on, Meesho propagates one write across every row for
      // this id, so dedupe by id alone. Otherwise each size row has its own selector
      // (e.g. "SIZE:M::#meesho_price" vs "SIZE:L::#meesho_price") sharing the same
      // duplicated DOM id, so dedupe per-selector or every row after the first gets
      // skipped as "already filled".
      const dedupeKey=copyingThisId?idMatch:selector;
      if(filledIds.has(dedupeKey)){ skippedCount++; continue; }
      if(copyingThisId){
        const rows=document.querySelectorAll(".css-1hw3sau");
        rows.length>0&&(el=rows[0].querySelector(`input[id="${idMatch}"]`),el&&filledIds.add(dedupeKey));
      }else{
        // parseAndQuerySelector/waitForElement already understand the "SIZE:label::selector"
        // format and scope the lookup to that size row's own container, which is required
        // here since Meesho reuses the same id across every size row's input.
        el=parseAndQuerySelector(selector)||await waitForElement(selector);
        el&&filledIds.add(dedupeKey);
      }
    }else{
      el=parseAndQuerySelector(selector)||await waitForElement(selector);
    }

    if(el){
      const current=el.value?el.value.trim():"";
      if(current===value.trim()){
        showSkipEffect(el); skippedCount++; await new Promise(r=>setTimeout(r,100)); continue;
      }
      if(current&&!isDropdown(el)&&"SELECT"!==el.tagName){
        showSkipEffect(el); skippedCount++; await new Promise(r=>setTimeout(r,100)); continue;
      }
      try{
        await fillField(el,value); showFillEffect(el); filledCount++; await new Promise(r=>setTimeout(r,150));
      }catch(e){}
    }else{
      showNotFoundEffect(selector); skippedCount++;
      notFound.push({selector:field.selector,type:field.type,value:field.value});
    }
  }

  if(!shouldStopAutofill) showToast(`Done! Filled: ${filledCount}, Skipped: ${skippedCount}`);
  isAutofilling=!1,shouldStopAutofill=!1,hideStopAutofillButton();

  if(profileId){
    try{
      await chrome.storage.local.set({["autofillReport_"+profileId]:{filled:filledCount,skipped:skippedCount,notFound,ts:Date.now()}});
    }catch(e){}
  }
}

isValidDomain()&&initVisualEffectStyles();

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg.action==="PING"){ sendResponse({ready:!0}); return !0; }
  if(msg.action==="START_CAPTURE"){ startCaptureMode(msg.profileId); sendResponse({success:!0}); return !0; }
  if(msg.action==="START_AUTOSCAN"){ stopCaptureMode(); autoScanFields(msg.profileId); sendResponse({success:!0}); return !0; }
  if(msg.action==="AUTOFILL"){ stopCaptureMode(); autofillProfile(msg.data,msg.profileId); sendResponse({success:!0}); return !0; }
});

document.addEventListener("keydown",e=>{"Escape"===e.key&&isCaptureMode&&stopCaptureMode()});

document.addEventListener("mouseover",e=>{
  if(!isCaptureMode) return;
  const t=e.target;
  if(["INPUT","TEXTAREA","SELECT"].includes(t.tagName)){
    const r=t.getBoundingClientRect();
    highlightOverlay&&(highlightOverlay.style.width=r.width+"px",highlightOverlay.style.height=r.height+"px",highlightOverlay.style.top=window.scrollY+r.top+"px",highlightOverlay.style.left=window.scrollX+r.left+"px",highlightOverlay.style.display="block");
  }else hideOverlay();
});

document.addEventListener("click",async e=>{
  if(!isCaptureMode) return;
  const raw=e.target;
  const t=raw&&raw.closest?raw.closest('input,textarea,select,[contenteditable="true"],[role="combobox"]'):raw;
  if(!t) return;
  e.preventDefault(); e.stopPropagation();
  const selector="function"==typeof getStableSelector?getStableSelector(t):null;
  if(!selector) return void showToast("Error: Selector util not loaded",!0);
  const currentVal=("value" in t?t.value:t.innerText||"").toString();
  const entered=prompt(`Save field: ${selector}\nValue:`,currentVal);
  if(entered!==null){
    chrome.runtime.sendMessage({action:"SAVE_FIELD",payload:{profileId:currentProfileId,field:{selector,type:t.type||t.getAttribute("role")||t.tagName.toLowerCase(),value:entered}}},res=>{
      if(chrome.runtime.lastError) return void showToast("Error Saving Field",!0);
      showToast(res&&res.success?"Field Saved!":"Error Saving",!(res&&res.success));
    });
  }
},!0);

initializeUI();