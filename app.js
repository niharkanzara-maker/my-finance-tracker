// ═══════════════════════════════════════════════
//  MY FINANCE TRACKER — app.js
//  With Net Worth, Carry Forward, Fixed Logic
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://ktbugezdzcrpuzrfnsbq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iOfsjV23yTBSeaziqfaZDw_rF-Xiz3M';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── CONSTANTS ──────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MFULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CAT_MAP = {
  'Income'     : ['Salary','Freelance','Rental Income','Business Income','Interest / Dividend','Other Income'],
  'Expenses'   : ['Food & Dining','Travel & Petrol','Rent / PG','Fashion & Shopping','Sent to Home','Insurance Premium','Entertainment','Medical','Utilities & Bills','Other Expenses'],
  'Assets'     : ['Mutual Fund / SIP','Stocks & Equity','Gold','Fixed Deposit','Real Estate','Other Investment'],
  'Liabilities': ['Home Loan EMI','Car Loan EMI','Personal Loan EMI','Credit Card Payment','Other Liability']
};

const CAT_COLORS = {
  Income:'#00d4a0', Expenses:'#ff6b6b', Assets:'#4d9fff', Liabilities:'#a78bfa'
};

// ── STATE ──────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let charts         = {};
let pendingTxns    = [];

// ── UTILS ──────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt  = v => '₹' + Math.round(v).toLocaleString('en-IN');
const fmtN = v => parseFloat(v) || 0;

function setMsg(el, type, text) {
  if (!el) return;
  el.className = 'msg msg-' + (type==='ok'?'ok':type==='err'?'err':'info');
  el.textContent = text;
}
function showPage(id) {
  ['pg-home','pg-dash','pg-demo'].forEach(p => $(p).classList.add('hide'));
  $(id).classList.remove('hide');
}
function clearCharts() {
  Object.keys(charts).forEach(k => { try { charts[k].destroy(); } catch(e){} });
  charts = {};
}

// ── PANEL SHOW/HIDE ────────────────────────────
function showPanel(t) {
  const cards  = $('home-cards');
  const signup = $('panel-signup');
  const login  = $('panel-login');
  if (t === 'signup') {
    cards.style.display  = 'none';
    signup.style.display = 'block';
    login.style.display  = 'none';
  } else if (t === 'login') {
    cards.style.display  = 'none';
    signup.style.display = 'none';
    login.style.display  = 'block';
  } else {
    cards.style.display  = 'block';
    signup.style.display = 'none';
    login.style.display  = 'none';
  }
}

// ── AUTH INIT ──────────────────────────────────
window.onload = async function() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { currentUser = session.user; await loadProfile(); }
  else showPage('pg-home');
};

sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    await loadProfile();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null; currentProfile = null;
    showPage('pg-home');
  }
});

// ── SIGNUP ─────────────────────────────────────
async function signUp() {
  const name     = $('inp-signup-name').value.trim();
  const email    = $('inp-signup-email').value.trim();
  const password = $('inp-signup-pass').value;
  const confirm  = $('inp-signup-confirm').value;
  const msgEl    = $('msg-signup');
  if (!name)                { setMsg(msgEl,'err','Please enter your full name.');            return; }
  if (!email)               { setMsg(msgEl,'err','Please enter your email.');                return; }
  if (password.length < 6)  { setMsg(msgEl,'err','Password must be at least 6 characters.'); return; }
  if (password !== confirm) { setMsg(msgEl,'err','Passwords do not match.');                 return; }
  setMsg(msgEl,'info','Creating your account…');
  localStorage.setItem('pendingName', name);
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) { setMsg(msgEl,'err', error.message); return; }
  setMsg(msgEl,'ok','✅ Account created! Please check your email to verify, then log in.');
}

async function generateUniqueId() {
  const { data } = await sb.from('profiles').select('unique_id').order('created_at',{ascending:false}).limit(1);
  if (!data || !data.length) return '#0001';
  const last = parseInt((data[0].unique_id||'#0000').replace('#','')) || 0;
  return '#' + String(last + 1).padStart(4,'0');
}

// ── LOGIN ──────────────────────────────────────
async function logIn() {
  const email    = $('inp-login-email').value.trim();
  const password = $('inp-login-pass').value;
  const msgEl    = $('msg-login');
  if (!email || !password) { setMsg(msgEl,'err','Please enter email and password.'); return; }
  setMsg(msgEl,'info','Logging in…');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { setMsg(msgEl,'err', error.message); return; }
  setMsg(msgEl,'ok','Welcome back! Loading your dashboard…');
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error || !data) {
    const name = localStorage.getItem('pendingName') || currentUser.email.split('@')[0];
    localStorage.removeItem('pendingName');
    const uniqueId = await generateUniqueId();
    const { error: profErr } = await sb.from('profiles').insert({
      id: currentUser.id, name, unique_id: uniqueId, bank: 'kotak'
    });
    if (profErr) { await sb.auth.signOut(); showPage('pg-home'); return; }
    const { data: newProfile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    currentProfile = newProfile;
  } else {
    currentProfile = data;
  }
  enterDash();
}

function enterDash() {
  $('dash-badge').innerHTML = `<b>${currentProfile.name}</b> &nbsp;${currentProfile.unique_id}`;
  const now = new Date();
  $('sel-month').value = now.getMonth();
  $('sel-year').value  = now.getFullYear();
  showPage('pg-dash');
  switchTab('txn');
}

async function logOut() {
  await sb.auth.signOut();
  clearCharts();
  showPage('pg-home');
  showPanel('none');
}
function goHome() { logOut(); }
function openDemo() { showPage('pg-demo'); }

// ── TABS ───────────────────────────────────────
function switchTab(t) {
  ['txn','summary','networth','annual','rules','upload'].forEach(x =>
    $('tab-'+x) && $('tab-'+x).classList.toggle('active', x===t)
  );
  clearCharts();
  $('pg-dash-body').innerHTML = '';
  if      (t==='txn')      renderTxn();
  else if (t==='summary')  renderSummary();
  else if (t==='networth') renderNetWorth();
  else if (t==='annual')   renderAnnual();
  else if (t==='rules')    renderRules();
  else if (t==='upload')   renderUpload();
}

function getMonthYear() {
  return { m: parseInt($('sel-month').value), y: parseInt($('sel-year').value) };
}

// ── DATABASE HELPERS ───────────────────────────
async function getTxns() {
  const {m,y} = getMonthYear();
  const { data } = await sb.from('transactions').select('*')
    .eq('user_id', currentUser.id).eq('month',m).eq('year',y)
    .order('date',{ascending:true});
  return data || [];
}

async function getAllTxns() {
  const { data } = await sb.from('transactions').select('*')
    .eq('user_id', currentUser.id)
    .order('date',{ascending:true});
  return data || [];
}

async function getRules() {
  const { data } = await sb.from('rules').select('*').eq('user_id', currentUser.id);
  return data || [];
}

async function saveRulesToDB(rules) {
  await sb.from('rules').delete().eq('user_id', currentUser.id);
  if (!rules.length) return;
  await sb.from('rules').insert(
    rules.map(r => ({ user_id:currentUser.id, keyword:r.keyword, category:r.cat, subcategory:r.subcat }))
  );
}

// opening balances helpers
async function getOpeningBalances() {
  const { data } = await sb.from('opening_balances').select('*').eq('user_id', currentUser.id);
  return data || [];
}

async function saveOpeningBalance(item) {
  if (item.id) {
    await sb.from('opening_balances').update({
      name:item.name, category:item.category, subcategory:item.subcategory, amount:item.amount, as_of_date:item.as_of_date
    }).eq('id', item.id);
  } else {
    await sb.from('opening_balances').insert({
      user_id:currentUser.id, name:item.name, category:item.category,
      subcategory:item.subcategory, amount:item.amount, as_of_date:item.as_of_date
    });
  }
}

async function deleteOpeningBalance(id) {
  await sb.from('opening_balances').delete().eq('id', id);
}

// ── NET WORTH CALC ─────────────────────────────
// Assets: Withdrawal = bought (increase), Deposit = sold (decrease)
// Liabilities: Deposit = loan taken (increase), Withdrawal = repaid (decrease)
function calcNetWorthFromData(openingBals, allTxns) {
  let openingAssets = 0, openingLiabilities = 0;
  openingBals.forEach(b => {
    if (b.category === 'Assets')      openingAssets      += parseFloat(b.amount);
    if (b.category === 'Liabilities') openingLiabilities += parseFloat(b.amount);
  });

  let txnAssets = 0, txnLiabilities = 0;
  allTxns.forEach(t => {
    const amt = parseFloat(t.amount);
    if (t.category === 'Assets') {
      txnAssets += t.type === 'Withdrawal' ? amt : -amt; // bought = +, sold = -
    }
    if (t.category === 'Liabilities') {
      txnLiabilities += t.type === 'Deposit' ? amt : -amt; // taken = +, repaid = -
    }
  });

  const totalAssets      = openingAssets      + txnAssets;
  const totalLiabilities = openingLiabilities + txnLiabilities;
  const netWorth         = totalAssets - totalLiabilities;
  return { openingAssets, openingLiabilities, txnAssets, txnLiabilities, totalAssets, totalLiabilities, netWorth };
}

// ── TAB 1: TRANSACTIONS ────────────────────────
async function renderTxn() {
  const body = $('pg-dash-body');
  const {m,y} = getMonthYear();
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8892b0">Loading transactions…</div>`;
  const txns = await getTxns();
  body.innerHTML = `
  <div class="section">
    <div class="sec-title">
      <span>Transactions — ${MFULL[m]} ${y}</span>
      <button class="btn btn-green btn-sm" onclick="toggleAddForm()">+ Add transaction</button>
    </div>
    <div id="add-txn-form" style="display:none;background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div class="grid2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Date</label><input type="date" id="new-date"></div>
        <div class="field"><label>Description</label><input type="text" id="new-desc" placeholder="e.g. Swiggy order"></div>
        <div class="field"><label>Amount (₹)</label><input type="number" id="new-amt" placeholder="0" min="0"></div>
        <div class="field"><label>Type</label>
          <select id="new-type">
            <option value="Withdrawal">Withdrawal (money out)</option>
            <option value="Deposit">Deposit (money in)</option>
          </select>
        </div>
        <div class="field"><label>Category</label>
          <select id="new-cat" onchange="updateSubDrop('new-subcat','new-cat')">
            <option value="">Select category</option>
            ${Object.keys(CAT_MAP).map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Sub-category</label>
          <select id="new-subcat"><option value="">Select sub-category</option></select>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="toggleAddForm()">Cancel</button>
        <button class="btn btn-green btn-sm" onclick="saveTxnRow()">Save transaction</button>
      </div>
      <div class="msg" id="txn-form-msg"></div>
    </div>
    ${txns.length ? `
    <div class="tbl-wrap">
      <table class="data-tbl">
        <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Category</th><th>Sub-category</th><th></th></tr></thead>
        <tbody>
          ${txns.map(t=>`
          <tr>
            <td style="white-space:nowrap">${t.date}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.description}">${t.description}</td>
            <td><span class="badge ${t.type==='Deposit'?'b-dep':'b-wit'}">${t.type}</span></td>
            <td style="text-align:right;font-weight:600;white-space:nowrap">${fmt(t.amount)}</td>
            <td><span class="badge" style="background:${CAT_COLORS[t.category]||'#333'}22;color:${CAT_COLORS[t.category]||'#aaa'};border:1px solid ${CAT_COLORS[t.category]||'#333'}44">${t.category||'—'}</span></td>
            <td style="font-size:11px;color:#8892b0">${t.subcategory||'—'}</td>
            <td><button class="btn btn-sm btn-red" onclick="deleteTxn('${t.id}')">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty">
      <div class="empty-icon">📋</div>
      No transactions for ${MFULL[m]} ${y}.<br>
      Add manually or <a href="#" onclick="switchTab('upload')">upload your bank statement</a>.
    </div>`}
  </div>`;
  $('new-date').value = new Date().toISOString().split('T')[0];
}

function toggleAddForm() {
  const f = $('add-txn-form');
  f.style.display = f.style.display==='none' ? 'block' : 'none';
}
function updateSubDrop(subId, catId) {
  const cat = $(catId).value, sub = $(subId);
  sub.innerHTML = '<option value="">Select sub-category</option>' +
    (CAT_MAP[cat]||[]).map(s=>`<option>${s}</option>`).join('');
}
async function saveTxnRow() {
  const date=  $('new-date').value;
  const desc=  $('new-desc').value.trim();
  const amount=fmtN($('new-amt').value);
  const type=  $('new-type').value;
  const cat=   $('new-cat').value;
  const subcat=$('new-subcat').value;
  const msgEl= $('txn-form-msg');
  if (!date||!desc||!amount){ setMsg(msgEl,'err','Please fill date, description and amount.'); return; }
  if (!cat)                 { setMsg(msgEl,'err','Please select a category.'); return; }
  setMsg(msgEl,'info','Saving…');
  const {m,y} = getMonthYear();
  await sb.from('transactions').insert({
    user_id:currentUser.id, date, description:desc, amount, type,
    category:cat, subcategory:subcat, month:m, year:y
  });
  renderTxn();
}
async function deleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  await sb.from('transactions').delete().eq('id',id);
  renderTxn();
}

// ── TAB 2: MONTHLY SUMMARY ─────────────────────
async function renderSummary() {
  const body = $('pg-dash-body');
  const {m,y} = getMonthYear();
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8892b0">Loading summary…</div>`;
  const txns = await getTxns();

  if (!txns.length) {
    body.innerHTML = `<div class="section"><div class="empty"><div class="empty-icon">📊</div>No transactions for ${MFULL[m]} ${y}.</div></div>`;
    return;
  }

  // ── calculate totals ──
  let income=0, expenses=0, assetsIn=0, assetsOut=0, liabIn=0, liabOut=0;
  const expSubs={}, incSubs={}, astSubs={};

  txns.forEach(t => {
    const amt = parseFloat(t.amount);
    const sub = t.subcategory || 'Other';
    if (t.category==='Income') {
      income += amt;
      incSubs[sub] = (incSubs[sub]||0) + amt;
    }
    if (t.category==='Expenses') {
      expenses += amt;
      expSubs[sub] = (expSubs[sub]||0) + amt;
    }
    if (t.category==='Assets') {
      if (t.type==='Withdrawal') { assetsIn  += amt; astSubs[sub]=(astSubs[sub]||0)+amt; }
      else                       { assetsOut += amt; }
    }
    if (t.category==='Liabilities') {
      if (t.type==='Deposit')    liabIn  += amt;
      else                       liabOut += amt;
    }
  });

  const netAssetChange = assetsIn - assetsOut;   // net invested this month
  const netLiabChange  = liabIn   - liabOut;     // net liability change this month
  const surplus        = Math.max(0, income - expenses - netAssetChange);
  // savings = everything that's not expenses
  const totalSavings   = income - expenses;
  const savingsRate    = income > 0 ? Math.round(totalSavings / income * 100) : 0;

  // sort subs
  const expSubArr = Object.entries(expSubs).sort((a,b)=>b[1]-a[1]);
  const incSubArr = Object.entries(incSubs).sort((a,b)=>b[1]-a[1]);
  const astSubArr = Object.entries(astSubs).sort((a,b)=>b[1]-a[1]);

  body.innerHTML = `
  <!-- OVERVIEW -->
  <div class="section">
    <div class="sec-title">Overview — ${MFULL[m]} ${y}</div>
    <div class="grid3" style="margin-bottom:1.25rem">
      <div class="metric">
        <div class="lbl">Total income</div>
        <div class="val" style="color:#00d4a0">${fmt(income)}</div>
      </div>
      <div class="metric">
        <div class="lbl">Total expenses</div>
        <div class="val" style="color:#ff6b6b">${fmt(expenses)}</div>
      </div>
      <div class="metric">
        <div class="lbl">Total savings</div>
        <div class="val" style="color:#4d9fff">${fmt(totalSavings)}</div>
        <div class="sub">Savings rate: ${savingsRate}%</div>
      </div>
    </div>
    <!-- savings rate bar -->
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#8892b0;margin-bottom:4px">
      <span>Savings rate</span><span style="color:#00d4a0;font-weight:600">${savingsRate}%</span>
    </div>
    <div class="bar-wrap"><div class="bar" style="width:${Math.min(Math.max(savingsRate,0),100)}%"></div></div>
  </div>

  <!-- INCOME SPLIT CHART -->
  <div class="section">
    <div class="sec-title">How your income was used — ${MFULL[m]}</div>
    <div style="position:relative;height:220px;margin-bottom:1rem"><canvas id="income-split-donut"></canvas></div>
    <div class="legend" style="justify-content:center">
      <span><span class="leg-dot" style="background:#ff6b6b"></span>Expenses: ${fmt(expenses)}</span>
      <span><span class="leg-dot" style="background:#4d9fff"></span>Invested: ${fmt(netAssetChange)}</span>
      <span><span class="leg-dot" style="background:#00d4a0"></span>Surplus: ${fmt(surplus)}</span>
    </div>
    <div style="margin-top:1rem">
      ${[['Expenses','#ff6b6b',expenses],['Invested (Assets)','#4d9fff',netAssetChange],['Net surplus','#00d4a0',surplus]].map(([label,color,val])=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:10px;height:10px;border-radius:3px;background:${color};display:inline-block"></span>
          <span style="font-size:13px">${label}</span>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:600;color:${color}">${fmt(val)}</div>
          <div style="font-size:11px;color:#8892b0">${income>0?Math.round(val/income*100):0}% of income</div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- EXPENSES BREAKDOWN -->
  ${expSubArr.length ? `
  <div class="section">
    <div class="sec-title">Expenses breakdown</div>
    ${expSubArr.map(([name,val])=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)">
      <span style="font-size:13px">${name}</span>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600">${fmt(val)}</div>
        <div style="font-size:11px;color:#8892b0">${expenses>0?Math.round(val/expenses*100):0}% of expenses</div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- INCOME BREAKDOWN -->
  ${incSubArr.length ? `
  <div class="section">
    <div class="sec-title">Income breakdown</div>
    ${incSubArr.map(([name,val])=>`
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)">
      <span style="font-size:13px">${name}</span>
      <span style="font-size:13px;font-weight:600;color:#00d4a0">${fmt(val)}</span>
    </div>`).join('')}
  </div>` : ''}

  <!-- ASSETS THIS MONTH -->
  ${astSubArr.length ? `
  <div class="section">
    <div class="sec-title">Investments this month</div>
    <div class="grid3" style="margin-bottom:1rem">
      <div class="metric"><div class="lbl">Invested</div><div class="val" style="color:#4d9fff">${fmt(assetsIn)}</div></div>
      <div class="metric"><div class="lbl">Redeemed</div><div class="val" style="color:#ff6b6b">${fmt(assetsOut)}</div></div>
      <div class="metric"><div class="lbl">Net change</div><div class="val" style="color:${netAssetChange>=0?'#00d4a0':'#ff6b6b'}">${netAssetChange>=0?'+':''}${fmt(netAssetChange)}</div></div>
    </div>
    ${astSubArr.map(([name,val])=>`
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)">
      <span style="font-size:13px">${name}</span>
      <span style="font-size:13px;font-weight:600;color:#4d9fff">${fmt(val)}</span>
    </div>`).join('')}
  </div>` : ''}

  <!-- LIABILITIES THIS MONTH -->
  ${(liabIn>0||liabOut>0) ? `
  <div class="section">
    <div class="sec-title">Liabilities this month</div>
    <div class="grid3">
      <div class="metric"><div class="lbl">Loans taken</div><div class="val" style="color:#a78bfa">${fmt(liabIn)}</div></div>
      <div class="metric"><div class="lbl">Repaid</div><div class="val" style="color:#00d4a0">${fmt(liabOut)}</div></div>
      <div class="metric"><div class="lbl">Net change</div><div class="val" style="color:${netLiabChange<=0?'#00d4a0':'#ff6b6b'}">${netLiabChange>0?'+':''}${fmt(netLiabChange)}</div></div>
    </div>
  </div>` : ''}

  <!-- INVESTMENT SPLIT SUGGESTION -->
  <div class="section">
    <div class="sec-title">Suggested investment split</div>
    <p style="font-size:12px;color:#8892b0;margin-bottom:1rem">Based on your savings of <b style="color:#4d9fff">${fmt(totalSavings)}</b> — recommended 60/30/20 allocation:</p>
    ${[['Flexi cap / Index fund','Long-term wealth creation','#4d9fff',totalSavings*.6,60],
       ['Liquid assets / fund','Emergency & short-term','#a78bfa',totalSavings*.3,30],
       ['Life & health insurance','Protection & risk cover','#00d4a0',totalSavings*.2,20]].map(([name,desc,color,amt,pct])=>`
    <div class="inv-row">
      <div><div class="ir-name">${name}</div><div class="ir-desc">${desc}</div></div>
      <div><div class="ir-amt" style="color:${color}">${fmt(amt)}</div><div class="ir-pct">${pct}% of savings</div></div>
    </div>`).join('')}
  </div>`;

  // ── donut chart: income split ──
  const splitData = [expenses, Math.max(0,netAssetChange), surplus];
  const total = splitData.reduce((a,b)=>a+b,0);
  const ctx = $('income-split-donut');
  if (ctx) {
    charts['income-split'] = new Chart(ctx, {
      type:'doughnut',
      data:{ labels:['Expenses','Invested','Surplus'], datasets:[{ data:total>0?splitData:[1,1,1], backgroundColor:['#ff6b6b','#4d9fff','#00d4a0'], borderWidth:0, hoverOffset:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>total>0?' '+fmt(c.parsed)+' ('+Math.round(c.parsed/income*100)+'%)':' No data'}} }
      }
    });
  }
}

// ── TAB 3: NET WORTH ───────────────────────────
async function renderNetWorth() {
  const body = $('pg-dash-body');
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8892b0">Loading net worth…</div>`;

  const [openingBals, allTxns] = await Promise.all([getOpeningBalances(), getAllTxns()]);
  const nw = calcNetWorthFromData(openingBals, allTxns);

  // monthly net worth trend (for chart)
  const monthlyNW = await calcMonthlyNetWorth(openingBals, allTxns);

  // current month changes
  const {m,y} = getMonthYear();
  const monthTxns = allTxns.filter(t => t.month===m && t.year===y);
  let mAssetsIn=0, mAssetsOut=0, mLiabIn=0, mLiabOut=0;
  monthTxns.forEach(t => {
    const amt = parseFloat(t.amount);
    if (t.category==='Assets')      { t.type==='Withdrawal' ? mAssetsIn+=amt : mAssetsOut+=amt; }
    if (t.category==='Liabilities') { t.type==='Deposit'    ? mLiabIn+=amt   : mLiabOut+=amt;  }
  });

  body.innerHTML = `
  <!-- NET WORTH SUMMARY -->
  <div class="section">
    <div class="sec-title">Net worth summary</div>
    <div style="text-align:center;padding:1.5rem 0 1rem">
      <div style="font-size:12px;color:#8892b0;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Total net worth</div>
      <div style="font-size:36px;font-weight:700;color:${nw.netWorth>=0?'#00d4a0':'#ff6b6b'};letter-spacing:-.02em">${fmt(Math.abs(nw.netWorth))}</div>
      <div style="font-size:13px;color:#8892b0;margin-top:.4rem">${nw.netWorth>=0?'Positive net worth 🎉':'Net liability position'}</div>
    </div>
    <div class="grid3">
      <div class="metric"><div class="lbl">Total assets</div><div class="val" style="color:#4d9fff">${fmt(nw.totalAssets)}</div></div>
      <div class="metric"><div class="lbl">Total liabilities</div><div class="val" style="color:#a78bfa">${fmt(nw.totalLiabilities)}</div></div>
      <div class="metric"><div class="lbl">Net worth</div><div class="val" style="color:${nw.netWorth>=0?'#00d4a0':'#ff6b6b'}">${fmt(nw.netWorth)}</div></div>
    </div>
  </div>

  <!-- THIS MONTH CHANGES -->
  <div class="section">
    <div class="sec-title">Changes this month — ${MFULL[m]} ${y}</div>
    <div class="grid3" style="margin-bottom:1rem">
      <div class="metric"><div class="lbl">Assets invested</div><div class="val" style="color:#4d9fff">+${fmt(mAssetsIn)}</div></div>
      <div class="metric"><div class="lbl">Assets redeemed</div><div class="val" style="color:#ff6b6b">-${fmt(mAssetsOut)}</div></div>
      <div class="metric"><div class="lbl">Net asset change</div><div class="val" style="color:${(mAssetsIn-mAssetsOut)>=0?'#00d4a0':'#ff6b6b'}">${mAssetsIn-mAssetsOut>=0?'+':''}${fmt(mAssetsIn-mAssetsOut)}</div></div>
      <div class="metric"><div class="lbl">Loans taken</div><div class="val" style="color:#a78bfa">+${fmt(mLiabIn)}</div></div>
      <div class="metric"><div class="lbl">Loans repaid</div><div class="val" style="color:#00d4a0">-${fmt(mLiabOut)}</div></div>
      <div class="metric"><div class="lbl">Net liab change</div><div class="val" style="color:${(mLiabIn-mLiabOut)<=0?'#00d4a0':'#ff6b6b'}">${mLiabIn-mLiabOut>0?'+':''}${fmt(mLiabIn-mLiabOut)}</div></div>
    </div>
  </div>

  <!-- NET WORTH TREND CHART -->
  ${monthlyNW.length > 0 ? `
  <div class="section">
    <div class="sec-title">Net worth trend</div>
    <div style="position:relative;height:260px"><canvas id="nw-line-chart"></canvas></div>
    <div class="legend" style="margin-top:.75rem">
      <span><span class="leg-dot" style="background:#4d9fff"></span>Assets</span>
      <span><span class="leg-dot" style="background:#a78bfa"></span>Liabilities</span>
      <span><span class="leg-dot" style="background:#00d4a0"></span>Net worth</span>
    </div>
  </div>` : ''}

  <!-- OPENING BALANCES -->
  <div class="section">
    <div class="sec-title">
      <span>Opening balances</span>
      <button class="btn btn-green btn-sm" onclick="showOpeningForm()">+ Add balance</button>
    </div>
    <p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">
      Add your existing assets and liabilities that you had before starting to use this app.
      These carry forward into your net worth calculation.
    </p>
    <div id="opening-form" style="display:none;background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div class="grid2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Name</label><input type="text" id="ob-name" placeholder="e.g. HDFC Mutual Fund"></div>
        <div class="field"><label>Category</label>
          <select id="ob-cat" onchange="updateSubDrop('ob-subcat','ob-cat')">
            <option value="">Select</option>
            <option value="Assets">Assets</option>
            <option value="Liabilities">Liabilities</option>
          </select>
        </div>
        <div class="field"><label>Sub-category</label>
          <select id="ob-subcat"><option value="">Select sub-category</option></select>
        </div>
        <div class="field"><label>Amount (₹)</label><input type="number" id="ob-amount" placeholder="0"></div>
        <div class="field"><label>As of date</label><input type="date" id="ob-date"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="$('opening-form').style.display='none'">Cancel</button>
        <button class="btn btn-green btn-sm" onclick="saveOpeningBal()">Save</button>
      </div>
      <div class="msg" id="ob-msg"></div>
    </div>
    ${openingBals.length ? `
    <div class="tbl-wrap">
      <table class="data-tbl">
        <thead><tr><th>Name</th><th>Category</th><th>Sub-category</th><th>Amount</th><th>As of</th><th></th></tr></thead>
        <tbody>
          ${openingBals.map(b=>`
          <tr>
            <td style="font-weight:500">${b.name}</td>
            <td><span class="badge" style="background:${CAT_COLORS[b.category]||'#333'}22;color:${CAT_COLORS[b.category]||'#aaa'};border:1px solid ${CAT_COLORS[b.category]||'#333'}44">${b.category}</span></td>
            <td style="font-size:11px;color:#8892b0">${b.subcategory||'—'}</td>
            <td style="font-weight:600;color:${b.category==='Assets'?'#4d9fff':'#a78bfa'}">${fmt(b.amount)}</td>
            <td style="font-size:11px;color:#8892b0">${b.as_of_date||'—'}</td>
            <td><button class="btn btn-sm btn-red" onclick="deleteOB('${b.id}')">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty" style="padding:1.5rem"><div class="empty-icon" style="font-size:24px">🏦</div>No opening balances added yet.</div>`}
  </div>`;

  // ── render charts ──
  if (monthlyNW.length > 0) {
    const labels = monthlyNW.map(d => MONTHS[d.m] + ' ' + String(d.y).slice(2));
    charts['nw-line'] = new Chart($('nw-line-chart'), {
      type:'bar',
      data:{ labels, datasets:[
        { label:'Assets',      data:monthlyNW.map(d=>d.assets),      backgroundColor:'rgba(77,159,255,0.5)',  borderColor:'#4d9fff', borderWidth:2, type:'bar', borderRadius:4 },
        { label:'Liabilities', data:monthlyNW.map(d=>d.liabilities), backgroundColor:'rgba(167,139,250,0.5)', borderColor:'#a78bfa', borderWidth:2, type:'bar', borderRadius:4 },
        { label:'Net worth',   data:monthlyNW.map(d=>d.netWorth),    borderColor:'#00d4a0', backgroundColor:'rgba(0,212,160,0.1)', borderWidth:2, type:'line', tension:.4, fill:true, pointRadius:4, pointBackgroundColor:'#00d4a0' }
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' '+fmt(c.parsed)}} },
        scales:{
          x:{ ticks:{color:'#8892b0',autoSkip:false,maxRotation:45}, grid:{color:'rgba(99,120,220,0.08)'} },
          y:{ ticks:{color:'#8892b0',callback:v=>fmt(v)}, grid:{color:'rgba(99,120,220,0.08)'} }
        }
      }
    });
  }
}

async function calcMonthlyNetWorth(openingBals, allTxns) {
  if (!allTxns.length && !openingBals.length) return [];
  // find date range
  const dates = allTxns.map(t => ({ m:t.month, y:t.year }));
  if (!dates.length) return [];
  const minY = Math.min(...dates.map(d=>d.y));
  const maxY = Math.max(...dates.map(d=>d.y));
  const result = [];
  let runAssets = openingBals.filter(b=>b.category==='Assets').reduce((a,b)=>a+parseFloat(b.amount),0);
  let runLiabs  = openingBals.filter(b=>b.category==='Liabilities').reduce((a,b)=>a+parseFloat(b.amount),0);
  for (let y=minY; y<=maxY; y++) {
    const startM = y===minY ? Math.min(...dates.filter(d=>d.y===y).map(d=>d.m)) : 0;
    const endM   = y===maxY ? Math.max(...dates.filter(d=>d.y===y).map(d=>d.m)) : 11;
    for (let m=startM; m<=endM; m++) {
      const mTxns = allTxns.filter(t=>t.month===m&&t.year===y);
      mTxns.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.category==='Assets')      { t.type==='Withdrawal' ? runAssets+=amt : runAssets-=amt; }
        if (t.category==='Liabilities') { t.type==='Deposit'    ? runLiabs+=amt  : runLiabs-=amt;  }
      });
      result.push({ m, y, assets:runAssets, liabilities:runLiabs, netWorth:runAssets-runLiabs });
    }
  }
  return result;
}

function showOpeningForm() {
  $('opening-form').style.display = 'block';
  $('ob-date').value = new Date().toISOString().split('T')[0];
}

async function saveOpeningBal() {
  const name    = $('ob-name').value.trim();
  const cat     = $('ob-cat').value;
  const subcat  = $('ob-subcat').value;
  const amount  = fmtN($('ob-amount').value);
  const date    = $('ob-date').value;
  const msgEl   = $('ob-msg');
  if (!name||!cat||!amount) { setMsg(msgEl,'err','Please fill name, category and amount.'); return; }
  setMsg(msgEl,'info','Saving…');
  await sb.from('opening_balances').insert({
    user_id:currentUser.id, name, category:cat, subcategory:subcat, amount, as_of_date:date
  });
  renderNetWorth();
}

async function deleteOB(id) {
  if (!confirm('Delete this opening balance?')) return;
  await sb.from('opening_balances').delete().eq('id',id);
  renderNetWorth();
}

// ── TAB 4: ANNUAL ANALYSIS ─────────────────────
async function renderAnnual() {
  const body = $('pg-dash-body');
  const {y}  = getMonthYear();
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8892b0">Loading annual data…</div>`;
  const { data:allTxns } = await sb.from('transactions').select('*').eq('user_id',currentUser.id).eq('year',y);
  if (!allTxns||!allTxns.length) {
    body.innerHTML = `<div class="section"><div class="empty"><div class="empty-icon">📈</div>No data for ${y} yet.</div></div>`;
    return;
  }
  const entries = [];
  for (let m=0; m<12; m++) {
    const txns = allTxns.filter(t=>t.month===m);
    if (!txns.length) continue;
    let inc=0,exp=0,ast=0,lib=0;
    txns.forEach(t=>{
      const amt=parseFloat(t.amount);
      if(t.category==='Income')   inc+=amt;
      if(t.category==='Expenses') exp+=amt;
      if(t.category==='Assets'&&t.type==='Withdrawal') ast+=amt;
      if(t.category==='Liabilities') lib+=amt;
    });
    entries.push({m,inc,exp,ast,lib,savings:inc-exp,count:txns.length});
  }
  const sumInc=entries.reduce((a,e)=>a+e.inc,0);
  const sumExp=entries.reduce((a,e)=>a+e.exp,0);
  const sumAst=entries.reduce((a,e)=>a+e.ast,0);
  const sumSav=entries.reduce((a,e)=>a+e.savings,0);
  const avgRate=sumInc>0?Math.round(sumSav/sumInc*100):0;
  const bestM=entries.reduce((a,b)=>a.savings>b.savings?a:b);

  // annual sub-totals for expenses
  const annExpSubs={};
  allTxns.filter(t=>t.category==='Expenses').forEach(t=>{
    const sub=t.subcategory||'Other';
    annExpSubs[sub]=(annExpSubs[sub]||0)+parseFloat(t.amount);
  });
  const annExpArr=Object.entries(annExpSubs).sort((a,b)=>b[1]-a[1]);

  body.innerHTML=`
  <div class="section"><div class="sec-title">Saved months — ${y}</div>
    <div class="months-grid">
      ${entries.map(({m,inc,exp,ast,savings,count})=>`
      <div class="mcard" onclick="jumpMonth(${m})">
        <div class="mname">${MFULL[m]}</div>
        <div class="mrow"><span>Income</span><span style="color:#00d4a0">${fmt(inc)}</span></div>
        <div class="mrow"><span>Expenses</span><span style="color:#ff6b6b">${fmt(exp)}</span></div>
        <div class="mrow"><span>Invested</span><span style="color:#4d9fff">${fmt(ast)}</span></div>
        <div class="mrow"><span>Savings</span><span style="color:${savings>=0?'#00d4a0':'#ff6b6b'}">${fmt(savings)}</span></div>
        <div class="mrow"><span>Txns</span><span>${count}</span></div>
      </div>`).join('')}
    </div>
  </div>
  <div class="section"><div class="sec-title">Year highlights — ${y}</div>
    <div class="hl-grid">
      <div class="hlcard"><div class="hl">Total income</div><div class="hv" style="color:#00d4a0">${fmt(sumInc)}</div><div class="hs">${entries.length} months</div></div>
      <div class="hlcard"><div class="hl">Total expenses</div><div class="hv" style="color:#ff6b6b">${fmt(sumExp)}</div></div>
      <div class="hlcard"><div class="hl">Total invested</div><div class="hv" style="color:#4d9fff">${fmt(sumAst)}</div></div>
      <div class="hlcard"><div class="hl">Total savings</div><div class="hv" style="color:#00d4a0">${fmt(sumSav)}</div></div>
      <div class="hlcard"><div class="hl">Avg savings rate</div><div class="hv">${avgRate}%</div></div>
      <div class="hlcard"><div class="hl">Best month</div><div class="hv">${MONTHS[bestM.m]}</div><div class="hs">Savings: ${fmt(bestM.savings)}</div></div>
    </div>
  </div>
  <div class="section"><div class="sec-title">Monthly trend — ${y}</div>
    <div style="position:relative;height:250px"><canvas id="bar-annual"></canvas></div>
    <div class="legend">
      <span><span class="leg-dot" style="background:#00d4a0"></span>Income</span>
      <span><span class="leg-dot" style="background:#ff6b6b"></span>Expenses</span>
      <span><span class="leg-dot" style="background:#4d9fff"></span>Invested</span>
    </div>
  </div>
  ${annExpArr.length?`
  <div class="section"><div class="sec-title">Annual expenses breakdown</div>
    ${annExpArr.map(([name,val])=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)">
      <span style="font-size:13px">${name}</span>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600">${fmt(val)}</div>
        <div style="font-size:11px;color:#8892b0">${sumExp>0?Math.round(val/sumExp*100):0}% of expenses</div>
      </div>
    </div>`).join('')}
  </div>`:''}`;

  charts['bar-annual']=new Chart($('bar-annual'),{type:'bar',data:{labels:entries.map(e=>MONTHS[e.m]),datasets:[
    {label:'Income',  data:entries.map(e=>e.inc), backgroundColor:'rgba(0,212,160,0.7)',  borderRadius:4},
    {label:'Expenses',data:entries.map(e=>e.exp), backgroundColor:'rgba(255,107,107,0.7)',borderRadius:4},
    {label:'Invested',data:entries.map(e=>e.ast), backgroundColor:'rgba(77,159,255,0.7)', borderRadius:4}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.parsed)}}},scales:{x:{ticks:{color:'#8892b0',autoSkip:false,maxRotation:0},grid:{color:'rgba(99,120,220,0.08)'}},y:{ticks:{color:'#8892b0',callback:v=>fmt(v)},grid:{color:'rgba(99,120,220,0.08)'}}}}});
}

function jumpMonth(m){$('sel-month').value=m;switchTab('txn');}

// ── TAB 5: MY RULES ────────────────────────────
async function renderRules() {
  const body=$('pg-dash-body');
  body.innerHTML=`<div style="text-align:center;padding:2rem;color:#8892b0">Loading rules…</div>`;
  const rules=await getRules();
  body.innerHTML=`
  <div class="section">
    <div class="sec-title">My keyword rules</div>
    <p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">Keywords matched against bank statement descriptions for auto-categorization.</p>
    <div class="field" style="max-width:240px;margin-bottom:1rem"><label>Your bank</label>
      <select id="rules-bank">
        ${['kotak','hdfc','icici','sbi','axis','other'].map(b=>`<option value="${b}" ${(currentProfile.bank||'kotak')===b?'selected':''}>
          ${b==='kotak'?'Kotak Mahindra':b==='hdfc'?'HDFC Bank':b==='icici'?'ICICI Bank':b==='sbi'?'State Bank (SBI)':b==='axis'?'Axis Bank':'Other Bank'}
        </option>`).join('')}
      </select>
    </div>
    <div style="overflow-x:auto">
      <table class="rules-tbl"><thead><tr>
        <th style="width:36%">Keyword</th><th style="width:22%">Category</th>
        <th style="width:28%">Sub-category</th><th style="width:14%"></th>
      </tr></thead><tbody id="rules-body"></tbody></table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem">
      <button class="btn btn-sm" onclick="addRuleRow()">+ Add row</button>
      <button class="btn btn-green" onclick="saveRules()">Save rules</button>
    </div>
    <div class="msg" id="rules-msg"></div>
  </div>`;
  const tbody=$('rules-body');tbody.innerHTML='';
  if(!rules.length){addRuleRow();return;}
  rules.forEach(r=>addRuleRow(r.keyword,r.category,r.subcategory));
}

function addRuleRow(kw='',cat='',subcat=''){
  const tbody=$('rules-body');
  const tr=document.createElement('tr');
  const subOpts=cat&&CAT_MAP[cat]?CAT_MAP[cat].map(s=>`<option ${s===subcat?'selected':''}>${s}</option>`).join(''):'';
  tr.innerHTML=`
    <td><input type="text" placeholder="e.g. SWIGGY, SALARY" value="${kw}" style="text-transform:uppercase"></td>
    <td><select onchange="updateSubInRow(this)"><option value="">Select</option>
      ${Object.keys(CAT_MAP).map(c=>`<option ${c===cat?'selected':''}>${c}</option>`).join('')}
    </select></td>
    <td><select><option value="">Select sub-category</option>${subOpts}</select></td>
    <td><button class="btn btn-sm btn-red" onclick="this.closest('tr').remove()">✕</button></td>`;
  tbody.appendChild(tr);
}

function updateSubInRow(sel){
  const cat=sel.value;
  const subSel=sel.closest('tr').cells[2].querySelector('select');
  subSel.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(s=>`<option>${s}</option>`).join('');
}

async function saveRules(){
  const rows=[...$('rules-body').querySelectorAll('tr')];
  const rules=rows.map(tr=>({
    keyword:tr.cells[0].querySelector('input').value.trim().toUpperCase(),
    cat:tr.cells[1].querySelector('select').value,
    subcat:tr.cells[2].querySelector('select').value
  })).filter(r=>r.keyword&&r.cat);
  await sb.from('profiles').update({bank:$('rules-bank').value}).eq('id',currentUser.id);
  await saveRulesToDB(rules);
  setMsg($('rules-msg'),'ok',rules.length+' rules saved successfully!');
}

// ── TAB 6: UPLOAD STATEMENT ────────────────────
function renderUpload(){
  $('pg-dash-body').innerHTML=`
  <div class="section">
    <div class="sec-title">Upload bank statement</div>
    <p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">Upload your Kotak Mahindra bank statement PDF. Transactions will be matched against your keyword rules.</p>
    <div class="upload-zone" onclick="$('pdf-input').click()">
      <div class="u-ico">📄</div>
      <p>Click to select your <b>bank statement PDF</b></p>
      <p style="font-size:11px;margin-top:.3rem">System-generated PDF only</p>
    </div>
    <input type="file" id="pdf-input" accept=".pdf" style="display:none" onchange="handlePDF(event)">
    <div class="msg" id="upload-msg" style="margin-top:.75rem;font-size:13px"></div>
  </div>
  <div id="confirm-section" style="display:none">
    <div class="section">
      <div class="sec-title"><span>Review transactions</span><span id="txn-count" style="font-size:12px;color:#8892b0;font-weight:400"></span></div>
      <p style="font-size:12px;color:#8892b0;margin-bottom:.85rem"><span style="color:#ff6b6b">■</span> Orange rows = unmatched — please select a category.</p>
      <div class="tbl-wrap">
        <table class="data-tbl">
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Category</th><th>Sub-category</th></tr></thead>
          <tbody id="txn-confirm-body"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:1rem">
        <button class="btn" onclick="switchTab('upload')">Cancel</button>
        <button class="btn btn-green" onclick="confirmImport()">Confirm &amp; import transactions</button>
      </div>
    </div>
  </div>`;
}

async function handlePDF(e){
  const file=e.target.files[0];if(!file)return;
  const msgEl=$('upload-msg');
  setMsg(msgEl,'info','📖 Reading PDF… please wait.');
  try{
    const buf=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    let allItems=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const tc=await page.getTextContent();
      const vp=page.getViewport({scale:1});
      tc.items.forEach(it=>{
        const str=it.str.trim();if(!str)return;
        allItems.push({str,x:Math.round(it.transform[4]),y:Math.round(vp.height-it.transform[5])});
      });
    }
    const rules=await getRules();
    const txns=parseKotakPDF(allItems,rules);
    if(!txns.length){setMsg(msgEl,'err','No transactions found.');return;}
    setMsg(msgEl,'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns;
    renderConfirmTable(txns);
    $('confirm-section').style.display='block';
  }catch(err){setMsg(msgEl,'err','Error: '+err.message);}
}

function parseKotakPDF(items,rules){
  items.sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[];
  items.forEach(it=>{
    const line=lines.find(l=>Math.abs(l.y-it.y)<=6);
    if(line)line.items.push(it);
    else lines.push({y:it.y,items:[it]});
  });
  lines.forEach(l=>l.items.sort((a,b)=>a.x-b.x));
  let colX={sr:40,date:90,desc:160,ref:370,wd:490,dep:590,bal:680};
  const hLine=lines.find(l=>l.items.some(i=>i.str.trim()==='Date')&&l.items.some(i=>i.str.trim().includes('Description')));
  if(hLine){hLine.items.forEach(it=>{const s=it.str.trim();
    if(s==='#')colX.sr=it.x;else if(s==='Date')colX.date=it.x;
    else if(s.includes('Description'))colX.desc=it.x;else if(s.includes('Chq')||s.includes('Ref'))colX.ref=it.x;
    else if(s.includes('Withdrawal')||s.includes('Dr'))colX.wd=it.x;
    else if(s.includes('Deposit')||s.includes('Cr'))colX.dep=it.x;
    else if(s==='Balance')colX.bal=it.x;
  });}
  const inDesc=x=>x>=colX.desc-10&&x<colX.ref-5;
  const inWd=x=>x>=colX.wd-10&&x<colX.dep-5;
  const inDep=x=>x>=colX.dep-5&&x<colX.bal-5;
  const amtRe=/^[\d,]+\.\d{2}$/;
  const dateRe=/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i;
  const srRe=/^\d{1,3}$/;
  const mMap={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const isAmt=s=>amtRe.test(s.replace(/,/g,''));
  const toAmt=s=>parseFloat(s.replace(/,/g,''));
  const transactions=[];let current=null;
  lines.forEach(line=>{
    const dateItem=line.items.find(it=>dateRe.test(it.str.trim())&&it.x>=colX.date-30&&it.x<=colX.date+80);
    if(dateItem){
      if(current&&current.desc.length>1&&current.amount>0)transactions.push(current);
      const wdItem=line.items.find(it=>isAmt(it.str)&&inWd(it.x));
      const depItem=line.items.find(it=>isAmt(it.str)&&inDep(it.x));
      const descItems=line.items.filter(it=>inDesc(it.x)&&!isAmt(it.str)&&!dateRe.test(it.str.trim())&&!srRe.test(it.str.trim()));
      const dp=dateItem.str.trim().split(/\s+/);
      const dateStr=dp.length===3?`${dp[2]}-${mMap[dp[1].toLowerCase()]||'01'}-${dp[0].padStart(2,'0')}`:dateItem.str.trim();
      const wd=wdItem?toAmt(wdItem.str):0,dep=depItem?toAmt(depItem.str):0;
      current={date:dateStr,desc:descItems.map(i=>i.str).join(' ').trim(),amount:wd>0?wd:dep,type:wd>0?'Withdrawal':'Deposit'};
    }else if(current){
      const lt=line.items.map(i=>i.str).join(' ').toLowerCase();
      if(lt.includes('value date')||lt.includes('page ')||lt.includes('statement generated')||lt.includes('opening balance'))return;
      const contItems=line.items.filter(it=>it.x>=colX.desc-20&&it.x<colX.ref+30&&!isAmt(it.str)&&!dateRe.test(it.str.trim())&&it.str.trim().length>1);
      if(contItems.length){const extra=contItems.map(i=>i.str).join(' ').trim();if(extra&&!/^\d+$/.test(extra))current.desc+=' '+extra;}
    }
  });
  if(current&&current.desc.length>1&&current.amount>0)transactions.push(current);
  function fuzzyMatch(desc,keyword){
    const norm=s=>s.toUpperCase().replace(/[^A-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
    return norm(desc).includes(norm(keyword));
  }
  const seen=new Set();
  return transactions.filter(t=>t.amount>0&&t.desc.length>1).map(t=>{
    const key=t.date+'|'+t.amount+'|'+t.type;
    if(seen.has(key))return null;seen.add(key);
    let cat='',subcat='';
    for(const r of rules){if(r.keyword&&fuzzyMatch(t.desc,r.keyword)){cat=r.category;subcat=r.subcategory;break;}}
    if(!cat&&t.type==='Deposit'){cat='Income';subcat='Other Income';}
    return{date:t.date,desc:t.desc.trim(),amount:t.amount,type:t.type,cat,subcat};
  }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
}

function renderConfirmTable(txns){
  $('txn-count').textContent=txns.length+' transactions';
  $('txn-confirm-body').innerHTML=txns.map((t,i)=>{
    const unmatched=!t.cat;
    const catOpts='<option value="">Select</option>'+Object.keys(CAT_MAP).map(c=>`<option value="${c}" ${c===t.cat?'selected':''}>${c}</option>`).join('');
    const subOpts='<option value="">Select sub-category</option>'+(t.cat&&CAT_MAP[t.cat]?CAT_MAP[t.cat].map(s=>`<option ${s===t.subcat?'selected':''}>${s}</option>`).join(''):'');
    return`<tr class="${unmatched?'unmatched':''}" id="ctxn-${i}">
      <td style="white-space:nowrap">${t.date}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.desc}">${t.desc}</td>
      <td><span class="badge ${t.type==='Deposit'?'b-dep':'b-wit'}">${t.type}</span></td>
      <td style="text-align:right;font-weight:600;white-space:nowrap">${fmt(t.amount)}</td>
      <td><select onchange="updatePendingCat(${i},this.value)">${catOpts}</select></td>
      <td><select id="csub-${i}" onchange="pendingTxns[${i}].subcat=this.value">${subOpts}</select></td>
    </tr>`;
  }).join('');
}

function updatePendingCat(i,cat){
  pendingTxns[i].cat=cat;pendingTxns[i].subcat='';
  const sub=$('csub-'+i);
  sub.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(s=>`<option>${s}</option>`).join('');
  sub.onchange=()=>{pendingTxns[i].subcat=sub.value;};
}

async function confirmImport(){
  const{m,y}=getMonthYear();
  const toAdd=pendingTxns.filter(t=>t.cat);
  if(!toAdd.length){alert('Please select categories for all transactions first.');return;}
  const{error}=await sb.from('transactions').insert(
    toAdd.map(t=>({user_id:currentUser.id,date:t.date,description:t.desc,amount:t.amount,type:t.type,category:t.cat,subcategory:t.subcat,month:m,year:y}))
  );
  if(error){alert('Import failed: '+error.message);return;}
  switchTab('txn');
}

// ── MONTH/YEAR CHANGE ──────────────────────────
document.addEventListener('change',e=>{
  if(!currentUser)return;
  if(e.target.id==='sel-month'||e.target.id==='sel-year'){
    const active=document.querySelector('.tab.active')?.id||'';
    if(active==='tab-txn')renderTxn();
    else if(active==='tab-summary')renderSummary();
    else if(active==='tab-networth')renderNetWorth();
    else if(active==='tab-annual')renderAnnual();
  }
});
