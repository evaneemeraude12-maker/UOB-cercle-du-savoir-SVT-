
const STORAGE_KEY = "cercle_savoir_v1";

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
  {id:"L1",level:"L1",track:"Tronc commun",title:"L1 · Tronc commun",desc:"Première année — tronc commun"},
  {id:"L2-STA",level:"L2",track:"STA",title:"L2 · STA",desc:"Sciences et Techniques de l'Aliment"},
  {id:"L2-STE",level:"L2",track:"STE",title:"L2 · STE",desc:"Sciences et Techniques de l'Environnement"},
  {id:"L2-GAE",level:"L2",track:"GAE",title:"L2 · GAE",desc:"Géologie Appliquée et Environnement"},
  {id:"L3-STA",level:"L3",track:"STA",title:"L3 · STA",desc:"Sciences et Techniques de l'Aliment"},
  {id:"L3-STE",level:"L3",track:"STE",title:"L3 · STE",desc:"Sciences et Techniques de l'Environnement"},
  {id:"L3-GAE",level:"L3",track:"GAE",title:"L3 · GAE",desc:"Géologie Appliquée et Environnement"}
];

const seedSubjects = [
  ["L1","Semestre 1","Biologie cellulaire"],
  ["L1","Semestre 1","Chimie générale"],
  ["L1","Semestre 1","Mathématiques"],
  ["L1","Semestre 2","Biologie végétale"],
  ["L2-STA","Semestre 3","Biochimie alimentaire"],
  ["L2-STA","Semestre 4","Microbiologie alimentaire"],
  ["L2-STA","Semestre 5","Technologie alimentaire"]
];

let state = loadState();
let currentSpace = null;
let currentSemester = "Semestre 1";
let currentSubject = null;
let currentCategory = categories[0];

const $ = id => document.getElementById(id);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && s.subjects && s.documents) return s;
  } catch(e) {}

  return {
    subjects: seedSubjects.map((x,i)=>({
      id:"seed"+i,
      spaceId:x[0],
      semester:x[1],
      name:x[2],
      code:"",
      description:""
    })),
    documents:[]
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2400);
}

function semesters(space) {
  return space.level==="L1"
    ? ["Semestre 1","Semestre 2"]
    : space.level==="L2"
    ? ["Semestre 3","Semestre 4","Semestre 5"]
    : ["Semestre 5","Semestre 6"];
}

function renderSpaces() {
  const q = $("searchInput").value.toLowerCase();
  const level = $("levelFilter").value;
  const track = $("trackFilter").value;

  const filtered = spaces.filter(s =>
    (!level || s.level===level) &&
    (!track || s.track===track) &&
    (!q || `${s.title} ${s.desc}`.toLowerCase().includes(q))
  );

  $("spacesGrid").innerHTML = filtered.map(s=>`
    <button class="space-card" data-space="${s.id}">
      <span class="arrow">↗</span>
      <span class="space-icon">${s.level}</span>
      <strong>${s.title}</strong>
      <small>${s.desc}</small>
    </button>
  `).join("") || '<div class="empty-state">Aucun espace ne correspond à ta recherche.</div>';

  document.querySelectorAll("[data-space]").forEach(b =>
    b.addEventListener("click",()=>openSpace(b.dataset.space))
  );
}

function openSpace(id) {
  currentSpace = spaces.find(s=>s.id===id);
  currentSemester = semesters(currentSpace)[0];

  $("spaceEyebrow").textContent = currentSpace.desc.toUpperCase();
  $("spaceTitle").textContent = currentSpace.title;
  $("spaceDescription").textContent = "Choisis une matière pour consulter ses ressources.";

  renderSemesterTabs();
  $("spaceDialog").showModal();
}

function renderSemesterTabs() {
  $("semesterTabs").innerHTML = semesters(currentSpace).map(s=>`
    <button class="tab-btn ${s===currentSemester?"active":""}" data-semester="${s}">
      ${s}
    </button>
  `).join("");

  document.querySelectorAll("[data-semester]").forEach(b =>
    b.addEventListener("click",()=>{
      currentSemester=b.dataset.semester;
      renderSemesterTabs();
      renderSubjects();
    })
  );

  $("subjectSemester").innerHTML = semesters(currentSpace).map(s=>
    `<option>${s}</option>`
  ).join("");

  renderSubjects();
}

function renderSubjects() {
  const list = state.subjects.filter(s =>
    s.spaceId===currentSpace.id && s.semester===currentSemester
  );

  $("subjectsList").innerHTML = list.map(s=>{
    const n=state.documents.filter(d=>d.subjectId===s.id).length;

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
  }).join("") || '<div class="empty-state">Aucune matière dans ce semestre pour le moment. Tu peux en créer une avec le bouton ci-dessus.</div>';

  document.querySelectorAll("[data-subject]").forEach(b =>
    b.addEventListener("click",()=>openSubject(b.dataset.subject))
  );
}

function esc(v) {
  return String(v).replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

$("createSubjectBtn").addEventListener("click",()=>{
  $("subjectForm").reset();
  $("subjectSemester").value=currentSemester;
  $("subjectDialog").showModal();
});

$("subjectForm").addEventListener("submit",e=>{
  e.preventDefault();

  const f = new FormData(e.target);
  const name = String(f.get("name")).trim();
  const semester = f.get("semester");

  if (!name) return;

  if (state.subjects.some(s=>
    s.spaceId===currentSpace.id &&
    s.semester===semester &&
    s.name.toLowerCase()===name.toLowerCase()
  )) {
    toast("Cette matière existe déjà dans ce semestre.");
    return;
  }

  state.subjects.push({
    id:"sub_"+Date.now(),
    spaceId:currentSpace.id,
    semester,
    name,
    code:String(f.get("code")).trim(),
    description:String(f.get("description")).trim()
  });

  save();
  $("subjectDialog").close();
  currentSemester=semester;
  renderSemesterTabs();
  toast("Matière ajoutée sur cet appareil.");
});

function openSubject(id) {
  currentSubject = state.subjects.find(s=>s.id===id);
  currentCategory = categories[0];

  $("documentsTitle").textContent=currentSubject.name;
  $("subjectContext").textContent=`${currentSpace.title} · ${currentSubject.semester}`;

  renderDocumentCategories();
  renderDocuments();
  $("documentsDialog").showModal();
}

function renderDocumentCategories() {
  $("documentCategories").innerHTML = categories.map(c=>`
    <button class="tab-btn ${c===currentCategory?"active":""}" data-category="${c}">
      ${c}
    </button>
  `).join("");

  document.querySelectorAll("[data-category]").forEach(b =>
    b.addEventListener("click",()=>{
      currentCategory=b.dataset.category;
      renderDocumentCategories();
      renderDocuments();
    })
  );
}

function renderDocuments() {
  const docs = state.documents.filter(d=>
    d.subjectId===currentSubject.id &&
    d.category===currentCategory
  );

  $("documentsList").innerHTML = docs.map(d=>`
    <div class="document-row">
      <span class="file-icon">${esc(d.ext.toUpperCase())}</span>
      <span class="grow">
        <strong>${esc(d.name)}</strong>
        <small>Ajouté le ${new Date(d.date).toLocaleDateString("fr-FR")} · ${esc(d.size)}</small>
      </span>
      <a class="download-link" href="${d.dataUrl}" download="${esc(d.name)}">
        Télécharger
      </a>
    </div>
  `).join("") || '<div class="empty-state">Aucune ressource dans cette catégorie.</div>';
}

$("uploadBtn").addEventListener("click",()=>$("fileInput").click());

$("fileInput").addEventListener("change",e=>{
  const file=e.target.files[0];
  if (!file) return;

  if (file.size>15*1024*1024) {
    toast("Fichier trop volumineux (15 Mo maximum).");
    e.target.value="";
    return;
  }

  const allowed=["pdf","doc","docx","ppt","pptx","jpg","jpeg","png"];
  const ext=file.name.split(".").pop().toLowerCase();

  if (!allowed.includes(ext)) {
    toast("Format de fichier non accepté.");
    e.target.value="";
    return;
  }

  const reader=new FileReader();

  reader.onload=()=>{
    state.documents.push({
      id:"doc_"+Date.now(),
      subjectId:currentSubject.id,
      name:file.name,
      ext,
      category:currentCategory,
      size:formatSize(file.size),
      date:new Date().toISOString(),
      dataUrl:reader.result
    });

    try {
      save();
      renderDocuments();
      renderLatest();
      toast("Document ajouté sur cet appareil.");
    } catch(err) {
      state.documents.pop();
      toast("Stockage local saturé. Essaie un fichier plus léger.");
    }
  };

  reader.readAsDataURL(file);
  e.target.value="";
});

function formatSize(n) {
  return n<1024*1024
    ? `${Math.max(1,Math.round(n/1024))} Ko`
    : `${(n/1024/1024).toFixed(1)} Mo`;
}

function renderLatest() {
  const q=$("searchInput").value.toLowerCase();
  const level=$("levelFilter").value;
  const track=$("trackFilter").value;
  const cat=$("categoryFilter").value;

  const docs=state.documents.filter(d=>{
    const sub=state.subjects.find(s=>s.id===d.subjectId);
    const sp=sub && spaces.find(x=>x.id===sub.spaceId);

    return sub && sp &&
      (!q || `${d.name} ${sub.name} ${sp.title} ${d.category}`.toLowerCase().includes(q)) &&
      (!level || sp.level===level) &&
      (!track || sp.track===track) &&
      (!cat || d.category===cat);
  }).slice().reverse().slice(0,8);

  $("resourceCount").textContent=`${state.documents.length} ressource(s)`;

  $("latestList").innerHTML=docs.map(d=>{
    const sub=state.subjects.find(s=>s.id===d.subjectId);
    const sp=spaces.find(x=>x.id===sub.spaceId);

    return `
      <div class="latest-item">
        <span class="file-icon">${esc(d.ext.toUpperCase())}</span>
        <span class="grow">
          <strong>${esc(d.name)}</strong>
          <small>${esc(sub.name)} · ${sp.title} · ${esc(d.category)}</small>
        </span>
        <a class="download-link" href="${d.dataUrl}" download="${esc(d.name)}">
          Télécharger
        </a>
      </div>
    `;
  }).join("") || '<div class="empty-state">Aucune ressource ne correspond aux filtres. Les documents ajoutés apparaîtront ici.</div>';
}

["searchInput","levelFilter","trackFilter","categoryFilter"].forEach(id=>
  $(id).addEventListener(
    id==="searchInput"?"input":"change",
    ()=>{
      renderSpaces();
      renderLatest();
    }
  )
);

$("adminToggle").addEventListener("click",()=>{
  const docs=state.documents.length;
  const subs=state.subjects.length;

  $("adminStats").innerHTML=`
    <div class="stat"><strong>${spaces.length}</strong><small>Espaces de formation</small></div>
    <div class="stat"><strong>${subs}</strong><small>Matières créées</small></div>
    <div class="stat"><strong>${docs}</strong><small>Documents ajoutés</small></div>
  `;

  $("adminDialog").showModal();
});

$("resetDemo").addEventListener("click",()=>{
  if (confirm("Effacer les matières et documents ajoutés sur cet appareil ?")) {
    localStorage.removeItem(STORAGE_KEY);
    state=loadState();
    save();
    renderSpaces();
    renderLatest();
    $("adminDialog").close();
    toast("Données locales réinitialisées.");
  }
});

document.querySelectorAll("[data-close]").forEach(b=>
  b.addEventListener("click",()=>$(b.dataset.close).close())
);

document.querySelectorAll("dialog").forEach(d=>
  d.addEventListener("click",e=>{
    if (e.target===d) d.close();
  })
);

$("year").textContent=new Date().getFullYear();

renderSpaces();
renderLatest();
      
