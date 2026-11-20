// Configuration Supabase
const SUPABASE_URL = "https://vocfhrshxqbgeweqtcyy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cDztkj3p72bBoWWOWx0NBg_IT4lCLTh";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const BUCKET = "cours-svt";

const categories = [
  "Cours",
  "TD",
  "TP",
  "Anciens sujets d'examen",
  "Corrigés",
  "Fiches de révision",
  "Autres ressources"
];

const spaces = [
  {id:"7526f17c-cfd3-45e2-b02a-7c6df4deee1f",code:"L1-TC",level:"L1",track:"Tronc commun",title:"L1 · Tronc commun",desc:"Première année — tronc commun"},
  {id:"797768c3-d300-4c6c-a569-958fd10ed31f",code:"L2-STA",level:"L2",track:"STA",title:"L2 · STA",desc:"Sciences et Techniques de l'Aliment"},
  {id:"9c8a80fa-233f-4bbd-b97c-98ff0a4610ed",code:"L2-STE",level:"L2",track:"STE",title:"L2 · STE",desc:"Sciences et Techniques de l'Environnement"},
  {id:"b7861a6c-ef47-42b1-a908-ef50fa22e6d9",code:"L2-GEO",level:"L2",track:"Géologie",title:"L2 · GAE",desc:"Géologie Appliquée et Environnement"},
  {id:"dfe83d42-a516-4317-9507-85957f91bc7e",code:"L3-STA",level:"L3",track:"STA",title:"L3 · STA",desc:"Sciences et Techniques de l'Aliment"},
  {id:"2b3d7858-1865-4306-bb70-dce98620b12d",code:"L3-STE",level:"L3",track:"STE",title:"L3 · STE",desc:"Sciences et Techniques de l'Environnement"},
  {id:"55081a20-9212-4f35-8f7b-b95e7fe3a264",code:"L3-GEO",level:"L3",track:"Géologie",title:"L3 · GAE",desc:"Géologie Appliquée et Environnement"}
];

let state = {subjects:[],documents:[]};
let currentUser = null;
let currentProfile = null;
let currentSpace = null;
let currentSemester = "Semestre 1";
let currentSubject = null;
let currentCategory = categories[0];

const $ = id => document.getElementById(id);

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function toast(message) {
  const t=$("toast");
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>t.classList.remove("show"),2800);
}

function semesters(space) {
  return space.level==="L1"
    ? ["Semestre 1","Semestre 2"]
    : space.level==="L2"
      ? ["Semestre 3","Semestre 4","Semestre 5"]
      : ["Semestre 5","Semestre 6"];
}

function formatSize(n) {
  return n<1024*1024
    ? `${Math.max(1,Math.round(n/1024))} Ko`
    : `${(n/1024/1024).toFixed(1)} Mo`;
}

function spaceFor(id) {
  return spaces.find(s=>s.id===id);
}

async function loadData() {
  const [
    {data:subjects,error:subjectsError},
    {data:documents,error:documentsError}
  ] = await Promise.all([
    supabaseClient.from("subjects")
      .select("id,name,description,space_id,created_by,created_at,code,semester")
      .order("name"),

    supabaseClient.from("resources")
      .select("id,title,description,file_path,original_filename,space_id,subject_id,category,file_size,uploaded_by,created_at")
      .order("created_at",{ascending:false})
  ]);

  if (subjectsError) throw subjectsError;
  if (documentsError) throw documentsError;

  state.subjects=(subjects||[]).map(s=>({...s,spaceId:s.space_id}));

  state.documents=(documents||[]).map(d=>({
    ...d,
    subjectId:d.subject_id,
    name:d.original_filename || d.title,
    ext:(d.original_filename || d.title || "PDF").split(".").pop().toLowerCase(),
    date:d.created_at,
    size:formatSize(d.file_size || 0)
  }));

  renderSpaces();
  renderLatest();

  if (currentSpace && $("spaceDialog").open) renderSubjects();
  if (currentSubject && $("documentsDialog").open) renderDocuments();
}

async function ensureProfile(user) {
  const {data,error}=await supabaseClient
    .from("profiles")
    .select("id,full_name,student_number,role")
    .eq("id",user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const fullName=user.user_metadata?.full_name ||
    user.email?.split("@")[0] || "Étudiant";

  const studentNumber=user.user_metadata?.student_number || null;

  const {data:created,error:insertError}=await supabaseClient
    .from("profiles")
    .insert({
      id:user.id,
      full_name:fullName,
      student_number:studentNumber,
      role:"student"
    })
    .select("id,full_name,student_number,role")
    .single();

  if (insertError) throw insertError;
  return created;
}

function updateAuthUI() {
  $("adminToggle").textContent=currentUser ? "Mon compte" : "Connexion";
  $("signedInPanel").hidden=!currentUser;
  $("signedOutPanel").hidden=!!currentUser;

  if (currentUser) {
    $("accountInfo").textContent=
      `Connecté : ${currentProfile?.full_name || currentUser.email} (${currentUser.email}). Tu peux maintenant télécharger, déposer des PDF et proposer des matières.`;
  }
}

async function refreshSession() {
  const {data:{session},error}=await supabaseClient.auth.getSession();

  if (error) throw error;

  currentUser=session?.user || null;
  currentProfile=currentUser ? await ensureProfile(currentUser) : null;

  updateAuthUI();
}

function requireLogin(message="Connecte-toi pour effectuer cette action.") {
  if (currentUser) return true;

  toast(message);
  $("authDialog").showModal();
  return false;
}

function renderSpaces() {
  const q=$("searchInput").value.toLowerCase();
  const level=$("levelFilter").value;
  const track=$("trackFilter").value;

  const filtered=spaces.filter(s=>
    (!level||s.level===level) &&
    (!track||s.track===track) &&
    (!q||`${s.title} ${s.desc}`.toLowerCase().includes(q))
  );

  $("spacesGrid").innerHTML=filtered.map(s=>`
    <button class="space-card" data-space="${s.id}">
      <span class="arrow">↗</span>
      <span class="space-icon">${s.level}</span>
      <strong>${esc(s.title)}</strong>
      <small>${esc(s.desc)}</small>
    </button>
  `).join("") ||
  '<div class="empty-state">Aucun espace ne correspond à ta recherche.</div>';
}

$("spacesGrid").addEventListener("click",e=>{
  const b=e.target.closest("[data-space]");
  if(b) openSpace(b.dataset.space);
});

function openSpace(id) {
  currentSpace=spaceFor(id);
  if(!currentSpace) return;

  currentSemester=semesters(currentSpace)[0];

  $("spaceEyebrow").textContent=currentSpace.desc.toUpperCase();
  $("spaceTitle").textContent=currentSpace.title;
  $("spaceDescription").textContent=
    "Choisis une matière pour consulter ses ressources.";

  renderSemesterTabs();
  $("spaceDialog").showModal();
}

function renderSemesterTabs() {
  $("semesterTabs").innerHTML=semesters(currentSpace).map(s=>`
    <button class="tab-btn ${s===currentSemester?"active":""}"
      data-semester="${s}">${s}</button>
  `).join("");

  $("subjectSemester").innerHTML=semesters(currentSpace)
    .map(s=>`<option>${s}</option>`).join("");

  $("subjectSemester").value=currentSemester;
  renderSubjects();
}

$("semesterTabs").addEventListener("click",e=>{
  const b=e.target.closest("[data-semester]");
  if(!b) return;

  currentSemester=b.dataset.semester;
  renderSemesterTabs();
});

function renderSubjects() {
  const list=state.subjects.filter(s=>
    s.space_id===currentSpace.id &&
    s.semester===currentSemester
  );

  $("subjectsList").innerHTML=list.map(s=>{
    const n=state.documents.filter(d=>d.subject_id===s.id).length;

    return `
      <button class="subject-row" data-subject="${s.id}">
        <span class="space-icon">✳</span>
        <span class="subject-info">
          <strong>${esc(s.name)}</strong>
          <small>${s.code?esc(s.code)+" · ":""}${n} ressource(s)</small>
        </span>
        <span class="chevron">→</span>
      </button>
    `;
  }).join("") ||
  '<div class="empty-state">Aucune matière dans ce semestre pour le moment. Connecte-toi pour en créer une.</div>';
}

$("subjectsList").addEventListener("click",e=>{
  const b=e.target.closest("[data-subject]");
  if(b) openSubject(b.dataset.subject);
});

$("createSubjectBtn").addEventListener("click",()=>{
  if(!requireLogin("Connecte-toi pour proposer une matière.")) return;

  $("subjectForm").reset();
  $("subjectSemester").value=currentSemester;
  $("subjectDialog").showModal();
});

$("subjectForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!requireLogin()) return;

  const f=new FormData(e.target);
  const name=String(f.get("name")).trim();
  const semester=String(f.get("semester"));

  if(!name) return;

  if(state.subjects.some(s=>
    s.space_id===currentSpace.id &&
    s.semester===semester &&
    s.name.toLowerCase()===name.toLowerCase()
  )) {
    toast("Cette matière existe déjà dans ce semestre.");
    return;
  }

  const payload={
    name,
    code:String(f.get("code")||"").trim()||null,
    semester,
    description:String(f.get("description")||"").trim()||null,
    space_id:currentSpace.id,
    created_by:currentUser.id
  };

  const {error}=await supabaseClient.from("subjects").insert(payload);

  if(error) {
    toast(`Impossible d'enregistrer : ${error.message}`);
    return;
  }

  $("subjectDialog").close();
  currentSemester=semester;

  try {
    await loadData();
    renderSemesterTabs();
    toast("Matière ajoutée à la bibliothèque.");
  } catch(err) {
    toast(`Erreur de chargement : ${err.message}`);
  }
});function openSubject(id) {
  currentSubject = state.subjects.find(s => s.id === id);
  if (!currentSubject) return;

  currentCategory = categories[0];
  $("documentsTitle").textContent = currentSubject.name;
  $("subjectContext").textContent =
    `${currentSpace.title} · ${currentSubject.semester}`;

  renderDocumentCategories();
  renderDocuments();
  $("documentsDialog").showModal();
}

function renderDocumentCategories() {
  $("documentCategories").innerHTML = categories.map(c =>
    `<button class="tab-btn ${c === currentCategory ? "active" : ""}" data-category="${c}">${esc(c)}</button>`
  ).join("");
}

$("documentCategories").addEventListener("click", e => {
  const b = e.target.closest("[data-category]");
  if (!b) return;

  currentCategory = b.dataset.category;
  renderDocumentCategories();
  renderDocuments();
});

function documentRow(d, latest = false) {
  const sub = state.subjects.find(s => s.id === d.subject_id);
  const sp = spaceFor(d.space_id);

  const detail = latest
    ? `${esc(sub?.name || "Matière")} · ${esc(sp?.title || "Espace")} · ${esc(d.category || "Ressource")}`
    : `Ajouté le ${new Date(d.created_at).toLocaleDateString("fr-FR")} · ${esc(d.size)}`;

  return `<div class="${latest ? "latest-item" : "document-row"}">
    <span class="file-icon">${esc((d.ext || "pdf").toUpperCase())}</span>
    <span class="grow">
      <strong>${esc(d.name || d.title)}</strong>
      <small>${detail}</small>
    </span>
    <button class="download-link" type="button" data-download="${d.id}">Télécharger</button>
  </div>`;
}

function renderDocuments() {
  const docs = state.documents.filter(d =>
    d.subject_id === currentSubject.id && d.category === currentCategory
  );

  $("documentsList").innerHTML = docs.map(d => documentRow(d)).join("") ||
    '<div class="empty-state">Aucune ressource dans cette catégorie.</div>';

  $("uploadBtn").textContent = currentUser
    ? "＋ Ajouter un document"
    : "Connexion requise";
}

$("documentsList").addEventListener("click", e => {
  const b = e.target.closest("[data-download]");
  if (b) downloadResource(b.dataset.download);
});

$("latestList").addEventListener("click", e => {
  const b = e.target.closest("[data-download]");
  if (b) downloadResource(b.dataset.download);
});

$("uploadBtn").addEventListener("click", () => {
  if (!requireLogin("Connecte-toi pour déposer un document.")) return;
  $("fileInput").click();
});

$("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  if (!currentUser) {
    requireLogin();
    e.target.value = "";
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    toast("Fichier trop volumineux (20 Mo maximum).");
    e.target.value = "";
    return;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    toast("Seuls les fichiers PDF sont acceptés pour le moment.");
    e.target.value = "";
    return;
  }

  const safeName = file.name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const path = `${currentUser.id}/${currentSubject.id}/${Date.now()}-${safeName}`;

  $("uploadBtn").disabled = true;
  toast("Envoi du document en cours…");

  const { error: uploadError } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false
    });

  if (uploadError) {
    $("uploadBtn").disabled = false;
    toast(`Échec de l'envoi : ${uploadError.message}`);
    e.target.value = "";
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("resources")
    .insert({
      title: file.name,
      original_filename: file.name,
      file_path: path,
      space_id: currentSubject.space_id,
      subject_id: currentSubject.id,
      category: currentCategory,
      file_size: file.size,
      uploaded_by: currentUser.id
    });

  if (insertError) {
    await supabaseClient.storage.from(BUCKET).remove([path]);
    $("uploadBtn").disabled = false;
    toast(`Document non enregistré : ${insertError.message}`);
    e.target.value = "";
    return;
  }

  $("uploadBtn").disabled = false;
  e.target.value = "";

  try {
    await loadData();
    toast("Document publié dans la bibliothèque.");
  } catch (err) {
    toast(`Document envoyé, mais actualisation impossible : ${err.message}`);
  }
});

async function downloadResource(id) {
  const d = state.documents.find(x => x.id === id);
  if (!d) return;

  if (!requireLogin("Connecte-toi pour télécharger ce document.")) return;

  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .createSignedUrl(d.file_path, 60);

  if (error) {
    toast(`Téléchargement impossible : ${error.message}`);
    return;
  }

  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.target = "_blank";
  a.rel = "noopener";
  a.download = d.original_filename || d.title;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function renderLatest() {
  const q = $("searchInput").value.toLowerCase();
  const level = $("levelFilter").value;
  const track = $("trackFilter").value;
  const cat = $("categoryFilter").value;

  const docs = state.documents.filter(d => {
    const sub = state.subjects.find(s => s.id === d.subject_id);
    const sp = spaceFor(d.space_id);

    return sub && sp &&
      (!q || `${d.name} ${sub.name} ${sp.title} ${d.category}`.toLowerCase().includes(q)) &&
      (!level || sp.level === level) &&
      (!track || sp.track === track) &&
      (!cat || d.category === cat);
  }).slice(0, 8);

  $("resourceCount").textContent = `${state.documents.length} ressource(s)`;

  $("latestList").innerHTML = docs.map(d => documentRow(d, true)).join("") ||
    '<div class="empty-state">Aucune ressource ne correspond aux filtres. Les documents ajoutés apparaîtront ici.</div>';
}

["searchInput", "levelFilter", "trackFilter", "categoryFilter"].forEach(id => {
  $(id).addEventListener(
    id === "searchInput" ? "input" : "change",
    () => {
      renderSpaces();
      renderLatest();
    }
  );
});

$("adminToggle").addEventListener("click", () => {
  updateAuthUI();
  $("authDialog").showModal();
});

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const f = new FormData(e.target);

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: String(f.get("email")).trim(),
    password: String(f.get("password"))
  });

  if (error) {
    toast(`Connexion impossible : ${error.message}`);
    return;
  }

  try {
    await refreshSession();
    $("authDialog").close();
    e.target.reset();
    toast("Connexion réussie.");
    await loadData();
  } catch (err) {
    toast(`Profil : ${err.message}`);
  }
});

$("signupForm").addEventListener("submit", async e => {
  e.preventDefault();

  const f = new FormData(e.target);

  const { data, error } = await supabaseClient.auth.signUp({
    email: String(f.get("email")).trim(),
    password: String(f.get("password")),
    options: {
      data: {
        full_name: String(f.get("full_name")).trim(),
        student_number: String(f.get("student_number") || "").trim()
      }
    }
  });

  if (error) {
    toast(`Inscription impossible : ${error.message}`);
    return;
  }

  e.target.reset();

  if (data.session) {
    try {
      await refreshSession();
      $("authDialog").close();
      toast("Compte créé et connecté.");
      await loadData();
    } catch (err) {
      toast(`Compte créé. Profil : ${err.message}`);
    }
  } else {
    toast("Compte créé. Vérifie ta boîte e-mail pour confirmer ton adresse, puis connecte-toi.");
  }
});

$("signOutBtn").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    toast(`Déconnexion impossible : ${error.message}`);
    return;
  }

  currentUser = null;
  currentProfile = null;
  updateAuthUI();
  $("authDialog").close();
  toast("Tu es déconnecté.");
});

document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", () => $(b.dataset.close).close());
});

document.querySelectorAll("dialog").forEach(d => {
  d.addEventListener("click", e => {
    if (e.target === d) d.close();
  });
});

$("year").textContent = new Date().getFullYear();

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;

  try {
    currentProfile = currentUser ? await ensureProfile(currentUser) : null;
    updateAuthUI();
  } catch (err) {
    updateAuthUI();
    toast(`Erreur de profil : ${err.message}`);
  }
});

(async function init() {
  try {
    await refreshSession();
    await loadData();
  } catch (err) {
    console.error(err);
    toast(`Connexion Supabase impossible : ${err.message}`);
    $("spacesGrid").innerHTML =
      '<div class="empty-state">Impossible de charger la bibliothèque. Vérifie la connexion Supabase et les règles d’accès.</div>';
  }
})();
