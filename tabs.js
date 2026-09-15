// Generic nested-tab controller. Each ".tab-group" owns exactly one direct-child
// ".tabs" bar and its direct-child ".tab-panel" elements, matched by data-tab/data-panel.
// Using :scope with "> " keeps a group from reaching into a nested group's own tabs/panels,
// so the outer (marketplace) group and inner (tool) group can be toggled independently.
document.addEventListener("DOMContentLoaded", () => {

const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local

document.querySelectorAll(".tab-group").forEach(group => {

const tabsBar = group.querySelector(":scope > .tabs")
if(!tabsBar) return

const buttons = tabsBar.querySelectorAll(":scope > .tab-btn")
const panels = group.querySelectorAll(":scope > .tab-panel")
const storageKey = "activeTab::" + (group.id || "default")

function activate(name){
if(!name) return
buttons.forEach(b => b.classList.toggle("active", b.dataset.tab === name))
panels.forEach(p => p.classList.toggle("active", p.dataset.panel === name))
}

buttons.forEach(btn => {
btn.addEventListener("click", () => {
activate(btn.dataset.tab)
if(hasStorage) chrome.storage.local.set({ [storageKey]: btn.dataset.tab })
})
})

if(hasStorage){
chrome.storage.local.get([storageKey], (data) => {
if(data && data[storageKey]) activate(data[storageKey])
})
}

})

})
