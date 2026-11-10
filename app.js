'use strict';

/* ============ Utilidades ============ */
const KEY = 'treinos.v1';
const HUES = [150, 200, 260, 300, 350, 20, 60, 100];
const LIMIT = 4; // exercícios visíveis antes de "ver mais"

const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const withVT = fn => (document.startViewTransition && !reduceMotion) ? document.startViewTransition(fn) : fn();

const ICON = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>'
};

/* ============ Dados ============ */
function normalize(w) {
  return {
    id: String(w.id || uid()),
    name: String(w.name || 'Treino').slice(0, 40),
    fav: !!w.fav,
    hue: Number.isFinite(+w.hue) ? +w.hue : 150,
    exercises: (Array.isArray(w.exercises) ? w.exercises : []).map(e => ({
      id: String(e.id || uid()),
      name: String(e.name || '').slice(0, 60),
      sets: clamp(parseInt(e.sets) || 1, 1, 99),
      reps: String(e.reps ?? '10').slice(0, 12),
      done: !!e.done
    })).filter(e => e.name.trim())
  };
}

function seed() {
  const ex = (name, sets, reps) => ({ id: uid(), name, sets, reps, done: false });
  return [
    { id: uid(), name: 'Treino A — Peito e tríceps', fav: true, hue: 150, exercises: [
      ex('Supino reto', 4, '10'), ex('Supino inclinado com halteres', 3, '12'), ex('Crucifixo', 3, '12'),
      ex('Tríceps pulley', 3, '12'), ex('Tríceps testa', 3, '10')] },
    { id: uid(), name: 'Treino B — Costas e bíceps', fav: false, hue: 260, exercises: [
      ex('Puxada frontal', 4, '10'), ex('Remada curvada', 4, '10'), ex('Remada baixa', 3, '12'),
      ex('Rosca direta', 3, '12'), ex('Rosca martelo', 3, '12')] },
    { id: uid(), name: 'Treino C — Pernas', fav: false, hue: 20, exercises: [
      ex('Agachamento livre', 4, '10'), ex('Leg press', 4, '12'), ex('Cadeira extensora', 3, '15'),
      ex('Mesa flexora', 3, '12'), ex('Panturrilha em pé', 4, '15')] }
  ];
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.workouts)) return d.workouts.map(normalize);
    } else {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify({ v: 1, workouts: s }));
      return s;
    }
  } catch {}
  return [];
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, workouts })); }
  catch { toast('Não foi possível salvar neste navegador.'); }
}

let workouts = load();
let reorder = false;
const expanded = new Set();

/* ============ Elementos ============ */
const app = $('#app');
const listFeatured = $('#listFeatured');
const listAll = $('#listAll');
const secFeatured = $('#secFeatured');
const secAll = $('#secAll');
const titleAll = $('#titleAll');
const emptyEl = $('#empty');
const hint = $('#hint');
const btnReorder = $('#btnReorder');

$('#hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

/* ============ Render ============ */
function cardHTML(w) {
  const total = w.exercises.length;
  const done = w.exercises.filter(e => e.done).length;
  const sets = w.exercises.reduce((a, e) => a + (+e.sets || 0), 0);
  const open = expanded.has(w.id);
  const shown = open ? w.exercises : w.exercises.slice(0, LIMIT);
  const pct = total ? Math.round(done / total * 100) : 0;

  const rows = shown.map(e => `
    <li class="ex ${e.done ? 'done' : ''}">
      <button class="check" data-act="toggle" data-ex="${e.id}" aria-pressed="${e.done}" aria-label="Marcar ${esc(e.name)}">${ICON.check}</button>
      <span class="ex-name">${esc(e.name)}</span>
      <span class="ex-meta">${e.sets}×${esc(e.reps)}</span>
    </li>`).join('');

  const body = total
    ? `<div class="progress" aria-hidden="true"><i style="--p:${pct}"></i></div><ul class="ex-list">${rows}</ul>`
    : `<p class="no-ex">Nenhum exercício ainda. Toque em editar para adicionar.</p>`;

  const more = total > LIMIT
    ? `<button class="link-btn muted" data-act="expand">${open ? 'Mostrar menos' : `+${total - LIMIT} exercício${total - LIMIT > 1 ? 's' : ''}`}</button>`
    : '<span></span>';
  const reset = done
    ? `<button class="link-btn" data-act="reset">${done === total ? 'Concluído ✓ Reiniciar' : 'Limpar marcações'}</button>`
    : '';

  return `
  <article class="card ${w.fav ? 'featured' : ''}" data-id="${w.id}" style="--h:${w.hue};view-transition-name:c-${w.id}">
    <div class="card-head">
      <button class="mini-btn drag-handle" aria-label="Arrastar ${esc(w.name)}">${ICON.grip}</button>
      <div class="card-title">
        <h3>${esc(w.name)}</h3>
        <p>${total} exercício${total === 1 ? '' : 's'} · ${sets} série${sets === 1 ? '' : 's'}</p>
      </div>
      <button class="mini-btn fav-btn" data-act="fav" aria-pressed="${w.fav}" aria-label="${w.fav ? 'Remover dos destaques' : 'Favoritar'}">${ICON.star}</button>
      <button class="mini-btn edit-btn" data-act="edit" aria-label="Editar ${esc(w.name)}">${ICON.edit}</button>
    </div>
    ${body}
    <div class="card-foot">${more}${reset}</div>
  </article>`;
}

function render() {
  const feat = workouts.filter(w => w.fav);
  const rest = workouts.filter(w => !w.fav);
  listFeatured.innerHTML = feat.map(cardHTML).join('');
  listAll.innerHTML = rest.map(cardHTML).join('');
  secFeatured.hidden = !feat.length;
  secAll.hidden = !rest.length;
  titleAll.hidden = !feat.length;
  emptyEl.hidden = workouts.length > 0;
  document.body.classList.toggle('reordering', reorder);
  hint.hidden = !reorder;
  btnReorder.setAttribute('aria-pressed', reorder);
}

function updateCard(w) {
  const el = app.querySelector(`.card[data-id="${w.id}"]`);
  if (!el) return render();
  const tmp = document.createElement('div');
  tmp.innerHTML = cardHTML(w).trim();
  const fresh = tmp.firstElementChild;
  fresh.style.animation = 'none';
  el.replaceWith(fresh);
}

/* ============ Ações nos cards ============ */
app.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = btn.closest('.card');
  const w = card && workouts.find(x => x.id === card.dataset.id);
  if (!w) return;

  switch (btn.dataset.act) {
    case 'fav':
      w.fav = !w.fav; save(); vibrate(12);
      withVT(render);
      toast(w.fav ? 'Treino em destaque ★' : 'Removido dos destaques');
      break;
    case 'edit':
      openEditor(w.id);
      break;
    case 'toggle': {
      const ex = w.exercises.find(x => x.id === btn.dataset.ex);
      if (ex) { ex.done = !ex.done; save(); vibrate(ex.done ? 14 : 6); updateCard(w); }
      break;
    }
    case 'expand':
      expanded.has(w.id) ? expanded.delete(w.id) : expanded.add(w.id);
      updateCard(w);
      break;
    case 'reset':
      w.exercises.forEach(x => x.done = false); save(); updateCard(w);
      break;
  }
});

/* ============ Reordenar (arrastar) ============ */
btnReorder.addEventListener('click', () => {
  reorder = !reorder;
  vibrate(10);
  render();
});

app.addEventListener('pointerdown', e => {
  const handle = e.target.closest('.drag-handle');
  if (!handle || !reorder) return;
  e.preventDefault();
  startDrag(e, handle.closest('.card'), handle);
});

function startDrag(e, card, handle) {
  const list = card.parentElement;
  const items = [...list.children];
  const from = items.indexOf(card);
  const tops = items.map(el => el.getBoundingClientRect().top + scrollY);
  const hs = items.map(el => el.offsetHeight);
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  const grab = e.clientY + scrollY - tops[from];
  let y = e.clientY, to = from, raf = 0, active = true;

  try { handle.setPointerCapture(e.pointerId); } catch {}
  card.classList.add('dragging');
  list.classList.add('sorting');
  vibrate(8);

  const update = () => {
    const top = y + scrollY - grab;
    card.style.transform = `translateY(${top - tops[from]}px)`;
    const center = top + hs[from] / 2;
    let n = 0;
    items.forEach((_, i) => { if (i !== from && tops[i] + hs[i] / 2 < center) n++; });
    to = n;
    items.forEach((el, i) => {
      if (i === from) return;
      let s = 0;
      if (to > from && i > from && i <= to) s = -(hs[from] + gap);
      else if (to < from && i >= to && i < from) s = hs[from] + gap;
      el.style.transform = s ? `translateY(${s}px)` : '';
    });
  };

  const tick = () => {
    if (!active) return;
    if (y < 90) scrollBy(0, -12);
    else if (y > innerHeight - 90) scrollBy(0, 12);
    update();
    raf = requestAnimationFrame(tick);
  };

  const move = ev => { y = ev.clientY; };
  const end = () => {
    active = false;
    cancelAnimationFrame(raf);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    list.classList.remove('sorting');
    card.classList.remove('dragging');
    items.forEach(el => { el.style.transform = ''; });
    if (to !== from) {
      const order = items.filter(el => el !== card);
      order.splice(to, 0, card);
      order.forEach(el => list.appendChild(el));
      const ids = [...listFeatured.children, ...listAll.children].map(el => el.dataset.id);
      workouts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      save();
      vibrate(10);
    }
  };

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  tick();
}

/* ============ Editor ============ */
const editor = $('#editor');
const edForm = $('#edForm');
const edName = $('#edName');
const edRows = $('#edRows');
const edHues = $('#edHues');
const edDelete = $('#edDelete');
let draft = null;

const newEx = () => ({ id: uid(), name: '', sets: 3, reps: '12', done: false });

function openEditor(id) {
  const w = id ? workouts.find(x => x.id === id) : null;
  draft = w
    ? JSON.parse(JSON.stringify(w))
    : { id: uid(), name: '', fav: false, hue: HUES[workouts.length % HUES.length], exercises: [newEx()] };
  draft.isNew = !w;

  $('#edTitle').textContent = w ? 'Editar treino' : 'Novo treino';
  edName.value = draft.name;
  edDelete.hidden = draft.isNew;
  renderHues();
  renderRows();
  editor.showModal();
  if (draft.isNew) setTimeout(() => edName.focus(), 120);
}

function renderHues() {
  edHues.innerHTML = HUES.map(h =>
    `<button type="button" class="hue" role="radio" data-h="${h}" style="--h:${h}" aria-checked="${h === draft.hue}" aria-label="Cor ${h}"></button>`
  ).join('');
}

function renderRows() {
  edRows.innerHTML = draft.exercises.map((x, i) => `
    <div class="ed-row" data-i="${i}">
      <input data-f="name" value="${esc(x.name)}" placeholder="Nome do exercício" maxlength="60" aria-label="Nome do exercício">
      <input data-f="sets" class="num" type="number" inputmode="numeric" min="1" max="99" value="${esc(x.sets)}" aria-label="Séries">
      <input data-f="reps" class="num" inputmode="text" value="${esc(x.reps)}" maxlength="12" aria-label="Repetições">
      <button type="button" class="rm" data-rm aria-label="Remover exercício">${ICON.trash}</button>
    </div>`).join('');
}

edName.addEventListener('input', () => { draft.name = edName.value; });

edHues.addEventListener('click', e => {
  const b = e.target.closest('.hue');
  if (!b) return;
  draft.hue = +b.dataset.h;
  vibrate(6);
  renderHues();
});

edRows.addEventListener('input', e => {
  const row = e.target.closest('.ed-row');
  const f = e.target.dataset.f;
  if (row && f) draft.exercises[+row.dataset.i][f] = e.target.value;
});

edRows.addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]');
  if (!rm) return;
  draft.exercises.splice(+rm.closest('.ed-row').dataset.i, 1);
  vibrate(8);
  renderRows();
});

$('#edAdd').addEventListener('click', () => {
  const last = draft.exercises[draft.exercises.length - 1];
  const x = newEx();
  if (last) { x.sets = last.sets; x.reps = last.reps; } // repete o padrão anterior
  draft.exercises.push(x);
  renderRows();
  const inputs = edRows.querySelectorAll('[data-f="name"]');
  const input = inputs[inputs.length - 1];
  input.focus();
  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

edForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = draft.name.trim() || `Treino ${workouts.length + (draft.isNew ? 1 : 0)}`;
  const exercises = draft.exercises
    .filter(x => String(x.name).trim())
    .map(x => ({
      id: x.id,
      name: String(x.name).trim(),
      sets: clamp(parseInt(x.sets) || 1, 1, 99),
      reps: String(x.reps).trim() || '10',
      done: !!x.done
    }));
  const { isNew, ...rest } = draft;
  const w = { ...rest, name, exercises };

  if (isNew) workouts.push(w);
  else workouts[workouts.findIndex(x => x.id === w.id)] = w;

  save();
  editor.close();
  render();
  vibrate(12);
  const el = app.querySelector(`.card[data-id="${w.id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
  }
});

edDelete.addEventListener('click', () => {
  const idx = workouts.findIndex(x => x.id === draft.id);
  if (idx < 0) return;
  const [removed] = workouts.splice(idx, 1);
  save();
  editor.close();
  render();
  toast('Treino excluído', 'Desfazer', () => {
    workouts.splice(Math.min(idx, workouts.length), 0, removed);
    save(); render();
  });
});

/* ============ Menu ============ */
const menu = $('#menu');
$('#btnMenu').addEventListener('click', () => menu.showModal());

$('#mnReset').addEventListener('click', () => {
  workouts.forEach(w => w.exercises.forEach(x => x.done = false));
  save(); render(); menu.close();
  toast('Marcações limpas');
});

$('#mnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ v: 1, workouts }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `treinos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  menu.close();
});

$('#mnFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.workouts;
    if (!Array.isArray(list)) throw new Error('formato');
    if (!confirm('Substituir seus treinos atuais pelos do backup?')) return;
    workouts = list.map(normalize);
    save(); render(); menu.close();
    toast('Backup importado');
  } catch {
    toast('Arquivo inválido.');
  }
});

/* ============ Dialogs: fechar ============ */
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
  else if (e.target instanceof HTMLDialogElement) e.target.close(); // clique no fundo
});

/* ============ Novo treino ============ */
$('#fab').addEventListener('click', () => openEditor());
$('#btnFirst').addEventListener('click', () => openEditor());

/* ============ Toast ============ */
const toastEl = $('#toast');
const toastMsg = $('#toastMsg');
const toastAct = $('#toastAct');
let toastTimer = 0, toastCb = null;

function toast(msg, actLabel, cb) {
  toastMsg.textContent = msg;
  toastCb = cb || null;
  toastAct.hidden = !actLabel;
  toastAct.textContent = actLabel || '';
  toastEl.hidden = false;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, actLabel ? 6000 : 2200);
}
toastAct.addEventListener('click', () => {
  const cb = toastCb;
  toastCb = null;
  toastEl.hidden = true;
  cb && cb();
});

/* ============ Início ============ */
render();

// Pede armazenamento persistente (evita o navegador limpar os dados)
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

// Service worker (offline)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
