const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const members=[
  {id:'me',   name:'Me',     init:'ME', color:'#A78BFA', bg:'rgba(167,139,250,0.12)', gradient:'linear-gradient(90deg,#A78BFA,#C4B5FD)'},
  {id:'hassan',name:'Hassan',init:'HA', color:'#34D399', bg:'rgba(52,211,153,0.12)',  gradient:'linear-gradient(90deg,#34D399,#6EE7B7)'},
  {id:'nii',  name:'Nii',    init:'NI', color:'#FB923C', bg:'rgba(251,146,60,0.12)',  gradient:'linear-gradient(90deg,#FB923C,#FCD34D)'}
];

let data={me:{},hassan:{},nii:{}};
let historyData=[];
let editingId=null;

async function load(){
  const { data: dbData, error } = await _supabase
    .from('tasks')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!error && dbData) {
    historyData = dbData;
    for (const m of members) {
      // Find the most recent task for this user
      const uTask = dbData.find(t => t.user === m.id);
      if (uTask) {
        data[m.id] = {
          db_id: uTask.id, // Store DB id for updating it later
          task: uTask.task_name || '',
          progress: parseInt(uTask.progress) || 0,
          tools: uTask.used_tools || '',
          obstacles: uTask.constraint || ''
        };
      }
    }
  } else {
    console.error("Supabase load error:", error);
  }
}

async function save(id){
  const d = data[id];
  const rowData = {
    task_name: d.task,
    progress: String(d.progress), // Your DB uses text for progress
    used_tools: d.tools,
    constraint: d.obstacles,
    user: id,
    updated_at: new Date().toISOString()
  };

  try {
    // Treat every save as a history log: always insert a new row. 
    rowData.created_at = new Date().toISOString(); 
    const { data: inserted, error } = await _supabase.from('tasks').insert([rowData]).select().single();
    if (inserted && !error) {
      d.db_id = inserted.id; // save the newest DB ID
    }
  } catch (e) {
    console.error("Supabase save error:", e);
  }
}

function fmt(d){return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
function fmtShort(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}

function toolChips(str){
  if(!str)return '<span style="color:var(--dim);font-size:12px;font-style:italic">—</span>';
  return str.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('');
}

function render(){
  const g=document.getElementById('grid');
  g.innerHTML='';
  for(const m of members){
    const d=data[m.id];
    const pct=d.progress??0;
    const hasObs=d.obstacles?.trim().length>0;
    g.innerHTML+=`
    <div class="card" data-who="${m.id}">
      <div class="card-accent"></div>
      <div class="card-head">
        <div class="avatar">${m.init}</div>
        <div class="name-info">
          <div class="name">${m.name}</div>
          <div class="tag">team member</div>
        </div>
        <button class="edit-btn" onclick="openModal('${m.id}')">edit ↗</button>
      </div>
      <div class="card-body">
        <div class="field">
          <div class="field-label">Task today</div>
          <div class="field-val ${!d.task?'empty':''}">${d.task||'No task yet'}</div>
        </div>
        <div class="field">
          <div class="field-label">Progress</div>
          <div class="prog-row"><span class="prog-pct">${pct}%</span></div>
          <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="field">
          <div class="field-label">Tools</div>
          <div class="chips">${toolChips(d.tools)}</div>
        </div>
        <div class="field">
          <div class="field-label">Obstacles</div>
          <div class="obstacle-box ${hasObs?'':'clear'}">${hasObs?d.obstacles:'✓ No blockers'}</div>
        </div>
      </div>
    </div>`;
  }
}

window.openModal=function(id){
  editingId=id;
  const m=members.find(x=>x.id===id);
  const d=data[id];
  document.getElementById('m-avatar').style.cssText=`background:${m.bg};color:${m.color};border:1px solid ${m.color}33`;
  document.getElementById('m-avatar').textContent=m.init;
  document.getElementById('m-title').textContent='Update — '+m.name;
  document.getElementById('f-task').value=d.task||'';
  document.getElementById('f-prog').value=d.progress??0;
  document.getElementById('prog-num').textContent=(d.progress??0)+'%';
  document.getElementById('modal-pct-color').textContent=(d.progress??0)+'%';
  document.getElementById('modal-pct-color').style.color=m.color;
  document.getElementById('f-tools').value=d.tools||'';
  document.getElementById('f-obs').value=d.obstacles||'';
  document.getElementById('btn-save').style.background=m.gradient;
  document.getElementById('f-prog').style.accentColor=m.color;
  document.getElementById('overlay').classList.add('open');
};

document.getElementById('f-prog').addEventListener('input',function(){
  const v=this.value;
  document.getElementById('prog-num').textContent=v+'%';
  document.getElementById('modal-pct-color').textContent=v+'%';
});

document.getElementById('btn-cancel').addEventListener('click',()=>document.getElementById('overlay').classList.remove('open'));
document.getElementById('overlay').addEventListener('click',e=>{if(e.target===document.getElementById('overlay'))document.getElementById('overlay').classList.remove('open');});

document.getElementById('btn-save').addEventListener('click',async()=>{
  const dData = {
    task:document.getElementById('f-task').value.trim(),
    progress:parseInt(document.getElementById('f-prog').value),
    tools:document.getElementById('f-tools').value.trim(),
    obstacles:document.getElementById('f-obs').value.trim()
  };
  
  // Update state locally first so UI is snappy, but we don't know db_id for history yet
  data[editingId] = { ...data[editingId], ...dData };
  
  await save(editingId);
  document.getElementById('overlay').classList.remove('open');
  
  // reload from Supabase to capture new history item & correct db_id
  await load();
  render();
  
  const activeTab = document.querySelector('.tab-btn.active');
  renderHistory(activeTab ? activeTab.dataset.id : 'all');
});

const now=new Date();
document.getElementById('hdate').textContent='— '+fmt(now);
document.getElementById('dtag').textContent=fmtShort(now);

function renderHistory(filter = 'all'){
  const list = document.getElementById('history-list');
  list.innerHTML='';
  
  const filtered = filter === 'all' ? historyData : historyData.filter(t => t.user === filter);
  
  if(filtered.length === 0){
    list.innerHTML = '<div style="color:var(--dim);font-size:13px;padding:12px;">No task history found.</div>';
    return;
  }
  
  for(const t of filtered){
    const m = members.find(x => x.id === t.user) || { name: 'Unknown', color: '#6B7A99' };
    const dateObj = new Date(t.updated_at || t.created_at);
    // e.g. "Dec 21, 2024 at 10:30 AM"
    const dateStr = fmtShort(dateObj) + ' at ' + dateObj.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
    
    const taskName = t.task_name || '<em style="color:var(--dim)">No detail provided</em>';
    const pct = t.progress || '0';
    const tools = t.used_tools || '—';
    const obs = t.constraint || '—';
    
    list.innerHTML += `
      <div class="history-item" style="border-left:3px solid ${m.color}">
        <div class="h-date">${dateStr} • ${m.name}</div>
        <div class="h-task" style="color:var(--text);font-size:14px;font-weight:600;margin-bottom:8px;">${taskName}</div>
        <div class="h-prog" style="color:${m.color};font-size:16px;font-weight:800;position:absolute;top:16px;right:16px;">${pct}%</div>
        <div class="h-meta" style="display:flex;gap:16px;margin-top:12px;">
          <div class="h-meta-col" style="display:flex;flex-direction:column;gap:4px;">
            <span class="h-meta-label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;">Tools</span>
            <span class="h-meta-val" style="font-size:11px;color:var(--text);">${tools}</span>
          </div>
          <div class="h-meta-col" style="display:flex;flex-direction:column;gap:4px;">
            <span class="h-meta-label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;">Obstacles</span>
            <span class="h-meta-val" style="font-size:11px;color:var(--text);">${obs}</span>
          </div>
        </div>
      </div>
    `;
  }
}

function initHistoryTabs(){
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabs.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderHistory(e.target.dataset.id);
    });
  });
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await _supabase.auth.signOut();
  window.location.href = 'login.html';
});

(async()=>{
  // Secure the app dashboard
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  
  // Set the user greeting
  const userEmail = session.user.email;
  const username = userEmail.split('@')[0];
  document.getElementById('greeting').innerHTML = `Hello, <span style="color:var(--me);">${username}</span>`;
  
  await load();
  render();
  renderHistory('all');
  initHistoryTabs();
})();