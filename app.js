// ═══════════════════════════════════════════
//  MY FINANCE TRACKER — app.js
//  Firebase Auth + Supabase Database
// ═══════════════════════════════════════════

// ── FIREBASE (compat SDK loaded via script tag) ──
const firebaseConfig = {
  apiKey: "AIzaSyBUSr0WH95KcDURGvEhlTkm8VntwDzOYfI",
  authDomain: "my-finance-tracker-6a51a.firebaseapp.com",
  projectId: "my-finance-tracker-6a51a",
  storageBucket: "my-finance-tracker-6a51a.firebasestorage.app",
  messagingSenderId: "190800540862",
  appId: "1:190800540862:web:a83425381020bb66fbdaef"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ── SUPABASE ──
const SUPABASE_URL = 'https://ktbugezdzcrpuzrfnsbq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iOfsjV23yTBSeaziqfaZDw_rF-Xiz3M';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF.JS ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── CONSTANTS ──
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MFULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAT_MAP = {
  'Income'     : ['Salary','Freelance','Rental Income','Business Income','Interest / Dividend','Other Income'],
  'Expenses'   : ['Food & Dining','Travel & Petrol','Rent / PG','Fashion & Shopping','Sent to Home','Insurance Premium','Entertainment','Medical','Utilities & Bills','Other Expenses'],
  'Assets'     : ['Mutual Fund / SIP','Stocks & Equity','Gold','Fixed Deposit','Real Estate','Other Investment'],
  'Liabilities': ['Home Loan EMI','Car Loan EMI','Personal Loan EMI','Credit Card Payment','Other Liability']
};
const CAT_COLORS = { Income:'#00d4a0', Expenses:'#ff6b6b', Assets:'#4d9fff', Liabilities:'#a78bfa' };

// ── STATE ──
let currentUser    = null;
let currentProfile = null;
let charts         = {};
let pendingTxns    = [];

// ── UTILS ──
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
function showLoading(msg) {
  const body = $('pg-dash-body');
  if (body) body.innerHTML = `<div style="text-align:center;padding:3rem 1rem"><div style="font-size:32px;margin-bottom:1rem">⏳</div><div style="font-size:14px;color:#8892b0">${msg||'Loading…'}</div></div>`;
}

// ── PANEL ──
function showPanel(t) {
  const cards  = $('home-cards');
  const signup = $('panel-signup');
  const login  = $('panel-login');
  cards.style.display  = t==='none'||t===''?'block':'none';
  signup.style.display = t==='signup'?'block':'none';
  login.style.display  = t==='login'?'block':'none';
  if(t==='none'||t==='') cards.style.display='block';
}

// ── AUTH STATE ──
auth.onAuthStateChanged(async function(user) {
  if (user) {
    currentUser = { id: user.uid, email: user.email };
    await loadProfile();
  } else {
    currentUser = null;
    currentProfile = null;
    showPage('pg-home');
  }
});

// ── SIGNUP ──
function signUp() {
  const name     = $('inp-signup-name').value.trim();
  const email    = $('inp-signup-email').value.trim();
  const password = $('inp-signup-pass').value;
  const confirm  = $('inp-signup-confirm').value;
  const msgEl    = $('msg-signup');
  if (!name)                { setMsg(msgEl,'err','Please enter your full name.'); return; }
  if (!email)               { setMsg(msgEl,'err','Please enter your email.'); return; }
  if (password.length < 6)  { setMsg(msgEl,'err','Password must be at least 6 characters.'); return; }
  if (password !== confirm) { setMsg(msgEl,'err','Passwords do not match.'); return; }
  setMsg(msgEl,'info','Creating your account…');
  localStorage.setItem('pendingName', name);
  auth.createUserWithEmailAndPassword(email, password)
    .then(function() { setMsg(msgEl,'ok','Account created! Loading dashboard…'); })
    .catch(function(e) {
      localStorage.removeItem('pendingName');
      var msg = e.message;
      if (e.code==='auth/email-already-in-use') msg='This email is already registered. Please log in.';
      if (e.code==='auth/invalid-email')        msg='Please enter a valid email address.';
      if (e.code==='auth/weak-password')        msg='Password must be at least 6 characters.';
      setMsg(msgEl,'err', msg);
    });
}

// ── LOGIN ──
function logIn() {
  const email    = $('inp-login-email').value.trim();
  const password = $('inp-login-pass').value;
  const msgEl    = $('msg-login');
  if (!email||!password) { setMsg(msgEl,'err','Please enter email and password.'); return; }
  setMsg(msgEl,'info','Logging in…');
  auth.signInWithEmailAndPassword(email, password)
    .then(function() { setMsg(msgEl,'ok','Welcome back!'); })
    .catch(function(e) {
      var msg = e.message;
      if (e.code==='auth/invalid-credential') msg='Incorrect email or password.';
      if (e.code==='auth/user-not-found')     msg='No account found with this email.';
      if (e.code==='auth/wrong-password')     msg='Incorrect password.';
      if (e.code==='auth/too-many-requests')  msg='Too many attempts. Please try again later.';
      setMsg(msgEl,'err', msg);
    });
}

// ── LOGOUT ──
function logOut() {
  auth.signOut().then(function() { clearCharts(); showPage('pg-home'); });
}
function goHome() { logOut(); }
function openDemo() { showPage('pg-demo'); }

// ── LOAD PROFILE ──
async function loadProfile() {
  try {
    var res = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (res.error || !res.data) {
      var name = localStorage.getItem('pendingName') || currentUser.email.split('@')[0];
      localStorage.removeItem('pendingName');
      var uid = await generateUniqueId();
      var ins = await sb.from('profiles').insert({ id:currentUser.id, name:name, unique_id:uid, bank:'kotak' });
      if (ins.error) { auth.signOut(); return; }
      var res2 = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
      currentProfile = res2.data;
    } else {
      currentProfile = res.data;
    }
    enterDash();
  } catch(e) {
    console.error('Profile error:', e);
    auth.signOut();
  }
}

async function generateUniqueId() {
  var res = await sb.from('profiles').select('unique_id').order('created_at',{ascending:false}).limit(1);
  if (!res.data || !res.data.length) return '#0001';
  var last = parseInt((res.data[0].unique_id||'#0000').replace('#','')) || 0;
  return '#' + String(last+1).padStart(4,'0');
}

function enterDash() {
  $('dash-badge').innerHTML = '<b>'+currentProfile.name+'</b> &nbsp;'+currentProfile.unique_id;
  var now = new Date();
  $('sel-month').value = now.getMonth();
  $('sel-year').value  = now.getFullYear();
  showPage('pg-dash');
  switchTab('txn');
}

// ── TABS ──
function switchTab(t) {
  ['txn','summary','networth','annual','rules','upload'].forEach(function(x) {
    var el = $('tab-'+x);
    if (el) el.classList.toggle('active', x===t);
  });
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

// ── DB HELPERS ──
async function getTxns() {
  var d = getMonthYear();
  var res = await sb.from('transactions').select('*')
    .eq('user_id',currentUser.id).eq('month',d.m).eq('year',d.y)
    .order('date',{ascending:true});
  return res.data || [];
}
async function getAllTxns() {
  var res = await sb.from('transactions').select('*').eq('user_id',currentUser.id).order('date',{ascending:true});
  return res.data || [];
}
async function getRules() {
  var res = await sb.from('rules').select('*').eq('user_id',currentUser.id);
  return res.data || [];
}
async function getOpeningBalances() {
  var res = await sb.from('opening_balances').select('*').eq('user_id',currentUser.id);
  return res.data || [];
}
async function saveRulesToDB(rules) {
  await sb.from('rules').delete().eq('user_id',currentUser.id);
  if (!rules.length) return;
  await sb.from('rules').insert(rules.map(function(r) {
    return { user_id:currentUser.id, keyword:r.keyword, category:r.cat, subcategory:r.subcat };
  }));
}

// ── NET WORTH CALC ──
function calcNetWorth(openingBals, allTxns) {
  var oA=0, oL=0, tA=0, tL=0;
  openingBals.forEach(function(b) {
    if(b.category==='Assets')      oA += parseFloat(b.amount);
    if(b.category==='Liabilities') oL += parseFloat(b.amount);
  });
  allTxns.forEach(function(t) {
    var amt = parseFloat(t.amount);
    if(t.category==='Assets')      tA += t.type==='Withdrawal' ? amt : -amt;
    if(t.category==='Liabilities') tL += t.type==='Deposit'    ? amt : -amt;
  });
  return { totalAssets:oA+tA, totalLiabilities:oL+tL, netWorth:(oA+tA)-(oL+tL) };
}

// ── TAB 1: TRANSACTIONS ──
async function renderTxn() {
  var d = getMonthYear();
  showLoading('Loading transactions…');
  var txns = await getTxns();
  var html = '<div class="section"><div class="sec-title"><span>Transactions — '+MFULL[d.m]+' '+d.y+'</span>'
    +'<button class="btn btn-green btn-sm" onclick="toggleAddForm()">+ Add transaction</button></div>'
    +'<div id="add-txn-form" style="display:none;background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:12px;padding:1rem;margin-bottom:1rem">'
    +'<div class="grid2" style="gap:8px;margin-bottom:8px">'
    +'<div class="field"><label>Date</label><input type="date" id="new-date"></div>'
    +'<div class="field"><label>Description</label><input type="text" id="new-desc" placeholder="e.g. Swiggy order"></div>'
    +'<div class="field"><label>Amount (₹)</label><input type="number" id="new-amt" placeholder="0" min="0"></div>'
    +'<div class="field"><label>Type</label><select id="new-type"><option value="Withdrawal">Withdrawal (money out)</option><option value="Deposit">Deposit (money in)</option></select></div>'
    +'<div class="field"><label>Category</label><select id="new-cat" onchange="updateSubDrop(\'new-subcat\',\'new-cat\')"><option value="">Select category</option>'
    +Object.keys(CAT_MAP).map(function(c){return'<option>'+c+'</option>';}).join('')
    +'</select></div>'
    +'<div class="field"><label>Sub-category</label><select id="new-subcat"><option value="">Select sub-category</option></select></div>'
    +'</div><div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn btn-sm" onclick="toggleAddForm()">Cancel</button>'
    +'<button class="btn btn-green btn-sm" onclick="saveTxnRow()">Save transaction</button>'
    +'</div><div class="msg" id="txn-form-msg"></div></div>';

  if (txns.length) {
    html += '<div class="tbl-wrap"><table class="data-tbl"><thead><tr>'
      +'<th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Category</th><th>Sub-category</th><th></th>'
      +'</tr></thead><tbody>';
    txns.forEach(function(t) {
      html += '<tr>'
        +'<td style="white-space:nowrap">'+t.date+'</td>'
        +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.description+'">'+t.description+'</td>'
        +'<td><span class="badge '+(t.type==='Deposit'?'b-dep':'b-wit')+'">'+t.type+'</span></td>'
        +'<td style="text-align:right;font-weight:600;white-space:nowrap">'+fmt(t.amount)+'</td>'
        +'<td><span class="badge" style="background:'+(CAT_COLORS[t.category]||'#333')+'22;color:'+(CAT_COLORS[t.category]||'#aaa')+';border:1px solid '+(CAT_COLORS[t.category]||'#333')+'44">'+( t.category||'—')+'</span></td>'
        +'<td style="font-size:11px;color:#8892b0">'+(t.subcategory||'—')+'</td>'
        +'<td><button class="btn btn-sm btn-red" onclick="deleteTxn(\''+t.id+'\')">✕</button></td>'
        +'</tr>';
    });
    html += '</tbody></table></div>';
  } else {
    html += '<div class="empty"><div class="empty-icon">📋</div>No transactions for '+MFULL[d.m]+' '+d.y+'.<br>Add manually or <a href="#" onclick="switchTab(\'upload\')" style="color:#4d9fff">upload your bank statement</a>.</div>';
  }
  html += '</div>';
  $('pg-dash-body').innerHTML = html;
  $('new-date').value = new Date().toISOString().split('T')[0];
}

function toggleAddForm() {
  var f = $('add-txn-form');
  f.style.display = f.style.display==='none' ? 'block' : 'none';
}
function updateSubDrop(subId, catId) {
  var cat = $(catId).value, sub = $(subId);
  sub.innerHTML = '<option value="">Select sub-category</option>'
    + (CAT_MAP[cat]||[]).map(function(s){return'<option>'+s+'</option>';}).join('');
}
async function saveTxnRow() {
  var date=$('new-date').value, desc=$('new-desc').value.trim();
  var amount=fmtN($('new-amt').value), type=$('new-type').value;
  var cat=$('new-cat').value, subcat=$('new-subcat').value;
  var msgEl=$('txn-form-msg');
  if(!date||!desc||!amount){setMsg(msgEl,'err','Please fill date, description and amount.');return;}
  if(!cat){setMsg(msgEl,'err','Please select a category.');return;}
  setMsg(msgEl,'info','Saving…');
  var d=getMonthYear();
  await sb.from('transactions').insert({user_id:currentUser.id,date:date,description:desc,amount:amount,type:type,category:cat,subcategory:subcat,month:d.m,year:d.y});
  renderTxn();
}
async function deleteTxn(id) {
  if(!confirm('Delete this transaction?'))return;
  await sb.from('transactions').delete().eq('id',id);
  renderTxn();
}

// ── TAB 2: MONTHLY SUMMARY ──
async function renderSummary() {
  var d=getMonthYear();
  showLoading('Loading summary…');
  var txns=await getTxns();
  if(!txns.length){$('pg-dash-body').innerHTML='<div class="section"><div class="empty"><div class="empty-icon">📊</div>No transactions for '+MFULL[d.m]+' '+d.y+'.</div></div>';return;}
  var income=0,expenses=0,assetsIn=0,assetsOut=0,liabIn=0,liabOut=0;
  var expSubs={},incSubs={},astSubs={};
  txns.forEach(function(t){
    var amt=parseFloat(t.amount),sub=t.subcategory||'Other';
    if(t.category==='Income'){income+=amt;incSubs[sub]=(incSubs[sub]||0)+amt;}
    if(t.category==='Expenses'){expenses+=amt;expSubs[sub]=(expSubs[sub]||0)+amt;}
    if(t.category==='Assets'){if(t.type==='Withdrawal'){assetsIn+=amt;astSubs[sub]=(astSubs[sub]||0)+amt;}else assetsOut+=amt;}
    if(t.category==='Liabilities'){if(t.type==='Deposit')liabIn+=amt;else liabOut+=amt;}
  });
  var netAst=assetsIn-assetsOut,netLib=liabIn-liabOut;
  var surplus=Math.max(0,income-expenses-netAst);
  // Fix 1: savings rate never negative
  var savRate=income>0?Math.round(Math.max(0,income-expenses)/income*100):0;
  var expArr=Object.entries(expSubs).sort(function(a,b){return b[1]-a[1];});
  var incArr=Object.entries(incSubs).sort(function(a,b){return b[1]-a[1];});
  var astArr=Object.entries(astSubs).sort(function(a,b){return b[1]-a[1];});
  // Fix: savings for suggestion never negative
  var savingsForSuggestion = Math.max(0, income - expenses);
  var sug1=savingsForSuggestion*.6, sug2=savingsForSuggestion*.3, sug3=savingsForSuggestion*.2;

  var html='<div class="section"><div class="sec-title">Overview — '+MFULL[d.m]+' '+d.y+'</div>'
    +'<div class="grid3" style="margin-bottom:1rem">'
    +'<div class="metric"><div class="lbl">Total income</div><div class="val" style="color:#00d4a0">'+fmt(income)+'</div></div>'
    +'<div class="metric"><div class="lbl">Total expenses</div><div class="val" style="color:#ff6b6b">'+fmt(expenses)+'</div></div>'
    +'<div class="metric"><div class="lbl">Savings rate</div><div class="val">'+savRate+'%</div></div>'
    +'</div><div style="display:flex;justify-content:space-between;font-size:12px;color:#8892b0;margin-bottom:4px"><span>Savings rate</span><span style="color:#00d4a0;font-weight:600">'+savRate+'%</span></div>'
    +'<div class="bar-wrap"><div class="bar" style="width:'+Math.min(Math.max(savRate,0),100)+'%"></div></div></div>'
    +'<div class="section"><div class="sec-title">How your income was used</div>'
    +'<div style="position:relative;height:220px;margin-bottom:1rem"><canvas id="income-donut"></canvas></div>'
    +'<div class="legend" style="justify-content:center">'
    +'<span><span class="leg-dot" style="background:#ff6b6b"></span>Expenses: '+fmt(expenses)+'</span>'
    +'<span><span class="leg-dot" style="background:#4d9fff"></span>Invested: '+fmt(netAst)+'</span>'
    +'<span><span class="leg-dot" style="background:#00d4a0"></span>Surplus: '+fmt(surplus)+'</span>'
    +'</div></div>';

  if(expArr.length){
    html+='<div class="section"><div class="sec-title">Expenses breakdown</div>';
    expArr.forEach(function(e){html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)"><span>'+e[0]+'</span><div style="text-align:right"><div style="font-size:13px;font-weight:600">'+fmt(e[1])+'</div><div style="font-size:11px;color:#8892b0">'+(expenses>0?Math.round(e[1]/expenses*100):0)+'%</div></div></div>';});
    html+='</div>';
  }
  if(incArr.length){
    html+='<div class="section"><div class="sec-title">Income breakdown</div>';
    incArr.forEach(function(e){html+='<div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)"><span>'+e[0]+'</span><span style="color:#00d4a0;font-weight:600">'+fmt(e[1])+'</span></div>';});
    html+='</div>';
  }
  html+='<div class="section"><div class="sec-title">Suggested investment split</div>'
    +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem">Based on savings of <b style="color:#4d9fff">'+fmt(income-expenses)+'</b></p>';
  [['Flexi cap / Index fund','Long-term wealth','#4d9fff',sug1,60],['Liquid assets / fund','Emergency & short-term','#a78bfa',sug2,30],['Life & health insurance','Protection','#00d4a0',sug3,20]].forEach(function(r){
    html+='<div class="inv-row"><div><div class="ir-name">'+r[0]+'</div><div class="ir-desc">'+r[1]+'</div></div><div><div class="ir-amt" style="color:'+r[2]+'">'+fmt(r[3])+'</div><div class="ir-pct">'+r[4]+'% of savings</div></div></div>';
  });
  html+='</div>';
  $('pg-dash-body').innerHTML=html;

  var ctx=$('income-donut');
  if(ctx){
    var data=[expenses,Math.max(0,netAst),surplus];
    var tot=data.reduce(function(a,b){return a+b;},0);
    charts['summary']=new Chart(ctx,{type:'doughnut',data:{labels:['Expenses','Invested','Surplus'],datasets:[{data:tot>0?data:[1,1,1],backgroundColor:['#ff6b6b','#4d9fff','#00d4a0'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return tot>0?' '+fmt(c.parsed):' No data';}}}}}});
  }
}

// ── TAB 3: NET WORTH ──
async function renderNetWorth() {
  showLoading('Loading net worth…');
  var ob=await getOpeningBalances(), at=await getAllTxns();
  var nw=calcNetWorth(ob,at);
  var d=getMonthYear();
  var mTxns=at.filter(function(t){return t.month===d.m&&t.year===d.y;});
  var mAI=0,mAO=0,mLI=0,mLO=0;
  mTxns.forEach(function(t){
    var amt=parseFloat(t.amount);
    if(t.category==='Assets'){t.type==='Withdrawal'?mAI+=amt:mAO+=amt;}
    if(t.category==='Liabilities'){t.type==='Deposit'?mLI+=amt:mLO+=amt;}
  });
  var html='<div class="section"><div class="sec-title">Net worth summary</div>'
    +'<div style="text-align:center;padding:1.5rem 0 1rem">'
    +'<div style="font-size:12px;color:#8892b0;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Total net worth</div>'
    +'<div style="font-size:36px;font-weight:700;color:'+(nw.netWorth>=0?'#00d4a0':'#ff6b6b')+'">'+fmt(Math.abs(nw.netWorth))+'</div>'
    +'<div style="font-size:13px;color:#8892b0;margin-top:.4rem">'+(nw.netWorth>=0?'Positive net worth 🎉':'Net liability position')+'</div>'
    +'</div><div class="grid3">'
    +'<div class="metric"><div class="lbl">Total assets</div><div class="val" style="color:#4d9fff">'+fmt(nw.totalAssets)+'</div></div>'
    +'<div class="metric"><div class="lbl">Total liabilities</div><div class="val" style="color:#a78bfa">'+fmt(nw.totalLiabilities)+'</div></div>'
    +'<div class="metric"><div class="lbl">Net worth</div><div class="val" style="color:'+(nw.netWorth>=0?'#00d4a0':'#ff6b6b')+'">'+fmt(nw.netWorth)+'</div></div>'
    +'</div></div>'
    +'<div class="section"><div class="sec-title">Changes this month — '+MFULL[d.m]+' '+d.y+'</div><div class="grid3">'
    +'<div class="metric"><div class="lbl">Assets invested</div><div class="val" style="color:#4d9fff">+'+fmt(mAI)+'</div></div>'
    +'<div class="metric"><div class="lbl">Assets redeemed</div><div class="val" style="color:#ff6b6b">-'+fmt(mAO)+'</div></div>'
    +'<div class="metric"><div class="lbl">Net asset change</div><div class="val" style="color:'+(mAI-mAO>=0?'#00d4a0':'#ff6b6b')+'">'+(mAI-mAO>=0?'+':'')+fmt(mAI-mAO)+'</div></div>'
    +'<div class="metric"><div class="lbl">Loans taken</div><div class="val" style="color:#a78bfa">+'+fmt(mLI)+'</div></div>'
    +'<div class="metric"><div class="lbl">Loans repaid</div><div class="val" style="color:#00d4a0">-'+fmt(mLO)+'</div></div>'
    +'<div class="metric"><div class="lbl">Net liab change</div><div class="val" style="color:'+(mLI-mLO<=0?'#00d4a0':'#ff6b6b')+'">'+(mLI-mLO>0?'+':'')+fmt(mLI-mLO)+'</div></div>'
    +'</div></div>'
    +'<div class="section"><div class="sec-title"><span>Opening balances</span><button class="btn btn-green btn-sm" onclick="showOBForm()">+ Add balance</button></div>'
    +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem">Add existing assets and liabilities you had before using this app.</p>'
    +'<div id="ob-form" style="display:none;background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:12px;padding:1rem;margin-bottom:1rem">'
    +'<div class="grid2" style="gap:8px;margin-bottom:8px">'
    +'<div class="field"><label>Name</label><input type="text" id="ob-name" placeholder="e.g. HDFC Mutual Fund"></div>'
    +'<div class="field"><label>Category</label><select id="ob-cat" onchange="updateSubDrop(\'ob-subcat\',\'ob-cat\')"><option value="">Select</option><option value="Assets">Assets</option><option value="Liabilities">Liabilities</option></select></div>'
    +'<div class="field"><label>Sub-category</label><select id="ob-subcat"><option value="">Select sub-category</option></select></div>'
    +'<div class="field"><label>Amount (₹)</label><input type="number" id="ob-amount" placeholder="0"></div>'
    +'<div class="field"><label>As of date</label><input type="date" id="ob-date"></div>'
    +'</div><div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn btn-sm" onclick="$(\'ob-form\').style.display=\'none\'">Cancel</button>'
    +'<button class="btn btn-green btn-sm" onclick="saveOB()">Save</button>'
    +'</div><div class="msg" id="ob-msg"></div></div>';
  if(ob.length){
    html+='<div class="tbl-wrap"><table class="data-tbl"><thead><tr><th>Name</th><th>Category</th><th>Sub-category</th><th>Amount</th><th>As of</th><th></th></tr></thead><tbody>';
    ob.forEach(function(b){
      html+='<tr><td style="font-weight:500">'+b.name+'</td>'
        +'<td><span class="badge" style="background:'+(CAT_COLORS[b.category]||'#333')+'22;color:'+(CAT_COLORS[b.category]||'#aaa')+';border:1px solid '+(CAT_COLORS[b.category]||'#333')+'44">'+b.category+'</span></td>'
        +'<td style="font-size:11px;color:#8892b0">'+(b.subcategory||'—')+'</td>'
        +'<td style="font-weight:600;color:'+(b.category==='Assets'?'#4d9fff':'#a78bfa')+'">'+fmt(b.amount)+'</td>'
        +'<td style="font-size:11px;color:#8892b0">'+(b.as_of_date||'—')+'</td>'
        +'<td><button class="btn btn-sm btn-red" onclick="deleteOB(\''+b.id+'\')">✕</button></td></tr>';
    });
    html+='</tbody></table></div>';
  } else {
    html+='<div class="empty" style="padding:1.5rem"><div class="empty-icon" style="font-size:24px">🏦</div>No opening balances added yet.</div>';
  }
  html+='</div>';
  $('pg-dash-body').innerHTML=html;
}

function showOBForm(){$('ob-form').style.display='block';$('ob-date').value=new Date().toISOString().split('T')[0];}
async function saveOB(){
  var name=$('ob-name').value.trim(),cat=$('ob-cat').value;
  var subcat=$('ob-subcat').value,amount=fmtN($('ob-amount').value),date=$('ob-date').value;
  var msgEl=$('ob-msg');
  if(!name||!cat||!amount){setMsg(msgEl,'err','Please fill name, category and amount.');return;}
  await sb.from('opening_balances').insert({user_id:currentUser.id,name:name,category:cat,subcategory:subcat,amount:amount,as_of_date:date});
  renderNetWorth();
}
async function deleteOB(id){
  if(!confirm('Delete?'))return;
  await sb.from('opening_balances').delete().eq('id',id);
  renderNetWorth();
}

// ── TAB 4: ANNUAL ANALYSIS ──
async function renderAnnual() {
  var d=getMonthYear();
  showLoading('Loading annual data…');
  var res=await sb.from('transactions').select('*').eq('user_id',currentUser.id).eq('year',d.y);
  var all=res.data||[];
  if(!all.length){$('pg-dash-body').innerHTML='<div class="section"><div class="empty"><div class="empty-icon">📈</div>No data for '+d.y+' yet.</div></div>';return;}
  var entries=[];
  for(var m=0;m<12;m++){
    var txns=all.filter(function(t){return t.month===m;});
    if(!txns.length)continue;
    var inc=0,exp=0,ast=0;
    txns.forEach(function(t){
      var amt=parseFloat(t.amount);
      if(t.category==='Income')inc+=amt;
      if(t.category==='Expenses')exp+=amt;
      if(t.category==='Assets'&&t.type==='Withdrawal')ast+=amt;
    });
    entries.push({m:m,inc:inc,exp:exp,ast:ast,sav:Math.max(0,inc-exp),cnt:txns.length});
  }
  var sI=entries.reduce(function(a,e){return a+e.inc;},0);
  var sE=entries.reduce(function(a,e){return a+e.exp;},0);
  var sA=entries.reduce(function(a,e){return a+e.ast;},0);
  var sS=entries.reduce(function(a,e){return a+e.sav;},0);
  var avgR=sI>0?Math.round(sS/sI*100):0;
  var best=entries.reduce(function(a,b){return a.sav>b.sav?a:b;});
  var expSubs={};
  all.filter(function(t){return t.category==='Expenses';}).forEach(function(t){var s=t.subcategory||'Other';expSubs[s]=(expSubs[s]||0)+parseFloat(t.amount);});
  var expArr=Object.entries(expSubs).sort(function(a,b){return b[1]-a[1];});

  var html='<div class="section"><div class="sec-title">Saved months — '+d.y+'</div><div class="months-grid">';
  entries.forEach(function(e){
    html+='<div class="mcard" onclick="jumpMonth('+e.m+')">'
      +'<div class="mname">'+MFULL[e.m]+'</div>'
      +'<div class="mrow"><span>Income</span><span style="color:#00d4a0">'+fmt(e.inc)+'</span></div>'
      +'<div class="mrow"><span>Expenses</span><span style="color:#ff6b6b">'+fmt(e.exp)+'</span></div>'
      +'<div class="mrow"><span>Invested</span><span style="color:#4d9fff">'+fmt(e.ast)+'</span></div>'
      +'<div class="mrow"><span>Savings</span><span style="color:'+(e.sav>=0?'#00d4a0':'#ff6b6b')+'">'+fmt(e.sav)+'</span></div>'
      +'<div class="mrow"><span>Txns</span><span>'+e.cnt+'</span></div></div>';
  });
  html+='</div></div><div class="section"><div class="sec-title">Year highlights — '+d.y+'</div><div class="hl-grid">'
    +'<div class="hlcard"><div class="hl">Total income</div><div class="hv" style="color:#00d4a0">'+fmt(sI)+'</div><div class="hs">'+entries.length+' months</div></div>'
    +'<div class="hlcard"><div class="hl">Total expenses</div><div class="hv" style="color:#ff6b6b">'+fmt(sE)+'</div></div>'
    +'<div class="hlcard"><div class="hl">Total invested</div><div class="hv" style="color:#4d9fff">'+fmt(sA)+'</div></div>'
    +'<div class="hlcard"><div class="hl">Total savings</div><div class="hv" style="color:#00d4a0">'+fmt(sS)+'</div></div>'
    +'<div class="hlcard"><div class="hl">Avg savings rate</div><div class="hv">'+avgR+'%</div></div>'
    +'<div class="hlcard"><div class="hl">Best month</div><div class="hv">'+MONTHS[best.m]+'</div><div class="hs">'+fmt(best.sav)+'</div></div>'
    +'</div></div>'
    +'<div class="section"><div class="sec-title">Monthly trend — '+d.y+'</div>'
    +'<div style="position:relative;height:250px"><canvas id="bar-annual"></canvas></div>'
    +'<div class="legend">'
    +'<span><span class="leg-dot" style="background:#00d4a0"></span>Income</span>'
    +'<span><span class="leg-dot" style="background:#ff6b6b"></span>Expenses</span>'
    +'<span><span class="leg-dot" style="background:#4d9fff"></span>Invested</span>'
    +'</div></div>';
  if(expArr.length){
    html+='<div class="section"><div class="sec-title">Annual expenses breakdown</div>';
    expArr.forEach(function(e){html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(99,120,220,0.08)"><span>'+e[0]+'</span><div style="text-align:right"><div style="font-size:13px;font-weight:600">'+fmt(e[1])+'</div><div style="font-size:11px;color:#8892b0">'+(sE>0?Math.round(e[1]/sE*100):0)+'%</div></div></div>';});
    html+='</div>';
  }
  $('pg-dash-body').innerHTML=html;
  charts['annual']=new Chart($('bar-annual'),{type:'bar',data:{labels:entries.map(function(e){return MONTHS[e.m];}),datasets:[
    {label:'Income',data:entries.map(function(e){return e.inc;}),backgroundColor:'rgba(0,212,160,0.7)',borderRadius:4},
    {label:'Expenses',data:entries.map(function(e){return e.exp;}),backgroundColor:'rgba(255,107,107,0.7)',borderRadius:4},
    {label:'Invested',data:entries.map(function(e){return e.ast;}),backgroundColor:'rgba(77,159,255,0.7)',borderRadius:4}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return' '+fmt(c.parsed);}}}},scales:{x:{ticks:{color:'#8892b0',autoSkip:false,maxRotation:0},grid:{color:'rgba(99,120,220,0.08)'}},y:{ticks:{color:'#8892b0',callback:function(v){return fmt(v);}},grid:{color:'rgba(99,120,220,0.08)'}}}}});
}

function jumpMonth(m){$('sel-month').value=m;switchTab('txn');}

// ── TAB 5: MY RULES ──
async function renderRules() {
  showLoading('Loading rules…');
  var rules=await getRules();
  var html='<div class="section"><div class="sec-title">My keyword rules</div>'
    +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">Keywords matched against bank statement descriptions for auto-categorization.</p>'
    +'<div class="field" style="max-width:240px;margin-bottom:1rem"><label>Your bank</label><select id="rules-bank">'
    +['kotak','hdfc','icici','sbi','axis','other'].map(function(b){return'<option value="'+b+'" '+(( currentProfile.bank||'kotak')===b?'selected':'')+'>'+{'kotak':'Kotak Mahindra','hdfc':'HDFC Bank','icici':'ICICI Bank','sbi':'State Bank (SBI)','axis':'Axis Bank','other':'Other Bank'}[b]+'</option>';}).join('')
    +'</select></div>'
    +'<div style="overflow-x:auto"><table class="rules-tbl"><thead><tr>'
    +'<th style="width:36%">Keyword</th><th style="width:22%">Category</th><th style="width:28%">Sub-category</th><th style="width:14%"></th>'
    +'</tr></thead><tbody id="rules-body"></tbody></table></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem">'
    +'<button class="btn btn-sm" onclick="addRuleRow()">+ Add row</button>'
    +'<button class="btn btn-green" onclick="saveRules()">Save rules</button>'
    +'</div><div class="msg" id="rules-msg"></div></div>';
  $('pg-dash-body').innerHTML=html;
  var tbody=$('rules-body');
  if(!rules.length){addRuleRow();return;}
  rules.forEach(function(r){addRuleRow(r.keyword,r.category,r.subcategory);});
}

function addRuleRow(kw,cat,subcat){
  kw=kw||'';cat=cat||'';subcat=subcat||'';
  var tbody=$('rules-body'),tr=document.createElement('tr');
  var subOpts=cat&&CAT_MAP[cat]?CAT_MAP[cat].map(function(s){return'<option '+(s===subcat?'selected':'')+'>'+s+'</option>';}).join(''):'';
  tr.innerHTML='<td><input type="text" placeholder="e.g. SWIGGY, SALARY" value="'+kw+'" style="text-transform:uppercase"></td>'
    +'<td><select onchange="updateSubInRow(this)"><option value="">Select</option>'
    +Object.keys(CAT_MAP).map(function(c){return'<option '+(c===cat?'selected':'')+'>'+c+'</option>';}).join('')
    +'</select></td>'
    +'<td><select><option value="">Select sub-category</option>'+subOpts+'</select></td>'
    +'<td><button class="btn btn-sm btn-red" onclick="this.closest(\'tr\').remove()">✕</button></td>';
  tbody.appendChild(tr);
}
function updateSubInRow(sel){
  var cat=sel.value,subSel=sel.closest('tr').cells[2].querySelector('select');
  subSel.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(function(s){return'<option>'+s+'</option>';}).join('');
}
async function saveRules(){
  var rows=[].slice.call($('rules-body').querySelectorAll('tr'));
  var rules=rows.map(function(tr){return{keyword:tr.cells[0].querySelector('input').value.trim().toUpperCase(),cat:tr.cells[1].querySelector('select').value,subcat:tr.cells[2].querySelector('select').value};}).filter(function(r){return r.keyword&&r.cat;});
  await sb.from('profiles').update({bank:$('rules-bank').value}).eq('id',currentUser.id);
  await saveRulesToDB(rules);
  setMsg($('rules-msg'),'ok',rules.length+' rules saved!');
}

// ── TAB 6: UPLOAD ──
function renderUpload(){
  $('pg-dash-body').innerHTML='<div class="section"><div class="sec-title">Upload bank statement</div>'
    +'<p style="font-size:12px;color:#8892b0;margin-bottom:1.25rem;line-height:1.7">Upload your bank statement — PDF, CSV or Excel.</p>'
    +'<div style="display:flex;gap:8px;margin-bottom:1.25rem">'
    +'<button class="btn" id="fmt-pdf" style="border-color:#4d9fff;color:#4d9fff" onclick="setFmt(\'pdf\')">📄 PDF</button>'
    +'<button class="btn" id="fmt-csv" onclick="setFmt(\'csv\')">📊 CSV</button>'
    +'<button class="btn" id="fmt-excel" onclick="setFmt(\'excel\')">📗 Excel</button>'
    +'</div>'
    +'<div id="up-pdf"><div class="info-box"><b>How to get PDF:</b> Bank app → Statements → Download PDF</div>'
    +'<div class="upload-zone" id="zone-pdf"><div class="u-ico">📄</div><p>Click to select <b>PDF statement</b></p></div>'
    +'<input type="file" id="file-pdf" accept=".pdf" style="display:none"></div>'
    +'<div id="up-csv" style="display:none"><div class="info-box"><b>How to get CSV:</b> Kotak net banking → Account Statement → Download CSV</div>'
    +'<div class="upload-zone" id="zone-csv"><div class="u-ico">📊</div><p>Click to select <b>CSV statement</b></p></div>'
    +'<input type="file" id="file-csv" accept=".csv" style="display:none"></div>'
    +'<div id="up-excel" style="display:none"><div class="info-box"><b>How to get Excel:</b> Kotak net banking → Account Statement → Download Excel</div>'
    +'<div class="upload-zone" id="zone-excel"><div class="u-ico">📗</div><p>Click to select <b>Excel statement</b></p></div>'
    +'<input type="file" id="file-excel" accept=".xlsx,.xls" style="display:none"></div>'
    +'<div class="msg" id="upload-msg" style="margin-top:.75rem;font-size:13px"></div></div>'
    +'<div id="confirm-sec" style="display:none"><div class="section">'
    +'<div class="sec-title"><span>Review transactions</span><span id="txn-count" style="font-size:12px;color:#8892b0;font-weight:400"></span></div>'
    +'<p style="font-size:12px;color:#8892b0;margin-bottom:.85rem"><span style="color:#ff6b6b">■</span> Orange rows = unmatched — please select a category.</p>'
    +'<div class="tbl-wrap"><table class="data-tbl"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Category</th><th>Sub-category</th></tr></thead>'
    +'<tbody id="confirm-body"></tbody></table></div>'
    +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:1rem">'
    +'<button class="btn" onclick="switchTab(\'upload\')">Cancel</button>'
    +'<button class="btn btn-green" onclick="doImport()">Confirm &amp; import</button>'
    +'</div></div></div>';

  // attach handlers using addEventListener — works with and without modules
  document.getElementById('zone-pdf').addEventListener('click',function(){document.getElementById('file-pdf').click();});
  document.getElementById('zone-csv').addEventListener('click',function(){document.getElementById('file-csv').click();});
  document.getElementById('zone-excel').addEventListener('click',function(){document.getElementById('file-excel').click();});
  document.getElementById('file-pdf').addEventListener('change',handlePDF);
  document.getElementById('file-csv').addEventListener('change',handleCSV);
  document.getElementById('file-excel').addEventListener('change',handleExcel);
}

function setFmt(f){
  ['pdf','csv','excel'].forEach(function(x){
    var d=$('up-'+x),b=$('fmt-'+x);
    if(d)d.style.display=x===f?'block':'none';
    if(b){b.style.borderColor=x===f?'#4d9fff':'';b.style.color=x===f?'#4d9fff':'';}
  });
}

// ── PDF HANDLER ──
async function handlePDF(e){
  var file=e.target.files[0];if(!file)return;
  var msgEl=$('upload-msg');setMsg(msgEl,'info','📖 Reading PDF…');
  try{
    var buf=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:buf}).promise;
    var items=[];
    for(var p=1;p<=pdf.numPages;p++){
      var page=await pdf.getPage(p),tc=await page.getTextContent(),vp=page.getViewport({scale:1});
      tc.items.forEach(function(it){var s=it.str.trim();if(!s)return;items.push({str:s,x:Math.round(it.transform[4]),y:Math.round(vp.height-it.transform[5])});});
    }
    var rules=await getRules(),txns=parsePDF(items,rules);
    if(!txns.length){setMsg(msgEl,'err','No transactions found in PDF.');return;}
    setMsg(msgEl,'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns;showConfirm(txns);
  }catch(err){setMsg(msgEl,'err','Error: '+err.message);}
}

// ── CSV HANDLER ──
async function handleCSV(e) {
  var file=e.target.files[0]; if(!file)return;
  var msgEl=$('upload-msg'); setMsg(msgEl,'info','📊 Reading CSV…');
  try {
    var text  = await file.text();
    var rules = await getRules();
    var result = parseCSV(text, rules);
    var txns   = result.txns;
    var closingBal = result.closingBalance;
    if (!txns.length) { setMsg(msgEl,'err','No transactions found in CSV.'); return; }
    setMsg(msgEl,'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns = txns;

    // Fix 4: Show bank balance confirmation if closing balance found
    if (closingBal > 0) {
      var d = getMonthYear();
      var balHtml = '<div style="background:#0c2a1a;border:1px solid #1D9E75;border-radius:8px;padding:.85rem 1rem;margin-top:.75rem;font-size:13px;color:#e8eaf0">'
        +'<b style="color:#00d4a0">Bank balance detected: '+fmt(closingBal)+'</b><br>'
        +'<span style="font-size:12px;color:#8892b0">This is your closing balance for '+MFULL[d.m]+' '+d.y+'. Would you like to save it as a bank asset?</span><br>'
        +'<div style="display:flex;gap:8px;margin-top:.6rem">'
        +'<button class="btn btn-green btn-sm" onclick="saveBankBalance('+closingBal+')">Yes, save bank balance</button>'
        +'<button class="btn btn-sm" onclick="this.parentElement.parentElement.remove()">Skip</button>'
        +'</div></div>';
      $('upload-msg').insertAdjacentHTML('afterend', balHtml);
    }
    showConfirm(txns);
  } catch(err) { setMsg(msgEl,'err','Error: '+err.message); }
}

// ── EXCEL HANDLER ──
async function handleExcel(e){
  var file=e.target.files[0];if(!file)return;
  var msgEl=$('upload-msg');setMsg(msgEl,'info','📗 Reading Excel…');
  try{
    var buf=await file.arrayBuffer();
    var wb=XLSX.read(buf,{type:'array'});
    var csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    var rules=await getRules(),txns=parseCSV(csv,rules);
    if(!txns.length){setMsg(msgEl,'err','No transactions found in Excel file.');return;}
    setMsg(msgEl,'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns;showConfirm(txns);
  }catch(err){setMsg(msgEl,'err','Error: '+err.message);}
}

// ── SMART KEYWORD MATCHING ──
// Fix 6: Better fuzzy matching with spaces
function fuzzyMatch(desc, kw) {
  // normalize: uppercase, replace special chars with space, collapse spaces
  var n = function(s) {
    return s.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  return n(desc).includes(n(kw));
}

// Fix 3: Smart category application based on transaction type
function applyRule(rule, type) {
  var cat = rule.category, sub = rule.subcategory;
  // Income rules only apply to Deposits
  if (cat === 'Income' && type !== 'Deposit')     return null;
  // Expense rules only apply to Withdrawals
  if (cat === 'Expenses' && type !== 'Withdrawal') return null;
  // Assets and Liabilities apply to both types
  return { cat: cat, subcat: sub };
}

// ── KOTAK CSV PARSER ──
function parseCSV(text, rules) {
  var lines = text.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
  var hIdx = -1;
  for (var i=0; i<lines.length; i++) {
    var cols = splitCSV(lines[i]);
    if (cols[0] && cols[0].toLowerCase().replace(/[^a-z]/g,'').includes('sl')) { hIdx=i; break; }
  }
  if (hIdx===-1) return { txns:[], closingBalance:0 };

  function parseDate(d) {
    d = d.trim().split(' ')[0];
    var m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(d);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    return d;
  }
  function cleanAmt(s) { return parseFloat((s||'').replace(/[,₹"\s]/g,''))||0; }

  var txns = [], seen = new Set();
  for (var i=hIdx+1; i<lines.length; i++) {
    var cols = splitCSV(lines[i]);
    if (!cols[0] || isNaN(parseInt(cols[0]))) continue;
    var date  = parseDate(cols[1]||'');
    var desc  = (cols[3]||'').trim();
    var amt   = cleanAmt(cols[5]);
    var drcr  = (cols[6]||'').trim().toUpperCase();
    var bal   = cleanAmt(cols[7]||'0'); // Fix 4: read balance column

    if (!date||!desc||!amt) continue;
    var type = drcr==='CR' ? 'Deposit' : 'Withdrawal';
    var key  = date+'|'+amt+'|'+type+'|'+desc.slice(0,10);
    if (seen.has(key)) continue; seen.add(key);

    // Fix 3 & 5 & 6: smart keyword matching with type awareness
    var cat='', subcat='';
    for (var j=0; j<rules.length; j++) {
      if (rules[j].keyword && fuzzyMatch(desc, rules[j].keyword)) {
        var applied = applyRule(rules[j], type);
        if (applied) { cat=applied.cat; subcat=applied.subcat; break; }
      }
    }
    // Fix 2 & 5: NO default category — leave blank if no keyword matched
    // User must manually select in review screen

    // Fix 4: track last balance
    if (bal > 0) lastBalance = bal;

    txns.push({ date:date, desc:desc, amount:amt, type:type, cat:cat, subcat:subcat });
  }

  return {
    txns: txns.sort(function(a,b){return a.date.localeCompare(b.date);}),
    closingBalance: lastBalance
  };
}

function splitCSV(line){
  var result=[],cur='',inQ=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(c==='"'){inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else cur+=c;
  }
  result.push(cur.trim());
  return result;
}

// ── PDF PARSER (Kotak) ──
function parsePDF(items,rules){
  items.sort(function(a,b){return a.y-b.y||a.x-b.x;});
  var lines=[];
  items.forEach(function(it){
    var l=lines.find(function(x){return Math.abs(x.y-it.y)<=6;});
    if(l)l.items.push(it);else lines.push({y:it.y,items:[it]});
  });
  lines.forEach(function(l){l.items.sort(function(a,b){return a.x-b.x;});});
  var cX={date:90,desc:160,ref:370,wd:490,dep:590,bal:680};
  var hLine=lines.find(function(l){return l.items.some(function(i){return i.str.trim()==='Date';})&&l.items.some(function(i){return i.str.trim().includes('Description');});});
  if(hLine){hLine.items.forEach(function(it){var s=it.str.trim();if(s==='Date')cX.date=it.x;else if(s.includes('Description'))cX.desc=it.x;else if(s.includes('Withdrawal')||s.includes('Dr'))cX.wd=it.x;else if(s.includes('Deposit')||s.includes('Cr'))cX.dep=it.x;else if(s==='Balance')cX.bal=it.x;else if(s.includes('Chq')||s.includes('Ref'))cX.ref=it.x;});}
  var inD=function(x){return x>=cX.desc-10&&x<cX.ref-5;};
  var inW=function(x){return x>=cX.wd-10&&x<cX.dep-5;};
  var inDp=function(x){return x>=cX.dep-5&&x<cX.bal-5;};
  var aRe=/^[\d,]+\.\d{2}$/,dtRe=/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,srRe=/^\d{1,3}$/;
  var mM={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  var isA=function(s){return aRe.test(s.replace(/,/g,''));};
  var toA=function(s){return parseFloat(s.replace(/,/g,''));};
  var txns=[],cur=null;
  lines.forEach(function(line){
    var dI=line.items.find(function(it){return dtRe.test(it.str.trim())&&it.x>=cX.date-30&&it.x<=cX.date+80;});
    if(dI){
      if(cur&&cur.desc.length>1&&cur.amount>0)txns.push(cur);
      var wI=line.items.find(function(it){return isA(it.str)&&inW(it.x);});
      var dpI=line.items.find(function(it){return isA(it.str)&&inDp(it.x);});
      var dItems=line.items.filter(function(it){return inD(it.x)&&!isA(it.str)&&!dtRe.test(it.str.trim())&&!srRe.test(it.str.trim());});
      var dp=dI.str.trim().split(/\s+/);
      var ds=dp.length===3?dp[2]+'-'+(mM[dp[1].toLowerCase()]||'01')+'-'+dp[0].padStart(2,'0'):dI.str.trim();
      var wd=wI?toA(wI.str):0,dep=dpI?toA(dpI.str):0;
      cur={date:ds,desc:dItems.map(function(i){return i.str;}).join(' ').trim(),amount:wd>0?wd:dep,type:wd>0?'Withdrawal':'Deposit'};
    }else if(cur){
      var lt=line.items.map(function(i){return i.str;}).join(' ').toLowerCase();
      if(lt.includes('value date')||lt.includes('page ')||lt.includes('statement generated')||lt.includes('opening balance'))return;
      var cI=line.items.filter(function(it){return it.x>=cX.desc-20&&it.x<cX.ref+30&&!isA(it.str)&&!dtRe.test(it.str.trim())&&it.str.trim().length>1;});
      if(cI.length){var ex=cI.map(function(i){return i.str;}).join(' ').trim();if(ex&&!/^\d+$/.test(ex))cur.desc+=' '+ex;}
    }
  });
  if(cur&&cur.desc.length>1&&cur.amount>0)txns.push(cur);
  function fuzzy(desc,kw){var n=function(s){return s.toUpperCase().replace(/[^A-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();};return n(desc).includes(n(kw));}
  var seen=new Set();
  return txns.filter(function(t){return t.amount>0&&t.desc.length>1;}).map(function(t){
    var key=t.date+'|'+t.amount+'|'+t.type;if(seen.has(key))return null;seen.add(key);
    var cat='',subcat='';
    for(var j=0;j<rules.length;j++){
      if(rules[j].keyword&&fuzzyMatch(t.desc,rules[j].keyword)){
        var applied=applyRule(rules[j],t.type);
        if(applied){cat=applied.cat;subcat=applied.subcat;break;}
      }
    }
    // Fix 2 & 5: No default — leave blank if no keyword matched
    return{date:t.date,desc:t.desc.trim(),amount:t.amount,type:t.type,cat:cat,subcat:subcat};
  }).filter(Boolean).sort(function(a,b){return a.date.localeCompare(b.date);});
}

// ── CONFIRM TABLE ──
function showConfirm(txns){
  $('txn-count').textContent=txns.length+' transactions';
  var html='';
  txns.forEach(function(t,i){
    var um=!t.cat;
    var cO='<option value="">Select</option>'+Object.keys(CAT_MAP).map(function(c){return'<option value="'+c+'" '+(c===t.cat?'selected':'')+'>'+c+'</option>';}).join('');
    var sO='<option value="">Select sub-category</option>'+(t.cat&&CAT_MAP[t.cat]?CAT_MAP[t.cat].map(function(s){return'<option '+(s===t.subcat?'selected':'')+'>'+s+'</option>';}).join(''):'');
    html+='<tr class="'+(um?'unmatched':'')+'" id="ct-'+i+'">'
      +'<td style="white-space:nowrap">'+t.date+'</td>'
      +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.desc+'">'+t.desc+'</td>'
      +'<td><span class="badge '+(t.type==='Deposit'?'b-dep':'b-wit')+'">'+t.type+'</span></td>'
      +'<td style="text-align:right;font-weight:600;white-space:nowrap">'+fmt(t.amount)+'</td>'
      +'<td><select onchange="updCat('+i+',this.value)">'+cO+'</select></td>'
      +'<td><select id="cs-'+i+'" onchange="pendingTxns['+i+'].subcat=this.value">'+sO+'</select></td>'
      +'</tr>';
  });
  $('confirm-body').innerHTML=html;
  $('confirm-sec').style.display='block';
}

function updCat(i,cat){
  pendingTxns[i].cat=cat;pendingTxns[i].subcat='';
  var s=$('cs-'+i);
  s.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(function(x){return'<option>'+x+'</option>';}).join('');
  s.onchange=function(){pendingTxns[i].subcat=s.value;};
}

async function doImport(){
  var d=getMonthYear();
  var toAdd=pendingTxns.filter(function(t){return t.cat;});
  if(!toAdd.length){alert('Please select categories first.');return;}
  var res=await sb.from('transactions').insert(toAdd.map(function(t){return{user_id:currentUser.id,date:t.date,description:t.desc,amount:t.amount,type:t.type,category:t.cat,subcategory:t.subcat,month:d.m,year:d.y};}));
  if(res.error){alert('Import failed: '+res.error.message);return;}
  switchTab('txn');
}

// ── MONTH/YEAR CHANGE ──
document.addEventListener('change',function(e){
  if(!currentUser)return;
  if(e.target.id==='sel-month'||e.target.id==='sel-year'){
    var a=document.querySelector('.tab.active');
    if(!a)return;
    var id=a.id;
    if(id==='tab-txn')renderTxn();
    else if(id==='tab-summary')renderSummary();
    else if(id==='tab-networth')renderNetWorth();
    else if(id==='tab-annual')renderAnnual();
  }
});
