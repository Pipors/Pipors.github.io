const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const members=[
  {id:'anas',   name:'Anas',     init:'ME', color:'#A78BFA', bg:'rgba(167,139,250,0.12)', gradient:'linear-gradient(90deg,#A78BFA,#C4B5FD)'},
  {id:'hassan',name:'Hassan',init:'HA', color:'#34D399', bg:'rgba(52,211,153,0.12)',  gradient:'linear-gradient(90deg,#34D399,#6EE7B7)'},
  {id:'nii',  name:'Nii',    init:'NI', color:'#FB923C', bg:'rgba(251,146,60,0.12)',  gradient:'linear-gradient(90deg,#FB923C,#FCD34D)'}
];

let tasksData=[];
let historyData=[];
let editingId=null;
let currentUserId=null;

async function load(){
  const { data: dbData, error } = await _supabase
    .from('tasks')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!error && dbData) {
    tasksData = dbData;
  } else {
    console.error("Supabase load error:", error);
  }

  const { data: histData, error: histError } = await _supabase
    .from('task_history')
    .select('*, tasks(name)')
    .order('changed_at', { ascending: false });

  if (!histError && histData) {
    historyData = histData;
  }
}

async function saveHistory(taskId, field, oldVal, newVal) {
  if (oldVal === newVal) return;
  const row = {
    task_id: taskId,
    changed_by: currentUserId,
    field_changed: field,
    old_value: oldVal ? String(oldVal) : null,
    new_value: newVal ? String(newVal) : null,
    changed_at: new Date().toISOString()
  };
  await _supabase.from('task_history').insert([row]);
}

async function save(taskPayload, id){
  const now = new Date().toISOString();
  
  if (id) {
    // Update existing task
    const oldTask = tasksData.find(t => t.id === id);
    const rowData = {
      ...taskPayload,
      updated_at: now
    };
    
    const { error } = await _supabase.from('tasks').update(rowData).eq('id', id);
    if (!error) {
      // Log History
      await saveHistory(id, 'name', oldTask.name, taskPayload.name);
      await saveHistory(id, 'progress', oldTask.progress, taskPayload.progress);
      await saveHistory(id, 'tools_used', JSON.stringify(oldTask.tools_used), JSON.stringify(taskPayload.tools_used));
      await saveHistory(id, 'constraints_found', oldTask.constraints_found, taskPayload.constraints_found);
    }
  } else {
    // Insert new task
    const rowData = {
      ...taskPayload,
      created_by: currentUserId,
      created_at: now,
      updated_at: now
    };
    const { data: inserted, error } = await _supabase.from('tasks').insert([rowData]).select().single();
    if (!error && inserted) {
      await saveHistory(inserted.id, 'task_created', '', 'Created task');
    }
  }
}

function fmt(d){return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
function fmtShort(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}

function toolChips(str){
  if(!str)return '<span style="color:var(--dim);font-size:12px;font-style:italic">—</span>';
  return str.split(',').map(t=>`<span class="chip">${t.trim()}</span>`).join('');
}

let currentTab = 'ongoing';

function render(){
  const g = document.getElementById('grid');
  const h = document.getElementById('history-section');
  
  if(currentTab === 'history') {
    g.style.display = 'none';
    h.style.display = 'block';
    renderHistory();
    return;
  }
  
  g.style.display = 'grid';
  h.style.display = 'none';
  g.innerHTML='';

  // Filter tasks based on the tab
  const filteredTasks = tasksData.filter(d => {
    const pct = d.progress ?? 0;
    if (currentTab === 'completed') return pct === 100;
    return pct < 100; // 'ongoing'
  });

  if (filteredTasks.length === 0) {
    g.innerHTML = `<div style="color:var(--dim);font-size:13px;grid-column:1/-1;text-align:center;padding:40px;">No ${currentTab} tasks found.</div>`;
    return;
  }

  for(const d of filteredTasks){
    const pct=d.progress??0;
    
    // Attempt parse of tools
    let rawTools = d.tools_used;
    if (typeof rawTools === 'string') {
      try { rawTools = JSON.parse(rawTools); } catch(e){}
    }
    const toolsStr = Array.isArray(rawTools) ? rawTools.join(', ') : (rawTools || '');
    
    const obs = d.constraints_found || '';
    const hasObs=obs.trim().length>0;

    g.innerHTML+=`
    <div class="card" data-who="user">
      <div class="card-accent" style="background:linear-gradient(90deg,var(--anas),#C4B5FD)"></div>
      <div class="card-head">
        <div class="name-info">
          <div class="name">${d.name||'Untitled Task'}</div>
          <div class="tag">Last Updated: ${fmtShort(new Date(d.updated_at))}</div>
        </div>
        <button class="edit-btn" onclick="openModal('${d.id}')">edit ↗</button>
      </div>
      <div class="card-body">
        <div class="field">
          <div class="field-label">Progress</div>
          <div class="prog-row"><span class="prog-pct" style="color:var(--anas)">${pct}%</span></div>
          <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--anas),#C4B5FD)"></div></div>
        </div>
        <div class="field">
          <div class="field-label">Tools</div>
          <div class="chips">${toolChips(toolsStr)}</div>
        </div>
        <div class="field">
          <div class="field-label">Obstacles</div>
          <div class="obstacle-box ${hasObs?'':'clear'}">${hasObs?obs:'✓ No blockers'}</div>
        </div>
      </div>
    </div>`;
  }
}

window.openModal=function(id){
  editingId=id; // UUID
  document.getElementById('m-title').textContent = id ? 'Update Task' : 'New Task';
  
  if (id) {
    const d=tasksData.find(t=>t.id===id);
    document.getElementById('f-task').value=d.name||'';
    document.getElementById('f-prog').value=d.progress??0;
    
    let rawTools = d.tools_used;
    if (typeof rawTools === 'string') {
      try { rawTools = JSON.parse(rawTools); } catch(e){}
    }
    document.getElementById('f-tools').value=Array.isArray(rawTools) ? rawTools.join(', ') : (rawTools || '');
    document.getElementById('f-obs').value=d.constraints_found||'';
    
    document.getElementById('prog-num').textContent=(d.progress??0)+'%';
    document.getElementById('modal-pct-color').textContent=(d.progress??0)+'%';
  } else {
    // New task modal init
    document.getElementById('f-task').value='';
    document.getElementById('f-prog').value=0;
    document.getElementById('f-tools').value='';
    document.getElementById('f-obs').value='';
    document.getElementById('prog-num').textContent='0%';
    document.getElementById('modal-pct-color').textContent='0%';
  }
  
  document.getElementById('m-avatar').style.display = 'none'; // hide user avatar for now
  document.getElementById('btn-save').style.background=members[0].gradient;
  document.getElementById('f-prog').style.accentColor=members[0].color;
  document.getElementById('overlay').classList.add('open');
};

document.getElementById('btn-add-task').addEventListener('click', () => {
    openModal(null);
});

document.getElementById('f-prog').addEventListener('input',function(){
  const v=this.value;
  document.getElementById('prog-num').textContent=v+'%';
  document.getElementById('modal-pct-color').textContent=v+'%';
});

document.getElementById('btn-cancel').addEventListener('click',()=>document.getElementById('overlay').classList.remove('open'));
document.getElementById('overlay').addEventListener('click',e=>{if(e.target===document.getElementById('overlay'))document.getElementById('overlay').classList.remove('open');});

document.getElementById('btn-save').addEventListener('click',async()=>{
  const rawToolsValue = document.getElementById('f-tools').value.trim();
  const toolsArray = rawToolsValue ? rawToolsValue.split(',').map(s=>s.trim()) : [];
  
  const dData = {
    name: document.getElementById('f-task').value.trim(),
    progress: parseInt(document.getElementById('f-prog').value),
    tools_used: JSON.stringify(toolsArray),
    constraints_found: document.getElementById('f-obs').value.trim()
  };
  
  await save(dData, editingId);
  document.getElementById('overlay').classList.remove('open');
  
  // reload from Supabase to capture new history item & correct db_id
  await load();
  render();
});

const now=new Date();
document.getElementById('hdate').textContent='— '+fmt(now);
document.getElementById('dtag').textContent=fmtShort(now);

function renderHistory(){
  const list = document.getElementById('history-list');
  list.innerHTML='';
  
  if(historyData.length === 0){
    list.innerHTML = '<div style="color:var(--dim);font-size:13px;padding:12px;">No task history found.</div>';
    return;
  }
  
  for(const h of historyData){
    const dateObj = new Date(h.changed_at);
    const dateStr = fmtShort(dateObj) + ' at ' + dateObj.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
    const subject = h.tasks?.name || 'Deleted Task';
    
    list.innerHTML += `
      <div class="history-item" style="border-left:3px solid var(--nii)">
        <div class="h-date">${dateStr}</div>
        <div class="h-task" style="color:var(--text);font-size:14px;font-weight:600;margin-bottom:8px;">${subject} &rarr; Modifying <span style="color:var(--anas);">${h.field_changed}</span></div>
        <div class="h-meta" style="display:flex;gap:16px;margin-top:12px;">
          <div class="h-meta-col" style="display:flex;flex-direction:column;gap:4px;">
            <span class="h-meta-label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;">From</span>
            <span class="h-meta-val" style="font-size:11px;color:var(--text);">${h.old_value||'—'}</span>
          </div>
          <div class="h-meta-col" style="display:flex;flex-direction:column;gap:4px;">
            <span class="h-meta-label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;">To</span>
            <span class="h-meta-val" style="font-size:11px;color:var(--text);">${h.new_value||'—'}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize the tabs logic
document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.main-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTab = e.target.dataset.tab;
    render();
  });
});

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
  
  // Set the user greeting and grab ID
  const userEmail = session.user.email;
  currentUserId = session.user.id;
  const username = userEmail.split('@')[0];
  document.getElementById('greeting').innerHTML = `Hello, <span style="color:var(--anas);">${username}</span>`;
  
  await load();
  render();
})();