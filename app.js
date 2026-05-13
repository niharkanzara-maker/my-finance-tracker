// ═══════════════════════════════════════════════
//  MY FINANCE TRACKER — app.js
//  Final Version with Supabase Auth + Cloud DB
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
  Income:'#1D9E75', Expenses:'#D85A30', Assets:'#378ADD', Liabilities:'#c084fc'
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
  if (session) {
    currentUser = session.user;
    await loadProfile();
  } else {
    showPage('pg-home');
  }
};

sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    await loadProfile();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    currentProfile = null;
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

  if (!name)               { setMsg(msgEl,'err','Please enter your full name.');            return; }
  if (!email)              { setMsg(msgEl,'err','Please enter your email.');                 return; }
  if (password.length < 6) { setMsg(msgEl,'err','Password must be at least 6 characters.'); return; }
  if (password !== confirm) { setMsg(msgEl,'err','Passwords do not match.');                return; }

  setMsg(msgEl,'info','Creating your account…');

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) { setMsg(msgEl,'err', error.message); return; }

  const uid      = data.user.id;
  const uniqueId = await generateUniqueId();
  const { error: profErr } = await sb.from('profiles').insert({
    id: uid, name, unique_id: uniqueId, bank: 'kotak'
  });
  if (profErr) { setMsg(msgEl,'err','Account created but profile setup failed: ' + profErr.message); return; }
  setMsg(msgEl,'ok','Account created! Please check your email to verify, then log in.');
}

async function generateUniqueId() {
  const { data } = await sb.from('profiles').select('unique_id').order('created_at', { ascending:false }).limit(1);
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
  if (error || !data) { showPage('pg-home'); showPanel('signup'); return; }
  currentProfile = data;
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
  ['txn','summary','annual','rules','upload'].forEach(x =>
    $('tab-' + x).classList.toggle('active', x === t)
  );
  clearCharts();
  $('pg-dash-body').innerHTML = '';
  if      (t === 'txn')     renderTxn();
  else if (t === 'summary') renderSummary();
  else if (t === 'annual')  renderAnnual();
  else if (t === 'rules')   renderRules();
  else if (t === 'upload')  renderUpload();
}

function getMonthYear() {
  return { m: parseInt($('sel-month').value), y: parseInt($('sel-year').value) };
}

// ── DATABASE HELPERS ───────────────────────────
async function getTxns() {
  const {m,y} = getMonthYear();
  const { data } = await sb.from('transactions').select('*')
    .eq('user_id', currentUser.id).eq('month', m).eq('year', y)
    .order('date', { ascending:true });
  return data || [];
}

async function addTxn(txn) {
  const {m,y} = getMonthYear();
  await sb.from('transactions').insert({
    user_id:currentUser.id, date:txn.date, description:txn.desc,
    amount:txn.amount, type:txn.type, category:txn.cat,
    subcategory:txn.subcat, month:m, year:y
  });
}

async function deleteTxnDB(id) {
  await sb.from('transactions').delete().eq('id', id);
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

// ── TAB 1: TRANSACTIONS ────────────────────────
async function renderTxn() {
  const body = $('pg-dash-body');
  const {m,y} = getMonthYear();
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8b90a8">Loading transactions…</div>`;
  const txns = await getTxns();
  body.innerHTML = `
  <div class="section">
    <div class="sec-title">
      <span>Transactions — ${MFULL[m]} ${y}</span>
      <button class="btn btn-green btn-sm" onclick="toggleAddForm()">+ Add transaction</button>
    </div>
    <div id="add-txn-form" style="display:none;background:#12151f;border:.5px solid #2e3244;border-radius:8px;padding:1rem;margin-bottom:1rem">
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
        <thead><tr>
          <th>Date</th><th>Description</th><th>Type</th>
          <th>Amount</th><th>Category</th><th>Sub-category</th><th></th>
        </tr></thead>
        <tbody>
          ${txns.map(t=>`
          <tr>
            <td style="white-space:nowrap">${t.date}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.description}">${t.description}</td>
            <td><span class="badge ${t.type==='Deposit'?'b-dep':'b-wit'}">${t.type}</span></td>
            <td style="text-align:right;font-weight:500;white-space:nowrap">${fmt(t.amount)}</td>
            <td><span class="badge" style="background:${CAT_COLORS[t.category]||'#333'};color:#fff;opacity:.9">${t.category||'—'}</span></td>
            <td style="font-size:11px;color:#8b90a8">${t.subcategory||'—'}</td>
            <td><button class="btn btn-sm btn-red" onclick="deleteTxn('${t.id}')">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty">
      <div class="empty-icon">📋</div>
      No transactions for ${MFULL[m]} ${y}.<br>
      Add manually or <a href="#" onclick="switchTab('upload')" style="color:#378ADD">upload your bank statement</a>.
    </div>`}
  </div>`;
  $('new-date').value = new Date().toISOString().split('T')[0];
}

function toggleAddForm() {
  const f = $('add-txn-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function updateSubDrop(subId, catId) {
  const cat = $(catId).value;
  const sub = $(subId);
  sub.innerHTML = '<option value="">Select sub-category</option>' +
    (CAT_MAP[cat]||[]).map(s=>`<option>${s}</option>`).join('');
}

async function saveTxnRow() {
  const date   = $('new-date').value;
  const desc   = $('new-desc').value.trim();
  const amount = fmtN($('new-amt').value);
  const type   = $('new-type').value;
  const cat    = $('new-cat').value;
  const subcat = $('new-subcat').value;
  const msgEl  = $('txn-form-msg');
  if (!date||!desc||!amount) { setMsg(msgEl,'err','Please fill date, description and amount.'); return; }
  if (!cat)                  { setMsg(msgEl,'err','Please select a category.'); return; }
  setMsg(msgEl,'info','Saving…');
  await addTxn({ date, desc, amount, type, cat, subcat });
  renderTxn();
}

async function deleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  await deleteTxnDB(id);
  renderTxn();
}

// ── TAB 2: MONTHLY SUMMARY ─────────────────────
async function renderSummary() {
  const body = $('pg-dash-body');
  const {m,y} = getMonthYear();
  body.innerHTML = `<div style="text-align:center;padding:2rem;color:#8b90a8">Loading summary…</div>`;
  const txns = await getTxns();
  if (!txns.length) {
    body.innerHTML = `<div class="section"><div class="empty"><div class="empty-icon">📊</div>No transactions for ${MFULL[m]} ${y}.</div></div>`;
    return;
  }
  const totals = {Income:0,Expenses:0,Assets:0,Liabilities:0};
  const subTotals = {};
  txns.forEach(t => {
    if (!t.category) return;
    totals[t.category]=(totals[t.category]||0)+parseFloat(t.amount);
    const sk=t.category+'|'+(t.subcategory||'Other');
    subTotals[sk]=(subTotals[sk]||0)+parseFloat(t.amount);
  });
  const totalIn=totals.Income||0, totalExp=totals.Expenses||0;
  const totalAst=totals.Assets||0, totalLib=totals.Liabilities||0;
  const surplus=Math.max(0,totalIn-totalExp-totalAst-totalLib);
  const savingsRate=totalIn>0?Math.round((totalIn-totalExp)/totalIn*100):0;
  const expSubs=Object.entries(subTotals).filter(([k])=>k.startsWith('Expenses')).map(([k,v])=>({name:k.split('|')[1],val:v})).sort((a,b)=>b.val-a.val);
  const incSubs=Object.entries(subTotals).filter(([k])=>k.startsWith('Income')).map(([k,v])=>({name:k.split('|')[1],val:v})).sort((a,b)=>b.val-a.val);
  const astSubs=Object.entries(subTotals).filter(([k])=>k.startsWith('Assets')).map(([k,v])=>({name:k.split('|')[1],val:v})).sort((a,b)=>b.val-a.val);
  const sugFlexi=totalAst*.6, sugLiquid=totalAst*.3, sugIns=totalAst*.2;
  body.innerHTML=`
  <div class="section">
    <div class="sec-title">Overview — ${MFULL[m]} ${y}</div>
    <div class="grid4" style="margin-bottom:1rem">
      <div class="metric"><div class="lbl">Total income</div><div class="val" style="color:#1D9E75">${fmt(totalIn)}</div></div>
      <div class="metric"><div class="lbl">Total expenses</div><div class="val" style="color:#D85A30">${fmt(totalExp)}</div></div>
      <div class="metric"><div class="lbl">Total invested</div><div class="val" style="color:#378ADD">${fmt(totalAst)}</div></div>
      <div class="metric"><div class="lbl">Liabilities / EMI</div><div class="val" style="color:#c084fc">${fmt(totalLib)}</div></div>
      <div class="metric"><div class="lbl">Net surplus</div><div class="val" style="color:#1D9E75">${fmt(surplus)}</div></div>
      <div class="metric"><div class="lbl">Savings rate</div><div class="val">${savingsRate}%</div><div class="sub">${txns.length} transactions</div></div>
    </div>
    <div class="bar-wrap"><div class="bar" style="width:${Math.min(Math.max(savingsRate,0),100)}%"></div></div>
  </div>
  <div class="section">
    <div class="sec-title">Category breakdown</div>
    <div style="position:relative;height:220px"><canvas id="cat-donut"></canvas></div>
    <div class="legend" style="margin-top:.75rem;justify-content:center">
      ${Object.keys(CAT_MAP).map(c=>`<span><span class="leg-dot" style="background:${CAT_COLORS[c]}"></span>${c}: ${fmt(totals[c]||0)}</span>`).join('')}
    </div>
  </div>
  ${expSubs.length?`<div class="section"><div class="sec-title">Expenses breakdown</div>
    ${expSubs.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:.5px solid #1e2130">
      <span>${s.name}</span><div style="text-align:right"><div style="font-size:13px;font-weight:500">${fmt(s.val)}</div>
      <div style="font-size:11px;color:#8b90a8">${totalExp>0?Math.round(s.val/totalExp*100):0}%</div></div></div>`).join('')}
  </div>`:''}
  ${incSubs.length?`<div class="section"><div class="sec-title">Income breakdown</div>
    ${incSubs.map(s=>`<div style="display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:.5px solid #1e2130">
      <span>${s.name}</span><span style="color:#1D9E75;font-weight:500">${fmt(s.val)}</span></div>`).join('')}
  </div>`:''}
  <div class="section">
    <div class="sec-title">Investment split — ${MFULL[m]}</div>
    <p style="font-size:12px;color:#8b90a8;margin-bottom:1rem">Based on total invested <b style="color:#378ADD">${fmt(totalAst)}</b> — suggested 60/30/20 split:</p>
    ${[['Flexi cap / Index fund','Long-term wealth','#378ADD',sugFlexi,60],
       ['Liquid assets / fund','Emergency & short-term','#7F77DD',sugLiquid,30],
       ['Life & health insurance','Protection','#639922',sugIns,20]].map(([name,desc,color,amt,pct])=>`
    <div class="inv-row"><div><div class="ir-name">${name}</div><div class="ir-desc">${desc}</div></div>
    <div><div class="ir-amt" style="color:${color}">${fmt(amt)}</div><div class="ir-pct">${pct}% of invested</div></div></div>`).join('')}
    ${astSubs.length?`<div class="divider"></div>
    <div style="font-size:12px;color:#8b90a8;margin-bottom:.5rem">Your actual investments:</div>
    ${astSubs.map(s=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:.35rem 0;border-bottom:.5px solid #1e2130">
      <span>${s.name}</span><span style="color:#378ADD;font-weight:500">${fmt(s.val)}</span></div>`).join('')}`:''}
  </div>`;
  const catData=Object.keys(CAT_MAP).map(c=>totals[c]||0);
  const total=catData.reduce((a,b)=>a+b,0);
  const ctx=$('cat-donut');
  if(ctx){charts['cat-donut']=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(CAT_MAP),datasets:[{data:total>0?catData:[1,1,1,1],backgroundColor:Object.values(CAT_COLORS),borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>total>0?' '+fmt(c.parsed):' No data'}}}}});}
}

// ── TAB 3: ANNUAL ANALYSIS ─────────────────────
async function renderAnnual() {
  const body=$('pg-dash-body');
  const {y}=getMonthYear();
  body.innerHTML=`<div style="text-align:center;padding:2rem;color:#8b90a8">Loading annual data…</div>`;
  const {data:allTxns}=await sb.from('transactions').select('*').eq('user_id',currentUser.id).eq('year',y);
  if(!allTxns||!allTxns.length){body.innerHTML=`<div class="section"><div class="empty"><div class="empty-icon">📈</div>No data for ${y} yet.</div></div>`;return;}
  const entries=[];
  for(let m=0;m<12;m++){
    const txns=allTxns.filter(t=>t.month===m);
    if(!txns.length)continue;
    const totals={Income:0,Expenses:0,Assets:0,Liabilities:0};
    txns.forEach(t=>{if(t.category)totals[t.category]=(totals[t.category]||0)+parseFloat(t.amount);});
    entries.push({m,totals,count:txns.length});
  }
  const sumInc=entries.reduce((a,e)=>a+e.totals.Income,0);
  const sumExp=entries.reduce((a,e)=>a+e.totals.Expenses,0);
  const sumAst=entries.reduce((a,e)=>a+e.totals.Assets,0);
  const sumLib=entries.reduce((a,e)=>a+e.totals.Liabilities,0);
  const avgRate=sumInc>0?Math.round((sumInc-sumExp)/sumInc*100):0;
  const bestM=entries.reduce((a,b)=>((a.totals.Income-a.totals.Expenses)>(b.totals.Income-b.totals.Expenses))?a:b);
  const annSubTotals={};
  allTxns.forEach(t=>{const sk=(t.category||'Other')+'|'+(t.subcategory||'Other');annSubTotals[sk]=(annSubTotals[sk]||0)+parseFloat(t.amount);});
  const annExpSubs=Object.entries(annSubTotals).filter(([k])=>k.startsWith('Expenses')).map(([k,v])=>({name:k.split('|')[1],val:v})).sort((a,b)=>b.val-a.val);
  const annAstSubs=Object.entries(annSubTotals).filter(([k])=>k.startsWith('Assets')).map(([k,v])=>({name:k.split('|')[1],val:v})).sort((a,b)=>b.val-a.val);
  const sugFlexi=sumAst*.6,sugLiquid=sumAst*.3,sugIns=sumAst*.2;
  body.innerHTML=`
  <div class="section"><div class="sec-title">Saved months — ${y}</div>
    <div class="months-grid">
      ${entries.map(({m,totals,count})=>`<div class="mcard" onclick="jumpMonth(${m})">
        <div class="mname">${MFULL[m]}</div>
        <div class="mrow"><span>Income</span><span>${fmt(totals.Income||0)}</span></div>
        <div class="mrow"><span>Expenses</span><span>${fmt(totals.Expenses||0)}</span></div>
        <div class="mrow"><span>Invested</span><span style="color:#378ADD">${fmt(totals.Assets||0)}</span></div>
        <div class="mrow"><span>Txns</span><span>${count}</span></div>
      </div>`).join('')}
    </div>
  </div>
  <div class="section"><div class="sec-title">Year highlights — ${y}</div>
    <div class="hl-grid">
      <div class="hlcard"><div class="hl">Total income</div><div class="hv" style="color:#1D9E75">${fmt(sumInc)}</div><div class="hs">${entries.length} months</div></div>
      <div class="hlcard"><div class="hl">Total expenses</div><div class="hv" style="color:#D85A30">${fmt(sumExp)}</div></div>
      <div class="hlcard"><div class="hl">Total invested</div><div class="hv" style="color:#378ADD">${fmt(sumAst)}</div></div>
      <div class="hlcard"><div class="hl">Liabilities</div><div class="hv" style="color:#c084fc">${fmt(sumLib)}</div></div>
      <div class="hlcard"><div class="hl">Avg savings rate</div><div class="hv">${avgRate}%</div></div>
      <div class="hlcard"><div class="hl">Best month</div><div class="hv">${MONTHS[bestM.m]}</div></div>
    </div>
  </div>
  <div class="section"><div class="sec-title">Monthly trend</div>
    <div style="position:relative;height:240px"><canvas id="bar-annual"></canvas></div>
    <div class="legend">
      <span><span class="leg-dot" style="background:#1D9E75"></span>Income</span>
      <span><span class="leg-dot" style="background:#D85A30"></span>Expenses</span>
      <span><span class="leg-dot" style="background:#378ADD"></span>Invested</span>
      <span><span class="leg-dot" style="background:#c084fc"></span>Liabilities</span>
    </div>
  </div>
  ${annExpSubs.length?`<div class="section"><div class="sec-title">Annual expenses breakdown</div>
    ${annExpSubs.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:.5px solid #1e2130">
      <span>${s.name}</span><div style="text-align:right"><div style="font-size:13px;font-weight:500">${fmt(s.val)}</div>
      <div style="font-size:11px;color:#8b90a8">${sumExp>0?Math.round(s.val/sumExp*100):0}%</div></div></div>`).join('')}
  </div>`:''}
  <div class="section"><div class="sec-title">Actual vs suggested investment — ${y}</div>
    <p style="font-size:12px;color:#8b90a8;margin-bottom:1rem">Total invested: <b style="color:#378ADD">${fmt(sumAst)}</b></p>
    ${[['Flexi cap / Index fund','#378ADD',sugFlexi,60],['Liquid assets / fund','#7F77DD',sugLiquid,30],['Life & health insurance','#639922',sugIns,20]].map(([name,color,sug,pct])=>`
    <div style="margin-bottom:.9rem">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:.35rem">
        <span>${name}</span><span style="color:${color};font-weight:600">${fmt(sug)} <span style="color:#8b90a8;font-weight:400">(${pct}%)</span></span>
      </div>
      <div class="prog-wrap"><div class="prog" style="width:${pct}%;background:${color}"></div></div>
    </div>`).join('')}
    ${annAstSubs.length?`<div class="divider"></div>
    <div style="font-size:12px;color:#8b90a8;margin-bottom:.5rem">Where you actually invested:</div>
    ${annAstSubs.map(s=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:.35rem 0;border-bottom:.5px solid #1e2130">
      <span>${s.name}</span><span style="color:#378ADD;font-weight:500">${fmt(s.val)}</span></div>`).join('')}`:''}
  </div>`;
  charts['bar-annual']=new Chart($('bar-annual'),{type:'bar',data:{labels:entries.map(e=>MONTHS[e.m]),datasets:[
    {label:'Income',data:entries.map(e=>e.totals.Income||0),backgroundColor:'#1D9E75',borderRadius:3},
    {label:'Expenses',data:entries.map(e=>e.totals.Expenses||0),backgroundColor:'#D85A30',borderRadius:3},
    {label:'Invested',data:entries.map(e=>e.totals.Assets||0),backgroundColor:'#378ADD',borderRadius:3},
    {label:'Liabilities',data:entries.map(e=>e.totals.Liabilities||0),backgroundColor:'#c084fc',borderRadius:3}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.parsed)}}},scales:{x:{ticks:{color:'#8b90a8',autoSkip:false,maxRotation:0},grid:{color:'#1e2130'}},y:{ticks:{color:'#8b90a8',callback:v=>fmt(v)},grid:{color:'#1e2130'}}}}});
}

function jumpMonth(m){$('sel-month').value=m;switchTab('txn');}

// ── TAB 4: MY RULES ────────────────────────────
async function renderRules() {
  const body=$('pg-dash-body');
  body.innerHTML=`<div style="text-align:center;padding:2rem;color:#8b90a8">Loading rules…</div>`;
  const rules=await getRules();
  body.innerHTML=`
  <div class="section">
    <div class="sec-title">My keyword rules</div>
    <p style="font-size:12px;color:#8b90a8;margin-bottom:1rem;line-height:1.7">Keywords matched against bank statement descriptions for auto-categorization.</p>
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

// ── TAB 5: UPLOAD STATEMENT ────────────────────
function renderUpload(){
  $('pg-dash-body').innerHTML=`
  <div class="section">
    <div class="sec-title">Upload bank statement</div>
    <p style="font-size:12px;color:#8b90a8;margin-bottom:1rem;line-height:1.7">Upload your Kotak Mahindra bank statement PDF.</p>
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
      <div class="sec-title"><span>Review transactions</span><span id="txn-count" style="font-size:12px;color:#8b90a8;font-weight:400"></span></div>
      <p style="font-size:12px;color:#8b90a8;margin-bottom:.85rem"><span style="color:#F0997B">■</span> Orange rows = unmatched — please select a category.</p>
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

// ── PDF PARSER ─────────────────────────────────
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
  const headerLine=lines.find(l=>l.items.some(i=>i.str.trim()==='Date')&&l.items.some(i=>i.str.trim().includes('Description')));
  if(headerLine){
    headerLine.items.forEach(it=>{
      const s=it.str.trim();
      if(s==='#')colX.sr=it.x;
      else if(s==='Date')colX.date=it.x;
      else if(s.includes('Description'))colX.desc=it.x;
      else if(s.includes('Chq')||s.includes('Ref'))colX.ref=it.x;
      else if(s.includes('Withdrawal')||s.includes('Dr'))colX.wd=it.x;
      else if(s.includes('Deposit')||s.includes('Cr'))colX.dep=it.x;
      else if(s==='Balance')colX.bal=it.x;
    });
  }
  const colWdLeft=colX.wd-10,colWdRight=colX.dep-5;
  const colDepLeft=colX.dep-5,colDepRight=colX.bal-5;
  const inDesc=x=>x>=colX.desc-10&&x<colX.ref-5;
  const inWd=x=>x>=colWdLeft&&x<colWdRight;
  const inDep=x=>x>=colDepLeft&&x<colDepRight;
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
      const wd=wdItem?toAmt(wdItem.str):0;
      const dep=depItem?toAmt(depItem.str):0;
      current={date:dateStr,desc:descItems.map(i=>i.str).join(' ').trim(),amount:wd>0?wd:dep,type:wd>0?'Withdrawal':'Deposit'};
    }else if(current){
      const lineText=line.items.map(i=>i.str).join(' ').toLowerCase();
      if(lineText.includes('value date')||lineText.includes('page ')||lineText.includes('statement generated')||lineText.includes('opening balance'))return;
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
      <td style="text-align:right;font-weight:500;white-space:nowrap">${fmt(t.amount)}</td>
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
    else if(active==='tab-annual')renderAnnual();
  }
});
