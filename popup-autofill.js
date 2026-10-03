
document.addEventListener("DOMContentLoaded", async () => {

const profileSelect = document.getElementById("profileSelect")

const btnNew = document.getElementById("btnNewProfile")
const btnEdit = document.getElementById("btnEditProfile")
const btnDelete = document.getElementById("btnDeleteProfile")

const btnCapture = document.getElementById("btnCapture")
const btnAutoScan = document.getElementById("btnAutoScan")
const btnAutofill = document.getElementById("btnAutofill")

const btnExport = document.getElementById("btnExport")
const btnImport = document.getElementById("btnImport")

const fieldsCountEl = document.getElementById("fieldsCount")
const btnToggleFields = document.getElementById("btnToggleFields")
const fieldsListEl = document.getElementById("fieldsList")
const notFoundBanner = document.getElementById("notFoundBanner")
const notFoundListEl = document.getElementById("notFoundList")
const btnCaptureMissing = document.getElementById("btnCaptureMissing")

let profiles = {}

/* LOAD PROFILES */

async function loadProfiles(){

const data = await chrome.storage.local.get(["profiles"])

profiles = data.profiles || {}

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
const selector = field.selector || ""
if(selector === "@sizes") return "Sizes"
const sm = selector.match(/^SIZE:(.+?)::/)
const m = selector.match(/id=["']([^"']+)["']/) || selector.match(/#([a-zA-Z0-9_-]+)/)
if(m) return sm ? `${m[1]} · ${sm[1]}` : m[1]
if(sm) return `Size "${sm[1]}"`
return selector.length > 36 ? selector.slice(0,33) + "..." : selector
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
valueEl.textContent = field.value
valueEl.title = "Click to edit"
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

const input = document.createElement("input")
input.className = "field-value-input"
input.value = field.value

valueEl.replaceWith(input)
input.focus()
input.select()

let committed = false

const commit = async () => {
if(committed) return
committed = true
let newValue = input.value
if(field.type === "number"){
// type="number" inputs on Meesho's page silently blank themselves if written
// with anything but a bare numeric string (commas, currency symbols, spaces
// all get rejected) - strip that here so a hand-edited value can't break Autofill.
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

const key = "autofillReport_" + id
const data = await chrome.storage.local.get([key])
const report = data[key]

// Reports from before this split only have "notFound" - treat those as absent fields.
const failed = report && report.failed ? report.failed : []
const absent = report && report.absent ? report.absent : (report && !report.failed ? (report.notFound || []) : [])

if(failed.length === 0 && absent.length === 0){
notFoundBanner.hidden = true
return
}

const titleEl = document.getElementById("notFoundTitle")
// Red = the field is on the page but the value didn't take. Muted = the field simply isn't
// on this dashboard layout, which is expected and was skipped without waiting.
notFoundBanner.classList.toggle("info", failed.length === 0)
if(titleEl) titleEl.textContent = failed.length ? "\u26a0 Couldn't fill " + failed.length + " field(s)" : "\u2139 Skipped fields"

notFoundListEl.innerHTML = ""

failed.forEach(field => {
const row = document.createElement("div")
row.textContent = "\u2715 " + labelForField(field) + " (" + field.value + ")" + (field.note ? " - " + field.note : "")
notFoundListEl.appendChild(row)
})

if(absent.length){
const details = document.createElement("details")
details.className = "absent-details"
const summary = document.createElement("summary")
summary.textContent = absent.length + " saved field(s) not on this page - skipped"
details.appendChild(summary)
absent.forEach(field => {
const row = document.createElement("div")
row.textContent = "\u2022 " + labelForField(field) + " (" + field.value + ")"
details.appendChild(row)
})
notFoundListEl.appendChild(details)
}

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
action:"START_CAPTURE",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"START_CAPTURE",profileId:id})
window.close()
}).catch(()=>alert("Capture Fields could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(startCapture).catch(()=>alert("Capture Fields could not start on this page"))
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
if(changes.profiles){
profiles = changes.profiles.newValue || {}
renderFieldsList()
}
const reportKey = "autofillReport_" + profileSelect.value
if(changes[reportKey]) renderNotFoundReport()
})

/* SAVE PROFILES */

async function saveProfiles(){

await chrome.storage.local.set({profiles})

}

/* CREATE PROFILE */

btnNew.onclick = async () => {

const name = prompt("Enter profile name")

if(!name) return

const id = "profile_" + Date.now()

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
action:"START_AUTOSCAN",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"START_AUTOSCAN",profileId:id})
window.close()
}).catch(()=>alert("Auto Scan could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(startScan).catch(()=>alert("Auto Scan could not start on this page"))
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
action:"AUTOFILL",
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
a.download = "meesho_autofill_" + safeName + "_" + Date.now() + ".json"

document.body.appendChild(a)

a.click()

document.body.removeChild(a)

URL.revokeObjectURL(url)

}

/* IMPORT - opens a full tab, because Chrome closes an extension popup as soon as a
   native file picker opens, so a file input inside the popup can never deliver its file */

btnImport.onclick = async () => {

const url = chrome.runtime.getURL("import.html") + "?store=profiles&profile=" + encodeURIComponent(profileSelect.value || "")

try{
await chrome.tabs.create({ url })
}catch(err){
alert("Could not open the import page: " + err.message)
}

}

loadProfiles()

})
