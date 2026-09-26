const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name, className = '') => `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const money = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 });
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits:1 });
const dateFmt = new Intl.DateTimeFormat('es-MX', { day:'numeric', month:'short', year:'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' });

function safeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(val, fmt = dateFmt) {
  const d = safeDate(val);
  return d ? fmt.format(d) : 'Sin fecha';
}

const state = { user:null, csrf:'', projects:[], entrepreneurs:[], users:[], workspace:null, activeProjectId:null, draggedTask:null };

async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(state.csrf ? { 'x-csrf-token':state.csrf } : {}), ...options.headers };
  const response = await fetch(`/api${path}`, { credentials:'same-origin', ...options, headers });
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) showLogin();
    const error = new Error(data?.error || 'No fue posible completar la acción.');
    error.fields = data?.fields;
    throw error;
  }
  return data;
}

function toast(message, kind = 'success') {
  const item = document.createElement('div'); item.className = `toast ${kind}`; item.textContent = message;
  $('#toast-region').append(item); setTimeout(() => item.remove(), 4200);
}

function initials(name = '') { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function roleLabel(role) { return role === 'admin' ? 'Administrador' : 'Usuario estándar'; }
function statusLabel(status) { return ({ active:'Activo',paused:'Pausado',completed:'Completado',archived:'Archivado',pending:'Pendiente',in_progress:'En proceso',review:'En revisión' })[status] || status; }

function showLogin() {
  state.user = null; $('#app-view').classList.add('hidden'); $('#login-view').classList.remove('hidden');
}
function showApp() {
  $('#login-view').classList.add('hidden'); $('#app-view').classList.remove('hidden');
  const short = initials(state.user.name);
  ['sidebar-avatar','top-avatar'].forEach(id => $(`#${id}`).textContent = short);
  ['sidebar-name','top-name'].forEach(id => $(`#${id}`).textContent = state.user.name);
  ['sidebar-role','top-role'].forEach(id => $(`#${id}`).textContent = roleLabel(state.user.role));
  $('#greeting-name').textContent = state.user.name.split(' ')[0];
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', state.user.role !== 'admin'));
}

async function boot() {
  const resetToken = new URLSearchParams(location.search).get('reset');
  if (resetToken) { showLogin(); openResetModal(resetToken); return; }
  try { const data = await api('/auth/me'); state.user = data.user; state.csrf = data.csrfToken; showApp(); await Promise.all([loadBaseData(), loadDashboard()]); }
  catch { showLogin(); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('button[type="submit"]', event.currentTarget); button.disabled = true; button.textContent = 'Verificando...';
  try { const values = Object.fromEntries(new FormData(event.currentTarget)); const data = await api('/auth/login', { method:'POST', body:JSON.stringify(values) }); state.user = data.user; state.csrf = data.csrfToken; showApp(); await Promise.all([loadBaseData(), loadDashboard()]); }
  catch (error) { toast(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = `Iniciar sesión ${icon('arrow')}`; }
});

$('#forgot-link').addEventListener('click', () => openModal('Recuperar contraseña', `<div class="modal-body"><p class="muted">Captura tu correo. Si existe una cuenta activa, recibirás instrucciones para restablecerla.</p><label>Correo electrónico<input name="email" type="email" required></label><button class="text-button" type="button" data-submit="show-reset">Ya tengo un código de recuperación</button></div><div class="modal-actions"><button class="button secondary" value="cancel" formnovalidate>Cancelar</button><button class="button primary" type="button" data-submit="forgot">Enviar instrucciones</button></div>`));
function openResetModal(token=''){openModal('Crear nueva contraseña',`<div class="modal-body"><p class="muted">El código es de un solo uso y vence 30 minutos después de su creación.</p><label>Código de recuperación<input name="token" value="${escapeHtml(token)}" required></label><label>Nueva contraseña<input name="password" type="password" minlength="12" required></label><small class="muted">Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo.</small></div><div class="modal-actions"><button class="button secondary" value="cancel" formnovalidate>Cancelar</button><button class="button primary" type="button" data-submit="reset-password">Actualizar contraseña</button></div>`,'SEGURIDAD');}

$('#logout-button').addEventListener('click', async () => { try { await api('/auth/logout', { method:'POST' }); } finally { state.csrf=''; showLogin(); } });
$('#open-menu').addEventListener('click', () => toggleMenu(true)); $('#close-menu').addEventListener('click', () => toggleMenu(false)); $('#menu-backdrop').addEventListener('click', () => toggleMenu(false));
function toggleMenu(open) { $('#sidebar').classList.toggle('open', open); $('#menu-backdrop').classList.toggle('visible', open); }

$('#main-nav').addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) navigate(button.dataset.view); });
document.addEventListener('click', event => {
  const viewLink = event.target.closest('[data-view-link]'); if (viewLink) navigate(viewLink.dataset.viewLink);
  const action = event.target.closest('[data-action]'); if (action) handleAction(action.dataset.action, action.dataset.id);
});

async function navigate(view) {
  $$('.view').forEach(el => el.classList.remove('active-view')); $(`#view-${view}`)?.classList.add('active-view');
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view)); toggleMenu(false); window.scrollTo({ top:0, behavior:'smooth' });
  try {
    if (view === 'dashboard') await loadDashboard();
    if (view === 'projects') renderProjects();
    if (view === 'entrepreneurs') renderEntrepreneurs();
    if (['planner','kanban','meetings'].includes(view)) await loadWorkspace(getSelectedProject(view));
    if (view === 'admin' && state.user.role === 'admin') await loadUsers();
  } catch (error) { toast(error.message, 'error'); }
}

async function loadBaseData() {
  [state.projects, state.entrepreneurs] = await Promise.all([api('/projects'), api('/entrepreneurs')]);
  fillProjectSelects(); renderProjects(); renderEntrepreneurs();
}

function fillProjectSelects() {
  const options = state.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  ['planner-project','kanban-project','meetings-project'].forEach(id => { const select=$(`#${id}`); select.innerHTML = options || '<option value="">Sin proyectos</option>'; if(state.activeProjectId)select.value=state.activeProjectId; });
  $('#calculator-project').innerHTML = `<option value="">Cálculo sin guardar</option>${options}`;
  if (!state.activeProjectId && state.projects[0]) state.activeProjectId = state.projects[0].id;
}

state.activity = { items: [], offset: 0, limit: 8, hasMore: true, loading: false };
let activityObserver = null;

function activityRowHtml(a) {
  return `
    <div class="activity-row">
      <span class="activity-dot"></span>
      <div>
        <p><strong>${escapeHtml(a.actor || 'Sistema')}</strong> ${escapeHtml(activityText(a.action, a.entity_type))}</p>
        <small>${dateTimeFmt.format(new Date(a.created_at))}</small>
      </div>
    </div>
  `;
}

async function loadMoreActivity(reset = false) {
  if (state.activity.loading) return;
  if (!reset && !state.activity.hasMore) return;

  if (reset) {
    state.activity.offset = 0;
    state.activity.items = [];
    state.activity.hasMore = true;
  }

  state.activity.loading = true;
  const listEl = $('#activity-list');
  let loaderEl = $('#activity-loader');

  if (!loaderEl && listEl && !reset) {
    loaderEl = document.createElement('div');
    loaderEl.id = 'activity-loader';
    loaderEl.className = 'activity-loading-indicator';
    loaderEl.innerHTML = '<span class="loading-dot"></span> Cargando más actividades...';
    listEl.appendChild(loaderEl);
  }

  try {
    const res = await api(`/activity?limit=${state.activity.limit}&offset=${state.activity.offset}`);
    state.activity.items.push(...res.items);
    state.activity.offset = res.nextOffset;
    state.activity.hasMore = res.hasMore;

    if (listEl) {
      listEl.classList.remove('skeleton-lines');
      if (reset) {
        if (!res.items.length) {
          listEl.innerHTML = empty('Sin actividad reciente.');
          return;
        }
        listEl.innerHTML = `
          <div id="activity-rows-container">
            ${res.items.map(activityRowHtml).join('')}
          </div>
          <div id="activity-sentinel" style="height:8px;"></div>
        `;
      } else {
        const rowsContainer = $('#activity-rows-container') || listEl;
        const newHtml = res.items.map(activityRowHtml).join('');
        const temp = document.createElement('div');
        temp.innerHTML = newHtml;
        while (temp.firstChild) {
          rowsContainer.appendChild(temp.firstChild);
        }
      }

      if (!res.hasMore && state.activity.items.length > 8) {
        const endHint = document.createElement('div');
        endHint.className = 'activity-end-hint';
        endHint.textContent = 'Has llegado al final de la actividad.';
        listEl.appendChild(endHint);
      }
    }
  } catch (err) {
    console.error('Error al cargar actividad:', err);
  } finally {
    state.activity.loading = false;
    loaderEl?.remove();
    setupActivityScrollObserver();
  }
}

function setupActivityScrollObserver() {
  const sentinel = $('#activity-sentinel');
  const container = $('#activity-list');
  if (!sentinel || !container || !state.activity.hasMore) return;

  if (activityObserver) activityObserver.disconnect();

  activityObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.activity.hasMore && !state.activity.loading) {
      loadMoreActivity(false);
    }
  }, { root: container, rootMargin: '60px' });

  activityObserver.observe(sentinel);
}

async function loadDashboard() {
  const data = await api('/dashboard');
  $('#metrics').innerHTML = `<article class="metric"><span class="metric-icon blue">${icon('folder')}</span><div><small>Proyectos activos</small><strong>${data.stats.active_projects}</strong><span>En acompañamiento</span></div></article><article class="metric"><span class="metric-icon gold">${icon('chart')}</span><div><small>Avance promedio</small><strong>${data.stats.average_progress}%</strong><span>De todos los proyectos</span></div></article><article class="metric"><span class="metric-icon teal">${icon('clock')}</span><div><small>Próximos vencimientos</small><strong>${data.stats.upcoming_deadlines}</strong><span>En los siguientes 14 días</span></div></article>`;
  $('#recent-projects').classList.remove('skeleton-lines');
  $('#recent-projects').innerHTML = data.projects.length ? data.projects.map(p => `<button class="project-row button-reset" data-open-project="${p.id}"><span class="project-mark">${escapeHtml(p.name[0])}</span><span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.entrepreneur || 'Sin emprendedor')} · ${escapeHtml(p.stage || 'Sin etapa')}</p><span class="progress"><span style="width:${p.progress}%"></span></span></span><span class="project-progress">${p.progress}%</span></button>`).join('') : empty('Aún no hay proyectos registrados.');
  $('#upcoming-meetings').classList.remove('skeleton-lines');
  $('#upcoming-meetings').innerHTML = data.meetings.length ? data.meetings.map(m => meetingRow(m)).join('') : empty('No hay reuniones próximas.');

  // Load activities with 8-by-8 infinite scroll
  await loadMoreActivity(true);
}

function meetingRow(m) { const d=safeDate(m.scheduled_at)||new Date(); return `<div class="meeting-row"><span class="date-tile"><strong>${d.getDate()}</strong><small>${d.toLocaleDateString('es-MX',{month:'short'}).toUpperCase()}</small></span><div><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.project_name || '')} · ${d.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'})}</p></div></div>`; }
function activityText(action, entity) { const verbs={create:'creó',update:'actualizó',move:'movió',calculate:'calculó',export:'exportó',reassign:'reasignó',delete:'eliminó',password_reset:'generó recuperación para'}; const entities={project:'un proyecto',entrepreneur:'un emprendedor',task:'una tarea',objective:'un objetivo',meeting:'una reunión',meeting_note:'una nota',break_even:'un punto de equilibrio',report:'un reporte',user:'un usuario'}; return `${verbs[action]||action} ${entities[entity]||entity}`; }
function empty(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }

function renderProjects(filter = '') {
  const status = $('#project-status-filter')?.value || ''; const term=filter.toLowerCase();
  const list=state.projects.filter(p=>(!status||p.status===status)&&`${p.name} ${p.entrepreneur||''} ${p.sector||''}`.toLowerCase().includes(term));
  $('#projects-grid').innerHTML=list.length?list.map(p=>`<article class="entity-card"><div class="entity-card-head"><div data-open-project="${p.id}" style="cursor:pointer;flex:1"><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description||'Sin descripción')}</p></div><button class="icon-button" data-action="project-options" data-id="${p.id}" type="button" aria-label="Más opciones">${icon('more')}</button></div><div class="entity-meta" data-open-project="${p.id}" style="cursor:pointer"><span class="badge ${p.status}">${statusLabel(p.status)}</span><span class="badge">${escapeHtml(p.sector||'Sin sector')}</span><span class="badge">${escapeHtml(p.stage||'Sin etapa')}</span></div><div class="progress"><span style="width:${p.progress}%"></span></div><div class="card-footer" data-open-project="${p.id}" style="cursor:pointer"><span>${escapeHtml(p.entrepreneur||'Sin emprendedor')}</span><strong>${p.progress}%</strong></div></article>`).join(''):empty('No encontramos proyectos con esos criterios.');
}
function renderEntrepreneurs(filter = '') { const term=filter.toLowerCase();const list=state.entrepreneurs.filter(e=>`${e.full_name} ${e.email||''} ${e.municipality||''}`.toLowerCase().includes(term));$('#entrepreneurs-grid').innerHTML=list.length?list.map(e=>`<article class="entity-card"><div class="entity-card-head"><div style="flex:1"><span class="avatar">${initials(e.full_name)}</span><h2 style="margin-top:12px">${escapeHtml(e.full_name)}</h2><p>${escapeHtml(e.email||'Sin correo')}<br>${escapeHtml(e.phone||'Sin teléfono')}</p></div><button class="icon-button" data-action="entrepreneur-options" data-id="${e.id}" type="button" aria-label="Opciones del emprendedor">${icon('more')}</button></div><div class="entity-meta"><span class="badge">${escapeHtml(e.municipality||'Sin municipio')}</span><span class="badge">${escapeHtml(e.education||'Escolaridad no indicada')}</span></div><div class="card-footer"><span>Responsable: ${escapeHtml(e.owner_name||state.user.name)}</span></div></article>`).join(''):empty('No encontramos emprendedores con esos criterios.'); }

$$('[data-filter]').forEach(input=>input.addEventListener('input',()=>input.dataset.filter==='projects'?renderProjects(input.value):renderEntrepreneurs(input.value)));
$('#project-status-filter').addEventListener('change',()=>renderProjects($('[data-filter="projects"]').value));
['planner-project','kanban-project','meetings-project'].forEach(id=> $(`#${id}`).addEventListener('change',event=>loadWorkspace(event.target.value)));

async function loadWorkspace(projectId) {
  if(!projectId)return;state.activeProjectId=projectId; ['planner-project','kanban-project','meetings-project'].forEach(id=>{if($(`#${id}`))$(`#${id}`).value=projectId});
  state.workspace=await api(`/projects/${projectId}/workspace`); renderObjectives();renderPlannerTimeline();renderKanban();renderMeetings();
}
function getSelectedProject(view){return $(`#${view}-project`)?.value||state.activeProjectId||state.projects[0]?.id;}
function renderObjectives(){
  const list=state.workspace?.objectives||[];
  $('#objectives-list').innerHTML=list.length?list.map(o=>`
    <article class="objective-card">
      <div class="objective-card-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
        <h3 style="margin:0">${escapeHtml(o.title)}</h3>
        <button class="icon-button" data-action="objective-options" data-id="${o.id}" type="button" aria-label="Opciones del objetivo">${icon('more')}</button>
      </div>
      <div class="smart-grid">
        <div class="smart-item"><b>S</b>${escapeHtml(o.specific)}</div>
        <div class="smart-item"><b>M</b>${escapeHtml(o.measurable)}</div>
        <div class="smart-item"><b>A</b>${escapeHtml(o.achievable)}</div>
        <div class="smart-item"><b>R</b>${escapeHtml(o.relevant)}</div>
      </div>
      <div class="objective-bottom">
        <span>📅 Fecha límite: ${formatDate(o.due_date)}</span>
        <span class="progress"><span style="width:${o.progress}%"></span></span>
        <strong>${o.progress}%</strong>
      </div>
    </article>
  `).join(''):empty('Agrega el primer objetivo SMART de este proyecto.');
}
function parseDayTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return Date.UTC(val.getFullYear(), val.getMonth(), val.getDate());
  const str = String(val).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function renderPlannerTimeline(){
  const tasks = state.workspace?.tasks || [];
  const dated = tasks
    .map(t => {
      const startMs = parseDayTimestamp(t.start_date);
      const dueMs = parseDayTimestamp(t.due_date);
      return {
        ...t,
        _startMs: startMs,
        _dueMs: dueMs,
        _startDate: startMs ? new Date(startMs) : null,
        _dueDate: dueMs ? new Date(dueMs) : null
      };
    })
    .filter(t => t._startMs !== null || t._dueMs !== null)
    .sort((a, b) => (a._startMs || a._dueMs) - (b._startMs || b._dueMs));

  const timelineContainer = $('#planner-timeline') || $('#gantt-chart');
  if (!timelineContainer) return;

  if (!dated.length) {
    timelineContainer.innerHTML = empty('Las tareas con fechas programadas aparecerán en la línea de tiempo vertical.');
    return;
  }

  const allStartMs = dated.map(t => t._startMs).filter(Boolean);
  const allDueMs = dated.map(t => t._dueMs).filter(Boolean);
  const minDay = Math.min(...allStartMs, ...allDueMs);
  const maxDay = Math.max(...allDueMs, ...allStartMs);
  const totalDays = Math.max(1, Math.round((maxDay - minDay) / 86400000) + 1);

  const totalTasks = dated.length;
  const completedTasks = dated.filter(t => t.status === 'completed').length;
  const inProgressTasks = dated.filter(t => t.status === 'in_progress' || t.status === 'review').length;
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  const today = new Date();
  const todayMs = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const minDateDisplay = dateFmt.format(new Date(minDay));
  const maxDateDisplay = dateFmt.format(new Date(maxDay));

  const summaryHtml = `
    <div class="vtimeline-summary-bar">
      <div class="vtimeline-stat">
        <small>Avance global de entregables</small>
        <strong>${progressPercent}% completado</strong>
        <div class="progress" style="height:6px;margin-top:6px"><span style="width:${progressPercent}%"></span></div>
      </div>
      <div class="vtimeline-stat">
        <small>Estado de tareas</small>
        <strong style="color:var(--success)">${completedTasks} de ${totalTasks} listas</strong>
        <span>${inProgressTasks} en proceso / revisión</span>
      </div>
      <div class="vtimeline-stat">
        <small>Período de ejecución</small>
        <strong>${minDateDisplay} — ${maxDateDisplay}</strong>
        <span>${totalDays} días de duración total</span>
      </div>
    </div>
  `;

  let todayInserted = false;
  const itemsHtml = [];

  dated.forEach((t, idx) => {
    const taskSortMs = t._startMs || t._dueMs;

    if (!todayInserted && todayMs <= taskSortMs) {
      itemsHtml.push(`
        <div class="vtimeline-item vtimeline-today-node">
          <div class="vtimeline-point today-point">
            <span class="pulse-dot"></span>
          </div>
          <div class="vtimeline-today-badge">
            <strong>HOY</strong> · ${dateFmt.format(today)}
          </div>
        </div>
      `);
      todayInserted = true;
    }

    const priorityLabel = t.priority === 1 ? 'Alta' : t.priority === 2 ? 'Media' : 'Baja';
    const statusText = statusLabel(t.status);
    const startStr = t._startDate ? dateFmt.format(new Date(t._startDate.getUTCFullYear(), t._startDate.getUTCMonth(), t._startDate.getUTCDate(), 12, 0, 0)) : null;
    const dueStr = t._dueDate ? dateFmt.format(new Date(t._dueDate.getUTCFullYear(), t._dueDate.getUTCMonth(), t._dueDate.getUTCDate(), 12, 0, 0)) : 'Sin fecha';
    const durationDays = (t._startMs && t._dueMs) ? Math.max(1, Math.round((t._dueMs - t._startMs) / 86400000) + 1) : null;
    const isOverdue = t.status !== 'completed' && t._dueMs && t._dueMs < todayMs;

    itemsHtml.push(`
      <article class="vtimeline-item status-${t.status} ${isOverdue ? 'is-overdue' : ''}">
        <div class="vtimeline-point status-point-${t.status}">
          <span class="vtimeline-node-icon">${t.status === 'completed' ? '✓' : (idx + 1)}</span>
        </div>
        <div class="vtimeline-card" data-action="edit-task" data-id="${t.id}" tabindex="0" role="button" title="Haz clic para editar la tarea">
          <div class="vtimeline-card-head">
            <div class="vtimeline-title-wrap">
              <h3>${escapeHtml(t.title)}</h3>
              <div class="vtimeline-badges">
                <span class="small-badge ${t.status}">${statusText}</span>
                <span class="prio-tag prio-${t.priority}">P. ${priorityLabel}</span>
                ${isOverdue ? '<span class="small-badge overdue-badge">⚠️ Atrasada</span>' : ''}
              </div>
            </div>
            <button class="icon-button" data-action="task-options" data-id="${t.id}" type="button" aria-label="Opciones de la tarea" style="width:26px;height:26px;padding:2px">${icon('more')}</button>
          </div>
          ${t.description ? `<p class="vtimeline-desc">${escapeHtml(t.description)}</p>` : ''}
          <div class="vtimeline-footer">
            <span class="vtimeline-date">
              📅 ${startStr ? `${startStr} — ${dueStr}` : `Vence: ${dueStr}`}
            </span>
            ${durationDays ? `<span class="vtimeline-duration">⏱️ ${durationDays} ${durationDays === 1 ? 'día' : 'días'}</span>` : ''}
          </div>
        </div>
      </article>
    `);
  });

  if (!todayInserted && todayMs >= minDay) {
    itemsHtml.push(`
      <div class="vtimeline-item vtimeline-today-node">
        <div class="vtimeline-point today-point">
          <span class="pulse-dot"></span>
        </div>
        <div class="vtimeline-today-badge">
          <strong>HOY</strong> · ${dateFmt.format(today)}
        </div>
      </div>
    `);
  }

  timelineContainer.innerHTML = `
    ${summaryHtml}
    <div class="vtimeline-container">
      <div class="vtimeline-spine"></div>
      <div class="vtimeline-list">
        ${itemsHtml.join('')}
      </div>
    </div>
  `;
}
const columns=[['pending','Pendientes'],['in_progress','En proceso'],['review','En revisión'],['completed','Completado']];
function renderKanban(){const tasks=state.workspace?.tasks||[];$('#kanban-board').innerHTML=columns.map(([status,label])=>{const items=tasks.filter(t=>t.status===status);return `<section class="kanban-column" data-status="${status}"><div class="kanban-head"><h2>${label}</h2><span class="kanban-count">${items.length}</span></div><div class="kanban-cards">${items.map(taskCard).join('')}</div></section>`}).join('');attachDrag();}
function taskCard(t){
  const prioText = t.priority===1?'Alta':t.priority===2?'Media':'Baja';
  return `
    <article class="kanban-card" draggable="true" data-task-id="${t.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <span class="badge ${t.status}">${prioText}</span>
        <button class="icon-button" data-action="task-options" data-id="${t.id}" type="button" aria-label="Opciones de la tarea" style="width:26px;height:26px;padding:2px">${icon('more')}</button>
      </div>
      <h3 data-action="edit-task" data-id="${t.id}" style="cursor:pointer">${escapeHtml(t.title)}</h3>
      <p data-action="edit-task" data-id="${t.id}" style="cursor:pointer">${escapeHtml(t.description||'Sin descripción')}</p>
      <div class="kanban-card-footer" data-action="edit-task" data-id="${t.id}" style="cursor:pointer">
        <span class="priority ${t.priority===1?'high':''}"></span>
        <span>${formatDate(t.due_date)}</span>
      </div>
    </article>
  `;
}
function attachDrag(){ $$('.kanban-card').forEach(card=>{card.addEventListener('dragstart',()=>{state.draggedTask=card.dataset.taskId;card.classList.add('dragging')});card.addEventListener('dragend',()=>card.classList.remove('dragging'))});$$('.kanban-column').forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over')});col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));col.addEventListener('drop',async e=>{e.preventDefault();col.classList.remove('drag-over');if(!state.draggedTask)return;const task=state.workspace.tasks.find(t=>t.id===state.draggedTask);const old=task.status;task.status=col.dataset.status;renderKanban();try{await api(`/tasks/${task.id}/status`,{method:'PATCH',body:JSON.stringify({status:task.status,position:0})});toast('Estado de la tarea actualizado.')}catch(error){task.status=old;renderKanban();toast(error.message,'error')}})});}
function renderMeetings(){const list=state.workspace?.meetings||[];$('#meetings-list').innerHTML=list.length?list.map(m=>{const d=safeDate(m.scheduled_at)||new Date();return `<article class="meeting-card"><div class="meeting-card-main"><span class="date-tile"><strong>${d.getDate()}</strong><small>${d.toLocaleDateString('es-MX',{month:'short'}).toUpperCase()}</small></span><div><h2>${escapeHtml(m.title)}</h2><p>${dateTimeFmt.format(d)} · ${m.duration_minutes} min</p><p>${escapeHtml(m.location||'Ubicación por definir')}</p></div></div><div class="meeting-actions"><button class="button secondary small" data-action="add-note" data-id="${m.id}">Agregar nota</button></div>${m.notes?.length?`<div class="meeting-notes"><strong>Notas de la reunión</strong><br>${m.notes.map(n=>escapeHtml(n.content)).join('<br>')}</div>`:''}</article>`;}).join(''):empty('No hay reuniones en este proyecto.');}

function addProductRow(data={name:'Producto 1',price:150,variableCost:65,salesMix:1}){const row=document.createElement('div');row.className='product-row';row.innerHTML=`<div class="product-fields"><label>Producto<input name="productName" value="${escapeHtml(data.name)}" required></label><label>Precio ($)<input name="price" type="number" min="0.01" step="0.01" value="${data.price}" required></label><label>Costo variable ($)<input name="variableCost" type="number" min="0" step="0.01" value="${data.variableCost}" required></label><label>Mezcla de venta<input name="salesMix" type="number" min="0.01" step="0.01" value="${data.salesMix}" required></label></div><button class="icon-button remove-product" type="button" aria-label="Eliminar producto">${icon('x')}</button>`;$('.remove-product',row).addEventListener('click',()=>{if($$('.product-row').length>1)row.remove();else toast('Debe conservar al menos un producto.','error')});$('#product-rows').append(row)}
function resetCalculatorResult(){
  const box=$('#calculator-result');
  box.classList.add('empty-result');
  box.innerHTML=`<span class="result-icon">${icon('chart')}</span><h2>Tu resultado aparecerá aquí</h2><p>Completa los datos para conocer la cantidad e ingreso de equilibrio y el margen de contribución.</p>`;
}

$('#add-product').addEventListener('click',()=>addProductRow({name:`Producto ${$$('.product-row').length+1}`,price:0,variableCost:0,salesMix:1}));addProductRow();
$('#calculator-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const products=$$('.product-row',form).map(row=>({name:$('[name="productName"]',row).value,price:Number($('[name="price"]',row).value),variableCost:Number($('[name="variableCost"]',row).value),salesMix:Number($('[name="salesMix"]',row).value)}));try{const result=await api('/break-even',{method:'POST',body:JSON.stringify({projectId:form.projectId.value||null,fixedCosts:Number(form.fixedCosts.value),products})});renderCalculation(result);toast('Cálculo realizado correctamente.')}catch(error){toast(error.message,'error')}});

function renderCalculation(r){
  const box=$('#calculator-result');
  box.classList.remove('empty-result');
  box.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
      <div>
        <span class="eyebrow navy">RESULTADO MENSUAL</span>
        <h2 style="margin:4px 0 0">Punto de equilibrio</h2>
      </div>
      <button id="clear-result-btn" class="button secondary small" type="button" style="padding:6px 12px;font-size:12.5px" title="Limpiar resultado">Limpiar resultado</button>
    </div>
    <div class="result-main">
      <small>Ingreso de equilibrio</small>
      <strong>${money.format(r.equilibriumRevenue)}</strong>
      <span>${number.format(r.equilibriumUnits)} unidades ponderadas</span>
    </div>
    <div class="result-grid">
      <div class="result-box">
        <small>Margen ponderado</small>
        <strong>${money.format(r.weightedContribution)}</strong>
      </div>
      <div class="result-box">
        <small>Costos fijos</small>
        <strong>${money.format(r.fixedCosts)}</strong>
      </div>
    </div>
    <table class="result-table">
      <thead><tr><th>Producto</th><th>Contribución</th><th>Unidades</th></tr></thead>
      <tbody>${r.products.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${money.format(p.contribution)}</td><td>${number.format(p.equilibriumUnits)}</td></tr>`).join('')}</tbody>
    </table>`;
}

$('#calculator-result').addEventListener('click',event=>{
  if(event.target.closest('#clear-result-btn')){
    resetCalculatorResult();
    toast('Tarjeta de resultado limpiada.');
  }
});

$('#reset-calculator').addEventListener('click',()=>{
  $('#calculator-form').reset();
  $('#product-rows').innerHTML='';
  addProductRow({name:'Producto 1',price:150,variableCost:65,salesMix:1});
  resetCalculatorResult();
  toast('Cálculo y formulario reiniciados.');
});

async function loadUsers(){state.users=await api('/admin/users');$('#users-table').innerHTML=state.users.map(u=>`<tr><td><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.email)}</small></td><td><span class="badge">${roleLabel(u.role)}</span></td><td><span><i class="status-dot ${u.active?'on':''}"></i>${u.active?'Activo':'Inactivo'}</span></td><td>${u.lastLoginAt?dateFmt.format(new Date(u.lastLoginAt)):'Sin acceso'}</td><td><span class="table-actions"><button class="button secondary small" data-action="edit-user" data-id="${u.id}">Editar</button><button class="button secondary small" data-action="reset-user" data-id="${u.id}">Recuperar</button><button class="button danger small" data-action="delete-user" data-id="${u.id}">Eliminar</button></span></td></tr>`).join('');renderReassignPanel();}

function renderReassignPanel(){let panel=$('#reassign-form');if(!panel){panel=document.createElement('form');panel.id='reassign-form';panel.className='panel reassign-panel';panel.innerHTML=`<div class="panel-head"><div><h2>Reasignar responsable</h2><p>Transfiere un registro a otro usuario</p></div></div><div class="modal-body"><label>Tipo de registro<select name="entityType"><option value="project">Proyecto</option><option value="entrepreneur">Emprendedor</option></select></label><label>Registro<select name="entityId"></select></label><label>Nuevo responsable<select name="userId"></select></label><button class="button primary wide" type="submit">Actualizar responsable</button></div>`;$('#view-admin').append(panel);panel.entityType.addEventListener('change',fillReassignEntities);panel.addEventListener('submit',submitReassignment)}panel.userId.innerHTML=state.users.filter(u=>u.active).map(u=>`<option value="${u.id}">${escapeHtml(u.name)} · ${roleLabel(u.role)}</option>`).join('');fillReassignEntities();}
function fillReassignEntities(){const panel=$('#reassign-form');const list=panel.entityType.value==='project'?state.projects:state.entrepreneurs;panel.entityId.innerHTML=list.map(item=>`<option value="${item.id}">${escapeHtml(item.name||item.full_name)} · ${escapeHtml(item.owner_name||'')}</option>`).join('');}
async function submitReassignment(event){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{await api('/admin/reassign',{method:'POST',body:JSON.stringify(data)});toast('Responsable actualizado.');await loadBaseData();renderReassignPanel()}catch(error){toast(error.message,'error')}}

function openModal(title, content, eyebrow='NUEVO REGISTRO'){ $('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=content;$('#modal').showModal(); }
function modalForm(fields, submit, submitLabel='Guardar'){return `<div class="modal-body">${fields}</div><div class="modal-actions"><button class="button secondary" value="cancel" formnovalidate>Cancelar</button><button class="button primary" type="button" data-submit="${submit}">${submitLabel}</button></div>`;}
function projectOptions(){return state.projects.map(p=>`<option value="${p.id}" ${p.id===state.activeProjectId?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
function entrepreneurOptions(selectedId=''){return `<option value="" ${!selectedId?'disabled selected':''}>Selecciona un emprendedor...</option>${state.entrepreneurs.map(e=>`<option value="${e.id}" ${e.id===selectedId?'selected':''}>${escapeHtml(e.full_name)}</option>`).join('')}`}

function handleAction(action,id){
  if(action==='new-project')openModal('Nuevo proyecto',modalForm(`<div class="form-grid"><label>Nombre del proyecto<input name="name" required maxlength="180"></label><label>Emprendedor<select name="entrepreneurId" required>${entrepreneurOptions()}</select></label><label>Sector<input name="sector" maxlength="100"></label><label>Etapa<select name="stage"><option>Ideación</option><option>Validación</option><option>Incubación</option><option>Consolidación</option></select></label><label>Fecha de inicio<input name="startDate" type="date"></label><label>Fecha objetivo<input name="endDate" type="date"></label></div><label>Descripción<textarea name="description" maxlength="5000"></textarea></label>`,'project'),'Crear proyecto');
  if(action==='project-options'){
    const p=state.projects.find(proj=>proj.id===id);
    if(!p)return;
    openModal(p.name,`
      <div class="modal-body">
        <p class="muted" style="margin:0 0 6px">Acciones disponibles para el proyecto <strong>${escapeHtml(p.name)}</strong>:</p>
        <div class="action-menu-list">
          <button class="action-card" type="button" data-nav-project="kanban" data-id="${p.id}">
            <span class="action-card-icon blue">${icon('board')}</span>
            <span class="action-card-text">
              <strong>Tablero Kanban</strong>
              <small>Mueve y gestiona el flujo de trabajo de tareas</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card" type="button" data-nav-project="planner" data-id="${p.id}">
            <span class="action-card-icon gold">${icon('target')}</span>
            <span class="action-card-text">
              <strong>Planificador SMART</strong>
              <small>Objetivos estratégicos y cronograma temporal</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card" type="button" data-nav-project="meetings" data-id="${p.id}">
            <span class="action-card-icon teal">${icon('calendar')}</span>
            <span class="action-card-text">
              <strong>Agenda y Reuniones</strong>
              <small>Sesiones de seguimiento y acuerdos</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card" type="button" data-action="edit-project" data-id="${p.id}">
            <span class="action-card-icon navy">${icon('folder')}</span>
            <span class="action-card-text">
              <strong>Editar datos del proyecto</strong>
              <small>Actualiza nombre, sector, etapa, fechas y avance</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card danger-action" type="button" data-action="delete-project" data-id="${p.id}">
            <span class="action-card-icon danger">${icon('x')}</span>
            <span class="action-card-text">
              <strong>Eliminar proyecto</strong>
              <small>Remover este proyecto de tu portafolio activo</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="button secondary" value="cancel" formnovalidate>Cerrar</button>
      </div>
    `,'OPCIONES DEL PROYECTO');
  }
  if(action==='edit-project'){
    const p=state.projects.find(proj=>proj.id===id);
    if(!p)return;
    openModal('Editar proyecto',modalForm(`
      <input type="hidden" name="projectId" value="${p.id}">
      <div class="form-grid">
        <label>Nombre del proyecto<input name="name" value="${escapeHtml(p.name)}" required maxlength="180"></label>
        <label>Emprendedor<select name="entrepreneurId" required>${entrepreneurOptions(p.entrepreneur_id)}</select></label>
        <label>Sector<input name="sector" value="${escapeHtml(p.sector||'')}" maxlength="100"></label>
        <label>Etapa<select name="stage">
          <option ${p.stage==='Ideación'?'selected':''}>Ideación</option>
          <option ${p.stage==='Validación'?'selected':''}>Validación</option>
          <option ${p.stage==='Incubación'?'selected':''}>Incubación</option>
          <option ${p.stage==='Consolidación'?'selected':''}>Consolidación</option>
        </select></label>
        <label>Estado<select name="status">
          <option value="active" ${p.status==='active'?'selected':''}>Activo</option>
          <option value="paused" ${p.status==='paused'?'selected':''}>Pausado</option>
          <option value="completed" ${p.status==='completed'?'selected':''}>Completado</option>
          <option value="archived" ${p.status==='archived'?'selected':''}>Archivado</option>
        </select></label>
        <label>Avance (% 0-100)<input name="progress" type="number" min="0" max="100" value="${p.progress||0}"></label>
        <label>Fecha de inicio<input name="startDate" type="date" value="${p.start_date?p.start_date.slice(0,10):''}"></label>
        <label>Fecha objetivo<input name="endDate" type="date" value="${p.end_date?p.end_date.slice(0,10):''}"></label>
      </div>
      <label>Descripción<textarea name="description" maxlength="5000">${escapeHtml(p.description||'')}</textarea></label>
    `,'project-edit','Guardar cambios'),'GESTIONAR PROYECTO');
  }
  if(action==='delete-project')deleteProject(id);
  if(action==='entrepreneur-options'){
    const e=state.entrepreneurs.find(item=>item.id===id);
    if(!e)return;
    openModal(e.full_name,`
      <div class="modal-body">
        <p class="muted" style="margin:0 0 6px">Acciones disponibles para <strong>${escapeHtml(e.full_name)}</strong>:</p>
        <div class="action-menu-list">
          <button class="action-card" type="button" data-action="edit-entrepreneur" data-id="${e.id}">
            <span class="action-card-icon blue">${icon('users')}</span>
            <span class="action-card-text">
              <strong>Editar datos del emprendedor</strong>
              <small>Actualiza correo, teléfono, municipio, escolaridad y notas</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card danger-action" type="button" data-action="delete-entrepreneur" data-id="${e.id}">
            <span class="action-card-icon danger">${icon('x')}</span>
            <span class="action-card-text">
              <strong>Eliminar emprendedor</strong>
              <small>Remover este emprendedor del directorio activo</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="button secondary" value="cancel" formnovalidate>Cerrar</button>
      </div>
    `,'OPCIONES DEL EMPRENDEDOR');
  }
  if(action==='edit-entrepreneur'){
    const e=state.entrepreneurs.find(item=>item.id===id);
    if(!e)return;
    openModal('Editar emprendedor',modalForm(`
      <input type="hidden" name="entrepreneurId" value="${e.id}">
      <div class="form-grid">
        <label>Nombre completo<input name="fullName" value="${escapeHtml(e.full_name)}" required maxlength="160"></label>
        <label>Correo electrónico<input name="email" type="email" value="${escapeHtml(e.email||'')}"></label>
        <label>Teléfono<input name="phone" value="${escapeHtml(e.phone||'')}"></label>
        <label>Municipio<input name="municipality" value="${escapeHtml(e.municipality||'')}"></label>
        <label>Escolaridad<input name="education" value="${escapeHtml(e.education||'')}"></label>
        <label>Género<input name="gender" value="${escapeHtml(e.gender||'')}"></label>
      </div>
      <label>Notas<textarea name="notes" maxlength="3000">${escapeHtml(e.notes||'')}</textarea></label>
    `,'entrepreneur-edit','Guardar cambios'),'DIRECTORIO');
  }
  if(action==='delete-entrepreneur')deleteEntrepreneur(id);
  if(action==='new-entrepreneur')openModal('Nuevo emprendedor',modalForm(`<div class="form-grid"><label>Nombre completo<input name="fullName" required></label><label>Correo electrónico<input name="email" type="email"></label><label>Teléfono<input name="phone"></label><label>Municipio<input name="municipality"></label><label>Escolaridad<input name="education"></label><label>Género<input name="gender"></label></div><label>Notas<textarea name="notes"></textarea></label>`,'entrepreneur'),'Registrar');
  if(action==='objective-options'){
    const o=state.workspace?.objectives?.find(obj=>obj.id===id);
    if(!o)return;
    openModal(o.title,`
      <div class="modal-body">
        <p class="muted" style="margin:0 0 6px">Acciones disponibles para el objetivo SMART:</p>
        <div class="action-menu-list">
          <button class="action-card" type="button" data-action="edit-objective" data-id="${o.id}">
            <span class="action-card-icon gold">${icon('chart')}</span>
            <span class="action-card-text">
              <strong>Editar objetivo SMART</strong>
              <small>Modifica el título, detalles S-M-A-R-T, fecha o avance</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card danger" type="button" data-action="delete-objective" data-id="${o.id}">
            <span class="action-card-icon danger">${icon('x')}</span>
            <span class="action-card-text">
              <strong>Eliminar objetivo</strong>
              <small>Elimina permanentemente este objetivo del planificador</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="button secondary" value="cancel" formnovalidate>Cerrar</button>
      </div>
    `,'OBJETIVO SMART');
  }
  if(action==='edit-objective'){
    const o=state.workspace?.objectives?.find(obj=>obj.id===id);
    if(!o)return;
    const dueRaw = o.due_date ? String(o.due_date).slice(0,10) : '';
    openModal('Editar objetivo SMART',modalForm(`
      <input type="hidden" name="objectiveId" value="${o.id}">
      <label>Título del objetivo<input name="title" value="${escapeHtml(o.title)}" required maxlength="200"></label>
      <label>Específico — ¿Qué se logrará?<textarea name="specific" required maxlength="2000">${escapeHtml(o.specific||'')}</textarea></label>
      <label>Medible — ¿Cómo se comprobará?<textarea name="measurable" required maxlength="2000">${escapeHtml(o.measurable||'')}</textarea></label>
      <label>Alcanzable — ¿Por qué es viable?<textarea name="achievable" required maxlength="2000">${escapeHtml(o.achievable||'')}</textarea></label>
      <label>Relevante — ¿Por qué importa?<textarea name="relevant" required maxlength="2000">${escapeHtml(o.relevant||'')}</textarea></label>
      <div class="form-grid">
        <label>Fecha límite<input name="dueDate" type="date" value="${dueRaw}" required></label>
        <label>Avance (% 0-100)<input name="progress" type="number" min="0" max="100" value="${o.progress||0}" required></label>
      </div>
    `,'objective-edit','Guardar cambios'),'PLANIFICADOR');
  }
  if(action==='delete-objective')deleteObjective(id);
  if(action==='task-options'){
    const t=state.workspace?.tasks?.find(task=>task.id===id);
    if(!t)return;
    openModal(t.title,`
      <div class="modal-body">
        <p class="muted" style="margin:0 0 6px">Acciones disponibles para la tarea:</p>
        <div class="action-menu-list">
          <button class="action-card" type="button" data-action="edit-task" data-id="${t.id}">
            <span class="action-card-icon blue">${icon('board')}</span>
            <span class="action-card-text">
              <strong>Editar tarea</strong>
              <small>Modifica el título, descripción, prioridad, estado o fechas</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
          <button class="action-card danger" type="button" data-action="delete-task" data-id="${t.id}">
            <span class="action-card-icon danger">${icon('x')}</span>
            <span class="action-card-text">
              <strong>Eliminar tarea</strong>
              <small>Elimina permanentemente esta tarea del tablero y cronograma</small>
            </span>
            <span class="action-card-arrow">${icon('arrow')}</span>
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="button secondary" value="cancel" formnovalidate>Cerrar</button>
      </div>
    `,'SEGUIMIENTO');
  }
  if(action==='edit-task'){
    const t=state.workspace?.tasks?.find(task=>task.id===id);
    if(!t)return;
    const startRaw = t.start_date ? String(t.start_date).slice(0,10) : '';
    const dueRaw = t.due_date ? String(t.due_date).slice(0,10) : '';
    openModal('Editar tarea',modalForm(`
      <input type="hidden" name="taskId" value="${t.id}">
      <label>Título<input name="title" value="${escapeHtml(t.title)}" required maxlength="200"></label>
      <label>Descripción<textarea name="description" maxlength="3000">${escapeHtml(t.description||'')}</textarea></label>
      <div class="form-grid">
        <label>Prioridad<select name="priority">
          <option value="1" ${t.priority===1?'selected':''}>Alta</option>
          <option value="2" ${t.priority===2?'selected':''}>Media</option>
          <option value="3" ${t.priority===3?'selected':''}>Baja</option>
        </select></label>
        <label>Estado<select name="status">
          <option value="pending" ${t.status==='pending'?'selected':''}>Pendiente</option>
          <option value="in_progress" ${t.status==='in_progress'?'selected':''}>En proceso</option>
          <option value="review" ${t.status==='review'?'selected':''}>En revisión</option>
          <option value="completed" ${t.status==='completed'?'selected':''}>Completado</option>
        </select></label>
        <label>Inicio<input name="startDate" type="date" value="${startRaw}"></label>
        <label>Vencimiento<input name="dueDate" type="date" value="${dueRaw}"></label>
      </div>
    `,'task-edit','Guardar cambios'),'SEGUIMIENTO');
  }
  if(action==='delete-task')deleteTask(id);
  if(action==='new-objective')openModal('Nuevo objetivo SMART',modalForm(`<label>Proyecto<select name="projectId">${projectOptions()}</select></label><label>Título del objetivo<input name="title" required></label><label>Específico — ¿Qué se logrará?<textarea name="specific" required></textarea></label><label>Medible — ¿Cómo se comprobará?<textarea name="measurable" required></textarea></label><label>Alcanzable — ¿Por qué es viable?<textarea name="achievable" required></textarea></label><label>Relevante — ¿Por qué importa?<textarea name="relevant" required></textarea></label><label>Fecha límite<input name="dueDate" type="date" required></label>`,'objective'),'Crear objetivo');
  if(action==='new-task')openModal('Nueva tarea',modalForm(`<label>Proyecto<select name="projectId">${projectOptions()}</select></label><label>Título<input name="title" required></label><label>Descripción<textarea name="description"></textarea></label><div class="form-grid"><label>Prioridad<select name="priority"><option value="1">Alta</option><option value="2" selected>Media</option><option value="3">Baja</option></select></label><label>Estado<select name="status"><option value="pending">Pendiente</option><option value="in_progress">En proceso</option><option value="review">En revisión</option><option value="completed">Completado</option></select></label><label>Inicio<input name="startDate" type="date"></label><label>Vencimiento<input name="dueDate" type="date"></label></div>`,'task'),'Crear tarea');
  if(action==='new-meeting')openModal('Agendar reunión',modalForm(`<label>Proyecto<select name="projectId">${projectOptions()}</select></label><label>Título<input name="title" required></label><div class="form-grid"><label>Fecha y hora<input name="scheduledAt" type="datetime-local" required></label><label>Duración (min)<input name="durationMinutes" type="number" min="15" max="480" value="60" required></label></div><label>Ubicación o enlace<input name="location"></label><label>Participantes<textarea name="attendees"></textarea></label>`,'meeting'),'Agendar');
  if(action==='add-note')openModal('Agregar nota de reunión',modalForm(`<input type="hidden" name="meetingId" value="${id}"><label>Notas<textarea name="content" required></textarea></label><label>Acuerdos y próximos pasos<textarea name="agreements"></textarea></label>`,'note'),'Guardar nota');
  if(action==='new-user')openModal('Nuevo usuario',modalForm(`<div class="form-grid"><label>Nombre completo<input name="name" required></label><label>Correo electrónico<input name="email" type="email" required></label><label>Rol<select name="role"><option value="standard">Estándar</option><option value="admin">Administrador</option></select></label><label>Contraseña temporal<input name="password" type="password" minlength="12" required></label></div><p class="muted">Debe incluir mayúscula, minúscula, número y símbolo. Solicita al usuario cambiarla mediante recuperación.</p>`,'user'),'Crear usuario');
  if(action==='edit-user'){const u=state.users.find(user=>user.id===id);if(u)openModal('Editar usuario',modalForm(`<input type="hidden" name="userId" value="${u.id}"><div class="form-grid"><label>Nombre completo<input name="name" value="${escapeHtml(u.name)}" required></label><label>Correo electrónico<input name="email" type="email" value="${escapeHtml(u.email)}" required></label><label>Rol<select name="role"><option value="standard" ${u.role==='standard'?'selected':''}>Estándar</option><option value="admin" ${u.role==='admin'?'selected':''}>Administrador</option></select></label><label>Estado<select name="active"><option value="true" ${u.active?'selected':''}>Activo</option><option value="false" ${!u.active?'selected':''}>Inactivo</option></select></label></div>`,'user-edit'),'Guardar cambios');}
  if(action==='delete-user')deleteUser(id);
  if(action==='reset-user')resetUser(id);
}

$('#modal').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });

$('#modal-content').addEventListener('click',async event=>{
  const button=event.target.closest('[data-submit]');
  if(!button)return;
  const type=button.dataset.submit;
  const form=$('#modal .modal-card');
  if(!form.checkValidity()){form.reportValidity();return;}
  const data=Object.fromEntries(new FormData(form));
  button.disabled=true;try{
  if(type==='show-reset'){openResetModal();return;}
  if(type==='forgot'){await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:data.email})});toast('Si la cuenta existe, se enviaron instrucciones.');}
  if(type==='reset-password'){await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token:data.token,password:data.password})});history.replaceState({},'',location.pathname);toast('Contraseña actualizada. Ya puedes iniciar sesión.');}
  if(type==='project'){await api('/projects',{method:'POST',body:JSON.stringify({...data,entrepreneurId:data.entrepreneurId||null,status:'active',progress:0})});toast('Proyecto creado.');}
  if(type==='project-edit'){await api(`/projects/${data.projectId}`,{method:'PATCH',body:JSON.stringify({name:data.name,entrepreneurId:data.entrepreneurId||null,sector:data.sector,stage:data.stage,status:data.status,progress:Number(data.progress||0),startDate:data.startDate||null,endDate:data.endDate||null,description:data.description})});toast('Proyecto actualizado.');}
  if(type==='entrepreneur'){await api('/entrepreneurs',{method:'POST',body:JSON.stringify(data)});toast('Emprendedor registrado.');}
  if(type==='entrepreneur-edit'){await api(`/entrepreneurs/${data.entrepreneurId}`,{method:'PATCH',body:JSON.stringify({fullName:data.fullName,email:data.email||'',phone:data.phone||null,municipality:data.municipality||null,education:data.education||null,gender:data.gender||null,notes:data.notes||null})});toast('Emprendedor actualizado.');}
  if(type==='task'){await api('/tasks',{method:'POST',body:JSON.stringify({...data,priority:Number(data.priority),startDate:data.startDate||null,dueDate:data.dueDate||null})});toast('Tarea creada.');}
  if(type==='task-edit'){
    await api(`/tasks/${data.taskId}`,{
      method:'PATCH',
      body:JSON.stringify({
        title:data.title,
        description:data.description||null,
        priority:Number(data.priority),
        status:data.status,
        startDate:data.startDate||null,
        dueDate:data.dueDate||null
      })
    });
    toast('Tarea actualizada.');
  }
  if(type==='objective'){await api('/objectives',{method:'POST',body:JSON.stringify({...data,progress:0})});toast('Objetivo creado.');}
  if(type==='objective-edit'){
    await api(`/objectives/${data.objectiveId}`,{
      method:'PATCH',
      body:JSON.stringify({
        title:data.title,
        specific:data.specific,
        measurable:data.measurable,
        achievable:data.achievable,
        relevant:data.relevant,
        dueDate:data.dueDate,
        progress:Number(data.progress||0)
      })
    });
    toast('Objetivo SMART actualizado.');
  }
  if(type==='meeting'){await api('/meetings',{method:'POST',body:JSON.stringify({...data,scheduledAt:new Date(data.scheduledAt).toISOString(),durationMinutes:Number(data.durationMinutes)})});toast('Reunión agendada.');}
  if(type==='note'){await api(`/meetings/${data.meetingId}/notes`,{method:'POST',body:JSON.stringify({content:data.content,agreements:data.agreements})});toast('Nota guardada.');}
  if(type==='user'){await api('/admin/users',{method:'POST',body:JSON.stringify({...data,active:true})});toast('Usuario creado.');}
  if(type==='user-edit'){await api(`/admin/users/${data.userId}`,{method:'PATCH',body:JSON.stringify({name:data.name,email:data.email,role:data.role,active:data.active==='true'})});toast('Usuario actualizado.');}
  $('#modal').close(); await loadBaseData(); if(['task','task-edit','objective','objective-edit','meeting','note'].includes(type))await loadWorkspace(data.projectId||state.activeProjectId);if(['user','user-edit'].includes(type))await loadUsers();
}catch(error){toast(error.message,'error')}finally{button.disabled=false}});

async function deleteTask(id){
  const t=state.workspace?.tasks?.find(task=>task.id===id);
  if(!t)return;
  openModal('Eliminar tarea',`
    <div class="modal-body">
      <p>¿Estás seguro de que deseas eliminar la tarea <strong>${escapeHtml(t.title)}</strong>?</p>
      <p class="muted" style="font-size:13px">Esta acción eliminará de forma permanente esta tarea del tablero Kanban y del cronograma Gantt.</p>
    </div>
    <div class="modal-actions">
      <button class="button secondary" value="cancel" formnovalidate>Cancelar</button>
      <button class="button danger" type="button" id="confirm-delete-task-btn">Sí, eliminar tarea</button>
    </div>
  `,'CONFIRMACIÓN');
  $('#confirm-delete-task-btn').onclick=async()=>{
    try{
      await api(`/tasks/${id}`,{method:'DELETE'});
      $('#modal').close();
      toast('Tarea eliminada correctamente.');
      await loadWorkspace(state.activeProjectId);
    }catch(error){
      toast(error.message,'error');
    }
  };
}

async function deleteObjective(id){
  const o=state.workspace?.objectives?.find(item=>item.id===id);
  if(!o)return;
  openModal('Eliminar objetivo SMART',`
    <div class="modal-body">
      <p>¿Estás seguro de que deseas eliminar el objetivo <strong>${escapeHtml(o.title)}</strong>?</p>
      <p class="muted" style="font-size:13px">Esta acción eliminará de forma permanente este objetivo del planificador del proyecto.</p>
    </div>
    <div class="modal-actions">
      <button class="button secondary" value="cancel" formnovalidate>Cancelar</button>
      <button class="button danger" type="button" id="confirm-delete-objective-btn">Sí, eliminar objetivo</button>
    </div>
  `,'CONFIRMACIÓN');
  $('#confirm-delete-objective-btn').onclick=async()=>{
    try{
      await api(`/objectives/${id}`,{method:'DELETE'});
      $('#modal').close();
      toast('Objetivo eliminado correctamente.');
      await loadWorkspace(state.activeProjectId);
    }catch(error){
      toast(error.message,'error');
    }
  };
}

async function deleteEntrepreneur(id){
  const e=state.entrepreneurs.find(item=>item.id===id);
  if(!e)return;
  const linked = state.projects.filter(p=>p.entrepreneur_id===id);
  if(linked.length>0){
    const names = linked.map(p=>`<strong>${escapeHtml(p.name)}</strong>`).join(', ');
    openModal('No es posible eliminar al emprendedor',`
      <div class="modal-body">
        <p><strong>${escapeHtml(e.full_name)}</strong> tiene ${linked.length} proyecto(s) asignado(s):</p>
        <div style="background:#f4f7fb;border:1px solid #d0dbe7;border-radius:10px;padding:12px 14px;color:var(--navy);font-size:14px">
          ${names}
        </div>
        <p class="muted" style="margin-top:6px;line-height:1.5">Para mantener la consistencia en el acompañamiento, ningún proyecto puede quedarse sin emprendedor asignado. Debes <strong>reasignar</strong> o <strong>eliminar</strong> primero los proyectos vinculados.</p>
      </div>
      <div class="modal-actions">
        <button class="button primary" value="cancel" formnovalidate>Entendido</button>
      </div>
    `,'RESTRICCIÓN DE INTEGRIDAD');
    return;
  }
  if(!window.confirm(`¿Estás seguro de eliminar a ${e.full_name}? Esta acción lo removerá de tu lista activa.`))return;
  try{
    await api(`/entrepreneurs/${id}`,{method:'DELETE'});
    toast('Emprendedor eliminado.');
    $('#modal').close();
    await loadBaseData();
    renderEntrepreneurs();
  }catch(error){toast(error.message,'error')}
}

async function deleteProject(id){
  const p=state.projects.find(item=>item.id===id);
  if(!p||!window.confirm(`¿Estás seguro de eliminar el proyecto "${p.name}"? Esta acción lo removerá de tu lista activa.`))return;
  try{
    await api(`/projects/${id}`,{method:'DELETE'});
    toast('Proyecto eliminado.');
    $('#modal').close();
    await loadBaseData();
    renderProjects();
  }catch(error){toast(error.message,'error')}
}

async function resetUser(id){try{const data=await api(`/admin/users/${id}/reset`,{method:'POST'});openModal('Recuperación generada',`<div class="modal-body"><p>Comparte este código por un canal seguro. Expira en ${data.expiresInMinutes} minutos y solo puede usarse una vez.</p><label>Código temporal<input value="${escapeHtml(data.resetToken)}" readonly></label></div><div class="modal-actions"><button class="button primary" value="cancel" formnovalidate>Cerrar</button></div>`,'SEGURIDAD');}catch(error){toast(error.message,'error')}}
async function deleteUser(id){const user=state.users.find(item=>item.id===id);if(!user||!window.confirm(`¿Eliminar la cuenta de ${user.name}? Esta acción cerrará todas sus sesiones.`))return;try{await api(`/admin/users/${id}`,{method:'DELETE'});toast('Usuario eliminado.');await loadUsers()}catch(error){toast(error.message,'error')}}

document.addEventListener('click',event=>{
  const navBtn=event.target.closest('[data-nav-project]');
  if(navBtn){
    const view=navBtn.dataset.navProject;
    const projId=navBtn.dataset.id;
    $('#modal').close();
    loadWorkspace(projId);
    navigate(view);
    return;
  }
  const card=event.target.closest('[data-open-project]');
  if(card&&!event.target.closest('button')){
    const projId=card.dataset.openProject;
    loadWorkspace(projId);
    navigate('kanban');
  }
});
$('#global-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();navigate('projects');const input=$('[data-filter="projects"]');input.value=event.currentTarget.value;renderProjects(input.value)}});

boot();
