// Backup & sync page. Opened in a full tab (like import.html): Chrome closes an extension
// popup the moment a file/folder picker opens, so none of this can live in the popup.
document.addEventListener("DOMContentLoaded", async () => {

const $ = id => document.getElementById(id)
const STORES = ["profiles", "flipkartProfiles"]
const LABEL = { profiles: "Meesho", flipkartProfiles: "Flipkart" }
const ID_PREFIX = { profiles: "profile_", flipkartProfiles: "fkprofile_" }

let incoming = null   // { profiles: [...], flipkartProfiles: [...] } parsed from the chosen files

function showStatus(message, type){
$("status").textContent = message
$("status").className = "status-msg visible" + (type ? " " + type : "")
}

async function loadStores(){
const data = await chrome.storage.local.get(STORES)
return { profiles: data.profiles || {}, flipkartProfiles: data.flipkartProfiles || {} }
}

function dateStamp(){
const d = new Date()
const p = n => String(n).padStart(2, "0")
return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
}

async function refreshExportInfo(){
const s = await loadStores()
const m = Object.keys(s.profiles).length
const f = Object.keys(s.flipkartProfiles).length
$("exportInfo").textContent = "This browser has " + m + " Meesho and " + f + " Flipkart profile(s)."
$("btnExportAll").disabled = m + f === 0
}

$("btnExportAll").onclick = async () => {
const stores = await loadStores()
const files = buildBackupFiles(stores)
if(files.length === 0){ showStatus("No profiles to export.", "error"); return }

const enc = new TextEncoder()
const zip = buildZip(files.map(f => ({ name: f.path, data: enc.encode(f.text) })))
const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }))
const a = document.createElement("a")
a.href = url
a.download = "meesho-tools-backup-" + dateStamp() + ".zip"
document.body.appendChild(a)
a.click()
a.remove()
setTimeout(() => URL.revokeObjectURL(url), 10000)

showStatus("Downloaded " + files.length + " profile file(s) as " + a.download + ".", "success")
}

function modeOpts(store){
return { mode: $("replaceMode").checked ? "replace" : "merge", idPrefix: ID_PREFIX[store] }
}

async function updatePreview(){
if(!incoming){ $("preview").textContent = ""; $("btnDoImport").disabled = true; return }
const stores = await loadStores()
const lines = []
let total = 0
for(const store of STORES){
if(incoming[store].length === 0) continue
total += incoming[store].length
const s = planImport(stores[store], incoming[store], modeOpts(store)).summary
const parts = []
if(s.added) parts.push(s.added + " new")
if(s.merged) parts.push(s.merged + " will be merged")
if(s.replaced) parts.push(s.replaced + " will be replaced")
if(s.unchanged) parts.push(s.unchanged + " already identical")
lines.push(LABEL[store] + ": " + incoming[store].length + " profile(s) - " + parts.join(", "))
}
$("preview").textContent = lines.join("  |  ")
$("btnDoImport").disabled = total === 0
}

async function handleFiles(files){
incoming = { profiles: [], flipkartProfiles: [] }
let skipped = 0
let read = 0

for(const f of files){
const store = classifyBackupPath(f.webkitRelativePath || f.name)
if(!store){ skipped++; continue }
try{
incoming[store].push(...parseBackupText(await f.text()))
read++
}catch{
skipped++
}
}

$("status").className = "status-msg"
if(read === 0){
incoming = null
showStatus("No profile files found in that selection" + (skipped ? " (" + skipped + " other file(s) ignored)." : "."), "error")
}else if(skipped){
showStatus("Read " + read + " profile file(s); ignored " + skipped + " that aren't profiles.", "")
}
await updatePreview()
}

$("btnPickFolder").onclick = () => $("folderInput").click()
$("btnPickFiles").onclick = () => $("filesInput").click()
for(const input of [$("folderInput"), $("filesInput")]){
input.addEventListener("change", e => {
const files = Array.from(e.target.files)
e.target.value = ""
if(files.length) handleFiles(files)
})
}
$("replaceMode").addEventListener("change", updatePreview)

$("btnDoImport").onclick = async () => {
if(!incoming) return
$("btnDoImport").disabled = true
try{
const stores = await loadStores()
const done = []
for(const store of STORES){
if(incoming[store].length === 0) continue
const plan = planImport(stores[store], incoming[store], modeOpts(store))
await chrome.storage.local.set({ [store]: plan.result })
const s = plan.summary
done.push(LABEL[store] + ": " + s.added + " added, " + (s.merged + s.replaced) + " updated, " + s.unchanged + " unchanged")
}
incoming = null
await updatePreview()
await refreshExportInfo()
showStatus("Done. " + done.join("  |  ") + ". Reopen the extension popup to see them.", "success")
}catch(err){
showStatus("Import failed: " + err.message, "error")
$("btnDoImport").disabled = false
}
}

await refreshExportInfo()

})
