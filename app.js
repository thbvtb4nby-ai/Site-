// ===================== State & storage =====================
const STORAGE_KEY = 'depenses.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DEFAULT_STATE = () => ({
  settings: { currency: 'EUR', locale: 'fr-FR', theme: 'system' },
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
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const s = JSON.parse(raw);
    const def = DEFAULT_STATE();
    return { ...def, ...s, settings: { ...def.settings, ...(s.settings||{}) } };
  } catch { return DEFAULT_STATE(); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
  const header = h('header', {},
    h('button', { onclick: close }, 'Annuler'),
    h('h2', {}, title),
    opts.confirmText
      ? h('button', { class:'primary', onclick: () => { if (opts.onConfirm && opts.onConfirm() !== false) close(); } }, opts.confirmText)
      : h('span')
  );
  const body = h('div', { class:'body' }, contentEl);
  modal.appendChild(header); modal.appendChild(body);
  backdrop.appendChild(modal); root.appendChild(backdrop);
  function close() { backdrop.remove(); }
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
  const views = { dashboard: renderDashboard, transactions: renderTransactions, budgets: renderBudgets, more: renderMore };
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

// ---------- Dashboard ----------
function renderDashboard() {
  const container = h('div');
  container.appendChild(h('h1', {}, 'Accueil'));
  const { expense, income } = monthTotals();
  container.appendChild(h('div', { class:'balance' },
    h('div', { class:'label' }, 'Solde total'),
    h('div', { class:'val' }, fmt(totalBalance())),
  ));
  container.appendChild(h('div', { class:'tiles' },
    h('div', { class:'tile exp' },
      h('div', { class:'label' }, 'Dépenses du mois'),
      h('div', { class:'val' }, fmt(expense))),
    h('div', { class:'tile inc' },
      h('div', { class:'label' }, 'Revenus du mois'),
      h('div', { class:'val' }, fmt(income))),
  ));

  // Recent transactions
  const recent = [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  container.appendChild(h('div', { class:'list-title' },
    h('h2', {}, 'Transactions récentes'),
    h('a', { href:'#', onclick: (e) => { e.preventDefault(); currentTab='transactions'; render(); } }, 'Tout voir'),
  ));
  if (recent.length === 0) {
    container.appendChild(h('div', { class:'card empty' },
      h('div', { class:'icon' }, '🧾'),
      h('p', {}, 'Aucune transaction'),
      h('button', { class:'btn', onclick: () => openTransactionForm() }, 'Ajouter une transaction'),
    ));
  } else {
    const list = h('div', { class:'card card-list' });
    for (const t of recent) list.appendChild(renderTxnRow(t));
    container.appendChild(list);
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
  );
}

// ---------- Transactions ----------
const txnFilter = { search: '', kind: 'all', categoryId: null };

function renderTransactions() {
  const container = h('div');
  container.appendChild(h('h1', {}, 'Transactions'));
  const search = h('input', {
    class:'search', type:'search', placeholder:'Rechercher…', value: txnFilter.search,
    oninput: (e) => { txnFilter.search = e.target.value; refreshList(); }
  });
  container.appendChild(search);
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
        h('p', {}, 'Aucune transaction')));
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

  form.appendChild(field('Montant',
    h('input', { type:'number', inputmode:'decimal', step:'0.01', value: t.amount || '',
      oninput: (e) => t.amount = parseFloat(e.target.value)||0 })));

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
      h('p', {}, 'Aucun budget'),
      h('button', { class:'btn', onclick: () => openBudgetForm() }, 'Créer un budget'),
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
  return h('div', { class:'row', onclick: () => openBudgetForm(b), style:'display:block' },
    h('div', { style:'display:flex;justify-content:space-between;margin-bottom:4px' },
      h('div', {}, `${cat?.icon || '📊'} ${b.name}`),
      h('div', { class:'amt' }, `${fmt(spent)} / ${fmt(b.amount)}`),
    ),
    h('div', { class:'progress' }, h('div', { class:'fill '+cls, style:`width:${pct}%` })),
    h('div', { class:'s', style:'font-size:12px;color:var(--text-2)' }, `${b.period === 'monthly' ? 'Mensuel' : b.period}`),
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
  return h('div', { class:'row', style:'display:block', onclick: () => openGoalForm(g) },
    h('div', { style:'display:flex;justify-content:space-between;margin-bottom:4px' },
      h('div', {}, `${g.icon || '🎯'} ${g.name}`),
      h('div', { class:'amt' }, `${fmt(g.current)} / ${fmt(g.target)}`)),
    h('div', { class:'progress' }, h('div', { class:'fill', style:`width:${pct}%` })),
    g.deadline ? h('div', { style:'font-size:12px;color:var(--text-2)' }, `Échéance : ${fmtDate(g.deadline)}`) : null,
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
  const size = 220, cx = size/2, cy = size/2, r = 90, hole = 55;
  let a = -Math.PI/2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class','chart');
  svg.style.maxWidth = '260px'; svg.style.margin = '0 auto 12px';
  for (const [cid, val] of entries) {
    const cat = state.categories.find(c => c.id === cid);
    const frac = val / total;
    const a2 = a + frac * Math.PI * 2;
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
    a = a2;
  }
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.appendChild(svg);
  const totalDiv = h('div', { style:'text-align:center;margin-top:-140px;pointer-events:none' },
    h('div', { style:'font-size:12px;color:var(--text-2)' }, 'Total'),
    h('div', { style:'font-size:20px;font-weight:600' }, fmt(total)));
  wrap.appendChild(totalDiv);
  return wrap;
}

function barsChart(months) {
  const w = 320, h_ = 160, pad = 24, bw = (w - pad*2) / months.length;
  const max = Math.max(1, ...months.map(m => Math.max(m.expense, m.income)));
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h_}`); svg.setAttribute('class','chart');
  months.forEach((m,i) => {
    const x = pad + bw*i;
    const eh = (m.expense/max)*(h_-40);
    const ih = (m.income/max)*(h_-40);
    const rExp = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rExp.setAttribute('x', x+4); rExp.setAttribute('y', h_-20-eh); rExp.setAttribute('width', bw/2-6); rExp.setAttribute('height', eh); rExp.setAttribute('fill', '#ff3b30'); rExp.setAttribute('rx', 3);
    svg.appendChild(rExp);
    const rInc = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rInc.setAttribute('x', x+bw/2+2); rInc.setAttribute('y', h_-20-ih); rInc.setAttribute('width', bw/2-6); rInc.setAttribute('height', ih); rInc.setAttribute('fill', '#34c759'); rInc.setAttribute('rx', 3);
    svg.appendChild(rInc);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x', x + bw/2); label.setAttribute('y', h_-6); label.setAttribute('text-anchor','middle');
    label.setAttribute('font-size', '10'); label.setAttribute('fill', 'currentColor'); label.setAttribute('opacity','0.7');
    label.textContent = m.label; svg.appendChild(label);
  });
  const wrap = document.createElement('div'); wrap.className = 'card';
  wrap.appendChild(svg);
  wrap.appendChild(h('div', { style:'display:flex;gap:14px;justify-content:center;font-size:12px;color:var(--text-2);margin-top:6px' },
    h('span', {}, '● Dépenses'), h('span', {}, '● Revenus')));
  wrap.firstChild.querySelectorAll('text').forEach(()=>{});
  return wrap;
}

// ---------- More / Settings ----------
function renderMore() {
  const wrap = h('div');
  wrap.appendChild(h('h1', {}, 'Plus'));
  const menu = h('div', { class:'settings-group' },
    row('📊','Rapports', openReportsScreen),
    row('💳','Comptes', openAccountsScreen),
    row('🏷️','Catégories', openCategoriesScreen),
    row('🔁','Récurrents', openRecurringScreen),
    row('🎯','Objectifs', openGoalsScreen),
  );
  wrap.appendChild(menu);
  wrap.appendChild(h('div', { class:'settings-group' },
    row('⚙️','Réglages', openSettingsScreen),
    row('📥','Importer / Exporter', openImportExportScreen),
    row('❓','À propos', openAboutScreen),
  ));
  return wrap;
}
function row(icon, label, onClick) {
  return h('div', { class:'row', onclick: onClick },
    h('div', { style:'font-size:20px;width:28px;text-align:center' }, icon),
    h('div', { class:'grow' }, label),
    h('div', { style:'color:var(--text-2)' }, '›'),
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
  wrap.appendChild(h('button', { class:'btn', onclick: exportJSON }, '📤 Exporter (JSON)'));
  wrap.appendChild(h('div',{style:'height:8px'}));
  wrap.appendChild(h('button', { class:'btn secondary', onclick: exportCSV }, '📤 Exporter transactions (CSV)'));
  wrap.appendChild(h('div',{style:'height:16px'}));
  const fileIn = h('input', { type:'file', accept:'.json', style:'display:none', onchange: (e) => { const f = e.target.files[0]; if (f) importJSON(f); } });
  wrap.appendChild(fileIn);
  wrap.appendChild(h('button', { class:'btn secondary', onclick: () => fileIn.click() }, '📥 Importer (JSON)'));
  openModal('Import / Export', wrap);
}
function download(filename, content, type='application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() { download(`depenses-${todayISO()}.json`, JSON.stringify(state, null, 2)); toast('Exporté'); }
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

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
