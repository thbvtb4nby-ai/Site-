// ===================== State & storage =====================
const STORAGE_KEY = 'depenses.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DEFAULT_STATE = () => ({
  settings: { currency: 'EUR', locale: 'fr-FR', theme: 'system', lastBackupAt: null, autoBackupDays: 7 },
  accounts: [
    { id: uid(), name: 'Compte courant', kind: 'checking', initial: 0, color: '#0a84ff', icon: '💳' },
    { id: uid(), name: 'Espèces', kind: 'cash', initial: 0, color: '#34c759', icon: '💵' },
  ],
  categories: [
    { id: uid(), name: 'Alimentation', icon: '🛒', color: '#ff9500', income: false },
    { id: uid(), name: 'Restaurant', icon: '🍽️', color: '#ff2d55', income: false },
    { id: uid(), name: 'Transport', icon: '🚌', color: '#5ac8fa', income: false },
    { id: uid(), name: 'Logement', icon: '🏠', color: '#af52de', income: false },
    { id: uid(), name: 'Loisirs', icon: '🎮', color: '#ff375f', income: false },
    { id: uid(), name: 'Santé', icon: '💊', color: '#30d158', income: false },
    { id: uid(), name: 'Shopping', icon: '🛍️', color: '#bf5af2', income: false },
    { id: uid(), name: 'Abonnements', icon: '🔁', color: '#64d2ff', income: false },
    { id: uid(), name: 'Salaire', icon: '💼', color: '#34c759', income: true },
    { id: uid(), name: 'Autre revenu', icon: '💰', color: '#a2845e', income: true },
  ],
  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  plan: {
    incomes: [
      // exemples pour montrer le format
    ],
    fixed: [],
  },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const s = JSON.parse(raw);
    const def = DEFAULT_STATE();
    return {
      ...def, ...s,
      settings: { ...def.settings, ...(s.settings||{}) },
      plan: { incomes: s.plan?.incomes || [], fixed: s.plan?.fixed || [] },
    };
  } catch { return DEFAULT_STATE(); }
}
function save() {
  const json = JSON.stringify(state);
  try { localStorage.setItem(STORAGE_KEY, json); } catch {}
  // Redondance : sessionStorage (au cas où)
  try { sessionStorage.setItem(STORAGE_KEY, json); } catch {}
  // IndexedDB en fallback (plus persistant sur iOS)
  saveToIDB(json);
}

// ---- IndexedDB fallback pour survivre à un éventuel nettoyage iOS ----
let _idbDb = null;
function openIDB() {
  return new Promise((resolve) => {
    if (_idbDb) return resolve(_idbDb);
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open('depenses', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => { _idbDb = req.result; resolve(_idbDb); };
    req.onerror = () => resolve(null);
  });
}
async function saveToIDB(json) {
  const db = await openIDB(); if (!db) return;
  try {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(json, STORAGE_KEY);
  } catch {}
}
async function loadFromIDB() {
  const db = await openIDB(); if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction('kv').objectStore('kv').get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

// Demande à iOS de rendre le stockage persistant (empêche l'éviction automatique)
async function requestPersistent() {
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch {}
  }
}

// Récupération asynchrone depuis IndexedDB si localStorage est vide (après nettoyage Safari)
async function tryRecoverFromIDB() {
  if (localStorage.getItem(STORAGE_KEY)) return false;
  const idbJson = await loadFromIDB();
  if (idbJson) {
    localStorage.setItem(STORAGE_KEY, idbJson);
    state = load();
    render();
    toast('Données restaurées ✓');
    return true;
  }
  return false;
}

// ===================== Utils =====================
const fmt = (n) => new Intl.NumberFormat(state.settings.locale, {
  style: 'currency', currency: state.settings.currency, maximumFractionDigits: 2
}).format(Number(n)||0);
const fmtDate = (d) => new Date(d).toLocaleDateString(state.settings.locale, { day:'numeric', month:'short', year:'numeric' });
const fmtDateShort = (d) => new Date(d).toLocaleDateString(state.settings.locale, { day:'numeric', month:'short' });
const todayISO = () => new Date().toISOString().slice(0,10);
const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; };
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59);

function h(tag, attrs={}, ...children) {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k,'');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  }
  return el;
}

function toast(msg) {
  const root = document.getElementById('toast-root');
  root.innerHTML = '';
  const t = h('div', { class:'toast' }, msg);
  root.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ===================== Aggregations =====================
function accountBalance(accId) {
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return 0;
  let b = Number(acc.initial) || 0;
  for (const t of state.transactions) {
    if (t.accountId === accId) {
      if (t.kind === 'expense') b -= Number(t.amount);
      else if (t.kind === 'income') b += Number(t.amount);
      else if (t.kind === 'transfer' && t.toAccountId) b -= Number(t.amount);
    }
    if (t.kind === 'transfer' && t.toAccountId === accId) b += Number(t.amount);
  }
  return b;
}
function totalBalance() { return state.accounts.reduce((s,a) => s + accountBalance(a.id), 0); }
function monthTotals(date = new Date()) {
  const s = startOfMonth(date), e = endOfMonth(date);
  let expense = 0, income = 0;
  for (const t of state.transactions) {
    const d = new Date(t.date);
    if (d < s || d > e) continue;
    if (t.kind === 'expense') expense += Number(t.amount);
    else if (t.kind === 'income') income += Number(t.amount);
  }
  return { expense, income };
}
function categorySpent(catId, from, to) {
  let sum = 0;
  for (const t of state.transactions) {
    if (t.categoryId !== catId || t.kind !== 'expense') continue;
    const d = new Date(t.date);
    if ((from && d < from) || (to && d > to)) continue;
    sum += Number(t.amount);
  }
  return sum;
}

// ===================== Modal =====================
function openModal(title, contentEl, opts = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = h('div', { class:'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = h('div', { class:'modal' });
  const handle = h('div', { class:'modal-handle' });
  const header = h('header', {},
    h('button', { onclick: close }, opts.cancelText || 'Annuler'),
    h('h2', {}, title),
    opts.confirmText
      ? h('button', { class:'primary', onclick: () => { if (opts.onConfirm && opts.onConfirm() !== false) close(); } }, opts.confirmText)
      : h('span', { style:'min-width:60px' })
  );
  const body = h('div', { class:'body' }, contentEl);
  modal.appendChild(handle);
  modal.appendChild(header);
  modal.appendChild(body);
  backdrop.appendChild(modal); root.appendChild(backdrop);
  function close() { backdrop.style.animation = 'fadeIn 0.2s reverse'; modal.style.animation = 'slideUp 0.25s reverse'; setTimeout(() => backdrop.remove(), 200); }
  return { close };
}

function confirmDialog(msg, onYes) {
  const body = h('div', {},
    h('p', {}, msg),
    h('button', { class:'btn danger', onclick: () => { onYes(); m.close(); } }, 'Confirmer'),
    h('div', { style:'height:8px' }),
    h('button', { class:'btn secondary', onclick: () => m.close() }, 'Annuler'),
  );
  const m = openModal('Confirmer', body);
}

// ===================== Views =====================
const app = document.getElementById('app');
let currentTab = 'dashboard';

function render() {
  app.innerHTML = '';
  const views = { dashboard: renderDashboard, transactions: renderTransactions, planner: renderPlanner, more: renderMore };
  const view = (views[currentTab] || renderDashboard)();
  app.appendChild(view);
  for (const b of document.querySelectorAll('#tabbar button[data-tab]')) {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  }
  applyTheme();
}
function applyTheme() {
  const t = state.settings.theme || 'system';
  document.documentElement.dataset.theme = (t === 'system') ? '' : t;
}

// Animate a numeric text node from 0 (or previous value) to target value
function animateNumber(el, to, code = state.settings.currency, duration = 700) {
  if (!el) return;
  const from = 0;
  const start = performance.now();
  const format = (v) => new Intl.NumberFormat(state.settings.locale, {
    style: 'currency', currency: code, maximumFractionDigits: 2
  }).format(v);
  function step(t) {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Dashboard ----------
function greeting() {
  const hh = new Date().getHours();
  if (hh < 6) return 'Bonne nuit';
  if (hh < 12) return 'Bonjour';
  if (hh < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function renderDashboard() {
  const container = h('div');
  container.appendChild(h('div', { class:'screen-header' },
    h('h1', {}, greeting()),
    h('div', { class:'subtitle' }, new Date().toLocaleDateString(state.settings.locale, { weekday:'long', day:'numeric', month:'long' })),
  ));

  const { expense, income } = monthTotals();
  const balanceEl = h('div', { class:'val' }, fmt(totalBalance()));
  const hero = h('div', { class:'hero' },
    h('div', { class:'label' }, 'Solde total'),
    balanceEl,
  );
  requestAnimationFrame(() => animateNumber(balanceEl, totalBalance()));
  if (state.accounts.length) {
    const strip = h('div', { class:'accounts-strip' });
    for (const a of state.accounts) {
      strip.appendChild(h('div', { class:'acc-pill' }, `${a.icon} ${a.name} · ${fmt(accountBalance(a.id))}`));
    }
    hero.appendChild(strip);
  }
  container.appendChild(hero);

  container.appendChild(h('div', { class:'tiles' },
    h('div', { class:'tile exp' },
      h('div', { class:'tile-icon' }, '↓'),
      h('div', { class:'label' }, 'Dépenses'),
      h('div', { class:'val' }, fmt(expense))),
    h('div', { class:'tile inc' },
      h('div', { class:'tile-icon' }, '↑'),
      h('div', { class:'label' }, 'Revenus'),
      h('div', { class:'val' }, fmt(income))),
  ));

  // Recent transactions
  const recent = [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  container.appendChild(h('div', { class:'list-title' },
    h('h2', {}, 'Récent'),
    recent.length ? h('a', { href:'#', onclick: (e) => { e.preventDefault(); currentTab='transactions'; render(); } }, 'Tout voir') : null,
  ));
  if (recent.length === 0) {
    container.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '🧾'),
      h('div', { class:'title' }, 'Aucune transaction'),
      h('div', { class:'desc' }, 'Ajoutez votre première dépense pour commencer.'),
      h('button', { class:'btn gradient', onclick: () => openTransactionForm() }, '＋  Ajouter une transaction'),
    ));
  } else {
    const list = h('div', { class:'card card-list' });
    for (const t of recent) list.appendChild(renderTxnRow(t));
    container.appendChild(list);
  }

  // Planner summary (reste à vivre)
  if (state.plan.incomes.length || state.plan.fixed.length) {
    const now = new Date();
    const { income: pi, fixed: pf, remaining: pr } = planTotals(now);
    const dim = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const dayNum = now.getDate();
    const daysLeft = Math.max(1, dim - dayNum + 1);
    const perDayLeft = pr / daysLeft;
    container.appendChild(h('h2', {}, 'Prévisionnel du mois'));
    const card = h('div', { class:'card', onclick: () => { currentTab = 'planner'; plannerMonth = new Date(); render(); }, style:'cursor:pointer' },
      h('div', { class:'spaced' },
        h('div', {},
          h('div', { style:'font-size:13px;color:var(--text-2);font-weight:600;text-transform:uppercase;letter-spacing:0.05em' }, 'Reste à vivre'),
          h('div', { class: 'amt '+(pr>=0?'pos':'neg'), style:'font-size:30px;margin-top:4px' }, fmt(pr)),
        ),
        h('div', { style:'text-align:right' },
          h('div', { style:'font-size:12px;color:var(--text-2)' }, `+ ${fmt(pi)}`),
          h('div', { style:'font-size:12px;color:var(--text-2);margin-top:2px' }, `− ${fmt(pf)}`),
        ),
      ),
      h('div', { class:'progress', style:'margin-top:12px' },
        h('div', { class:'fill', style:`width:${Math.min(100, (pf/(pi||1))*100)}%;background:${pr>=0?'var(--grad-success)':'var(--grad-danger)'}` })),
      h('div', { style:'margin-top:8px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-2)' },
        h('span', {}, `${daysLeft} jour${daysLeft>1?'s':''} restant${daysLeft>1?'s':''}`),
        h('span', {}, `≈ ${fmt(perDayLeft)} / jour`),
      ),
    );
    container.appendChild(card);
  }

  // Budgets summary
  if (state.budgets.length) {
    container.appendChild(h('h2', {}, 'Budgets ce mois'));
    const list = h('div', { class:'card card-list' });
    const s = startOfMonth(), e = endOfMonth();
    for (const b of state.budgets.slice(0, 3)) {
      list.appendChild(renderBudgetRow(b, s, e));
    }
    container.appendChild(list);
  }

  // Goals
  if (state.goals.length) {
    container.appendChild(h('h2', {}, 'Objectifs'));
    const list = h('div', { class:'card card-list' });
    for (const g of state.goals.slice(0, 3)) list.appendChild(renderGoalRow(g));
    container.appendChild(list);
  }

  return container;
}

function renderTxnRow(t) {
  const cat = state.categories.find(c => c.id === t.categoryId);
  const acc = state.accounts.find(a => a.id === t.accountId);
  const sign = t.kind === 'expense' ? '-' : t.kind === 'income' ? '+' : '';
  const cls = t.kind === 'expense' ? 'neg' : t.kind === 'income' ? 'pos' : '';
  const color = cat?.color || (t.kind === 'income' ? '#34c759' : '#8e8e93');
  const icon = cat?.icon || (t.kind === 'transfer' ? '🔄' : t.kind === 'income' ? '💰' : '💸');
  const title = t.merchant || cat?.name || (t.kind === 'transfer' ? 'Virement' : 'Transaction');
  return h('div', { class:'row', onclick: () => openTransactionForm(t) },
    h('div', { class:'ico-wrap', style:{ background: color } }, icon),
    h('div', { class:'grow' },
      h('div', { class:'t' }, title),
      h('div', { class:'s' }, `${fmtDateShort(t.date)} · ${acc?.name || '—'}`),
    ),
    h('div', { class:'amt '+cls }, `${sign}${fmt(t.amount)}`),
    h('div', { class:'chevron' }, '›'),
  );
}

// ---------- Transactions ----------
const txnFilter = { search: '', kind: 'all', categoryId: null };

function renderTransactions() {
  const container = h('div');
  container.appendChild(h('h1', {}, 'Transactions'));
  const searchWrap = h('div', { class:'search-wrap' },
    h('input', {
      class:'search', type:'search', placeholder:'Rechercher…', value: txnFilter.search,
      oninput: (e) => { txnFilter.search = e.target.value; refreshList(); }
    })
  );
  container.appendChild(searchWrap);
  const seg = h('div', { class:'seg' },
    ...[['all','Tout'],['expense','Dépenses'],['income','Revenus'],['transfer','Virements']].map(([k,l]) =>
      h('button', {
        class: (txnFilter.kind===k?'active':''),
        onclick: () => { txnFilter.kind = k; render(); }
      }, l)
    )
  );
  container.appendChild(seg);

  const listWrap = h('div');
  container.appendChild(listWrap);
  function refreshList() {
    listWrap.innerHTML = '';
    const q = txnFilter.search.toLowerCase();
    let items = [...state.transactions].filter(t => {
      if (txnFilter.kind !== 'all' && t.kind !== txnFilter.kind) return false;
      if (!q) return true;
      const cat = state.categories.find(c => c.id === t.categoryId);
      return (t.merchant||'').toLowerCase().includes(q)
        || (t.note||'').toLowerCase().includes(q)
        || (cat?.name||'').toLowerCase().includes(q);
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    if (items.length === 0) {
      listWrap.appendChild(h('div', { class:'card empty' },
        h('div', { class:'icon' }, '🔍'),
        h('div', { class:'title' }, 'Aucun résultat'),
        h('div', { class:'desc' }, 'Essayez d\'ajuster votre recherche ou vos filtres.')));
      return;
    }
    // Group by day
    const groups = {};
    for (const t of items) {
      const k = new Date(t.date).toDateString();
      (groups[k] = groups[k] || []).push(t);
    }
    for (const k of Object.keys(groups)) {
      listWrap.appendChild(h('h3', {}, fmtDate(k)));
      const card = h('div', { class:'card card-list' });
      for (const t of groups[k]) card.appendChild(renderTxnRow(t));
      listWrap.appendChild(card);
    }
  }
  refreshList();
  return container;
}

function openTransactionForm(existing) {
  const t = existing ? { ...existing } : {
    id: null, kind:'expense', amount:0, date: todayISO(), merchant:'', note:'',
    categoryId: null, accountId: state.accounts[0]?.id || null, toAccountId: null,
  };

  const form = h('div');
  const seg = h('div', { class:'seg' });
  const kinds = [['expense','Dépense'],['income','Revenu'],['transfer','Virement']];
  const kindBtns = {};
  for (const [k,l] of kinds) {
    const b = h('button', { class: (t.kind===k?'active':''), onclick: () => { t.kind = k; for (const kk in kindBtns) kindBtns[kk].classList.toggle('active', kk===k); toggleCat(); } }, l);
    kindBtns[k] = b; seg.appendChild(b);
  }
  form.appendChild(seg);

  const amtField = field('Montant',
    h('input', { type:'number', inputmode:'decimal', step:'0.01', value: t.amount || '', placeholder:'0,00',
      class:'amount-input',
      oninput: (e) => t.amount = parseFloat(e.target.value)||0 }));
  form.appendChild(amtField);

  form.appendChild(field('Date',
    h('input', { type:'date', value: t.date, oninput: (e) => t.date = e.target.value })));

  form.appendChild(field('Commerçant',
    h('input', { type:'text', value: t.merchant, oninput: (e) => t.merchant = e.target.value, placeholder:'Ex. Carrefour' })));

  const accField = h('select', { onchange: (e) => t.accountId = e.target.value },
    ...state.accounts.map(a => h('option', { value: a.id, selected: t.accountId===a.id }, a.name)));
  form.appendChild(field('Compte', accField));

  const toAccWrap = field('Vers le compte', h('select', { onchange: (e) => t.toAccountId = e.target.value },
    h('option', { value:'' }, '—'),
    ...state.accounts.map(a => h('option', { value: a.id, selected: t.toAccountId===a.id }, a.name))));

  const catWrap = h('div');
  function toggleCat() {
    catWrap.innerHTML = '';
    if (t.kind === 'transfer') { catWrap.appendChild(toAccWrap); return; }
    const cats = state.categories.filter(c => (t.kind === 'income') === !!c.income);
    if (!cats.find(c => c.id === t.categoryId)) t.categoryId = cats[0]?.id || null;
    const pill = h('div', { class:'pill-select' });
    for (const c of cats) {
      pill.appendChild(h('button', {
        class: (t.categoryId===c.id?'active':''),
        onclick: () => { t.categoryId = c.id; toggleCat(); }
      }, `${c.icon} ${c.name}`));
    }
    catWrap.appendChild(field(t.kind==='income'?'Catégorie de revenu':'Catégorie', pill));
  }
  toggleCat();
  form.appendChild(catWrap);

  form.appendChild(field('Note',
    h('textarea', { rows:2, oninput: (e) => t.note = e.target.value }, t.note || '')));

  if (existing) {
    form.appendChild(h('button', { class:'btn danger', onclick: () => {
      confirmDialog('Supprimer cette transaction ?', () => {
        state.transactions = state.transactions.filter(x => x.id !== existing.id);
        save(); render(); toast('Supprimée'); m.close();
      });
    } }, 'Supprimer'));
  }

  const m = openModal(existing ? 'Modifier' : 'Nouvelle transaction', form, {
    confirmText: 'Enregistrer',
    onConfirm: () => {
      if (!t.amount || t.amount <= 0) { toast('Montant invalide'); return false; }
      if (!t.accountId) { toast('Choisir un compte'); return false; }
      if (t.kind === 'transfer' && !t.toAccountId) { toast('Choisir un compte cible'); return false; }
      if (existing) {
        Object.assign(state.transactions.find(x => x.id === existing.id), t);
      } else {
        t.id = uid();
        state.transactions.push(t);
      }
      save(); render(); toast('Enregistrée');
    }
  });
}

function field(label, control) {
  return h('label', { class:'field' }, h('span', { style:'display:block;font-size:13px;color:var(--text-2);margin-bottom:6px' }, label), control);
}

// ---------- Budgets ----------
function renderBudgets() {
  const container = h('div');
  container.appendChild(h('div', { class:'list-title' },
    h('h1', {}, 'Budgets'),
    h('a', { href:'#', onclick: (e) => { e.preventDefault(); openBudgetForm(); } }, '＋ Nouveau'),
  ));
  if (state.budgets.length === 0) {
    container.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '🥧'),
      h('div', { class:'title' }, 'Aucun budget'),
      h('div', { class:'desc' }, 'Fixez une limite mensuelle par catégorie pour garder le contrôle.'),
      h('button', { class:'btn gradient', onclick: () => openBudgetForm() }, '＋  Créer un budget'),
    ));
    return container;
  }
  const list = h('div', { class:'card card-list' });
  const s = startOfMonth(), e = endOfMonth();
  for (const b of state.budgets) list.appendChild(renderBudgetRow(b, s, e));
  container.appendChild(list);
  return container;
}

function renderBudgetRow(b, s, e) {
  const cat = state.categories.find(c => c.id === b.categoryId);
  const spent = b.categoryId ? categorySpent(b.categoryId, s, e)
    : state.transactions.filter(t => t.kind==='expense' && new Date(t.date)>=s && new Date(t.date)<=e).reduce((sum,t)=>sum+Number(t.amount),0);
  const pct = Math.min(100, (spent / (b.amount || 1)) * 100);
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  const remaining = Math.max(0, Number(b.amount) - spent);
  const periodLabel = { weekly:'Hebdo', monthly:'Mensuel', quarterly:'Trimestriel', yearly:'Annuel' }[b.period] || b.period;
  return h('div', { class:'budget-row', onclick: () => openBudgetForm(b) },
    h('div', { class:'head' },
      h('div', { class:'cat-dot', style:{ background: cat?.color || '#8e8e93' } }, cat?.icon || '📊'),
      h('div', { class:'name' }, b.name),
      h('div', { class:'amt' }, fmt(spent)),
    ),
    h('div', { class:'progress' }, h('div', { class:'fill '+cls, style:`width:${pct}%` })),
    h('div', { class:'meta' },
      h('span', {}, periodLabel),
      h('span', {}, pct >= 100 ? `Dépassé de ${fmt(spent - b.amount)}` : `Reste ${fmt(remaining)}`)
    ),
  );
}

function openBudgetForm(existing) {
  const b = existing ? { ...existing } : { id:null, name:'', amount:0, period:'monthly', categoryId:null };
  const form = h('div');
  form.appendChild(field('Nom', h('input', { type:'text', value: b.name, oninput: e => b.name = e.target.value })));
  form.appendChild(field('Montant', h('input', { type:'number', step:'0.01', value: b.amount || '', oninput: e => b.amount = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Période', h('select', { onchange: e => b.period = e.target.value },
    ...[['weekly','Hebdo'],['monthly','Mensuel'],['quarterly','Trimestriel'],['yearly','Annuel']]
      .map(([v,l]) => h('option', { value:v, selected: b.period===v }, l)))));
  form.appendChild(field('Catégorie (optionnel)', h('select', { onchange: e => b.categoryId = e.target.value || null },
    h('option', { value:'' }, 'Tout dépense'),
    ...state.categories.filter(c => !c.income).map(c => h('option', { value: c.id, selected: b.categoryId===c.id }, `${c.icon} ${c.name}`)))));
  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer ce budget ?', () => {
      state.budgets = state.budgets.filter(x => x.id !== existing.id); save(); render(); toast('Supprimé'); m.close();
    });
  } }, 'Supprimer'));

  const m = openModal(existing ? 'Modifier budget' : 'Nouveau budget', form, {
    confirmText: 'Enregistrer',
    onConfirm: () => {
      if (!b.name) { toast('Nom requis'); return false; }
      if (!b.amount || b.amount <= 0) { toast('Montant invalide'); return false; }
      if (existing) Object.assign(state.budgets.find(x => x.id === existing.id), b);
      else { b.id = uid(); state.budgets.push(b); }
      save(); render(); toast('Enregistré');
    }
  });
}

// ---------- Goals ----------
function renderGoalRow(g) {
  const pct = Math.min(100, (g.current / (g.target || 1)) * 100);
  return h('div', { class:'goal-row', onclick: () => openGoalForm(g) },
    h('div', { class:'head', style:'display:flex;align-items:center;gap:10px;margin-bottom:8px' },
      h('div', { class:'cat-dot', style:{ background:'var(--grad-success)' } }, g.icon || '🎯'),
      h('div', { style:'flex:1;font-weight:600;font-size:15px' }, g.name),
      h('div', { class:'amt' }, `${fmt(g.current)} / ${fmt(g.target)}`)),
    h('div', { class:'progress' }, h('div', { class:'fill', style:`width:${pct}%;background:var(--grad-success)` })),
    h('div', { class:'meta', style:'display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);margin-top:4px' },
      h('span', {}, `${pct.toFixed(0)}%`),
      g.deadline ? h('span', {}, `Échéance : ${fmtDate(g.deadline)}`) : h('span'),
    ),
  );
}

function openGoalForm(existing) {
  const g = existing ? { ...existing } : { id:null, name:'', target:0, current:0, deadline:'', icon:'🎯' };
  const form = h('div');
  form.appendChild(field('Nom', h('input', { type:'text', value: g.name, oninput: e => g.name = e.target.value })));
  form.appendChild(field('Objectif (€)', h('input', { type:'number', step:'0.01', value: g.target || '', oninput: e => g.target = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Déjà épargné', h('input', { type:'number', step:'0.01', value: g.current || '', oninput: e => g.current = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Échéance', h('input', { type:'date', value: g.deadline || '', oninput: e => g.deadline = e.target.value })));
  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer cet objectif ?', () => { state.goals = state.goals.filter(x => x.id !== existing.id); save(); render(); toast('Supprimé'); m.close(); });
  } }, 'Supprimer'));

  const m = openModal(existing ? 'Modifier objectif' : 'Nouvel objectif', form, {
    confirmText: 'Enregistrer',
    onConfirm: () => {
      if (!g.name || !g.target) { toast('Champs requis'); return false; }
      if (existing) Object.assign(state.goals.find(x => x.id === existing.id), g);
      else { g.id = uid(); state.goals.push(g); }
      save(); render(); toast('Enregistré');
    }
  });
}

// ---------- Accounts / Categories / Recurring ----------
function openAccountsScreen() {
  const wrap = h('div');
  const list = h('div', { class:'card card-list' });
  for (const a of state.accounts) {
    list.appendChild(h('div', { class:'row', onclick: () => openAccountForm(a) },
      h('div', { class:'ico-wrap', style:{ background: a.color } }, a.icon),
      h('div', { class:'grow' },
        h('div', { class:'t' }, a.name),
        h('div', { class:'s' }, a.kind)),
      h('div', { class:'amt' }, fmt(accountBalance(a.id))),
    ));
  }
  wrap.appendChild(list);
  wrap.appendChild(h('button', { class:'btn', onclick: () => openAccountForm() }, '＋ Ajouter un compte'));
  openModal('Comptes', wrap);
}
function openAccountForm(existing) {
  const a = existing ? { ...existing } : { id:null, name:'', kind:'checking', initial:0, color:'#0a84ff', icon:'💳' };
  const form = h('div');
  form.appendChild(field('Nom', h('input', { type:'text', value: a.name, oninput: e => a.name = e.target.value })));
  form.appendChild(field('Type', h('select', { onchange: e => a.kind = e.target.value },
    ...[['checking','Courant'],['savings','Épargne'],['cash','Espèces'],['card','Carte'],['crypto','Crypto'],['other','Autre']]
      .map(([v,l]) => h('option', { value:v, selected: a.kind===v }, l)))));
  form.appendChild(field('Solde initial', h('input', { type:'number', step:'0.01', value: a.initial || '', oninput: e => a.initial = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Icône', iconPicker(['💳','💵','🏦','💰','📱','🪙','💎','🎁'], a.icon, v => a.icon = v)));
  form.appendChild(field('Couleur', colorPicker(a.color, v => a.color = v)));
  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer ce compte et ses transactions ?', () => {
      state.transactions = state.transactions.filter(t => t.accountId !== existing.id && t.toAccountId !== existing.id);
      state.accounts = state.accounts.filter(x => x.id !== existing.id);
      save(); render(); toast('Supprimé'); m.close();
    });
  } }, 'Supprimer'));
  const m = openModal(existing?'Modifier compte':'Nouveau compte', form, {
    confirmText:'Enregistrer',
    onConfirm: () => {
      if (!a.name) { toast('Nom requis'); return false; }
      if (existing) Object.assign(state.accounts.find(x=>x.id===existing.id), a);
      else { a.id = uid(); state.accounts.push(a); }
      save(); render(); toast('Enregistré');
    }
  });
}

function openCategoriesScreen() {
  const wrap = h('div');
  const list = h('div', { class:'card card-list' });
  for (const c of state.categories) {
    list.appendChild(h('div', { class:'row', onclick: () => openCategoryForm(c) },
      h('div', { class:'ico-wrap', style:{ background: c.color } }, c.icon),
      h('div', { class:'grow' },
        h('div', { class:'t' }, c.name),
        h('div', { class:'s' }, c.income ? 'Revenu' : 'Dépense')),
    ));
  }
  wrap.appendChild(list);
  wrap.appendChild(h('button', { class:'btn', onclick: () => openCategoryForm() }, '＋ Ajouter une catégorie'));
  openModal('Catégories', wrap);
}
function openCategoryForm(existing) {
  const c = existing ? { ...existing } : { id:null, name:'', icon:'🏷️', color:'#8e8e93', income:false };
  const form = h('div');
  form.appendChild(field('Nom', h('input', { type:'text', value: c.name, oninput: e => c.name = e.target.value })));
  const typeSeg = h('div', { class:'seg' },
    h('button', { class: !c.income?'active':'', onclick: e => { c.income=false; e.target.classList.add('active'); e.target.nextSibling.classList.remove('active'); } }, 'Dépense'),
    h('button', { class: c.income?'active':'', onclick: e => { c.income=true; e.target.classList.add('active'); e.target.previousSibling.classList.remove('active'); } }, 'Revenu'),
  );
  form.appendChild(typeSeg);
  form.appendChild(field('Icône', iconPicker(
    ['🛒','🍽️','🚌','🏠','🎮','💊','🛍️','🔁','💼','💰','📚','✈️','☕','🎬','⛽','🏋️','🎁','🐾','📱','🧾'],
    c.icon, v => c.icon = v)));
  form.appendChild(field('Couleur', colorPicker(c.color, v => c.color = v)));
  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer cette catégorie ? Les transactions liées perdront la catégorie.', () => {
      state.transactions.forEach(t => { if (t.categoryId === existing.id) t.categoryId = null; });
      state.categories = state.categories.filter(x => x.id !== existing.id);
      save(); render(); toast('Supprimée'); m.close();
    });
  } }, 'Supprimer'));
  const m = openModal(existing?'Modifier catégorie':'Nouvelle catégorie', form, {
    confirmText:'Enregistrer',
    onConfirm: () => {
      if (!c.name) { toast('Nom requis'); return false; }
      if (existing) Object.assign(state.categories.find(x=>x.id===existing.id), c);
      else { c.id = uid(); state.categories.push(c); }
      save(); render(); toast('Enregistrée');
    }
  });
}

function iconPicker(icons, current, onChange) {
  const grid = h('div', { class:'icon-picker' });
  for (const ic of icons) {
    const b = h('button', { class: (current===ic?'active':''), onclick: () => { for (const x of grid.children) x.classList.remove('active'); b.classList.add('active'); onChange(ic); } }, ic);
    grid.appendChild(b);
  }
  return grid;
}
function colorPicker(current, onChange) {
  const colors = ['#0a84ff','#5e5ce6','#af52de','#ff2d55','#ff3b30','#ff9500','#ffcc00','#34c759','#30d158','#5ac8fa','#64d2ff','#8e8e93'];
  const grid = h('div', { class:'color-picker' });
  for (const c of colors) {
    const b = h('button', { style:{ background:c }, class:(current===c?'active':''), onclick: () => { for (const x of grid.children) x.classList.remove('active'); b.classList.add('active'); onChange(c); } });
    grid.appendChild(b);
  }
  return grid;
}

// ---------- Recurring ----------
function openRecurringScreen() {
  const wrap = h('div');
  const list = h('div', { class:'card card-list' });
  if (state.recurring.length === 0) list.appendChild(h('div', { class:'empty' }, h('div', { class:'icon' }, '🔁'), h('p', {}, 'Aucun abonnement')));
  for (const r of state.recurring) {
    const cat = state.categories.find(c => c.id === r.categoryId);
    list.appendChild(h('div', { class:'row', onclick: () => openRecurringForm(r) },
      h('div', { class:'ico-wrap', style:{ background: cat?.color || '#8e8e93' } }, cat?.icon || '🔁'),
      h('div', { class:'grow' },
        h('div', { class:'t' }, r.name),
        h('div', { class:'s' }, `${r.frequency} · prochain ${fmtDateShort(r.nextDate)}`)),
      h('div', { class:'amt neg' }, `-${fmt(r.amount)}`),
    ));
  }
  wrap.appendChild(list);
  wrap.appendChild(h('button', { class:'btn', onclick: () => openRecurringForm() }, '＋ Nouvel abonnement'));
  wrap.appendChild(h('div', { style:'height:8px' }));
  wrap.appendChild(h('button', { class:'btn secondary', onclick: () => { const n = applyRecurring(); toast(`${n} générée(s)`); render(); } }, 'Générer les échéances dues'));
  openModal('Récurrents', wrap);
}
function openRecurringForm(existing) {
  const r = existing ? { ...existing } : { id:null, name:'', amount:0, frequency:'monthly', nextDate: todayISO(), accountId: state.accounts[0]?.id || null, categoryId: state.categories.find(c=>!c.income)?.id || null, kind:'expense' };
  const form = h('div');
  form.appendChild(field('Nom', h('input', { type:'text', value: r.name, oninput: e => r.name = e.target.value, placeholder:'Ex. Netflix' })));
  form.appendChild(field('Montant', h('input', { type:'number', step:'0.01', value: r.amount || '', oninput: e => r.amount = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Type', h('select', { onchange: e => r.kind = e.target.value },
    ...[['expense','Dépense'],['income','Revenu']].map(([v,l]) => h('option', { value:v, selected: r.kind===v }, l)))));
  form.appendChild(field('Fréquence', h('select', { onchange: e => r.frequency = e.target.value },
    ...[['daily','Quotidien'],['weekly','Hebdo'],['biweekly','Bi-hebdo'],['monthly','Mensuel'],['quarterly','Trimestriel'],['yearly','Annuel']].map(([v,l]) => h('option', { value:v, selected: r.frequency===v }, l)))));
  form.appendChild(field('Prochaine date', h('input', { type:'date', value: r.nextDate, oninput: e => r.nextDate = e.target.value })));
  form.appendChild(field('Compte', h('select', { onchange: e => r.accountId = e.target.value },
    ...state.accounts.map(a => h('option', { value: a.id, selected: r.accountId===a.id }, a.name)))));
  form.appendChild(field('Catégorie', h('select', { onchange: e => r.categoryId = e.target.value },
    ...state.categories.map(c => h('option', { value: c.id, selected: r.categoryId===c.id }, `${c.icon} ${c.name}`)))));
  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer cet abonnement ?', () => { state.recurring = state.recurring.filter(x => x.id !== existing.id); save(); render(); toast('Supprimé'); m.close(); });
  } }, 'Supprimer'));
  const m = openModal(existing?'Modifier':'Nouvel abonnement', form, {
    confirmText:'Enregistrer',
    onConfirm: () => {
      if (!r.name || !r.amount) { toast('Champs requis'); return false; }
      if (existing) Object.assign(state.recurring.find(x=>x.id===existing.id), r);
      else { r.id = uid(); state.recurring.push(r); }
      save(); toast('Enregistré');
    }
  });
}

function nextDate(iso, freq) {
  const d = new Date(iso);
  const map = { daily: () => d.setDate(d.getDate()+1), weekly: () => d.setDate(d.getDate()+7),
    biweekly: () => d.setDate(d.getDate()+14), monthly: () => d.setMonth(d.getMonth()+1),
    quarterly: () => d.setMonth(d.getMonth()+3), yearly: () => d.setFullYear(d.getFullYear()+1) };
  (map[freq] || map.monthly)();
  return d.toISOString().slice(0,10);
}
function applyRecurring() {
  const today = new Date(); today.setHours(23,59,59);
  let count = 0;
  for (const r of state.recurring) {
    while (new Date(r.nextDate) <= today) {
      state.transactions.push({
        id: uid(), kind: r.kind || 'expense', amount: r.amount, date: r.nextDate,
        merchant: r.name, note: 'Récurrent', accountId: r.accountId, categoryId: r.categoryId
      });
      r.nextDate = nextDate(r.nextDate, r.frequency);
      count++;
      if (count > 200) break;
    }
  }
  save();
  return count;
}

// ---------- Reports ----------
function openReportsScreen() {
  const wrap = h('div');
  // pie by category (current month expenses)
  const s = startOfMonth(), e = endOfMonth();
  const byCat = {};
  for (const t of state.transactions) {
    if (t.kind !== 'expense') continue;
    const d = new Date(t.date); if (d < s || d > e) continue;
    byCat[t.categoryId || 'none'] = (byCat[t.categoryId || 'none'] || 0) + Number(t.amount);
  }
  const entries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const total = entries.reduce((s,[,v]) => s+v, 0) || 1;
  wrap.appendChild(h('h3', {}, `Répartition — ${new Date().toLocaleDateString(state.settings.locale,{month:'long',year:'numeric'})}`));
  if (entries.length === 0) {
    wrap.appendChild(h('div', { class:'card empty' }, h('div', { class:'icon' }, '📊'), h('p', {}, 'Aucune dépense ce mois')));
  } else {
    wrap.appendChild(pieChart(entries, total));
    const list = h('div', { class:'card card-list' });
    for (const [cid, val] of entries) {
      const cat = state.categories.find(c => c.id === cid);
      const pct = (val/total*100).toFixed(1);
      list.appendChild(h('div', { class:'row' },
        h('div', { class:'ico-wrap', style:{ background: cat?.color || '#8e8e93' } }, cat?.icon || '•'),
        h('div', { class:'grow' }, h('div', { class:'t' }, cat?.name || 'Sans catégorie'), h('div', { class:'s' }, `${pct}%`)),
        h('div', { class:'amt' }, fmt(val)),
      ));
    }
    wrap.appendChild(list);
  }

  // Monthly bars (6 months)
  wrap.appendChild(h('h3', {}, '6 derniers mois'));
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const {expense, income} = monthTotals(d);
    months.push({ label: d.toLocaleDateString(state.settings.locale,{month:'short'}), expense, income });
  }
  wrap.appendChild(barsChart(months));

  openModal('Rapports', wrap);
}

function pieChart(entries, total) {
  const size = 240, cx = size/2, cy = size/2, r = 100, hole = 66;
  let a = -Math.PI/2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class','chart');
  svg.style.maxWidth = '260px'; svg.style.margin = '0 auto';
  // subtle background ring
  const bgRing = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bgRing.setAttribute('cx', cx); bgRing.setAttribute('cy', cy); bgRing.setAttribute('r', (r+hole)/2);
  bgRing.setAttribute('fill', 'none'); bgRing.setAttribute('stroke', 'var(--card-2)'); bgRing.setAttribute('stroke-width', r - hole);
  svg.appendChild(bgRing);
  for (const [cid, val] of entries) {
    const cat = state.categories.find(c => c.id === cid);
    const frac = val / total;
    const a2 = a + frac * Math.PI * 2 - 0.006; // tiny gap
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + Math.cos(a)*r, y1 = cy + Math.sin(a)*r;
    const x2 = cx + Math.cos(a2)*r, y2 = cy + Math.sin(a2)*r;
    const xi1 = cx + Math.cos(a2)*hole, yi1 = cy + Math.sin(a2)*hole;
    const xi2 = cx + Math.cos(a)*hole, yi2 = cy + Math.sin(a)*hole;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${hole} ${hole} 0 ${large} 0 ${xi2} ${yi2} Z`;
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', d);
    p.setAttribute('fill', cat?.color || '#8e8e93');
    svg.appendChild(p);
    a = a2 + 0.006;
  }
  const wrap = document.createElement('div');
  wrap.className = 'chart-card';
  wrap.appendChild(svg);
  wrap.appendChild(h('div', { class:'chart-center' },
    h('div', { class:'label' }, 'Total'),
    h('div', { class:'val' }, fmt(total))));
  return wrap;
}

function barsChart(months) {
  const w = 340, h_ = 180, pad = 22, bw = (w - pad*2) / months.length;
  const max = Math.max(1, ...months.map(m => Math.max(m.expense, m.income)));
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h_}`); svg.setAttribute('class','chart');

  // gradients
  const defs = document.createElementNS(svgNS,'defs');
  defs.innerHTML = `
    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff375f"/><stop offset="100%" stop-color="#ff3b30"/>
    </linearGradient>
    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#30d158"/><stop offset="100%" stop-color="#0a84ff"/>
    </linearGradient>`;
  svg.appendChild(defs);

  const baseY = h_ - 26;
  // baseline
  const baseline = document.createElementNS(svgNS,'line');
  baseline.setAttribute('x1', pad); baseline.setAttribute('x2', w - pad);
  baseline.setAttribute('y1', baseY); baseline.setAttribute('y2', baseY);
  baseline.setAttribute('stroke', 'var(--sep)'); baseline.setAttribute('stroke-width','1');
  svg.appendChild(baseline);

  months.forEach((m,i) => {
    const x = pad + bw*i;
    const eh = (m.expense/max)*(h_-50);
    const ih = (m.income/max)*(h_-50);
    const barW = Math.max(6, bw/2 - 8);
    const rExp = document.createElementNS(svgNS,'rect');
    rExp.setAttribute('x', x+4); rExp.setAttribute('y', baseY-eh);
    rExp.setAttribute('width', barW); rExp.setAttribute('height', eh);
    rExp.setAttribute('fill', 'url(#gExp)'); rExp.setAttribute('rx', 4);
    svg.appendChild(rExp);
    const rInc = document.createElementNS(svgNS,'rect');
    rInc.setAttribute('x', x + bw/2 + 4); rInc.setAttribute('y', baseY-ih);
    rInc.setAttribute('width', barW); rInc.setAttribute('height', ih);
    rInc.setAttribute('fill', 'url(#gInc)'); rInc.setAttribute('rx', 4);
    svg.appendChild(rInc);
    const label = document.createElementNS(svgNS,'text');
    label.setAttribute('x', x + bw/2); label.setAttribute('y', h_-8); label.setAttribute('text-anchor','middle');
    label.setAttribute('font-size', '11'); label.setAttribute('font-weight','600');
    label.setAttribute('fill', 'var(--text-2)');
    label.textContent = m.label; svg.appendChild(label);
  });
  const wrap = document.createElement('div'); wrap.className = 'chart-card';
  wrap.appendChild(svg);
  wrap.appendChild(h('div', { class:'chart-legend' },
    h('span', {}, h('span', { class:'dot', style:'background:#ff3b30' }), 'Dépenses'),
    h('span', {}, h('span', { class:'dot', style:'background:#30d158' }), 'Revenus')));
  return wrap;
}

// ---------- More / Settings ----------
function renderMore() {
  const wrap = h('div');
  wrap.appendChild(h('h1', {}, 'Plus'));
  const menu = h('div', { class:'settings-group' },
    row('🥧','Budgets', () => openModal('Budgets', renderBudgets())),
    row('📊','Rapports', openReportsScreen),
    row('💳','Comptes', openAccountsScreen),
    row('🏷️','Catégories', openCategoriesScreen),
    row('🔁','Récurrents', openRecurringScreen),
    row('🎯','Objectifs', openGoalsScreen),
  );
  wrap.appendChild(menu);
  wrap.appendChild(h('div', { class:'settings-group' },
    row('⚙️','Réglages', openSettingsScreen),
    row('💾','Sauvegarde & restauration', openImportExportScreen),
    row('❓','À propos', openAboutScreen),
  ));
  return wrap;
}
function row(icon, label, onClick) {
  return h('div', { class:'row', onclick: onClick },
    h('div', { class:'ico-txt' }, icon),
    h('div', { class:'grow' }, h('div', { class:'t' }, label)),
    h('div', { class:'chevron' }, '›'),
  );
}

function openGoalsScreen() {
  const wrap = h('div');
  const list = h('div', { class:'card card-list' });
  if (state.goals.length === 0) list.appendChild(h('div', { class:'empty' }, h('div', { class:'icon' }, '🎯'), h('p', {}, 'Aucun objectif')));
  for (const g of state.goals) list.appendChild(renderGoalRow(g));
  wrap.appendChild(list);
  wrap.appendChild(h('button', { class:'btn', onclick: () => openGoalForm() }, '＋ Nouvel objectif'));
  openModal('Objectifs', wrap);
}

function openSettingsScreen() {
  const wrap = h('div');
  wrap.appendChild(field('Devise', h('select', { onchange: e => { state.settings.currency = e.target.value; save(); render(); } },
    ...['EUR','USD','GBP','CHF','JPY','CAD','AUD'].map(c => h('option', { value:c, selected: state.settings.currency===c }, c)))));
  wrap.appendChild(field('Thème', h('select', { onchange: e => { state.settings.theme = e.target.value; save(); applyTheme(); } },
    ...[['system','Système'],['light','Clair'],['dark','Sombre']].map(([v,l]) => h('option', { value:v, selected: state.settings.theme===v }, l)))));
  wrap.appendChild(h('button', { class:'btn danger', onclick: () => confirmDialog('Effacer toutes les données ? Cette action est irréversible.', () => {
    localStorage.removeItem(STORAGE_KEY); state = DEFAULT_STATE(); save(); render(); toast('Réinitialisé');
  }) }, 'Réinitialiser l\'application'));
  openModal('Réglages', wrap);
}

function openImportExportScreen() {
  const wrap = h('div');
  const lastBk = state.settings.lastBackupAt
    ? `Dernière sauvegarde : ${new Date(state.settings.lastBackupAt).toLocaleString(state.settings.locale)}`
    : 'Aucune sauvegarde manuelle pour l\'instant.';
  wrap.appendChild(h('div', { class:'hint' },
    '📌 Astuce : sauvegarde régulièrement dans Fichiers → iCloud Drive. Si un jour ton iPhone efface les données Safari, tu pourras tout restaurer.',
    h('br'), h('br'),
    h('span', { style:'color:var(--text)' }, lastBk),
  ));
  wrap.appendChild(h('button', { class:'btn gradient', onclick: () => { exportJSON(); state.settings.lastBackupAt = Date.now(); save(); } },
    '💾  Sauvegarder maintenant'));
  wrap.appendChild(h('div',{style:'height:8px'}));
  wrap.appendChild(h('button', { class:'btn secondary', onclick: exportCSV }, '📊  Exporter transactions (CSV)'));
  wrap.appendChild(h('div',{style:'height:20px'}));

  wrap.appendChild(h('div', { class:'field-label' }, 'Restaurer une sauvegarde'));
  const fileIn = h('input', { type:'file', accept:'.json,application/json', style:'display:none', onchange: (e) => { const f = e.target.files[0]; if (f) importJSON(f); } });
  wrap.appendChild(fileIn);
  wrap.appendChild(h('button', { class:'btn secondary', onclick: () => fileIn.click() }, '📥  Importer un fichier JSON'));
  wrap.appendChild(h('div', { class:'hint', style:'margin-top:12px' },
    '💡 Pour restaurer : appuie sur ce bouton, choisis "Parcourir" puis va dans Fichiers → iCloud Drive → sélectionne ton dernier "depenses-*.json".'));

  wrap.appendChild(h('div',{style:'height:16px'}));
  wrap.appendChild(h('div', { class:'field-label' }, 'Rappel de sauvegarde'));
  wrap.appendChild(field('M\'inviter à sauvegarder tous les',
    h('select', { onchange: e => { state.settings.autoBackupDays = parseInt(e.target.value); save(); } },
      ...[[0,'Jamais'],[3,'3 jours'],[7,'7 jours'],[14,'14 jours'],[30,'30 jours']].map(([v,l]) =>
        h('option', { value: v, selected: (state.settings.autoBackupDays||7) === v }, l)))));

  openModal('Sauvegarde & restauration', wrap);
}
function download(filename, content, type='application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(`depenses-${todayISO()}.json`, JSON.stringify(state, null, 2));
  state.settings.lastBackupAt = Date.now();
  save();
  toast('Sauvegarde téléchargée ✓');
}
function exportCSV() {
  const rows = [['date','type','montant','commerçant','catégorie','compte','note']];
  for (const t of state.transactions) {
    const cat = state.categories.find(c => c.id === t.categoryId);
    const acc = state.accounts.find(a => a.id === t.accountId);
    rows.push([t.date, t.kind, t.amount, t.merchant||'', cat?.name||'', acc?.name||'', (t.note||'').replace(/\n/g,' ')]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  download(`transactions-${todayISO()}.csv`, csv, 'text/csv');
  toast('CSV exporté');
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s.accounts || !s.transactions) throw new Error('format invalide');
      confirmDialog('Remplacer les données actuelles ?', () => { state = { ...DEFAULT_STATE(), ...s }; save(); render(); toast('Importé'); });
    } catch (e) { toast('Fichier invalide'); }
  };
  reader.readAsText(file);
}

function openAboutScreen() {
  const wrap = h('div');
  wrap.appendChild(h('p', {}, 'Mes Dépenses — application web personnelle.'));
  wrap.appendChild(h('p', {}, 'Toutes les données sont stockées localement sur votre appareil (aucun serveur).'));
  wrap.appendChild(h('p', {}, 'Astuce : depuis Safari sur iPhone, appuyez sur Partager → « Ajouter à l\'écran d\'accueil » pour installer l\'app.'));
  wrap.appendChild(h('p', { style:'color:var(--text-2);font-size:13px' }, 'Version 0.1'));
  openModal('À propos', wrap);
}

// ===================== Planner (revenus & charges fixes) =====================
function itemAppliesTo(item, mKey) {
  if (item.from && mKey < item.from) return false;
  if (item.until && mKey > item.until) return false;
  return true;
}
function planTotals(monthDate = new Date()) {
  const mKey = monthKey(monthDate);
  const applicable = (arr) => (arr || []).filter(x => itemAppliesTo(x, mKey));
  const income = applicable(state.plan.incomes).reduce((s, x) => s + Number(x.amount || 0), 0);
  const fixed = applicable(state.plan.fixed).reduce((s, x) => s + Number(x.amount || 0), 0);
  return { income, fixed, remaining: income - fixed };
}

let plannerMonth = new Date(); // month currently shown in planner tab
function shiftPlannerMonth(delta) {
  plannerMonth = new Date(plannerMonth.getFullYear(), plannerMonth.getMonth() + delta, 1);
  render();
}

function renderPlanner() {
  const wrap = h('div');
  wrap.appendChild(h('div', { class:'screen-header' },
    h('h1', {}, 'Prévision'),
  ));

  // Month navigator
  const monthLabel = plannerMonth.toLocaleDateString(state.settings.locale, { month:'long', year:'numeric' });
  const isCurrent = monthKey(plannerMonth) === monthKey(new Date());
  wrap.appendChild(h('div', { class:'month-nav' },
    h('button', { class:'nav-btn', onclick: () => shiftPlannerMonth(-1), 'aria-label':'Mois précédent' }, '‹'),
    h('div', { class:'month-title' },
      h('div', { class:'m-name' }, monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)),
      !isCurrent ? h('button', { class:'today-btn', onclick: () => { plannerMonth = new Date(); render(); } }, 'Aujourd\'hui') : null,
    ),
    h('button', { class:'nav-btn', onclick: () => shiftPlannerMonth(1), 'aria-label':'Mois suivant' }, '›'),
  ));

  buildPlannerBody(wrap, plannerMonth);
  return wrap;
}

function openPlannerScreen() {
  const wrap = h('div');
  buildPlannerBody(wrap, new Date());
  openModal('Prévisionnel mensuel', wrap);
}

function buildPlannerBody(wrap, monthDate) {
  const mKey = monthKey(monthDate);
  const { income, fixed, remaining } = planTotals(monthDate);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
  const perDay = remaining / daysInMonth;

  const applicable = (arr) => (arr || []).filter(x => itemAppliesTo(x, mKey));
  const activeIncomes = applicable(state.plan.incomes);
  const activeFixed = applicable(state.plan.fixed);

  // Summary card
  const remCls = remaining >= 0 ? 'pos' : 'neg';
  const hero = h('div', { class:'hero', style: remaining >= 0
    ? 'background: var(--grad-hero)'
    : 'background: var(--grad-danger)' },
    h('div', { class:'label' }, 'Reste à vivre ce mois'),
    h('div', { class:'val' }, fmt(remaining)),
    h('div', { style:'margin-top:14px;font-size:13px;opacity:0.9;font-weight:600' },
      `Soit environ ${fmt(perDay)} par jour · ${daysInMonth} jours`),
  );
  wrap.appendChild(hero);

  // Two summary tiles
  wrap.appendChild(h('div', { class:'tiles' },
    h('div', { class:'tile inc' },
      h('div', { class:'tile-icon' }, '↑'),
      h('div', { class:'label' }, 'Revenus'),
      h('div', { class:'val' }, fmt(income))),
    h('div', { class:'tile exp' },
      h('div', { class:'tile-icon' }, '↓'),
      h('div', { class:'label' }, 'Charges fixes'),
      h('div', { class:'val' }, fmt(fixed))),
  ));

  // Incomes section
  wrap.appendChild(h('div', { class:'list-title' },
    h('h2', {}, '💰 Revenus mensuels'),
    h('a', { href:'#', onclick: e => { e.preventDefault(); openPlanItemForm('incomes'); } }, '＋ Ajouter'),
  ));
  if (!state.plan.incomes.length) {
    wrap.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '💼'),
      h('div', { class:'title' }, 'Aucun revenu'),
      h('div', { class:'desc' }, 'Ajoutez votre salaire, une aide, une bourse…'),
      h('button', { class:'btn gradient', onclick: () => openPlanItemForm('incomes') }, '＋  Ajouter un revenu'),
    ));
  } else if (!activeIncomes.length) {
    wrap.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '⏳'),
      h('div', { class:'title' }, 'Aucun revenu ce mois'),
      h('div', { class:'desc' }, 'Vos revenus ne sont pas actifs sur cette période.'),
    ));
  } else {
    const list = h('div', { class:'card card-list stagger' });
    for (const item of activeIncomes) list.appendChild(renderPlanRow('incomes', item, '#30d158', mKey));
    wrap.appendChild(list);
  }

  // Fixed expenses section
  wrap.appendChild(h('div', { class:'list-title' },
    h('h2', {}, '🏠 Charges fixes'),
    h('a', { href:'#', onclick: e => { e.preventDefault(); openPlanItemForm('fixed'); } }, '＋ Ajouter'),
  ));
  if (!state.plan.fixed.length) {
    wrap.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '🧾'),
      h('div', { class:'title' }, 'Aucune charge fixe'),
      h('div', { class:'desc' }, 'Loyer, abonnements, assurance, forfait…'),
      h('button', { class:'btn gradient', onclick: () => openPlanItemForm('fixed') }, '＋  Ajouter une charge'),
    ));
  } else {
    const list = h('div', { class:'card card-list stagger' });
    if (activeFixed.length === 0) {
      list.appendChild(h('div', { class:'empty', style:'padding:32px 20px' },
        h('div', { class:'icon' }, '⏳'),
        h('div', { class:'title' }, 'Aucune charge ce mois'),
        h('div', { class:'desc' }, 'Vos charges ne sont pas actives sur cette période.')));
    } else {
      for (const item of activeFixed) list.appendChild(renderPlanRow('fixed', item, '#ff3b30', mKey));
    }
    wrap.appendChild(list);
  }

  // Répartition par compte : solde actuel + prévisions restantes
  const today = new Date();
  const isCurMonth = monthKey(monthDate) === monthKey(today);
  const currentDay = today.getDate();
  // Pour le mois en cours : ne compte que les lignes dont le jour est >= aujourd'hui (donc pas encore passées)
  // Pour un autre mois : compte toutes les lignes
  const stillToCome = (item) => {
    if (!isCurMonth) return true;
    const day = item.day || 1;
    return day >= currentDay;
  };
  const perAccount = {};
  for (const x of activeIncomes) {
    if (!stillToCome(x)) continue;
    const k = x.accountId || '__none__';
    perAccount[k] = perAccount[k] || { income: 0, fixed: 0 };
    perAccount[k].income += Number(x.amount || 0);
  }
  for (const x of activeFixed) {
    if (!stillToCome(x)) continue;
    const k = x.accountId || '__none__';
    perAccount[k] = perAccount[k] || { income: 0, fixed: 0 };
    perAccount[k].fixed += Number(x.amount || 0);
  }
  // Inclure aussi les comptes sans ligne prévisionnelle (juste pour voir leur solde)
  for (const a of state.accounts) if (!perAccount[a.id]) perAccount[a.id] = { income: 0, fixed: 0 };

  const isCurrentMonth = isCurMonth;
  if (Object.keys(perAccount).length > 0) {
    wrap.appendChild(h('h2', {}, isCurrentMonth ? 'Comptes · projection fin de mois' : 'Comptes · prévu'));
    const card = h('div', { class:'card card-list stagger' });
    for (const [accId, { income: ai, fixed: af }] of Object.entries(perAccount)) {
      const acc = state.accounts.find(a => a.id === accId);
      if (!acc && accId === '__none__' && ai === 0 && af === 0) continue;

      const current = acc ? accountBalance(acc.id) : 0;
      const projected = current + ai - af;
      const meta = [];
      if (ai) meta.push(`+ ${fmt(ai)}`);
      if (af) meta.push(`− ${fmt(af)}`);

      card.appendChild(h('div', { class:'row account-projection' },
        h('div', { class:'ico-wrap', style:{ background: acc?.color || '#8e8e93' } }, acc?.icon || '❓'),
        h('div', { class:'grow' },
          h('div', { class:'t' }, acc?.name || 'Sans compte'),
          acc ? h('div', { class:'s' }, `Solde actuel : ${fmt(current)}${meta.length ? '  ·  ' + meta.join(' ') : ''}`)
              : (meta.length ? h('div', { class:'s' }, meta.join('  ·  ')) : null),
        ),
        h('div', { style:'text-align:right' },
          h('div', { class:'amt '+(projected>=0?'pos':'neg'), style:'font-size:16px' }, fmt(projected)),
          isCurrentMonth ? h('div', { style:'font-size:11px;color:var(--text-2);margin-top:2px' }, 'fin de mois') : null,
        ),
      ));
    }
    wrap.appendChild(card);
  }

  // Info sur les éléments masqués (pas actifs ce mois)
  const hiddenCount = state.plan.incomes.filter(x => !itemAppliesTo(x, mKey)).length
                   + state.plan.fixed.filter(x => !itemAppliesTo(x, mKey)).length;
  if (hiddenCount > 0) {
    wrap.appendChild(h('div', { class:'hint', style:'margin-top:16px;text-align:center' },
      `${hiddenCount} élément${hiddenCount>1?'s':''} masqué${hiddenCount>1?'s':''} (non actif${hiddenCount>1?'s':''} ce mois-ci)`));
  }

  // Info footer
  wrap.appendChild(h('div', { style:'font-size:13px;color:var(--text-2);margin-top:16px;text-align:center;line-height:1.5' },
    'Le prévisionnel est indépendant de vos transactions réelles.',
    h('br'),
    'Il sert à planifier votre budget mensuel type.'));
}

function renderPlanRow(kind, item, defaultColor, mKey, inactive = false) {
  const sub = [];
  if (item.accountId) {
    const acc = state.accounts.find(a => a.id === item.accountId);
    if (acc) sub.push(`${acc.icon} ${acc.name}`);
  }
  if (item.day) sub.push(`Le ${item.day} du mois`);
  if (inactive) {
    if (item.from && mKey < item.from) sub.push(`À partir de ${prettyMonth(item.from)}`);
    else if (item.until && mKey > item.until) sub.push(`Terminé en ${prettyMonth(item.until)}`);
    else sub.push('Inactif');
  }
  return h('div', { class:'row'+(inactive?' inactive':''), onclick: () => openPlanItemForm(kind, item) },
    h('div', { class:'ico-wrap', style:{ background: item.color || defaultColor } }, item.icon || '•'),
    h('div', { class:'grow' },
      h('div', { class:'t' }, item.name),
      sub.length ? h('div', { class:'s' }, sub.join(' · ')) : null,
    ),
    h('div', { class:'amt '+(inactive ? '' : (kind==='incomes'?'pos':'neg')) },
      inactive ? fmt(item.amount) : `${kind==='incomes'?'+':'-'}${fmt(item.amount)}`),
    h('div', { class:'chevron' }, '›'),
  );
}

function prettyMonth(mKey) {
  const [y, m] = mKey.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString(state.settings.locale, { month:'long', year:'numeric' });
}

function openPlanItemForm(kind, existing) {
  const isIncome = kind === 'incomes';
  const defaults = isIncome
    ? { name:'', amount:0, day:'', icon:'💼', color:'#30d158' }
    : { name:'', amount:0, day:'', icon:'🧾', color:'#ff3b30' };
  const it = existing ? { ...existing } : { id:null, ...defaults };

  const form = h('div');
  form.appendChild(field('Nom',
    h('input', { type:'text', value: it.name,
      placeholder: isIncome ? 'Ex. Salaire, Aide parents…' : 'Ex. Loyer, Netflix…',
      oninput: e => it.name = e.target.value })));
  form.appendChild(field('Montant mensuel',
    h('input', { type:'number', inputmode:'decimal', step:'0.01', class:'amount-input',
      value: it.amount || '', placeholder:'0,00',
      oninput: e => it.amount = parseFloat(e.target.value)||0 })));
  form.appendChild(field('Jour du mois (optionnel)',
    h('input', { type:'number', min:'1', max:'31', value: it.day || '',
      placeholder:'Ex. 5 pour le 5 du mois',
      oninput: e => it.day = e.target.value ? parseInt(e.target.value) : '' })));

  form.appendChild(field('Compte concerné (optionnel)',
    h('select', { onchange: e => it.accountId = e.target.value || null },
      h('option', { value:'', selected: !it.accountId }, '—'),
      ...state.accounts.map(a => h('option', { value: a.id, selected: it.accountId===a.id }, `${a.icon} ${a.name}`)))));

  form.appendChild(h('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:10px' },
    field('Actif à partir de',
      h('input', { type:'month', value: it.from || '',
        oninput: e => it.from = e.target.value || '' })),
    field('Jusqu\'à (optionnel)',
      h('input', { type:'month', value: it.until || '',
        oninput: e => it.until = e.target.value || '' })),
  ));
  form.appendChild(h('div', { class:'hint' },
    isIncome
      ? '💡 Ex. si ton salaire commence en octobre, mets "10/2026" comme date de début.'
      : '💡 Utile pour un abonnement qui commence bientôt ou qui se termine à une date précise.'
  ));

  const commonIcons = isIncome
    ? ['💼','💰','👨‍👩‍👧','🎓','🏛️','🎁','💵','📈','🪙','💳']
    : ['🏠','🔌','💧','🔥','📱','📶','🚗','🎬','🎵','🎮','🏋️','🍽️','💊','🧾','☂️','🐾','📚','🛡️'];
  form.appendChild(field('Icône', iconPicker(commonIcons, it.icon, v => it.icon = v)));
  form.appendChild(field('Couleur', colorPicker(it.color, v => it.color = v)));

  if (existing) form.appendChild(h('button', { class:'btn danger', onclick: () => {
    confirmDialog('Supprimer cette ligne ?', () => {
      state.plan[kind] = state.plan[kind].filter(x => x.id !== existing.id);
      save(); m.close();
      if (currentTab === 'planner') render(); else setTimeout(openPlannerScreen, 250);
      toast('Supprimé');
    });
  } }, 'Supprimer'));

  const title = existing
    ? (isIncome ? 'Modifier revenu' : 'Modifier charge')
    : (isIncome ? 'Nouveau revenu' : 'Nouvelle charge');

  const m = openModal(title, form, {
    confirmText: 'Enregistrer',
    onConfirm: () => {
      if (!it.name) { toast('Nom requis'); return false; }
      if (!it.amount || it.amount <= 0) { toast('Montant invalide'); return false; }
      if (existing) {
        Object.assign(state.plan[kind].find(x => x.id === existing.id), it);
      } else {
        it.id = uid();
        state.plan[kind].push(it);
      }
      save(); toast('Enregistré');
      if (currentTab === 'planner') render(); else setTimeout(openPlannerScreen, 250);
    }
  });
}

// ===================== Tab bar wiring =====================
document.getElementById('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === 'add') { openTransactionForm(); return; }
  currentTab = tab;
  render();
});

// Initial
applyTheme();
render();
// Auto-generate due recurring items on load
if (applyRecurring() > 0) render();

// Demande le stockage persistant (empêche iOS d'effacer les données automatiquement)
requestPersistent();

// Tente de récupérer les données depuis IndexedDB si localStorage est vide
tryRecoverFromIDB();

// Rappel de sauvegarde
setTimeout(() => {
  const days = state.settings.autoBackupDays || 0;
  if (!days) return;
  const last = state.settings.lastBackupAt || 0;
  const elapsedDays = (Date.now() - last) / (1000*60*60*24);
  if (elapsedDays > days && (state.transactions.length || state.plan.incomes.length || state.plan.fixed.length)) {
    showBackupBanner();
  }
}, 1200);

function showBackupBanner() {
  const root = document.getElementById('toast-root');
  const banner = h('div', { class:'backup-banner' },
    h('div', { class:'grow' },
      h('div', { style:'font-weight:700;font-size:14px' }, '💾 Pense à sauvegarder'),
      h('div', { style:'font-size:12px;opacity:0.85;margin-top:2px' }, 'Pour ne rien perdre en cas de nettoyage Safari.'),
    ),
    h('button', { onclick: () => { exportJSON(); banner.remove(); } }, 'Sauver'),
    h('button', { class:'close', onclick: () => banner.remove(), 'aria-label':'Fermer' }, '×'),
  );
  root.appendChild(banner);
}

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// Sauvegarde sécurité quand l'app passe en arrière-plan
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
