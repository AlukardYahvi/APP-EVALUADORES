/* app.js - Plataforma de evaluación (versión profesional) */

// URL de tu Web App Google Apps Script (ya la proporcionaste)
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzatgCyA9JOC5NGiaVhyWzBG9V69-jzlyPAW03HtI-_pMKd3K5N8zxai1dUuKNcf_s0/exec";

let currentUser = null;
let currentRole = null;
let currentJudge = null;

// -- Login
document.getElementById("login-btn").addEventListener("click", tryLogin);

function tryLogin(){
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();
  const err = document.getElementById("login-error");
  err.classList.add("hidden"); err.textContent = "";

  const match = USERS.find(x => x.user === u && x.pass === p);
  if(!match){
    err.textContent = "Usuario o contraseña incorrectos.";
    err.classList.remove("hidden");
    return;
  }

  currentUser = match.user; currentRole = match.role; currentJudge = match;
  localStorage.setItem("simposioUser", currentUser); localStorage.setItem("simposioRole", currentRole);

  showDashboard();
}

window.addEventListener("load", () => {
  const u = localStorage.getItem("simposioUser");
  const r = localStorage.getItem("simposioRole");
  if(u && r){
    currentUser = u; currentRole = r; currentJudge = USERS.find(x=>x.user===u);
    showDashboard();
  }
});

// -- Show dashboard
function showDashboard(){
  document.getElementById("login-card").classList.add("hidden");
  const root = document.getElementById("app-root");
  root.classList.remove("hidden");
  if(currentRole === "admin") renderAdmin();
  else renderJudge();
}

// -- Render judge dashboard
function renderJudge(){
  const root = document.getElementById("app-root");
  const assigned = ASSIGNMENTS[currentUser] || [];
  let html = `<div class="header-row"><div><div class="welcome">Bienvenido, ${currentJudge.name}</div><div class="small">Juez: ${currentUser}</div></div><div class="top-actions"><button class="btn ghost" onclick="logout()">Cerrar sesión</button></div></div>`;

  html += `<div class="card"><h3 class="small">Mis trabajos asignados</h3>`;
  if(assigned.length===0) html += `<p class="small">No tiene trabajos asignados.</p>`;
  html += `<div class="work-list">`;
  for(const id of assigned){
    const student = WORKS[id] || "";
    const doneKey = `eval_${currentUser}_${id}`;
    const done = localStorage.getItem(doneKey) ? true : false;
    html += `<div class="work-card"><strong>${id}</strong><div class="work-meta">${student}</div><div style="margin-top:10px">${done ? `<span class="evaluated-badge">Evaluado</span>`: `<button class="btn primary" onclick="openEvaluation('${id}')">Evaluar</button>`}</div></div>`;
  }
  html += `</div></div>`;
  root.innerHTML = html;
}

// -- Open evaluation modal (inline)
function openEvaluation(id){
  const student = WORKS[id] || "";
  const root = document.getElementById("app-root");
  root.innerHTML = `<div class="card"><button class="btn ghost" onclick="showDashboard()">← Volver</button><h3>Evaluar</h3><div class="small">${id} — ${student}</div>
    <form id="eval-form" style="margin-top:12px">
      <div class="form-row">
        <div><label>Claridad</label><input name="claridad" type="number" min="0" max="5" value="0"></div>
        <div><label>Metodología</label><input name="metodologia" type="number" min="0" max="5" value="0"></div>
      </div>
      <div style="margin-top:8px"><label>Resultados</label><input name="resultados" type="number" min="0" max="5" value="0"></div>
      <div style="margin-top:8px"><label>Comentarios</label><textarea name="comentarios" rows="4"></textarea></div>

      <div style="margin-top:12px;display:flex;gap:8px"><button class="btn primary" type="submit">Guardar evaluación</button><button type="button" class="btn ghost" onclick="showDashboard()">Cancelar</button></div>
    </form></div>`;

  document.getElementById("eval-form").addEventListener("submit", e=>{
    e.preventDefault();
    saveEvaluation(id);
  });
}

// -- Save evaluation (localStorage + Sheets)
async function saveEvaluation(id){
  const fd = new FormData(document.getElementById("eval-form"));
  const scores = {
    claridad: Number(fd.get("claridad")||0),
    metodologia: Number(fd.get("metodologia")||0),
    resultados: Number(fd.get("resultados")||0)
  };
  const total = scores.claridad + scores.metodologia + scores.resultados;
  const payload = {
    timestamp: new Date().toISOString(),
    staticJudgeId: currentUser,
    judgeName: currentJudge.name,
    posterId: id,
    posterTitle: WORKS[id] || "",
    totalScore: total,
    scores,
    observations: fd.get("comentarios")||""
  };

  // Guardar local
  localStorage.setItem(`eval_${currentUser}_${id}`, JSON.stringify(payload));

  // Enviar a Google Sheets (no-cors)
  try {
    await fetch(SHEETS_WEBAPP_URL, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
  } catch(e){ console.warn("Sheets send failed (no-cors)"); }

  // Mostrar confirmación y volver
  alert("Evaluación guardada.");
  showDashboard();
}

// -- Render admin
function renderAdmin(){
  const root = document.getElementById("app-root");
  let html = `<div class="header-row"><div><div class="welcome">Panel de Administración</div><div class="small">Usuario: ${currentJudge.name}</div></div><div class="top-actions"><button class="btn ghost" onclick="logout()">Cerrar sesión</button></div></div>`;
  html += `<div class="card"><h3 class="small">Progreso por juez</h3><div class="admin-grid">`;
  for(const u of USERS.filter(x=>x.role==="juez")){
    const assigned = ASSIGNMENTS[u.user] || [];
    let done = 0;
    for(const id of assigned) if(localStorage.getItem(`eval_${u.user}_${id}`)) done++;
    const pct = assigned.length? Math.round(done/assigned.length*100) : 0;
    html += `<div class="card"><strong>${u.name}</strong><div class="small">${done}/${assigned.length} completados</div><div style="margin-top:8px" class="progress"><div style="width:${pct}%"></div></div><div style="margin-top:10px"><button class="btn ghost" onclick="openReassignModal('${u.user}')">Reasignar</button>&nbsp;<button class="btn" onclick="exportJudgeCSV('${u.user}')">Exportar CSV</button></div></div>`;
  }
  html += `</div></div><div style="margin-top:12px"><button class="btn primary" onclick="exportGlobalCSV()">Exportar global</button></div>`;
  root.innerHTML = html;
}

// -- Reassign modal (simple prompt)
function openReassignModal(oldJudge){
  const newJudge = prompt("Reasignar trabajos pendientes de "+oldJudge+" a (usuario):");
  if(!newJudge) return;
  reassignAllPending(oldJudge,newJudge);
}

function reassignAllPending(oldJudge,newJudge){
  const pending = ASSIGNMENTS[oldJudge] || [];
  let count = 0;
  for(const id of pending){
    const key = `eval_${oldJudge}_${id}`;
    if(!localStorage.getItem(key)){
      // mark as reassigned for new judge
      localStorage.setItem(`eval_${newJudge}_${id}`, JSON.stringify({reassignedFrom: oldJudge, timestamp:new Date().toISOString()}));
      count++;
    }
  }
  alert(`Reasignados ${count} trabajos de ${oldJudge} → ${newJudge}`);
  renderAdmin();
}

// -- CSV exports
function exportGlobalCSV(){
  const rows = [["judge","work","student","totalScore","comments","timestamp"]];
  for(const u of USERS.filter(x=>x.role==="juez")){
    const assigned = ASSIGNMENTS[u.user] || [];
    for(const id of assigned){
      const key = `eval_${u.user}_${id}`;
      const data = localStorage.getItem(key);
      if(data){
        const obj = JSON.parse(data);
        rows.push([u.user,id,WORKS[id]||"",obj.totalScore||"",obj.observations||"",obj.timestamp||""]);
      }
    }
  }
  downloadCSV(rows,"evaluaciones_global.csv");
}

function exportJudgeCSV(judge){
  const rows = [["work","student","totalScore","comments","timestamp"]];
  const assigned = ASSIGNMENTS[judge] || [];
  for(const id of assigned){
    const key = `eval_${judge}_${id}`;
    const data = localStorage.getItem(key);
    if(data){
      const obj = JSON.parse(data);
      rows.push([id,WORKS[id]||"",obj.totalScore||"",obj.observations||"",obj.timestamp||""]);
    }
  }
  downloadCSV(rows,`evaluaciones_${judge}.csv`);
}

function downloadCSV(rows,filename){
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,"'")}"`).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function logout(){ localStorage.removeItem("simposioUser"); localStorage.removeItem("simposioRole"); location.reload(); }
