
document.addEventListener("DOMContentLoaded", async () => {

const profileSelect = document.getElementById("fkProfileSelect")

const btnNew = document.getElementById("fkBtnNewProfile")
const btnEdit = document.getElementById("fkBtnEditProfile")
const btnDelete = document.getElementById("fkBtnDeleteProfile")

const btnCapture = document.getElementById("fkBtnCapture")
const btnAutoScan = document.getElementById("fkBtnAutoScan")
const btnAutofill = document.getElementById("fkBtnAutofill")

const btnExport = document.getElementById("fkBtnExport")
const btnImport = document.getElementById("fkBtnImport")

const fieldsCountEl = document.getElementById("fkFieldsCount")
const btnToggleFields = document.getElementById("fkBtnToggleFields")
const fieldsListEl = document.getElementById("fkFieldsList")
const notFoundBanner = document.getElementById("fkNotFoundBanner")
const notFoundListEl = document.getElementById("fkNotFoundList")
const btnCaptureMissing = document.getElementById("fkBtnCaptureMissing")

const STORAGE_KEY = "flipkartProfiles"

let profiles = {}

/* LOAD PROFILES */

async function loadProfiles(){

const data = await chrome.storage.local.get([STORAGE_KEY])

profiles = data[STORAGE_KEY] || {}

profileSelect.innerHTML = '<option value="" disabled>-- Choose --</option>'

let lastId = null

Object.keys(profiles).forEach(id => {

const opt = document.createElement("option")

opt.value = id
opt.textContent = profiles[id].name

profileSelect.appendChild(opt)

lastId = id

})

if(lastId){
profileSelect.value = lastId
}

renderFieldsList()
renderNotFoundReport()

}

/* CAPTURED FIELDS VIEW */

function labelForField(field){
if(field.tab && field.label){
return `${field.tab} › ${field.label}`
}
const selector = field.selector || ""
// A not-found report entry from the wizard already carries a readable "Tab › Label"
// string in place of a real selector - show it as-is instead of running it through
// the generic-selector truncation below, which would cut off the label half.
if(selector.includes(" › ")) return selector
const m = selector.match(/id=["']([^"']+)["']/) || selector.match(/#([a-zA-Z0-9_-]+)/)
if(m) return m[1]
if(selector.startsWith("SIZE:")){
const sm = selector.match(/^SIZE:(.+?)::/)
if(sm) return `Size "${sm[1]}"`
}
return selector.length > 36 ? selector.slice(0,33) + "..." : selector
}

function displayValue(value){
return Array.isArray(value) ? value.join(", ") : value
}

function renderFieldsList(){

const id = profileSelect.value
const data = profiles[id]
const fields = (data && data.fields) || []

fieldsCountEl.textContent = fields.length
fieldsListEl.innerHTML = ""

if(fields.length === 0){
const empty = document.createElement("div")
empty.className = "fields-empty"
empty.textContent = "No fields captured yet"
fieldsListEl.appendChild(empty)
return
}

fields.forEach((field, index) => {

const row = document.createElement("div")
row.className = "field-row"

const main = document.createElement("div")
main.className = "field-main"

const typeEl = document.createElement("div")
typeEl.className = "field-type"
typeEl.textContent = labelForField(field)

const valueEl = document.createElement("div")
valueEl.className = "field-value"
valueEl.textContent = displayValue(field.value)
valueEl.title = Array.isArray(field.value) ? "Click to edit (comma-separated)" : "Click to edit"
valueEl.onclick = () => editFieldValue(id, index, valueEl)

main.appendChild(typeEl)
main.appendChild(valueEl)

const delBtn = document.createElement("button")
delBtn.className = "field-del"
delBtn.textContent = "×"
delBtn.title = "Delete field"
delBtn.onclick = async () => {
if(!confirm("Remove this field from the profile?")) return
profiles[id].fields.splice(index, 1)
await saveProfiles()
renderFieldsList()
}

row.appendChild(main)
row.appendChild(delBtn)
fieldsListEl.appendChild(row)

})

}

function editFieldValue(id, index, valueEl){

const field = profiles[id].fields[index]
const wasArray = Array.isArray(field.value)
const kind = field.kind || field.type

const input = document.createElement("input")
input.className = "field-value-input"
input.value = displayValue(field.value)
if(wasArray) input.title = "Comma-separated list"

valueEl.replaceWith(input)
input.focus()
input.select()

let committed = false

const commit = async () => {
if(committed) return
committed = true
let newValue = input.value
if(wasArray){
newValue = newValue.split(",").map(v => v.trim()).filter(Boolean)
}else if(kind === "number"){
// type="number" inputs silently blank themselves if written with anything but
// a bare numeric string (commas, currency symbols, spaces all get rejected) -
// strip that here so a hand-edited value can't break Autofill.
newValue = newValue.trim().replace(/[^0-9.\-+eE]/g, "")
}
profiles[id].fields[index].value = newValue
await saveProfiles()
renderFieldsList()
}

input.addEventListener("keydown", (e) => {
if(e.key === "Enter") input.blur()
})

input.addEventListener("blur", commit)

}

async function renderNotFoundReport(){

const id = profileSelect.value

if(!id){
notFoundBanner.hidden = true
return
}

const key = "flipkartAutofillReport_" + id
const data = await chrome.storage.local.get([key])
const report = data[key]

if(!report || !report.notFound || report.notFound.length === 0){
notFoundBanner.hidden = true
return
}

notFoundListEl.innerHTML = ""
report.notFound.forEach(field => {
const row = document.createElement("div")
row.textContent = "• " + labelForField(field) + " (" + displayValue(field.value) + ")"
notFoundListEl.appendChild(row)
})

notFoundBanner.hidden = false

}

async function startCaptureForProfile(id){

if(!id){
alert("Select profile first")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

const startCapture=()=>{
chrome.tabs.sendMessage(tab.id,{
action:"FK_START_CAPTURE",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","flipkart-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"FK_START_CAPTURE",profileId:id})
window.close()
}).catch(()=>alert("Capture Fields could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"FK_PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","flipkart-content.js"]}).then(startCapture).catch(()=>alert("Capture Fields could not start on this page"))
}else startCapture()
})

}

profileSelect.addEventListener("change", () => {
renderFieldsList()
renderNotFoundReport()
})

btnToggleFields.onclick = () => {
const showing = !fieldsListEl.hidden
fieldsListEl.hidden = showing
btnToggleFields.textContent = showing ? "View" : "Hide"
}

btnCaptureMissing.onclick = () => startCaptureForProfile(profileSelect.value)

chrome.storage.onChanged.addListener((changes, area) => {
if(area !== "local") return
if(changes[STORAGE_KEY]){
profiles = changes[STORAGE_KEY].newValue || {}
renderFieldsList()
}
const reportKey = "flipkartAutofillReport_" + profileSelect.value
if(changes[reportKey]) renderNotFoundReport()
})

/* SAVE PROFILES */

async function saveProfiles(){

await chrome.storage.local.set({[STORAGE_KEY]:profiles})

}

/* CREATE PROFILE */

btnNew.onclick = async () => {

const name = prompt("Enter profile name")

if(!name) return

const id = "fkprofile_" + Date.now()

profiles[id] = {
name:name,
fields:[]
}

await saveProfiles()

await loadProfiles()

profileSelect.value = id

}

/* DELETE PROFILE */

btnDelete.onclick = async () => {

const id = profileSelect.value

if(!id) return

if(!confirm("Delete this profile?")) return

delete profiles[id]

await saveProfiles()

loadProfiles()

}

/* RENAME PROFILE */

btnEdit.onclick = async () => {

const id = profileSelect.value

if(!id) return

const newName = prompt("New name", profiles[id].name)

if(!newName) return

profiles[id].name = newName

await saveProfiles()

loadProfiles()

}

/* START CAPTURE */

btnCapture.onclick = () => startCaptureForProfile(profileSelect.value)

/* AUTO SCAN */

btnAutoScan.onclick = async () => {

const id = profileSelect.value

if(!id){
alert("Select profile first")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

const startScan=()=>{
chrome.tabs.sendMessage(tab.id,{
action:"FK_START_AUTOSCAN",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","flipkart-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"FK_START_AUTOSCAN",profileId:id})
window.close()
}).catch(()=>alert("Auto Scan could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"FK_PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","flipkart-content.js"]}).then(startScan).catch(()=>alert("Auto Scan could not start on this page"))
}else startScan()
})

}

/* AUTOFILL */

btnAutofill.onclick = async () => {

const id = profileSelect.value

if(!id){
alert("Select profile first")
return
}

const data = profiles[id]

if(!data || data.fields.length === 0){
alert("No fields saved in this profile")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

chrome.tabs.sendMessage(tab.id,{
action:"FK_AUTOFILL",
data:data,
profileId:id
})

notFoundBanner.hidden = true

}

/* EXPORT (selected profile only) */

btnExport.onclick = () => {

const id = profileSelect.value

if(!id){
alert("Select a profile first")
return
}

const profile = profiles[id]

if(!profile || !profile.fields || profile.fields.length === 0){
alert("This profile has no fields to export")
return
}

const payload = { [id]: profile }

const data = JSON.stringify(payload,null,2)

const blob = new Blob([data],{type:"application/json"})

const url = URL.createObjectURL(blob)

const a = document.createElement("a")

const safeName = (profile.name || "profile").replace(/[^a-z0-9_-]+/gi,"_")

a.href = url
a.download = "flipkart_autofill_" + safeName + "_" + Date.now() + ".json"

document.body.appendChild(a)

a.click()

document.body.removeChild(a)

URL.revokeObjectURL(url)

}

/* IMPORT - opens a full tab, because Chrome closes an extension popup as soon as a
   native file picker opens, so a file input inside the popup can never deliver its file */

btnImport.onclick = () => {

const url = chrome.runtime.getURL("import.html") + "?store=" + STORAGE_KEY + "&profile=" + encodeURIComponent(profileSelect.value || "")

chrome.tabs.create({ url })

}

loadProfiles()

})
