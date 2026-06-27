// ═══════════════════════════════════════════
//  MY FINANCE TRACKER — app.js
//  Firebase Auth + Supabase Database
// ═══════════════════════════════════════════

// ── FIREBASE ──
const firebaseConfig = {
  apiKey: "AIzaSyBUSr0WH95KcDURGvEhlTkm8VntwDzOYfI",
  authDomain: "my-finance-tracker-6a51a.firebaseapp.com",
  projectId: "my-finance-tracker-6a51a",
  storageBucket: "my-finance-tracker-6a51a.firebasestorage.app",
  messagingSenderId: "190800540862",
  appId: "1:190800540862:web:a83425381020bb66fbdaef"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();

// ── SUPABASE ──
var sb = window.supabase.createClient(
  'https://ktbugezdzcrpuzrfnsbq.supabase.co',
  'sb_publishable_iOfsjV23yTBSeaziqfaZDw_rF-Xiz3M'
);

// ── PDF.JS ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── CONSTANTS ──
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MFULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var CAT_MAP = {
  'Income'     : ['Salary','Freelance','Rental Income','Business Income','Interest / Dividend','Other Income'],
  'Expenses'   : ['Food & Dining','Travel & Petrol','Rent / PG','Fashion & Shopping','Sent to Home','Insurance Premium','Entertainment','Medical','Utilities & Bills','Other Expenses'],
  'Assets'     : ['Mutual Fund / SIP','Stocks & Equity','Gold','Fixed Deposit','Real Estate','Other Investment'],
  'Liabilities': ['Home Loan EMI','Car Loan EMI','Personal Loan EMI','Credit Card Payment','Other Liability']
};
var CAT_COLORS = { Income:'#00d4a0', Expenses:'#ff6b6b', Assets:'#4d9fff', Liabilities:'#a78bfa' };

// ── STATE ──
var currentUser    = null;
var currentProfile = null;
var charts         = {};
var pendingTxns    = [];
// default month/year — always available even before dropdowns render
var _curMonth = new Date().getMonth();
var _curYear  = new Date().getFullYear();

// ── UTILS ──
function $(id) { return document.getElementById(id); }
function fmt(v) { return '₹' + Math.round(v).toLocaleString('en-IN'); }
function fmtN(v) { return parseFloat(v) || 0; }

function setMsg(el, type, text) {
  if (!el) return;
  el.className = 'msg msg-' + (type==='ok'?'ok':type==='err'?'err':'info');
  el.textContent = text;
}

function showPage(id) {
  ['pg-home','pg-dash','pg-demo'].forEach(function(p) { $(p).classList.add('hide'); });
  $(id).classList.remove('hide');
}

function clearCharts() {
  Object.keys(charts).forEach(function(k) { try { charts[k].destroy(); } catch(e){} });
  charts = {};
}

function showLoading(msg) {
  var body = $('pg-dash-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:32px;margin-bottom:1rem">⏳</div><div style="font-size:14px;color:#8892b0">'+(msg||'Loading…')+'</div></div>';
}

// ── MONTH/YEAR HELPERS ──
function getMonthYear() {
  var selM = $('sel-month');
  var selY = $('sel-year');
  if (selM && selM.value !== '') _curMonth = parseInt(selM.value);
  if (selY && selY.value !== '') _curYear  = parseInt(selY.value);
  return { m: _curMonth, y: _curYear };
}

function getMonthYearFromDate(dateStr) {
  var parts = dateStr.split('-');
  if (parts.length === 3) {
    return { m: parseInt(parts[1]) - 1, y: parseInt(parts[0]) };
  }
  return getMonthYear();
}

// month/year selector HTML — shown inside Transactions & Monthly Summary tabs only
function monthYearSelectorHTML() {
  var d = getMonthYear();
  var opts = MFULL.map(function(name, i) {
    return '<option value="'+i+'" '+(i===d.m?'selected':'')+'>'+name+'</option>';
  }).join('');
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem">'
    +'<select id="sel-month" style="background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:8px;padding:5px 8px;font-size:13px;color:#e8eaf0" onchange="onSelChange()">'+ opts +'</select>'
    +'<input type="number" id="sel-year" value="'+d.y+'" min="2020" max="2099" style="width:74px;background:#0a0f1e;border:1px solid rgba(99,120,220,0.15);border-radius:8px;padding:5px 8px;font-size:13px;color:#e8eaf0" onchange="onSelChange()">'
    +'</div>';
}

function onSelChange() {
  var selM = $('sel-month'), selY = $('sel-year');
  if (selM) _curMonth = parseInt(selM.value);
  if (selY) _curYear  = parseInt(selY.value);
  var active = document.querySelector('.tab.active');
  if (!active) return;
  if (active.id === 'tab-txn')     renderTxn();
  if (active.id === 'tab-summary') renderSummary();
}

// ── PANEL ──
function showPanel(t) {
  var lm = $('landing-main'); if(lm) lm.style.display = (t==='none'||t==='')?'block':'none';
  var ao = $('auth-overlay'); if(ao) ao.className = (t==='none'||t==='')?'hide':'';
  if(t==='none'||t==='') return;
  var su = $('panel-signup'); if(su) su.className = t==='signup'?'auth-panel':'auth-panel hide';
  var lo = $('panel-login');  if(lo) lo.className = t==='login'?'auth-panel':'auth-panel hide';
  var fp = $('panel-forgot'); if(fp) fp.className = t==='forgot'?'auth-panel':'auth-panel hide';
}

function forgotPasswordAction() {
  var email = $('inp-forgot-email').value.trim();
  if (!email) { setMsg($('msg-forgot'), 'err', 'Please enter your email address first.'); return; }
  auth.sendPasswordResetEmail(email)
    .then(function() { setMsg($('msg-forgot'), 'ok', 'Password reset email sent! Check your inbox.'); })
    .catch(function(e) { setMsg($('msg-forgot'), 'err', e.message); });
}

// ── AUTH ──
auth.onAuthStateChanged(function(user) {
  if (user) {
    currentUser = { id: user.uid, email: user.email };
    loadProfile();
  } else {
    currentUser = null;
    currentProfile = null;
    showPage('pg-home');
  }
});

// Handle Magic Link sign-in on page load
if (auth.isSignInWithEmailLink(window.location.href)) {
  var email = window.localStorage.getItem('emailForSignIn');
  if (!email) {
    email = window.prompt('Please provide your email for confirmation');
  }
  auth.signInWithEmailLink(email, window.location.href)
    .then(function(result) {
      window.localStorage.removeItem('emailForSignIn');
    })
    .catch(function(error) {
      alert("Error signing in with magic link: " + error.message);
    });
}

function signUp() {
  var name     = $('inp-signup-name').value.trim();
  var email    = $('inp-signup-email').value.trim();
  var password = $('inp-signup-pass').value;
  var confirm  = $('inp-signup-confirm').value;
  var msgEl    = $('msg-signup');
  if (!name)               { setMsg(msgEl,'err','Please enter your full name.'); return; }
  if (!email)              { setMsg(msgEl,'err','Please enter your email.'); return; }
  if (password.length < 6) { setMsg(msgEl,'err','Password must be at least 6 characters.'); return; }
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

function logIn() {
  var email    = $('inp-login-email').value.trim();
  var password = $('inp-login-pass').value;
  var msgEl    = $('msg-login');
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

function logOut() {
  auth.signOut().then(function() { clearCharts(); showPage('pg-home'); });
}
function goHome() { logOut(); }
function openDemo() { showPage('pg-demo'); }

function loginGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  auth.signInWithPopup(provider)
    .catch(function(e) {
      if (e.code !== 'auth/popup-closed-by-user') alert('Google Sign-In Error: ' + e.message);
    });
}

function forgotPassword() {
  var email = $('inp-login-email').value.trim();
  if (!email) { setMsg($('msg-login'), 'err', 'Please enter your email address first.'); return; }
  auth.sendPasswordResetEmail(email)
    .then(function() { setMsg($('msg-login'), 'ok', 'Password reset email sent! Check your inbox.'); })
    .catch(function(e) { setMsg($('msg-login'), 'err', e.message); });
}

function sendMagicLink() {
  var email = $('inp-login-email').value.trim();
  if (!email) { setMsg($('msg-login'), 'err', 'Please enter your email address first.'); return; }
  var actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
  setMsg($('msg-login'), 'info', 'Sending magic link...');
  auth.sendSignInLinkToEmail(email, actionCodeSettings)
    .then(function() {
      window.localStorage.setItem('emailForSignIn', email);
      setMsg($('msg-login'), 'ok', 'Magic link sent! Please check your email.');
    })
    .catch(function(e) { setMsg($('msg-login'), 'err', e.message); });
}

function loadProfile() {
  sb.from('profiles').select('*').eq('id', currentUser.id).single()
    .then(function(res) {
      if (res.error || !res.data) {
        var name = localStorage.getItem('pendingName');
        if (!name && auth.currentUser && auth.currentUser.displayName) name = auth.currentUser.displayName;
        if (!name) name = currentUser.email.split('@')[0];
        
        localStorage.removeItem('pendingName');
        generateUniqueId().then(function(uid) {
          sb.from('profiles').insert({ id:currentUser.id, name:name, unique_id:uid, bank:'kotak' })
            .then(function() {
              sb.from('profiles').select('*').eq('id', currentUser.id).single()
                .then(function(r) { currentProfile = r.data; enterDash(); });
            });
        });
      } else {
        currentProfile = res.data;
        enterDash();
      }
    })
    .catch(function(e) { console.error('Profile error:', e); auth.signOut(); });
}

function generateUniqueId() {
  return sb.from('profiles').select('unique_id').order('created_at',{ascending:false}).limit(1)
    .then(function(res) {
      if (!res.data || !res.data.length) return '#0001';
      var last = parseInt((res.data[0].unique_id||'#0000').replace('#','')) || 0;
      return '#' + String(last+1).padStart(4,'0');
    });
}

function enterDash() {
  $('dash-badge').innerHTML = '<b>'+currentProfile.name+'</b> &nbsp;'+currentProfile.unique_id;
  if ($('sb-pname')) $('sb-pname').textContent = currentProfile.name;
  if ($('sb-ptier')) $('sb-ptier').textContent = currentProfile.unique_id;
  showPage('pg-dash');
  switchTab('txn');
}

// ── SEARCH ──
var globalSearchTerm = '';
function handleSearch(val) {
  globalSearchTerm = val.toLowerCase().trim();
  if (document.querySelector('.tab.active') && document.querySelector('.tab.active').id === 'tab-txn') {
    renderTxn();
  } else {
    // If not on txn tab, maybe switch to it or just do nothing until they go there.
    // For now we just filter transactions. Let's switch to it if search is active.
    if (globalSearchTerm) switchTab('txn');
  }
}

// ── TABS & SIDEBAR ──
function switchTab(t) {
  var titles = {
    'txn': 'Transactions',
    'snapshot': 'Monthly Snapshot Entry',
    'summary': 'Monthly Summary',
    'networth': 'Net Worth Monitoring',
    'annual': 'Annual Analysis',
    'rules': 'Automation Rules',
    'upload': 'Upload Statement'
  };
  var titleEl = $('page-title');
  if(titleEl) titleEl.textContent = titles[t] || 'Dashboard';

  ['txn','snapshot','summary','networth','annual','rules','upload'].forEach(function(x) {
    var el = $('tab-'+x);
    if (el) el.classList.toggle('active', x===t);
  });
  clearCharts();
  $('pg-dash-body').innerHTML = '';
  if      (t==='txn')      renderTxn();
  else if (t==='snapshot') renderSnapshot();
  else if (t==='summary')  renderSummary();
  else if (t==='networth') renderNetWorth();
  else if (t==='annual')   renderAnnual();
  else if (t==='rules')    renderRules();
  else if (t==='upload')   renderUpload();
  
  if (window.innerWidth <= 600) {
    $('sidebar').classList.remove('show');
  }
}

function toggleSidebar() {
  $('sidebar').classList.toggle('show');
}

function toggleGroup(id) {
  var el = $(id);
  var arr = $('arr-'+id);
  if (el.style.display === 'none') {
    el.style.display = 'flex';
    if(arr.children[0]) arr.children[0].style.transform = 'rotate(0deg)';
  } else {
    el.style.display = 'none';
    if(arr.children[0]) arr.children[0].style.transform = 'rotate(-90deg)';
  }
}

// ── DB HELPERS ──
function getTxns() {
  var d = getMonthYear();
  return sb.from('transactions').select('*')
    .eq('user_id',currentUser.id).eq('month',d.m).eq('year',d.y)
    .order('date',{ascending:true})
    .then(function(r){ return r.data||[]; });
}
function getAllTxns() {
  return sb.from('transactions').select('*')
    .eq('user_id',currentUser.id).order('date',{ascending:true})
    .then(function(r){ return r.data||[]; });
}
function getMonthlySnapshots() {
  var d = getMonthYear();
  return sb.from('monthly_snapshots').select('*')
    .eq('user_id',currentUser.id).eq('month',d.m).eq('year',d.y)
    .then(function(r){ return r.data||[]; });
}
function getAllSnapshots() {
  return sb.from('monthly_snapshots').select('*')
    .eq('user_id',currentUser.id)
    .then(function(r){ return r.data||[]; });
}
function getRules() {
  return sb.from('rules').select('*').eq('user_id',currentUser.id)
    .then(function(r){ return r.data||[]; });
}
function getOpeningBalances() {
  return sb.from('opening_balances').select('*').eq('user_id',currentUser.id)
    .then(function(r){ return r.data||[]; });
}
function saveRulesToDB(rules) {
  return sb.from('rules').delete().eq('user_id',currentUser.id).then(function() {
    if (!rules.length) return;
    return sb.from('rules').insert(rules.map(function(r) {
      return { user_id:currentUser.id, keyword:r.keyword, category:r.cat, subcategory:r.subcat };
    }));
  });
}

// ── UNIFIED AGGREGATION ──
function getUnifiedMonthlyData(txns, snaps, m, y) {
  var mTxns = txns.filter(function(t) { return t.month === m && t.year === y; });
  if (mTxns.length > 0) {
    var inc=0, exp=0, invM=0, invR=0, loanT=0, loanR=0;
    mTxns.forEach(function(t) {
      var amt = parseFloat(t.amount);
      if (t.category === 'Income') inc += amt;
      if (t.category === 'Expenses') exp += amt;
      if (t.category === 'Assets') { if(t.type === 'Withdrawal') invM+=amt; else invR+=amt; }
      if (t.category === 'Liabilities') { if(t.type === 'Deposit') loanT+=amt; else loanR+=amt; }
    });
    return { source: 'transactions', income: inc, expenses: exp, invMade: invM, invRedeemed: invR, loansTaken: loanT, loansRepaid: loanR, txns: mTxns };
  } else {
    var snap = snaps.find(function(s) { return s.month === m && s.year === y; });
    if (snap) {
      return { source: 'snapshot', income: parseFloat(snap.income||0), expenses: parseFloat(snap.expenses||0), invMade: parseFloat(snap.investments_made||0), invRedeemed: parseFloat(snap.investments_redeemed||0), loansTaken: parseFloat(snap.loans_taken||0), loansRepaid: parseFloat(snap.loans_repaid||0), txns: [] };
    } else {
      return { source: 'none', income: 0, expenses: 0, invMade: 0, invRedeemed: 0, loansTaken: 0, loansRepaid: 0, txns: [] };
    }
  }
}

// ── SMART MATCHING ──
function fuzzyMatch(desc, kw) {
  var n = function(s) { return s.toUpperCase().replace(/[^A-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); };
  return n(desc).includes(n(kw));
}
function applyRule(rule, type) {
  var cat = rule.category, sub = rule.subcategory;
  if (cat==='Income'   && type!=='Deposit')    return null;
  if (cat==='Expenses' && type!=='Withdrawal') return null;
  return { cat:cat, subcat:sub };
}

// ── NET WORTH CALC ──
function calcNetWorth(ob, txns) {
  var oA=0,oL=0,tA=0,tL=0;
  ob.forEach(function(b) {
    if(b.category==='Assets')      oA+=parseFloat(b.amount);
    if(b.category==='Liabilities') oL+=parseFloat(b.amount);
  });
  txns.forEach(function(t) {
    var amt=parseFloat(t.amount);
    if(t.category==='Assets')      tA += t.type==='Withdrawal'?amt:-amt;
    if(t.category==='Liabilities') tL += t.type==='Deposit'?amt:-amt;
  });
  return { totalAssets:oA+tA, totalLiabilities:oL+tL, netWorth:(oA+tA)-(oL+tL) };
}

// ── TRANSACTIONS STATE ──
var filterState = {
  dateRange: 'Current Month', // 'Current Month', 'Last 30 Days', 'Previous Month', 'Last 6 Months', 'Custom Range'
  startDate: '',
  endDate: '',
  category: 'All Categories', // 'All Categories', 'Income', 'Expenses', 'Assets', 'Liabilities'
  minAmount: '',
  type: 'ALL' // 'ALL', 'INCOME', 'EXPENSES'
};

function applyFilters() {
  filterState.dateRange = $('filt-date') ? $('filt-date').value : 'Current Month';
  if (filterState.dateRange === 'Custom Range') {
    filterState.startDate = $('filt-start').value;
    filterState.endDate = $('filt-end').value;
  }
  filterState.category = $('filt-cat') ? $('filt-cat').value : 'All Categories';
  filterState.minAmount = $('filt-min') ? $('filt-min').value : '';
  renderTxn();
}

function clearFilters() {
  filterState = { dateRange: 'Current Month', startDate: '', endDate: '', category: 'All Categories', minAmount: '', type: 'ALL' };
  globalSearchTerm = '';
  if ($('global-search')) $('global-search').value = '';
  renderTxn();
}

function updateDateRangeUI() {
  var dr = $('filt-date').value;
  $('custom-dates').style.display = (dr === 'Custom Range') ? 'flex' : 'none';
}

// ── TAB 1: TRANSACTIONS ──
function renderTxn() {
  var d = getMonthYear();
  showLoading('Loading transactions…');
  getAllTxns().then(function(allTxns) {
    
    // Apply Filters
    var filtered = allTxns.filter(function(t) {
      // 1. Search Term
      if (globalSearchTerm) {
        var match = t.description.toLowerCase().includes(globalSearchTerm) || 
                    (t.category && t.category.toLowerCase().includes(globalSearchTerm)) ||
                    (t.subcategory && t.subcategory.toLowerCase().includes(globalSearchTerm));
        if (!match) return false;
      }
      
      // 2. Type Button Filter
      if (filterState.type === 'INCOME' && t.type !== 'Deposit') return false;
      if (filterState.type === 'EXPENSES' && t.type !== 'Withdrawal') return false;
      
      // 3. Category Filter
      if (filterState.category !== 'All Categories') {
        if (t.category !== filterState.category) return false;
      }
      
      // 4. Min Amount
      if (filterState.minAmount !== '' && parseFloat(t.amount) < parseFloat(filterState.minAmount)) return false;
      
      // 5. Date Range
      var tDate = new Date(t.date);
      var now = new Date();
      if (filterState.dateRange === 'Current Month') {
         if (t.month !== d.m || t.year !== d.y) return false;
      } else if (filterState.dateRange === 'Last 30 Days') {
         var thirtyDaysAgo = new Date();
         thirtyDaysAgo.setDate(now.getDate() - 30);
         if (tDate < thirtyDaysAgo || tDate > now) return false;
      } else if (filterState.dateRange === 'Previous Month') {
         var pm = d.m - 1, py = d.y;
         if (pm < 1) { pm = 12; py--; }
         if (t.month !== pm || t.year !== py) return false;
      } else if (filterState.dateRange === 'Last 6 Months') {
         var sixMonthsAgo = new Date();
         sixMonthsAgo.setMonth(now.getMonth() - 6);
         if (tDate < sixMonthsAgo || tDate > now) return false;
      } else if (filterState.dateRange === 'Custom Range') {
         if (filterState.startDate && t.date < filterState.startDate) return false;
         if (filterState.endDate && t.date > filterState.endDate) return false;
      }
      
      return true;
    });

    // Sort descending by date
    filtered.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });

    var html = '';
    
    // Action Bar
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">';
    html += '<div style="display:flex;gap:12px"><button class="btn btn-blue-glow" onclick="toggleAddForm()"><i class="ph ph-plus"></i> New Transaction</button><button class="btn" onclick="switchTab(\'upload\')"><i class="ph ph-cloud-arrow-up"></i> Upload Statement</button></div>';
    html += '<div style="display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;overflow:hidden">'
      +'<button class="btn" style="border:none;border-radius:0;'+(filterState.type==='ALL'?'background:var(--bg-card2)':'')+'" onclick="filterState.type=\'ALL\';renderTxn()">ALL</button>'
      +'<button class="btn" style="border:none;border-radius:0;'+(filterState.type==='INCOME'?'background:var(--bg-card2)':'')+'" onclick="filterState.type=\'INCOME\';renderTxn()">INCOME</button>'
      +'<button class="btn" style="border:none;border-radius:0;'+(filterState.type==='EXPENSES'?'background:var(--bg-card2)':'')+'" onclick="filterState.type=\'EXPENSES\';renderTxn()">EXPENSES</button></div>';
    html += '</div>';

    // Filters Bar
    html += '<div class="grid4" style="margin-bottom:1.5rem;align-items:end">';
    
    html += '<div class="field"><label>Date Range</label><div style="position:relative"><i class="ph ph-calendar-blank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
      +'<select id="filt-date" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary)" onchange="updateDateRangeUI()">'
      +'<option '+(filterState.dateRange==='Current Month'?'selected':'')+'>Current Month</option>'
      +'<option '+(filterState.dateRange==='Last 30 Days'?'selected':'')+'>Last 30 Days</option>'
      +'<option '+(filterState.dateRange==='Previous Month'?'selected':'')+'>Previous Month</option>'
      +'<option '+(filterState.dateRange==='Last 6 Months'?'selected':'')+'>Last 6 Months</option>'
      +'<option '+(filterState.dateRange==='Custom Range'?'selected':'')+'>Custom Range</option>'
      +'</select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>';
      
    html += '<div class="field"><label>Category</label><div style="position:relative"><i class="ph ph-intersect" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
      +'<select id="filt-cat" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary)">'
      +'<option '+(filterState.category==='All Categories'?'selected':'')+'>All Categories</option>'
      +'<option '+(filterState.category==='Income'?'selected':'')+'>Income</option>'
      +'<option '+(filterState.category==='Expenses'?'selected':'')+'>Expenses</option>'
      +'<option '+(filterState.category==='Assets'?'selected':'')+'>Assets</option>'
      +'<option '+(filterState.category==='Liabilities'?'selected':'')+'>Liabilities</option>'
      +'</select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>';
      
    html += '<div class="field"><label>Min. Amount (₹)</label><div style="position:relative"><i class="ph ph-currency-inr" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i><input type="number" id="filt-min" value="'+filterState.minAmount+'" placeholder="0.00" style="padding-left:36px"></div></div>';
    
    html += '<div style="display:flex;gap:8px;height:42px"><button class="btn btn-blue-glow" style="flex:1" onclick="applyFilters()">Apply</button><button class="btn" style="flex:1" onclick="clearFilters()">Clear</button></div>';
    html += '</div>';
    
    // Custom Dates Row
    html += '<div id="custom-dates" style="display:'+(filterState.dateRange==='Custom Range'?'flex':'none')+';gap:16px;margin-bottom:1.5rem">';
    html += '<div class="field" style="flex:1"><label>Start Date</label><input type="date" id="filt-start" value="'+filterState.startDate+'"></div>';
    html += '<div class="field" style="flex:1"><label>End Date</label><input type="date" id="filt-end" value="'+filterState.endDate+'"></div>';
    html += '</div>';

    // Add Form
    html += '<div id="add-txn-form" style="display:none;background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">'
      +'<div class="sec-title" style="margin-top:0;font-size:14px">Add Manual Transaction</div>'
      +'<div class="grid2" style="gap:12px;margin-bottom:16px">'
      +'<div class="field"><label>Date</label><input type="date" id="new-date"></div>'
      +'<div class="field"><label>Description</label><input type="text" id="new-desc" placeholder="e.g. Swiggy order"></div>'
      +'<div class="field"><label>Amount (₹)</label><input type="number" id="new-amt" placeholder="0.00" min="0"></div>'
      +'<div class="field"><label>Type</label><select id="new-type"><option value="Withdrawal">Withdrawal (money out)</option><option value="Deposit">Deposit (money in)</option></select></div>'
      +'<div class="field"><label>Category</label><select id="new-cat" onchange="updateSubDrop(\'new-subcat\',\'new-cat\')"><option value="">Select category</option>'
      +Object.keys(CAT_MAP).map(function(c){return'<option>'+c+'</option>';}).join('')
      +'</select></div>'
      +'<div class="field"><label>Sub-category</label><select id="new-subcat"><option value="">Select sub-category</option></select></div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;justify-content:flex-end">'
      +'<button class="btn" onclick="toggleAddForm()">Cancel</button>'
      +'<button class="btn btn-blue-glow" onclick="saveTxnRow()"><i class="ph ph-check"></i> Save transaction</button>'
      +'</div><div class="msg" id="txn-form-msg"></div></div>';

    if (filtered.length) {
      html += '<div class="section" style="padding:0;overflow:hidden"><div class="tbl-wrap" style="overflow-x:auto"><table class="data-tbl" style="width:100%;border-collapse:collapse;text-align:left"><thead><tr style="border-bottom:1px solid var(--border);font-size:10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.1em">'
        +'<th style="padding:16px 20px">Date</th><th style="padding:16px 20px">Description</th><th style="padding:16px 20px">Category</th><th style="padding:16px 20px">Status</th><th style="padding:16px 20px;text-align:right">Amount</th><th style="padding:16px 20px;text-align:right"></th>'
        +'</tr></thead><tbody>';
      filtered.forEach(function(t) {
        var isDep = t.type==='Deposit';
        var dObj = new Date(t.date);
        var dateStr = MFULL[dObj.getMonth()].substring(0,3).toUpperCase() + ' ' + dObj.getDate() + ', ' + dObj.getFullYear();
        var icon = isDep ? 'ph-money' : 'ph-shopping-bag';
        var catColor = CAT_COLORS[t.category]||'#8892b0';
        
        var txnNoHtml = t.txn_no ? '<span style="font-size:9px;color:var(--blue);font-weight:bold;margin-right:6px">['+t.txn_no+']</span>' : '';
        var splitTagHtml = t.split_group_id ? '<span style="font-size:9px;color:#a855f7;margin-left:6px;border:1px solid #a855f7;padding:1px 4px;border-radius:4px">SPLIT</span>' : '';
        
        var actionsHtml = '';
        if (t.split_group_id) {
          actionsHtml = '<button class="icon-btn" title="Edit Split Group" onclick="editSplitGroup(\''+t.split_group_id+'\')"><i class="ph ph-pencil-simple" style="font-size:16px;color:var(--text-secondary)"></i></button>' +
                        '<button class="icon-btn" title="Delete Split Group" onclick="deleteSplitGroup(\''+t.split_group_id+'\')"><i class="ph ph-trash" style="font-size:16px;color:#ef4444"></i></button>';
        } else {
          actionsHtml = '<button class="icon-btn" title="Split Transaction" onclick="openSplitModal(\''+t.id+'\', '+t.amount+')"><i class="ph ph-git-branch" style="font-size:16px;color:var(--text-secondary)"></i></button>' +
                        '<button class="icon-btn" onclick="deleteTxn(\''+t.id+'\')"><i class="ph ph-trash" style="font-size:16px;color:var(--text-secondary)"></i></button>';
        }

        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.02);transition:var(--transition)" onmouseover="this.style.backgroundColor=\'rgba(255,255,255,0.02)\'" onmouseout="this.style.backgroundColor=\'transparent\'">'
          +'<td style="padding:16px 20px;font-size:13px;color:var(--text-secondary);white-space:nowrap">'+dateStr+'</td>'
          +'<td style="padding:16px 20px;display:flex;align-items:center;gap:12px">'
            +'<div style="width:32px;height:32px;border-radius:8px;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;color:var(--text-primary)"><i class="ph '+icon+'"></i></div>'
            +'<div><div style="font-weight:600;font-size:13px;color:var(--text-primary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.description+'">'+txnNoHtml+t.description+splitTagHtml+'</div><div style="font-size:10px;color:var(--text-secondary)">'+(t.subcategory||t.category||'Other')+'</div></div>'
          +'</td>'
          +'<td style="padding:16px 20px"><span class="tag tg" style="background:'+catColor+'15;color:'+catColor+';border:1px solid '+catColor+'33;font-size:9px;letter-spacing:0.05em;text-transform:uppercase">'+(t.category||'Uncategorized')+'</span></td>'
          +'<td style="padding:16px 20px;font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:var(--blue)"></span>Completed</td>'
          +'<td style="padding:16px 20px;text-align:right;font-weight:600;font-size:14px;color:'+(isDep?'var(--green)':'var(--red)')+'">'+(isDep?'+':'-')+fmt(t.amount)+'</td>'
          +'<td style="padding:16px 20px;text-align:right">'+actionsHtml+'</td>'
          +'</tr>';
      });
      html += '</tbody></table></div>'
        +'<div style="padding:12px 20px;background:rgba(255,255,255,0.01);display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-secondary)">'
        +'<div>Showing <b>1-'+filtered.length+'</b> of <b>'+filtered.length+'</b> transactions</div>'
        +'<div style="display:flex;gap:4px"><button class="btn btn-sm" style="background:var(--bg-input)">‹</button><button class="btn btn-sm" style="background:var(--blue-dim);color:var(--blue)">1</button><button class="btn btn-sm" style="background:var(--bg-input)">›</button></div>'
        +'</div></div>';
    } else {
      html += '<div class="section"><div class="empty" style="padding:3rem 1rem"><div class="empty-icon" style="font-size:32px;margin-bottom:1rem"><i class="ph ph-receipt"></i></div>No transactions found matching your criteria.<br>Adjust filters, add manually, or <a href="#" onclick="switchTab(\'upload\')" style="color:var(--blue)">upload your bank statement</a>.</div></div>';
    }
    
    $('pg-dash-body').innerHTML = html;
    var dInput = $('new-date');
    if (dInput) dInput.value = new Date().toISOString().split('T')[0];
  });
}

function toggleAddForm() {
  var f = $('add-txn-form');
  f.style.display = f.style.display==='none'?'block':'none';
}
function updateSubDrop(subId, catId) {
  var cat=$(catId).value, sub=$(subId);
  sub.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(function(s){return'<option>'+s+'</option>';}).join('');
}
function saveTxnRow() {
  var date=$('new-date').value, desc=$('new-desc').value.trim();
  var amount=fmtN($('new-amt').value), type=$('new-type').value;
  var cat=$('new-cat').value, subcat=$('new-subcat').value;
  var msgEl=$('txn-form-msg');
  if(!date||!desc||!amount){setMsg(msgEl,'err','Please fill date, description and amount.');return;}
  if(!cat){setMsg(msgEl,'err','Please select a category.');return;}
  setMsg(msgEl,'info','Saving…');
  var d = getMonthYearFromDate(date);
  sb.from('transactions').insert({
    user_id:currentUser.id, date:date, description:desc,
    amount:amount, type:type, category:cat, subcategory:subcat,
    month:d.m, year:d.y
  }).then(function(){ renderTxn(); });
}
function deleteTxn(id) {
  if(!confirm('Delete this transaction?'))return;
  sb.from('transactions').delete().eq('id',id).then(function(){ renderTxn(); });
}

// ── TAB: MONTHLY SNAPSHOT ──
function renderSnapshot() {
  var d = getMonthYear();
  showLoading('Loading snapshot data...');
  Promise.all([getTxns(), getMonthlySnapshots()]).then(function(results) {
    var txns = results[0], snaps = results[1];
    var isTxn = txns.length > 0;
    var s = snaps[0] || {};
    var inc=0, exp=0, invM=0, invR=0, loanT=0, loanR=0;
    
    if (isTxn) {
       var unified = getUnifiedMonthlyData(txns, snaps, d.m, d.y);
       inc = unified.income; exp = unified.expenses; invM = unified.invMade; invR = unified.invRedeemed; loanT = unified.loansTaken; loanR = unified.loansRepaid;
    } else if (snaps.length > 0) {
       inc = s.income||0; exp = s.expenses||0; invM = s.investments_made||0; invR = s.investments_redeemed||0; loanT = s.loans_taken||0; loanR = s.loans_repaid||0;
    }

    var ro = isTxn ? 'disabled' : '';
    var srcMsg = isTxn ? '<div class="info-box" style="margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:12px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);"><i class="ph ph-info" style="font-size:20px;color:var(--blue)"></i><div><div style="font-weight:600;margin-bottom:4px;color:var(--text-primary)">Data Integrity Notice <span class="tag tg" style="margin-left:8px;font-size:9px">STATUS: READ-ONLY</span></div>This interface is optimized for manual aggregated entry. If detailed transaction records are detected for the selected period, these fields automatically transition to <b>Read-Only</b> mode to ensure consistency across your financial architecture.</div></div>' : '<div class="info-box" style="margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:12px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);"><i class="ph ph-info" style="font-size:20px;color:var(--blue)"></i><div><div style="font-weight:600;margin-bottom:4px;color:var(--text-primary)">Data Integrity Notice <span class="tag tg" style="background:var(--green-dim);color:var(--green);border-color:rgba(16,185,129,0.2);margin-left:8px;font-size:9px">STATUS: EDITABLE</span></div>This interface is optimized for manual aggregated entry. If detailed transaction records are detected for the selected period, these fields automatically transition to <b>Read-Only</b> mode to ensure consistency across your financial architecture.</div></div>';
    
    var netSurplus = inc - exp;
    var sr = inc>0 ? Math.round((netSurplus/inc)*1000)/10 : 0;
    
    var html = monthYearSelectorHTML() + srcMsg + '<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:1.5rem;align-items:start">';
    
    // Left Column
    html += '<div class="section" style="margin:0"><div class="sec-title">Entry Fields</div><div class="grid2" style="gap:1.5rem 1rem">';
    
    var fields = [
      {id:'snap-inc', lbl:'Total Income', val:inc, pre:'₹'},
      {id:'snap-exp', lbl:'Total Expenses', val:exp, pre:'₹'},
      {id:'snap-inv-m', lbl:'Investments Made', val:invM, pre:'₹'},
      {id:'snap-inv-r', lbl:'Investments Redeemed', val:invR, pre:'₹'},
      {id:'snap-loan-t', lbl:'Loans Taken', val:loanT, pre:'₹'},
      {id:'snap-loan-r', lbl:'Loans Repaid', val:loanR, pre:'₹'}
    ];
    
    fields.forEach(function(f) {
      html += '<div class="field"><label>'+f.lbl+'</label><div style="position:relative"><span style="position:absolute;left:12px;top:12px;color:var(--blue);font-weight:600;font-size:14px">'+f.pre+'</span><input type="number" id="'+f.id+'" min="0" value="'+f.val+'" '+ro+' style="padding-left:28px"></div></div>';
    });
    
    html += '</div>';

    if (!isTxn) {
      html += '<div class="divider" style="margin:1.5rem 0"></div><div style="display:flex;gap:12px;margin-top:1.5rem;"><button class="btn btn-blue-glow" style="flex:1;background:#a5b4fc;color:#1e1b4b" onclick="saveSnapshot()">Save Snapshot</button><button class="btn" style="flex:1" onclick="renderSnapshot()">Reset</button></div><div id="snap-msg" class="msg" style="text-align:center"></div>';
    }
    html += '</div>';
    
    // Right Column
    html += '<div style="display:flex;flex-direction:column;gap:1.5rem">';
    
    // Impact Card
    html += '<div class="section" style="margin:0;background:linear-gradient(180deg, var(--bg-card) 0%, #0c101a 100%);border:1px solid rgba(59,130,246,0.15);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">'
      +'<div class="sec-title" style="font-size:11px;letter-spacing:0.1em;color:var(--text-secondary);text-transform:uppercase">Net Monthly Impact <i class="ph ph-trend-up" style="color:var(--blue);font-size:16px"></i></div>'
      +'<div style="font-size:36px;font-weight:700;margin-bottom:8px;color:var(--text-primary)">'+(netSurplus<0?'-':'')+fmt(Math.abs(netSurplus))+'</div>'
      +'<div style="font-size:12px;color:var(--text-secondary);margin-bottom:1.5rem">Total capital retention for this cycle.</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-bottom:6px"><span>Savings Rate</span><span style="color:var(--blue);font-weight:600">'+sr+'%</span></div>'
      +'<div class="bar-wrap" style="height:4px"><div class="bar" style="background:var(--blue);width:'+Math.min(Math.max(0,sr),100)+'%"></div></div>'
      +'</div>';
      
    // Composition Card
    html += '<div class="section" style="margin:0">'
      +'<div class="sec-title" style="font-size:11px;letter-spacing:0.1em;color:var(--text-secondary);text-transform:uppercase;margin-bottom:1.5rem">Cash Flow Composition</div>'
      
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:rgba(16,185,129,0.1);color:var(--green);display:flex;align-items:center;justify-content:center"><i class="ph ph-money" style="font-size:20px"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600">Core Surplus</div><div style="font-size:10px;color:var(--text-secondary)">Income minus expenses</div></div>'
      +'<div style="font-weight:600;font-size:12px">'+(netSurplus<0?'-':'')+fmt(Math.abs(netSurplus))+'</div>'
      +'</div>'
      
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:rgba(59,130,246,0.1);color:var(--blue);display:flex;align-items:center;justify-content:center"><i class="ph ph-chart-pie-slice" style="font-size:20px"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600">Investments Made</div><div style="font-size:10px;color:var(--text-secondary)">New investments allocated</div></div>'
      +'<div style="font-weight:600;font-size:12px">'+fmt(invM)+'</div>'
      +'</div>'

      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:rgba(16,185,129,0.1);color:var(--green);display:flex;align-items:center;justify-content:center"><i class="ph ph-trend-down" style="font-size:20px"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600">Investments Redeemed</div><div style="font-size:10px;color:var(--text-secondary)">Capital returned</div></div>'
      +'<div style="font-weight:600;font-size:12px">'+fmt(invR)+'</div>'
      +'</div>'
      
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,0.1);color:var(--red);display:flex;align-items:center;justify-content:center"><i class="ph ph-wallet" style="font-size:20px"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600">Debt Servicing</div><div style="font-size:10px;color:var(--text-secondary)">Loans repaid</div></div>'
      +'<div style="font-weight:600;font-size:12px">'+fmt(loanR)+'</div>'
      +'</div>'

      +'<div style="display:flex;align-items:center;gap:12px">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,0.1);color:var(--red);display:flex;align-items:center;justify-content:center"><i class="ph ph-bank" style="font-size:20px"></i></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600">Borrowing Activity</div><div style="font-size:10px;color:var(--text-secondary)">Loans taken</div></div>'
      +'<div style="font-weight:600;font-size:12px">'+fmt(loanT)+'</div>'
      +'</div>'
      
      +'</div>';
    
    html += '</div></div>';
    $('pg-dash-body').innerHTML = html;
  });
}

function saveSnapshot() {
  var d = getMonthYear();
  var inc = Math.max(0, fmtN($('snap-inc').value));
  var exp = Math.max(0, fmtN($('snap-exp').value));
  var invM = Math.max(0, fmtN($('snap-inv-m').value));
  var invR = Math.max(0, fmtN($('snap-inv-r').value));
  var loanT = Math.max(0, fmtN($('snap-loan-t').value));
  var loanR = Math.max(0, fmtN($('snap-loan-r').value));
  
  setMsg($('snap-msg'), 'info', 'Saving...');
  sb.from('monthly_snapshots').delete().eq('user_id', currentUser.id).eq('month', d.m).eq('year', d.y).then(function() {
    sb.from('monthly_snapshots').insert({
      user_id: currentUser.id, month: d.m, year: d.y,
      income: inc, expenses: exp, investments_made: invM, investments_redeemed: invR, loans_taken: loanT, loans_repaid: loanR
    }).then(function(r) {
      if (r.error) setMsg($('snap-msg'), 'err', 'Error saving snapshot.');
      else setMsg($('snap-msg'), 'ok', 'Snapshot saved successfully!');
    });
  });
}

// ── TAB 2: MONTHLY SUMMARY ──
function renderSummary() {
  var d = getMonthYear();
  showLoading('Loading summary…');
  Promise.all([getTxns(), getMonthlySnapshots()]).then(function(results) {
    var txns = results[0], snaps = results[1];
    var unified = getUnifiedMonthlyData(txns, snaps, d.m, d.y);
    
    if (unified.source === 'none') {
      $('pg-dash-body').innerHTML = monthYearSelectorHTML()+'<div class="section"><div class="empty"><div class="empty-icon">📊</div>No data for '+MFULL[d.m]+' '+d.y+'.</div></div>';
      return;
    }
    
    var income=unified.income, expenses=unified.expenses, netAst=unified.invMade - unified.invRedeemed;
    var savings = Math.max(0, income-expenses);
    var surplus = Math.max(0, income-expenses-netAst);
    var savRate = income>0 ? Math.round(savings/income*100) : 0;
    var expSubs={},incSubs={},astSubs={};
    
    if (unified.source === 'transactions') {
      unified.txns.forEach(function(t) {
        var amt=parseFloat(t.amount), sub=t.subcategory||'Other';
        if(t.category==='Income') incSubs[sub]=(incSubs[sub]||0)+amt;
        if(t.category==='Expenses') expSubs[sub]=(expSubs[sub]||0)+amt;
        if(t.category==='Assets') { if(t.type==='Withdrawal') astSubs[sub]=(astSubs[sub]||0)+amt; }
      });
    }
    var expArr=Object.entries(expSubs).sort(function(a,b){return b[1]-a[1];});
    var incArr=Object.entries(incSubs).sort(function(a,b){return b[1]-a[1];});
    var topExp = expArr.length > 0 ? expArr[0][0] : 'N/A';
    var topInc = incArr.length > 0 ? incArr[0][0] : 'N/A';

    var html = monthYearSelectorHTML() + '<div style="margin-bottom:1.5rem;display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem">';
    
    // 4 Metric Cards
    html += '<div class="metric" style="text-align:left;background:linear-gradient(145deg, var(--bg-card2), var(--bg-card));"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--text-secondary);letter-spacing:.08em;text-transform:uppercase">Total Income</span><i class="ph ph-trend-up" style="color:var(--blue);background:rgba(59,130,246,0.1);padding:4px;border-radius:4px"></i></div><div style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:8px">'+fmt(income)+'</div></div>';
    
    html += '<div class="metric" style="text-align:left;background:linear-gradient(145deg, var(--bg-card2), var(--bg-card));"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--text-secondary);letter-spacing:.08em;text-transform:uppercase">Total Expenses</span><i class="ph ph-wallet" style="color:var(--red);background:rgba(239,68,68,0.1);padding:4px;border-radius:4px"></i></div><div style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:8px">'+fmt(expenses)+'</div></div>';
    
    html += '<div class="metric" style="text-align:left;background:linear-gradient(145deg, var(--bg-card2), var(--bg-card));"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--text-secondary);letter-spacing:.08em;text-transform:uppercase">Monthly Savings</span><i class="ph ph-piggy-bank" style="color:var(--green);background:rgba(16,185,129,0.1);padding:4px;border-radius:4px"></i></div><div style="font-size:24px;font-weight:700;color:var(--green);margin-bottom:8px">'+fmt(savings)+'</div></div>';
    
    html += '<div class="metric" style="text-align:left;background:linear-gradient(145deg, var(--bg-card2), var(--bg-card));"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--text-secondary);letter-spacing:.08em;text-transform:uppercase">Savings Rate</span><i class="ph ph-percent" style="color:var(--purple);background:rgba(139,92,246,0.1);padding:4px;border-radius:4px"></i></div><div style="font-size:28px;font-weight:700;color:var(--text-primary);margin-bottom:12px">'+savRate+'%</div><div class="bar-wrap" style="height:4px"><div class="bar" style="background:#ffb084;width:'+Math.min(savRate,100)+'%"></div></div></div>';
    html += '</div>';

    // Monthly Insights
    html += '<div style="display:grid;grid-template-columns:1fr;gap:1.5rem;margin-bottom:1.5rem">';
    
    html += '<div class="section" style="margin:0;background:linear-gradient(180deg, var(--bg-card) 0%, rgba(15,22,41,0) 100%)">'
      +'<div class="sec-title" style="margin-bottom:16px">Monthly Insights</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;margin-bottom:1.5rem">'
      
      +'<div style="background:var(--bg-input);padding:16px;border-radius:8px;display:flex;align-items:center;gap:12px">'
      +'<i class="ph ph-shopping-cart" style="color:var(--red);font-size:24px"></i>'
      +'<div><div style="font-size:11px;color:var(--text-secondary)">Largest Expense</div><div style="font-size:14px;font-weight:600;color:var(--text-primary)">'+topExp+'</div></div>'
      +'</div>'
      
      +'<div style="background:var(--bg-input);padding:16px;border-radius:8px;display:flex;align-items:center;gap:12px">'
      +'<i class="ph ph-briefcase" style="color:var(--green);font-size:24px"></i>'
      +'<div><div style="font-size:11px;color:var(--text-secondary)">Largest Income Source</div><div style="font-size:14px;font-weight:600;color:var(--text-primary)">'+topInc+'</div></div>'
      +'</div>'
      
      +'<div style="background:var(--bg-input);padding:16px;border-radius:8px;display:flex;align-items:center;gap:12px">'
      +'<i class="ph ph-chart-pie" style="color:var(--blue);font-size:24px"></i>'
      +'<div><div style="font-size:11px;color:var(--text-secondary)">Investments Made</div><div style="font-size:14px;font-weight:600;color:var(--text-primary)">'+fmt(unified.invMade)+'</div></div>'
      +'</div>'

      +'</div></div>';
      
    html += '</div>';

    // Bottom Row: Category Breakdown + Investment Suggestions
    html += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:1.5rem">';
    
    // Category Breakdown
    html += '<div class="section" style="margin:0"><div class="sec-title">Category Breakdown</div>';
    if(unified.source === 'transactions' && expArr.length){
      html += '<div style="position:relative;height:160px;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center"><div style="width:140px;height:140px;border-radius:50%;border:20px solid var(--blue-dim);border-top-color:#a5b4fc;border-right-color:#34d399;border-bottom-color:#fb923c;display:flex;align-items:center;justify-content:center;flex-direction:column"><div style="font-size:10px;color:var(--text-secondary)">Total</div><div style="font-size:16px;font-weight:700">'+fmt(expenses)+'</div></div></div>';
      expArr.slice(0,5).forEach(function(e, i){
        var colors = ['#a5b4fc', '#34d399', '#fb923c', '#2dd4bf', '#64748b'];
        html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)"><span style="width:8px;height:8px;border-radius:50%;background:'+colors[i%colors.length]+'"></span>'+e[0]+'</div><div style="font-size:12px;font-weight:600;color:var(--text-primary)">'+fmt(e[1])+'</div></div>';
      });
    } else {
       html += '<div class="info-box">Transaction breakdown unavailable in Snapshot mode.</div>';
    }
    html += '</div>';
    
    // Investment Suggestions -> Suggested Allocation
    html += '<div class="section" style="margin:0;background:rgba(255,255,255,0.02)">'
      +'<div class="sec-title" style="margin-bottom:1.5rem">Suggested Allocation <span class="tag tg" style="background:rgba(16,185,129,0.1);color:var(--green)">Surplus: '+fmt(surplus)+'</span></div>';
    
    if (surplus > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">';
      var cards = [
        {i:'ph-chart-line-up', t:'Equity Mutual Funds / Index Funds', p:'Allocate 60% ('+fmt(surplus*0.6)+') of surplus for long-term growth and wealth building.', rc:'var(--blue)'},
        {i:'ph-piggy-bank', t:'Emergency Fund / Liquid Savings', p:'Allocate 30% ('+fmt(surplus*0.3)+') of surplus to maintain high liquidity for unexpected expenses.', rc:'var(--green)'},
        {i:'ph-shield-check', t:'Insurance Protection', p:'Allocate 10% ('+fmt(surplus*0.1)+') of surplus for risk management and premium coverage.', rc:'var(--purple)'}
      ];
      cards.forEach(function(c) {
        html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:12px;transition:var(--transition);cursor:pointer" onmouseover="this.style.borderColor=\'var(--border-hover)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
          +'<div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;color:'+c.rc+'"><i class="ph '+c.i+'" style="font-size:20px"></i></div><div style="font-weight:600;font-size:13px;color:var(--text-primary)">'+c.t+'</div></div>'
          +'<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;flex:1">'+c.p+'</div>'
          +'</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="info-box" style="margin-top:1rem">No surplus available this month for allocation. Focus on reducing core expenses to generate savings.</div>';
    }
    
    html += '</div></div>';
    
    $('pg-dash-body').innerHTML = html;
    
    if (unified.source === 'transactions') {
      var ctx=$('income-donut');
      if(ctx){
        var data=[expenses,Math.max(0,netAst),surplus];
        var tot=data.reduce(function(a,b){return a+b;},0);
        charts['summary']=new Chart(ctx,{type:'doughnut',data:{labels:['Expenses','Invested','Surplus'],datasets:[{data:tot>0?data:[1,1,1],backgroundColor:['#ff6b6b','#4d9fff','#00d4a0'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return tot>0?' '+fmt(c.parsed):' No data';}}}}}});
      }
    }
  });
}

// ── TAB 3: NET WORTH ──
// ── NET WORTH STATE ──
var nwChartPeriod = '1Y';

// ── TAB 3: NET WORTH ──
function renderNetWorth() {
  showLoading('Loading net worth…');
  Promise.all([getOpeningBalances(), getAllTxns(), getAllSnapshots()]).then(function(results) {
    var ob=results[0], at=results[1], as=results[2];
    var d=getMonthYear();
    
    var oA=0,oL=0,tA=0,tL=0;
    var earliest = new Date();
    
    ob.forEach(function(b) {
      if(b.category==='Assets') oA += parseFloat(b.amount);
      if(b.category==='Liabilities') oL += parseFloat(b.amount);
      if(b.as_of_date) {
        var dObj = new Date(b.as_of_date);
        if(dObj < earliest) earliest = dObj;
      }
    });
    
    var monthDeltas = {}; // key: "YYYY-M", val: delta
    var updateDelta = function(yy, mm, val) {
      var k = yy+'-'+mm;
      monthDeltas[k] = (monthDeltas[k]||0) + val;
      var dObj = new Date(yy, mm-1, 1);
      if(dObj < earliest) earliest = dObj;
    };
    
    at.forEach(function(t){ updateDelta(t.year, t.month, 0); }); // Just to register month
    as.forEach(function(s){ updateDelta(s.year, s.month, 0); });
    
    Object.keys(monthDeltas).forEach(function(k) {
      var parts = k.split('-');
      var yy = parseInt(parts[0]), mm = parseInt(parts[1]);
      var u = getUnifiedMonthlyData(at, as, mm, yy);
      var netDelta = (u.invMade - u.invRedeemed) - (u.loansTaken - u.loansRepaid);
      monthDeltas[k] = netDelta;
      tA += (u.invMade - u.invRedeemed);
      tL += (u.loansTaken - u.loansRepaid);
    });
    
    var nw={ totalAssets:oA+tA, totalLiabilities:oL+tL, netWorth:(oA+tA)-(oL+tL) };
    
    // Build Chart Data
    var now = new Date();
    var monthsBack = 12;
    if(nwChartPeriod==='1M') monthsBack=1;
    if(nwChartPeriod==='3M') monthsBack=3;
    if(nwChartPeriod==='6M') monthsBack=6;
    if(nwChartPeriod==='5Y') monthsBack=60;
    if(nwChartPeriod==='ALL') {
       monthsBack = (now.getFullYear() - earliest.getFullYear())*12 + (now.getMonth() - earliest.getMonth()) + 1;
       if(monthsBack < 1) monthsBack = 1;
    }
    
    var labels = [];
    var dataNW = [];
    var runningNW = (oA - oL);
    
    // To calculate running NW accurately, we need to start from earliest
    var eY = earliest.getFullYear(), eM = earliest.getMonth()+1;
    var cY = eY, cM = eM;
    var historyFull = {}; // "YYYY-M": val
    
    while(cY < now.getFullYear() || (cY === now.getFullYear() && cM <= now.getMonth()+1)) {
      runningNW += (monthDeltas[cY+'-'+cM] || 0);
      historyFull[cY+'-'+cM] = runningNW;
      cM++;
      if(cM>12){ cM=1; cY++; }
    }
    
    // Now pick the requested window
    var startD = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
    var pY = startD.getFullYear(), pM = startD.getMonth()+1;
    
    var hasDataInWindow = false;
    for(var i=0; i<monthsBack; i++) {
      labels.push(MFULL[pM-1].substring(0,3) + ' ' + (pY%100));
      var val = historyFull[pY+'-'+pM];
      if (val !== undefined) {
         dataNW.push(val);
         hasDataInWindow = true;
      } else {
         dataNW.push(0); // If before earliest
      }
      pM++;
      if(pM>12){ pM=1; pY++; }
    }
    
    var html = '<div style="display:grid;grid-template-columns:1fr;gap:1.5rem;margin-bottom:1.5rem">';
    
    // GROWTH CHART & NET WORTH
    html += '<div class="section" style="margin:0;display:flex;flex-direction:column">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem">'
      +'<div><div style="font-size:11px;color:var(--text-secondary);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Current Net Worth</div>'
      +'<div style="font-size:36px;font-weight:700;color:var(--text-primary);line-height:1.2">'+(nw.netWorth<0?'-':'')+fmt(Math.abs(nw.netWorth))+'</div></div>'
      +'<div style="display:flex;gap:4px">'
      +['1M','3M','6M','1Y','5Y','ALL'].map(function(p){
         return '<button class="btn btn-sm" style="border-radius:12px;font-size:10px;'+(nwChartPeriod===p?'background:#a5b4fc;color:#1e1b4b':'')+'" onclick="nwChartPeriod=\''+p+'\';renderNetWorth()">'+p+'</button>';
      }).join('')
      +'</div>'
      +'</div>'
      +'<div style="position:relative;flex:1;min-height:280px;">';
      
    if (hasDataInWindow) {
      html += '<canvas id="nw-chart"></canvas>';
    } else {
      html += '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px">No historical data available</div>';
    }
    
    html += '</div></div></div>';
    
    // OPENING BALANCES MANAGEMENT (Hidden behind a button to match clean UI)
    html += '<div class="section"><div class="sec-title"><span>Opening balances Configuration</span><button class="btn btn-blue-glow btn-sm" onclick="showOBForm()"><i class="ph ph-plus"></i> Add balance</button></div>'
      +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem">Manage existing assets and liabilities you had before using this app.</p>'
      +'<div id="ob-form" style="display:none;background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">'
      +'<div class="grid2" style="gap:8px;margin-bottom:8px">'
      +'<div class="field"><label>Name</label><input type="text" id="ob-name" placeholder="e.g. HDFC Mutual Fund"></div>'
      +'<div class="field"><label>Category</label><select id="ob-cat" onchange="updateSubDrop(\'ob-subcat\',\'ob-cat\')"><option value="">Select</option><option value="Assets">Assets</option><option value="Liabilities">Liabilities</option></select></div>'
      +'<div class="field"><label>Sub-category</label><select id="ob-subcat"><option value="">Select sub-category</option></select></div>'
      +'<div class="field"><label>Amount (₹)</label><input type="number" id="ob-amount" placeholder="0"></div>'
      +'<div class="field"><label>As of date</label><input type="date" id="ob-date"></div>'
      +'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">'
      +'<button class="btn btn-sm" onclick="$(\'ob-form\').style.display=\'none\'">Cancel</button>'
      +'<button class="btn btn-blue-glow btn-sm" onclick="saveOB()">Save</button>'
      +'</div><div class="msg" id="ob-msg"></div></div>';

    if(ob.length){
      html+='<div class="tbl-wrap" style="margin-top:1rem"><table class="data-tbl"><thead><tr><th>Name</th><th>Category</th><th>Sub-category</th><th>Amount</th><th>As of</th><th></th></tr></thead><tbody>';
      ob.forEach(function(b){
        html+='<tr><td style="font-weight:500">'+b.name+'</td>'
          +'<td><span class="tag tg" style="background:'+(CAT_COLORS[b.category]||'#333')+'22;color:'+(CAT_COLORS[b.category]||'#aaa')+';border:1px solid '+(CAT_COLORS[b.category]||'#333')+'44">'+b.category+'</span></td>'
          +'<td style="font-size:11px;color:var(--text-secondary)">'+(b.subcategory||'—')+'</td>'
          +'<td style="font-weight:600;color:'+(b.category==='Assets'?'var(--green)':'var(--red)')+'">'+fmt(b.amount)+'</td>'
          +'<td style="font-size:11px;color:var(--text-secondary)">'+(b.as_of_date||'—')+'</td>'
          +'<td><button class="btn btn-sm btn-red" onclick="deleteOB(\''+b.id+'\')"><i class="ph ph-trash"></i></button></td></tr>';
      });
      html+='</tbody></table></div>';
    }
    html+='</div>';

    $('pg-dash-body').innerHTML=html;
    
    if (hasDataInWindow) {
       var ctx = $('nw-chart');
       if(ctx) {
         charts['networth'] = new Chart(ctx, {
           type: 'line',
           data: {
             labels: labels,
             datasets: [{
               label: 'Net Worth',
               data: dataNW,
               borderColor: '#a5b4fc',
               backgroundColor: 'rgba(165,180,252,0.1)',
               borderWidth: 2,
               pointBackgroundColor: '#1e1b4b',
               pointBorderColor: '#a5b4fc',
               pointRadius: 4,
               fill: true,
               tension: 0.4
             }]
           },
           options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return fmt(c.parsed.y); } } } },
             scales: {
               x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0' } },
               y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892b0', callback: function(v){ return fmt(v); } } }
             }
           }
         });
       }
    }
  });
}

function showOBForm(){$('ob-form').style.display='block';$('ob-date').value=new Date().toISOString().split('T')[0];}
function saveOB(){
  var name=$('ob-name').value.trim(),cat=$('ob-cat').value;
  var subcat=$('ob-subcat').value,amount=fmtN($('ob-amount').value),date=$('ob-date').value;
  var msgEl=$('ob-msg');
  if(!name||!cat||!amount){setMsg(msgEl,'err','Please fill name, category and amount.');return;}
  sb.from('opening_balances').insert({user_id:currentUser.id,name:name,category:cat,subcategory:subcat,amount:amount,as_of_date:date})
    .then(function(){renderNetWorth();});
}
function deleteOB(id){
  if(!confirm('Delete?'))return;
  sb.from('opening_balances').delete().eq('id',id).then(function(){renderNetWorth();});
}

// ── TAB 4: ANNUAL ANALYSIS ──
function renderAnnual() {
  var d = getMonthYear();
  showLoading('Loading annual data…');
  Promise.all([
    sb.from('transactions').select('*').eq('user_id',currentUser.id).eq('year',d.y).then(function(r){return r.data||[];}),
    sb.from('monthly_snapshots').select('*').eq('user_id',currentUser.id).eq('year',d.y).then(function(r){return r.data||[];})
  ]).then(function(results) {
    var all=results[0], snaps=results[1];
    var entries=[];
    for(var m=0;m<12;m++){
      var u = getUnifiedMonthlyData(all, snaps, m, d.y);
      if(u.source !== 'none') {
        entries.push({m:m,inc:u.income,exp:u.expenses,ast:u.invMade,sav:Math.max(0,u.income-u.expenses),cnt:u.txns.length});
      }
    }
    if(!entries.length){$('pg-dash-body').innerHTML=monthYearSelectorHTML()+'<div class="section"><div class="empty"><div class="empty-icon">📈</div>No data for '+d.y+' yet.</div></div>';return;}
    
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
          +'<div class="mrow"><span>Savings</span><span style="color:#00d4a0">'+fmt(e.sav)+'</span></div>'
          +'<div class="mrow"><span>Txns</span><span>'+e.cnt+'</span></div></div>';
      });
      html+='</div></div>'
        +'<div class="section"><div class="sec-title">Year highlights — '+d.y+'</div><div class="hl-grid">'
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
        {label:'Income',  data:entries.map(function(e){return e.inc;}),backgroundColor:'rgba(0,212,160,0.7)',borderRadius:4},
        {label:'Expenses',data:entries.map(function(e){return e.exp;}),backgroundColor:'rgba(255,107,107,0.7)',borderRadius:4},
        {label:'Invested',data:entries.map(function(e){return e.ast;}),backgroundColor:'rgba(77,159,255,0.7)',borderRadius:4}
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return' '+fmt(c.parsed);}}}},scales:{x:{ticks:{color:'#8892b0',autoSkip:false,maxRotation:0},grid:{color:'rgba(99,120,220,0.08)'}},y:{ticks:{color:'#8892b0',callback:function(v){return fmt(v);}},grid:{color:'rgba(99,120,220,0.08)'}}}}});
    });
}

function jumpMonth(m){ _curMonth=m; switchTab('txn'); }

// ── TAB 5: MY RULES ──
function renderRules() {
  showLoading('Loading rules…');
  getRules().then(function(rules) {
    var html='<div class="section"><div class="sec-title">My keyword rules</div>'
      +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">Keywords matched against bank statement descriptions for auto-categorization.</p>'
      +'<div class="field" style="max-width:240px;margin-bottom:1rem"><label>Your bank</label><select id="rules-bank">'
      +['kotak','hdfc','icici','sbi','axis','other'].map(function(b){
        var name={'kotak':'Kotak Mahindra','hdfc':'HDFC Bank','icici':'ICICI Bank','sbi':'State Bank (SBI)','axis':'Axis Bank','other':'Other Bank'}[b];
        return'<option value="'+b+'" '+((currentProfile.bank||'kotak')===b?'selected':'')+'>'+name+'</option>';
      }).join('')+'</select></div>'
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
  });
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
function saveRules(){
  var rows=[].slice.call($('rules-body').querySelectorAll('tr'));
  var rules=rows.map(function(tr){return{keyword:tr.cells[0].querySelector('input').value.trim().toUpperCase(),cat:tr.cells[1].querySelector('select').value,subcat:tr.cells[2].querySelector('select').value};}).filter(function(r){return r.keyword&&r.cat;});
  sb.from('profiles').update({bank:$('rules-bank').value}).eq('id',currentUser.id);
  saveRulesToDB(rules).then(function(){setMsg($('rules-msg'),'ok',rules.length+' rules saved!');});
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

  $('zone-pdf').addEventListener('click',function(){$('file-pdf').click();});
  $('zone-csv').addEventListener('click',function(){$('file-csv').click();});
  $('zone-excel').addEventListener('click',function(){$('file-excel').click();});
  $('file-pdf').addEventListener('change',handlePDF);
  $('file-csv').addEventListener('change',handleCSV);
  $('file-excel').addEventListener('change',handleExcel);
}

function setFmt(f){
  ['pdf','csv','excel'].forEach(function(x){
    var d=$('up-'+x),b=$('fmt-'+x);
    if(d)d.style.display=x===f?'block':'none';
    if(b){b.style.borderColor=x===f?'#4d9fff':'';b.style.color=x===f?'#4d9fff':'';}
  });
}

// ── PDF HANDLER ──
function handlePDF(e){
  var file=e.target.files[0]; if(!file)return;
  var msgEl=$('upload-msg'); setMsg(msgEl,'info','📖 Reading PDF…');
  file.arrayBuffer().then(function(buf){
    return pdfjsLib.getDocument({data:buf}).promise;
  }).then(function(pdf){
    var pages=[];
    for(var p=1;p<=pdf.numPages;p++) pages.push(pdf.getPage(p));
    return Promise.all(pages);
  }).then(function(pages){
    var allItems=[];
    return Promise.all(pages.map(function(page){
      return page.getTextContent().then(function(tc){
        var vp=page.getViewport({scale:1});
        tc.items.forEach(function(it){
          var s=it.str.trim(); if(!s)return;
          allItems.push({str:s,x:Math.round(it.transform[4]),y:Math.round(vp.height-it.transform[5])});
        });
      });
    })).then(function(){return allItems;});
  }).then(function(items){
    return getRules().then(function(rules){return parsePDF(items,rules);});
  }).then(function(txns){
    if(!txns.length){setMsg($('upload-msg'),'err','No transactions found in PDF.');return;}
    setMsg($('upload-msg'),'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns; showConfirm(txns);
  }).catch(function(err){setMsg($('upload-msg'),'err','Error: '+err.message);});
}

// ── CSV HANDLER ──
function handleCSV(e){
  var file=e.target.files[0]; if(!file)return;
  var msgEl=$('upload-msg'); setMsg(msgEl,'info','📊 Reading CSV…');
  file.text().then(function(text){
    return getRules().then(function(rules){return parseCSV(text,rules);});
  }).then(function(result){
    var txns=result.txns, bal=result.closingBalance;
    if(!txns.length){setMsg($('upload-msg'),'err','No transactions found in CSV.');return;}
    setMsg($('upload-msg'),'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns;
    if(bal>0){
      var d=getMonthYear();
      var banner='<div id="bal-banner" style="background:#0c2a1a;border:1px solid #1D9E75;border-radius:8px;padding:.85rem 1rem;margin-top:.75rem;font-size:13px;color:#e8eaf0">'
        +'<b style="color:#00d4a0">Bank balance detected: '+fmt(bal)+'</b><br>'
        +'<span style="font-size:12px;color:#8892b0">Closing balance for '+MFULL[d.m]+' '+d.y+'. Save to assets?</span><br>'
        +'<div style="display:flex;gap:8px;margin-top:.6rem">'
        +'<button class="btn btn-green btn-sm" onclick="saveBankBal('+bal+')">Yes, save</button>'
        +'<button class="btn btn-sm" onclick="$(\'bal-banner\').remove()">Skip</button>'
        +'</div></div>';
      $('upload-msg').insertAdjacentHTML('afterend',banner);
    }
    showConfirm(txns);
  }).catch(function(err){setMsg($('upload-msg'),'err','Error: '+err.message);});
}

// ── EXCEL HANDLER ──
function handleExcel(e){
  var file=e.target.files[0]; if(!file)return;
  var msgEl=$('upload-msg'); setMsg(msgEl,'info','📗 Reading Excel…');
  file.arrayBuffer().then(function(buf){
    var wb=XLSX.read(buf,{type:'array'});
    var csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    return getRules().then(function(rules){return parseCSV(csv,rules);});
  }).then(function(result){
    var txns=result.txns;
    if(!txns.length){setMsg($('upload-msg'),'err','No transactions found in Excel.');return;}
    setMsg($('upload-msg'),'ok','✅ '+txns.length+' transactions found. Review below.');
    pendingTxns=txns; showConfirm(txns);
  }).catch(function(err){setMsg($('upload-msg'),'err','Error: '+err.message);});
}

// ── SAVE BANK BALANCE ──
function saveBankBal(bal){
  var d=getMonthYear();
  var dateStr=d.y+'-'+String(d.m+1).padStart(2,'0')+'-01';
  sb.from('opening_balances').select('*').eq('user_id',currentUser.id).eq('name','Bank Balance — Kotak').single()
    .then(function(res){
      if(res.data){
        return sb.from('opening_balances').update({amount:bal,as_of_date:dateStr}).eq('id',res.data.id);
      } else {
        return sb.from('opening_balances').insert({user_id:currentUser.id,name:'Bank Balance — Kotak',category:'Assets',subcategory:'Other Investment',amount:bal,as_of_date:dateStr});
      }
    }).then(function(){
      var b=$('bal-banner'); if(b)b.remove();
      alert('✅ Bank balance of '+fmt(bal)+' saved to assets!');
    });
}

// ── KOTAK CSV PARSER ──
function parseCSV(text,rules){
  var lines=text.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
  var hIdx=-1;
  for(var i=0;i<lines.length;i++){
    var cols=splitCSV(lines[i]);
    if(cols[0]&&cols[0].toLowerCase().replace(/[^a-z]/g,'').includes('sl')){hIdx=i;break;}
  }
  if(hIdx===-1)return{txns:[],closingBalance:0};

  function parseDate(d){
    d=d.trim().split(' ')[0];
    var m=/^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(d);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    return d;
  }
  function cleanAmt(s){return parseFloat((s||'').replace(/[,₹"\s]/g,''))||0;}

  var txns=[],seen=new Set(),latestDate='',latestBal=0;
  for(var i=hIdx+1;i<lines.length;i++){
    var cols=splitCSV(lines[i]);
    if(!cols[0]||isNaN(parseInt(cols[0])))continue;
    var date=parseDate(cols[1]||'');
    var desc=(cols[3]||'').trim();
    var amt=cleanAmt(cols[5]);
    var drcr=(cols[6]||'').trim().toUpperCase();
    var bal=cleanAmt(cols[7]||'0');
    if(!date||!desc||!amt)continue;
    var type=drcr==='CR'?'Deposit':'Withdrawal';
    var key=date+'|'+amt+'|'+type+'|'+desc.slice(0,10);
    if(seen.has(key))continue; seen.add(key);
    // track latest date balance
    if(bal>0&&date>latestDate){latestDate=date;latestBal=bal;}
    // smart keyword matching
    var cat='',subcat='';
    for(var j=0;j<rules.length;j++){
      if(rules[j].keyword&&fuzzyMatch(desc,rules[j].keyword)){
        var applied=applyRule(rules[j],type);
        if(applied){cat=applied.cat;subcat=applied.subcat;break;}
      }
    }
    // no default category — leave blank if no match
    txns.push({date:date,desc:desc,amount:amt,type:type,cat:cat,subcat:subcat});
  }
  return{txns:txns.sort(function(a,b){return a.date.localeCompare(b.date);}),closingBalance:latestBal};
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

// ── PDF PARSER ──
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
    html+='<tr class="'+(um?'unmatched':'')+'">'
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
  pendingTxns[i].cat=cat; pendingTxns[i].subcat='';
  var s=$('cs-'+i);
  s.innerHTML='<option value="">Select sub-category</option>'+(CAT_MAP[cat]||[]).map(function(x){return'<option>'+x+'</option>';}).join('');
  s.onchange=function(){pendingTxns[i].subcat=s.value;};
}

function doImport(){
  var toAdd=pendingTxns.filter(function(t){return t.cat;});
  if(!toAdd.length){alert('Please select categories first.');return;}
  sb.from('transactions').insert(toAdd.map(function(t){
    var d=getMonthYearFromDate(t.date);
    return{user_id:currentUser.id,date:t.date,description:t.desc,amount:t.amount,type:t.type,category:t.cat,subcategory:t.subcat,month:d.m,year:d.y};
  })).then(function(res){
    if(res.error){alert('Import failed: '+res.error.message);return;}
    switchTab('txn');
  });
}



// ── SPLIT TRANSACTIONS ──
var currentSplitTxnId = null;
var currentSplitGroupId = null;
var currentSplitTotal = 0;
var splitRowsData = [];

function openSplitModal(txnId, amount) {
  currentSplitTxnId = txnId;
  currentSplitGroupId = null;
  currentSplitTotal = parseFloat(amount);
  
  $('split-orig-amt').innerText = '₹' + fmt(currentSplitTotal);
  splitRowsData = [];
  addSplitRow(); // add two rows by default for new split
  addSplitRow();
  
  renderSplitRows();
  $('modal-split').classList.remove('hide');
  $('msg-split').innerHTML = '';
}

function editSplitGroup(groupId) {
  currentSplitGroupId = groupId;
  currentSplitTxnId = null;
  
  // Find all txns in this group
  getAllTxns().then(function(allTxns) {
    var groupTxns = allTxns.filter(function(t) { return t.split_group_id === groupId; });
    if(groupTxns.length === 0) return;
    
    currentSplitTotal = groupTxns.reduce(function(sum, t) { return sum + parseFloat(t.amount); }, 0);
    $('split-orig-amt').innerText = '₹' + fmt(currentSplitTotal);
    
    splitRowsData = groupTxns.map(function(t) {
      return {
        amount: parseFloat(t.amount),
        type: t.type,
        category: t.category,
        subcategory: t.subcategory
      };
    });
    
    renderSplitRows();
    $('modal-split').classList.remove('hide');
    $('msg-split').innerHTML = '';
  });
}

function closeSplitModal() {
  $('modal-split').classList.add('hide');
}

function addSplitRow() {
  splitRowsData.push({ amount: '', type: 'Withdrawal', category: '', subcategory: '' });
  renderSplitRows();
}

function removeSplitRow(index) {
  splitRowsData.splice(index, 1);
  renderSplitRows();
}

function renderSplitRows() {
  var html = '';
  var currentSum = 0;
  
  splitRowsData.forEach(function(row, i) {
    var amt = parseFloat(row.amount) || 0;
    currentSum += amt;
    
    var catOptions = '<option value="">Category</option>' + Object.keys(CAT_MAP).map(function(c){return'<option '+(row.category===c?'selected':'')+'>'+c+'</option>';}).join('');
    var subOptions = '<option value="">Subcat</option>' + (CAT_MAP[row.category]||[]).map(function(s){return'<option '+(row.subcategory===s?'selected':'')+'>'+s+'</option>';}).join('');
    
    html += '<div class="split-row">'
      +'<input type="number" class="split-amt" placeholder="Amount" value="'+(row.amount||'')+'" oninput="updateSplitData('+i+', \'amount\', this.value)">'
      +'<select class="split-cat" oninput="updateSplitData('+i+', \'type\', this.value)"><option '+(row.type==='Withdrawal'?'selected':'')+'>Withdrawal</option><option '+(row.type==='Deposit'?'selected':'')+'>Deposit</option></select>'
      +'<select class="split-cat" onchange="updateSplitData('+i+', \'category\', this.value)">'+catOptions+'</select>'
      +'<select class="split-cat" id="split-sub-'+i+'" onchange="updateSplitData('+i+', \'subcategory\', this.value)">'+subOptions+'</select>'
      +'<div class="split-row-del" onclick="removeSplitRow('+i+')">&times;</div>'
      +'</div>';
  });
  
  $('split-rows').innerHTML = html;
  
  var rem = currentSplitTotal - currentSum;
  var remEl = $('split-rem-amt');
  remEl.innerText = '₹' + fmt(rem);
  remEl.style.color = (Math.abs(rem) < 0.01) ? 'var(--green)' : 'var(--red)';
  
  $('btn-save-split').disabled = (Math.abs(rem) > 0.01);
}

function updateSplitData(index, field, value) {
  splitRowsData[index][field] = value;
  if (field === 'category') {
    splitRowsData[index].subcategory = '';
  }
  renderSplitRows();
}

function saveSplitTxn() {
  var rem = currentSplitTotal - splitRowsData.reduce(function(s, r){ return s + (parseFloat(r.amount)||0); }, 0);
  if (Math.abs(rem) > 0.01) {
    setMsg($('msg-split'), 'err', 'Remaining amount must be exactly 0.');
    return;
  }
  
  for(var i=0; i<splitRowsData.length; i++) {
    var r = splitRowsData[i];
    if (!r.amount || !r.category) {
      setMsg($('msg-split'), 'err', 'Please fill amount and category for all rows.');
      return;
    }
  }
  
  setMsg($('msg-split'), 'info', 'Saving split...');
  
  var rpcName = currentSplitGroupId ? 'update_split_group' : 'split_transaction';
  var payload = {
    p_splits: splitRowsData
  };
  
  if (currentSplitGroupId) {
    payload.p_split_group_id = currentSplitGroupId;
  } else {
    payload.p_original_txn_id = currentSplitTxnId;
    payload.p_split_group_id = 'SPLIT-' + crypto.randomUUID();
  }
  
  sb.rpc(rpcName, payload).then(function(res) {
    if (res.error) {
      setMsg($('msg-split'), 'err', res.error.message || 'Database error occurred.');
      console.error(res.error);
    } else {
      closeSplitModal();
      renderTxn();
    }
  });
}

function deleteSplitGroup(groupId) {
  if(!confirm('Are you sure you want to delete this entire split group?')) return;
  sb.from('transactions').delete().eq('split_group_id', groupId).then(function(){ renderTxn(); });
}
