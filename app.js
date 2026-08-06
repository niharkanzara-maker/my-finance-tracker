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
const customFetch = async (url, options) => {
  options = options || {};
  let headers = new Headers(options.headers || {});
  
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch (e) {
      console.error("Error getting Firebase token:", e);
    }
  }
  
  return fetch(url, { ...options, headers: headers });
};

var sb = window.supabase.createClient(
  'https://ktbugezdzcrpuzrfnsbq.supabase.co',
  'sb_publishable_iOfsjV23yTBSeaziqfaZDw_rF-Xiz3M',
  { global: { fetch: customFetch } }
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
  ['pg-home','pg-dash','pg-demo','pg-guide'].forEach(function(p) { 
    var el = $(p);
    if (el) el.classList.add('hide'); 
  });
  var target = $(id);
  if (target) target.classList.remove('hide');
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
                .then(function(r) { currentProfile = r.data; loadCustomSubcategories(enterDash); });
            });
        });
      } else {
        currentProfile = res.data;
        loadCustomSubcategories(enterDash);
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
  getAllTxns().then(function(allTxns) {
    var dashboardTxns = [];
    if (allTxns) {
      dashboardTxns = allTxns;
    }
    if ($('sb-pname')) $('sb-pname').textContent = currentProfile.name;
    if ($('sb-ptier')) $('sb-ptier').textContent = currentProfile.unique_id;
    
    showPage('pg-dash');
    switchTab('networth');
  });
}

// ── ONBOARDING BUTTON NAVIGATION ──
window.onboardingStep1 = function() {
  showPage('pg-dash');
  switchTab('rules');
};
window.onboardingStep2 = function() {
  showPage('pg-dash');
  switchTab('upload');
};
window.onboardingStep3 = function() {
  showPage('pg-dash');
  switchTab('upload');
};
window.onboardingStep4 = function() {
  showPage('pg-dash');
  switchTab('upload');
};

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
    'txn': 'Confirmed Transactions',
    'snapshot': 'Monthly Snapshot',
    'summary': 'Monthly Summary',
    'networth': 'Net Worth Monitoring',
    'annual': 'Annual Analysis',
    'accounts': 'Accounts',
    'rules': 'Categorization Rules',
    'upload': 'Upload Statement'
  };
  var titleEl = $('page-title');
  if(titleEl) titleEl.textContent = titles[t] || 'Dashboard';

  ['txn','snapshot','summary','networth','annual','accounts','rules','upload'].forEach(function(x) {
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
  else if (t==='accounts') renderAccounts();
  else if (t==='rules')    renderRules();
  else if (t==='upload')   renderUpload();
  
  if (window.innerWidth <= 1024) {
    $('sidebar').classList.remove('show');
    if ($('sidebar-backdrop')) $('sidebar-backdrop').classList.add('hide');
  }
}

function toggleSidebar() {
  $('sidebar').classList.toggle('show');
  if ($('sidebar-backdrop')) $('sidebar-backdrop').classList.toggle('hide');
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
    .then(function(r){ 
      return (r.data||[]).filter(function(t) { return t.status !== 'PENDING'; });
    });
}
function getPendingTxns() {
  return sb.from('transactions').select('*').eq('user_id',currentUser.id).eq('status','PENDING')
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
      return { 
        user_id: currentUser.id, 
        keyword: r.keyword, 
        category: r.cat, 
        subcategory: r.subcat,
        applies_to_all_accounts: r.appliesToAll,
        account_id: r.accountId
      };
    }));
  });
}

// ── UNIFIED AGGREGATION ──
function getUnifiedMonthlyData(txns, snaps, m, y) {
  var mTxns = txns.filter(function(t) { 
    if (t.month !== undefined && t.year !== undefined) return t.month === m && t.year === y;
    var d = getMonthYearFromDate(t.date);
    return d.m === m && d.y === y;
  });
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
  type: 'ALL', // 'ALL', 'INCOME', 'EXPENSES'
  bank: 'All Banks'
};

function applyFilters() {
  filterState.dateRange = $('filt-date') ? $('filt-date').value : 'Current Month';
  if (filterState.dateRange === 'Custom Range') {
    filterState.startDate = $('filt-start').value;
    filterState.endDate = $('filt-end').value;
  }
  filterState.category = $('filt-cat') ? $('filt-cat').value : 'All Categories';
  filterState.bank = $('filt-bank') ? $('filt-bank').value : 'All Banks';
  filterState.minAmount = $('filt-min') ? $('filt-min').value : '';
  renderTxn();
}

function clearFilters() {
  filterState = { dateRange: 'Current Month', startDate: '', endDate: '', category: 'All Categories', minAmount: '', type: 'ALL', bank: 'All Banks' };
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
      
      // 5. Bank Name
      if (filterState.bank !== 'All Banks' && t.bank_name !== filterState.bank) return false;
      
      // 6. Date Range
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
    var uniqueBanks = [...new Set(allTxns.filter(function(t){ return t.bank_name; }).map(function(t){ return t.bank_name; }))].sort();
    var bankOpts = '<option '+(filterState.bank==='All Banks'?'selected':'')+'>All Banks</option>';
    uniqueBanks.forEach(function(b) { bankOpts += '<option '+(filterState.bank===b?'selected':'')+'>'+b+'</option>'; });

    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:1.5rem;align-items:end">';
    
    html += '<div class="field" style="flex:1;min-width:150px"><label>Date Range</label><div style="position:relative"><i class="ph ph-calendar-blank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
      +'<select id="filt-date" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary)" onchange="updateDateRangeUI()">'
      +'<option '+(filterState.dateRange==='Current Month'?'selected':'')+'>Current Month</option>'
      +'<option '+(filterState.dateRange==='Last 30 Days'?'selected':'')+'>Last 30 Days</option>'
      +'<option '+(filterState.dateRange==='Previous Month'?'selected':'')+'>Previous Month</option>'
      +'<option '+(filterState.dateRange==='Last 6 Months'?'selected':'')+'>Last 6 Months</option>'
      +'<option '+(filterState.dateRange==='Custom Range'?'selected':'')+'>Custom Range</option>'
      +'</select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>';
      
    html += '<div class="field" style="flex:1;min-width:150px"><label>Category</label><div style="position:relative"><i class="ph ph-intersect" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
      +'<select id="filt-cat" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary)">'
      +'<option '+(filterState.category==='All Categories'?'selected':'')+'>All Categories</option>'
      +'<option '+(filterState.category==='Income'?'selected':'')+'>Income</option>'
      +'<option '+(filterState.category==='Expenses'?'selected':'')+'>Expenses</option>'
      +'<option '+(filterState.category==='Assets'?'selected':'')+'>Assets</option>'
      +'<option '+(filterState.category==='Liabilities'?'selected':'')+'>Liabilities</option>'
      +'</select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>';
      
    html += '<div class="field" style="flex:1;min-width:150px"><label>Bank</label><div style="position:relative"><i class="ph ph-bank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
      +'<select id="filt-bank" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary)">'
      +bankOpts
      +'</select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>';
      
    html += '<div class="field" style="flex:1;min-width:120px"><label>Min. Amount (₹)</label><div style="position:relative"><i class="ph ph-currency-inr" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i><input type="number" id="filt-min" value="'+filterState.minAmount+'" placeholder="0.00" style="padding-left:36px"></div></div>';
    
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
      +'<div class="field"><label>Subcategory</label><select id="new-subcat" onchange="handleSubcatChange(this, $(\'new-cat\').value)"><option value="">Select sub-category</option></select></div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;justify-content:flex-end">'
      +'<button class="btn" onclick="toggleAddForm()">Cancel</button>'
      +'<button class="btn btn-blue-glow" onclick="saveTxnRow()"><i class="ph ph-check"></i> Save transaction</button>'
      +'</div><div class="msg" id="txn-form-msg"></div></div>';

    if (filtered.length) {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:1rem;"><button class="btn btn-red" id="btn-delete-dash" style="opacity:0.5;pointer-events:none;" onclick="deleteSelectedDash()">Delete Selected (0)</button></div>'
        +'<div class="section" style="padding:0;overflow:hidden"><div class="tbl-wrap" style="overflow-x:auto"><table class="data-tbl" style="width:100%;border-collapse:collapse;text-align:left"><thead><tr style="border-bottom:1px solid var(--border);font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.1em">'
        +'<th style="width:40px;text-align:center;"><input type="checkbox" id="selectAllDash" onchange="toggleAllDash(this.checked)"></th>'
        +'<th style="padding:16px 20px">Date</th><th style="padding:16px 20px">Description</th><th style="padding:16px 20px">Bank Name</th><th style="padding:16px 20px">Category</th><th style="padding:16px 20px">Subcategory</th><th style="padding:16px 20px;text-align:right">Amount</th><th style="padding:16px 20px;text-align:right">Action</th>'
        +'</tr></thead><tbody>';
      
      window.dashboardTxns = filtered;
      filtered.forEach(function(t) {
        var isDep = t.type==='Deposit';
        var dObj = new Date(t.date);
        var dateStr = MFULL[dObj.getMonth()].substring(0,3).toUpperCase() + ' ' + dObj.getDate() + ', ' + dObj.getFullYear();
        var icon = isDep ? 'ph-money' : 'ph-shopping-bag';
        var catColor = CAT_COLORS[t.category]||'#8892b0';
        
        var txnNoHtml = t.txn_no ? '<span style="font-size:9px;color:var(--blue);font-weight:bold;margin-right:6px">['+t.txn_no+']</span>' : '';
        var splitTagHtml = t.split_group_id ? '<span style="font-size:9px;color:#a855f7;margin-left:6px;border:1px solid #a855f7;padding:1px 4px;border-radius:4px">SPLIT</span>' : '';
        
        var actionsHtml = '<button class="icon-btn" onclick="openDashActionMenu(event, \''+t.id+'\', '+(t.split_group_id?'\''+t.split_group_id+'\'':'null')+')"><i class="ph ph-dots-three-vertical" style="font-size:18px;color:var(--text-secondary)"></i></button>';

        html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.02);transition:var(--transition)" onmouseover="this.style.backgroundColor=\'rgba(255,255,255,0.02)\'" onmouseout="this.style.backgroundColor=\'transparent\'">'
          +'<td style="text-align:center;"><input type="checkbox" class="dash-cb pending-cb" value="'+t.id+'" onchange="checkDashActions()"></td>'
          +'<td style="padding:16px 20px;font-size:13px;color:var(--text-secondary);white-space:nowrap">'+dateStr+'</td>'
          +'<td style="padding:16px 20px;display:flex;align-items:center;gap:12px">'
            +'<div style="width:32px;height:32px;border-radius:8px;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;color:var(--text-primary)"><i class="ph '+icon+'"></i></div>'
            +'<div><div style="font-weight:600;font-size:13px;color:var(--text-primary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.description+'">'+txnNoHtml+t.description+splitTagHtml+'</div><div style="font-size:10px;color:var(--text-secondary)">'+(t.subcategory||t.category||'Other')+'</div></div>'
          +'</td>'
          +'<td style="padding:16px 20px"><span class="badge" style="background:var(--bg-card2);color:var(--text-primary);border:1px solid var(--border);font-size:11px;padding:2px 6px;">'+(t.bank_name || '-')+'</span></td>'
          +'<td style="padding:16px 20px"><span class="tag tg" style="background:'+catColor+'15;color:'+catColor+';border:1px solid '+catColor+'33;font-size:9px;letter-spacing:0.05em;text-transform:uppercase">'+(t.category||'Uncategorized')+'</span></td>'
          +'<td style="padding:16px 20px"><span class="tag tg" style="background:'+catColor+'15;color:'+catColor+';border:1px solid '+catColor+'33;font-size:9px;letter-spacing:0.05em;text-transform:uppercase">'+(t.subcategory||'None')+'</span></td>'
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
  sub.innerHTML = getSubcatOptionsHTML(cat, '');
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
    html += '<div class="summary-bottom-row" style="display:grid;grid-template-columns:1fr 2fr;gap:1.5rem">';
    
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
  showLoading('Loading net worth...');
  Promise.all([getOpeningBalances(), getAllTxns(), getAllSnapshots(), getRules(), getPendingTxns()]).then(function(results) {
    var ob=results[0], at=results[1], as=results[2], rules=results[3]||[], pending=results[4]||[];
    
    if (at && at.length === 0) {
      var step1Completed = rules.length > 0;
      var step2Completed = pending.length > 0;
      
      var step1HTML = step1Completed ? `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid #10b981; background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep1()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="ph ph-check-circle"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: #10b981; font-weight: 600;">Step 1 Completed</div>
              <h3 style="margin: 4px 0 8px 0;">Configure Rules</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">You have successfully configured categorization rules.</p>
              <button class="btn btn-outline" style="margin-top: 16px; width: fit-content; border-color: #10b981; color: #10b981;">Edit Rules</button>
            </div>
          </div>
      ` : `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid var(--blue); background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep1()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon"><i class="ph ph-faders"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: var(--blue); font-weight: 600;">Step 1</div>
              <h3 style="margin: 4px 0 8px 0;">Configure Rules</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Set up categorization rules to automate your transaction tracking.</p>
              <button class="btn btn-blue" style="margin-top: 16px; width: fit-content;">Start Configuration</button>
            </div>
          </div>
      `;

      var step2HTML = step2Completed ? `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid #10b981; background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep2()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="ph ph-check-circle"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: #10b981; font-weight: 600;">Step 2 Completed</div>
              <h3 style="margin: 4px 0 8px 0;">Upload Statement</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">You have successfully imported your bank statement.</p>
              <button class="btn btn-outline" style="margin-top: 16px; width: fit-content; border-color: #10b981; color: #10b981;">Upload Another</button>
            </div>
          </div>
      ` : (step1Completed ? `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid var(--blue); background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep2()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon"><i class="ph ph-cloud-arrow-up"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: var(--blue); font-weight: 600;">Step 2</div>
              <h3 style="margin: 4px 0 8px 0;">Upload Statement</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Import your first bank statement safely and securely.</p>
              <button class="btn btn-blue" style="margin-top: 16px; width: fit-content;">Upload Now</button>
            </div>
          </div>
      ` : `
          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-cloud-arrow-up"></i></div>
            <div class="step-content">
              <div class="step-number">Step 2</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Upload Statement <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Import your first bank statement safely and securely.</p>
            </div>
          </div>
      `);

      var step3HTML = step2Completed ? `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid var(--blue); background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep3()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon"><i class="ph ph-magnifying-glass"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: var(--blue); font-weight: 600;">Step 3</div>
              <h3 style="margin: 4px 0 8px 0;">Review Transactions</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Verify and categorize your ${pending.length} imported transactions.</p>
              <button class="btn btn-blue" style="margin-top: 16px; width: fit-content;">Review Now</button>
            </div>
          </div>
      ` : `
          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-magnifying-glass"></i></div>
            <div class="step-content">
              <div class="step-number">Step 3</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Review Transactions <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Verify and categorize your imported transactions.</p>
            </div>
          </div>
      `;

      var step4HTML = step2Completed ? `
          <div class="step-card" style="cursor: pointer; border-left: 4px solid var(--blue); background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep4()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon"><i class="ph ph-check-square"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: var(--blue); font-weight: 600;">Step 4</div>
              <h3 style="margin: 4px 0 8px 0;">Confirm Transactions</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Approve your transactions to permanently unlock your dashboard.</p>
              <button class="btn btn-blue" style="margin-top: 16px; width: fit-content;">Confirm Now</button>
            </div>
          </div>
      ` : `
          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-check-square"></i></div>
            <div class="step-content">
              <div class="step-number">Step 4</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Confirm Transactions <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Approve your transactions to permanently unlock your dashboard.</p>
            </div>
          </div>
      `;

      document.getElementById('pg-dash-body').innerHTML = `
      <div style="padding: 32px; max-width: 800px; margin: 0 auto; animation: fade-in 0.3s ease;">
        <h2 style="font-size: 28px; color: var(--text-primary); margin-bottom: 8px;">Welcome to The FinTracker</h2>
        <p style="color: var(--text-secondary); margin-bottom: 32px; font-size: 15px; line-height: 1.6;">Welcome aboard! Complete the following onboarding steps to configure your account and unlock your financial dashboard.</p>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${step1HTML}
          ${step2HTML}
          ${step3HTML}
          ${step4HTML}
        </div>
      </div>
      `;
      return;
    }

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
    
    at.forEach(function(t){ 
      if (t.month !== undefined && t.year !== undefined) updateDelta(t.year, t.month, 0); 
      else { var d = getMonthYearFromDate(t.date); updateDelta(d.y, d.m, 0); }
    }); // Just to register month
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
      +'<div class="nw-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem">'
      +'<div><div style="font-size:11px;color:var(--text-secondary);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Current Net Worth</div>'
      +'<div style="font-size:36px;font-weight:700;color:var(--text-primary);line-height:1.2">'+(nw.netWorth<0?'-':'')+fmt(Math.abs(nw.netWorth))+'</div></div>'
      +'<div class="nw-period-btns" style="display:flex;gap:4px;flex-wrap:wrap">'
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

// ================== ACCOUNTS MODULE ==================
function getAccounts() {
  return sb.from('accounts').select('*').eq('user_id', currentUser.id)
    .then(function(res) { return res.data || []; });
}

function renderAccounts() {
  showLoading('Loading accounts...');
  getAccounts().then(function(accounts) {
    var html = '<div class="section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem"><div class="sec-title" style="margin:0">Accounts</div><button class="btn btn-blue btn-sm" onclick="openAccountModal()">+ Add Account</button></div>';
    
    if(!accounts.length) {
      html += '<div class="empty"><div class="empty-icon">🏦</div>No accounts found. Create one to get started.</div></div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:1rem;">';
      accounts.forEach(function(acc) {
        var statusColor = acc.status === 'Active' ? 'var(--green)' : 'var(--text-secondary)';
        var bName = acc.bank_name==='kotak'?'Kotak Mahindra Bank':(acc.bank_name==='sbi'?'State Bank of India':(acc.bank_name==='hdfc'?'HDFC Bank':acc.bank_name));
        html += '<div style="background:var(--bg-input);padding:1.25rem;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">'
          + '<div>'
          + '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px">🏦 ' + acc.account_name + '</div>'
          + '<div style="font-size:13px;color:var(--text-secondary);display:flex;gap:16px;">'
          + '<span><b>Bank:</b> ' + bName + '</span>'
          + '<span><b>Type:</b> ' + acc.account_type + '</span>'
          + '<span><b>Status:</b> <span style="color:'+statusColor+'">' + acc.status + '</span></span>'
          + '</div></div>'
          + '<div style="display:flex;gap:8px;">'
          + '<button class="btn btn-outline btn-sm" onclick="openAccountModal(\''+acc.id+'\',\''+encodeURIComponent(acc.account_name)+'\',\''+acc.bank_name+'\',\''+acc.account_type+'\',\''+acc.status+'\')">Edit</button>'
          + '<button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="deleteAccount(\''+acc.id+'\')"><i class="ph ph-trash"></i></button>'
          + '</div></div>';
      });
      html += '</div></div>';
    }
    $('pg-dash-body').innerHTML = html;
  });
}

function openAccountModal(id, name, bank, type, status) {
  var msg = $('acc-msg');
  if(msg) { msg.innerHTML = ''; msg.className = 'msg'; }
  var t = $('account-modal-title');
  if(t) t.innerText = id ? 'Edit Account' : 'Add Account';
  if($('acc-id')) $('acc-id').value = id || '';
  if($('acc-name')) $('acc-name').value = name ? decodeURIComponent(name) : '';
  if($('acc-bank')) $('acc-bank').value = bank || 'kotak';
  if($('acc-type')) $('acc-type').value = type || 'Savings';
  if($('acc-status')) $('acc-status').value = status || 'Active';
  if($('modal-account')) $('modal-account').classList.remove('hide');
}

function saveAccount() {
  var id = $('acc-id').value;
  var name = $('acc-name').value.trim();
  var bank = $('acc-bank').value;
  var type = $('acc-type').value;
  var status = $('acc-status').value;
  
  if(!name) { setMsg($('acc-msg'), 'err', 'Account Name is required.'); return; }
  
  var payload = { account_name: name, bank_name: bank, account_type: type, status: status, user_id: currentUser.id };
  var p;
  if(id) { p = sb.from('accounts').update(payload).eq('id', id); }
  else { p = sb.from('accounts').insert([payload]); }
  
  p.then(function(res) {
    if(res.error) { setMsg($('acc-msg'), 'err', res.error.message); return; }
    $('modal-account').classList.add('hide');
    if($('tab-accounts') && $('tab-accounts').classList.contains('active')) renderAccounts();
  });
}

function deleteAccount(id) {
  if(!confirm('Are you sure you want to delete this account?')) return;
  sb.from('accounts').delete().eq('id', id).then(function() {
    renderAccounts();
  });
}

// ── TAB 5: MY RULES ──
function renderRules() {
  showLoading('Loading rules...');
  Promise.all([getRules(), getAccounts()]).then(function(res) {
    var rules = res[0];
    var accounts = res[1];
    window._cachedAccounts = accounts;
    
    var html='<div class="section"><div class="sec-title">My keyword rules</div>'
      +'<p style="font-size:12px;color:#8892b0;margin-bottom:1rem;line-height:1.7">Keywords matched against bank statement descriptions for auto-categorization.</p>'
      +'<div style="overflow-x:auto"><table class="rules-tbl"><thead><tr>'
      +'<th style="width:25%">Keyword</th><th style="width:20%">Category</th><th style="width:25%">Sub-category</th><th style="width:20%">Applies To</th><th style="width:10%"></th>'
      +'</tr></thead><tbody id="rules-body"></tbody></table></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.85rem">'
      +'<button class="btn btn-sm" onclick="addRuleRow()">+ Add row</button>'
      +'<button class="btn btn-green" onclick="saveRules()">Save rules</button>'
      +'</div><div class="msg" id="rules-msg"></div></div>';
    $('pg-dash-body').innerHTML=html;
    var tbody=$('rules-body');
    if(!rules.length){addRuleRow();return;}
    rules.forEach(function(r){
      addRuleRow(r.keyword, r.category, r.subcategory, r.applies_to_all_accounts, r.account_id);
    });
  });
}

function addRuleRow(kw, cat, subcat, appliesToAll, accountId){
  kw=kw||'';cat=cat||'';subcat=subcat||'';
  var tbody=$('rules-body'),tr=document.createElement('tr');
  var subOpts=getSubcatOptionsHTML(cat, subcat);
  
  var accOpts = '<option value="all" '+(appliesToAll !== false ? 'selected' : '')+'>All Accounts</option>';
  if (window._cachedAccounts) {
    window._cachedAccounts.forEach(function(a) {
      var isSel = (appliesToAll === false && accountId === a.id) ? 'selected' : '';
      accOpts += '<option value="'+a.id+'" '+isSel+'>'+a.account_name+'</option>';
    });
  }
  
  tr.innerHTML='<td><input type="text" placeholder="e.g. SWIGGY, SALARY" value="'+kw+'" style="text-transform:uppercase"></td>'
    +'<td><select onchange="updateSubInRow(this)"><option value="">Select</option>'
    +Object.keys(CAT_MAP).map(function(c){return'<option '+(c===cat?'selected':'')+'>'+c+'</option>';}).join('')
    +'</select></td>'
    +'<td><select onchange="handleSubcatChange(this, this.closest(\'tr\').cells[1].querySelector(\'select\').value)">'+subOpts+'</select></td>'
    +'<td><select>'+accOpts+'</select></td>'
    +'<td><button class="btn btn-outline" style="padding:6px;border-color:var(--border);color:var(--text-secondary)" onclick="this.closest(\'tr\').remove()"><i class="ph ph-trash"></i></button></td>';
  tbody.appendChild(tr);
}
function updateSubInRow(sel){
  var cat=sel.value,subSel=sel.closest('tr').cells[2].querySelector('select');
  subSel.innerHTML=getSubcatOptionsHTML(cat, '');
}
function saveRules(){
  var rows=[].slice.call($('rules-body').querySelectorAll('tr'));
  var rules=rows.map(function(tr){
    var accVal = tr.cells[3].querySelector('select').value;
    var appliesToAll = accVal === 'all';
    var accountId = appliesToAll ? null : accVal;
    return{
      keyword:tr.cells[0].querySelector('input').value.trim().toUpperCase(),
      cat:tr.cells[1].querySelector('select').value,
      subcat:tr.cells[2].querySelector('select').value,
      appliesToAll: appliesToAll,
      accountId: accountId
    };
  }).filter(function(r){return r.keyword&&r.cat;});
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
    var sO=getSubcatOptionsHTML(t.cat, t.subcat);
    html+='<tr class="'+(um?'unmatched':'')+'">'
      +'<td style="white-space:nowrap">'+t.date+'</td>'
      +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.desc+'">'+t.desc+'</td>'
      +'<td><span class="badge '+(t.type==='Deposit'?'b-dep':'b-wit')+'">'+t.type+'</span></td>'
      +'<td style="text-align:right;font-weight:600;white-space:nowrap">'+fmt(t.amount)+'</td>'
      +'<td><select onchange="updCat('+i+',this.value)">'+cO+'</select></td>'
      +'<td><select id="cs-'+i+'" onchange="handleSubcatChange(this, pendingTxns['+i+'].cat, function(v){pendingTxns['+i+'].subcat=v;})">'+sO+'</select></td>'
      +'</tr>';
  });
  $('confirm-body').innerHTML=html;
  $('confirm-sec').style.display='block';
}

function updCat(i,cat){
  pendingTxns[i].cat=cat; pendingTxns[i].subcat='';
  var s=$('cs-'+i);
  s.innerHTML=getSubcatOptionsHTML(cat, '');
  s.onchange=function(){handleSubcatChange(s, cat, function(v){pendingTxns[i].subcat=v;});};
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
    var subOptions = getSubcatOptionsHTML(row.category, row.subcategory);
    
    html += '<div class="split-row">'
      +'<input type="number" class="split-amt" placeholder="Amount" value="'+(row.amount||'')+'" oninput="updateSplitData('+i+', \'amount\', this.value)">'
      +'<select class="split-cat" oninput="updateSplitData('+i+', \'type\', this.value)"><option '+(row.type==='Withdrawal'?'selected':'')+'>Withdrawal</option><option '+(row.type==='Deposit'?'selected':'')+'>Deposit</option></select>'
      +'<select class="split-cat" onchange="updateSplitData('+i+', \'category\', this.value)">'+catOptions+'</select>'
      +'<select class="split-cat" id="split-sub-'+i+'" onchange="handleSubcatChange(this, splitRowsData['+i+'].category, function(v){updateSplitData('+i+', \'subcategory\', v)})">'+subOptions+'</select>'
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

// --- UNIFIED UPLOAD V2 OVERRIDES ---
window.renderUpload = function() {
  var pg = document.getElementById('pg-dash-body');
  if(!pg) return;
  
  showLoading('Loading accounts...');
  getAccounts().then(function(accounts) {
    if(!accounts.length) {
      pg.innerHTML = '<div class="section"><div class="empty"><div class="empty-icon">🏦</div>No accounts found. Please add an Account in the Accounts tab before uploading statements.</div></div>';
      return;
    }
    
    var cy = new Date().getFullYear();
    var ys = '<option value="all">All Years</option>'; for(var y=cy; y>=cy-5; y--) ys += '<option value="'+y+'">'+y+'</option>';
    
    var accOptions = '';
    accounts.forEach(function(a) {
      accOptions += '<option value="'+a.id+'" data-bank="'+a.bank_name+'">'+a.account_name+'</option>';
    });
    
    pg.innerHTML = '<div class="section"><div class="sec-title">Upload bank statement</div>'
      +'<p style="font-size:12px;color:#8892b0;margin-bottom:1.25rem;line-height:1.7">Upload your CSV or Excel statement.</p>'
      +'<div style="margin-bottom: 1rem;"><label style="font-size: 13px; color:#ccd6f6; margin-right: 10px;">Select Account:</label>'
      +'<select id="bank-selector" style="padding: 6px 12px; border-radius: 4px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border);">'
      + accOptions + '</select></div>'
      +'<div class="upload-zone" id="zone-unified" style="border: 2px dashed #233554; padding: 2rem; text-align: center; cursor: pointer; border-radius: 8px; max-width: 600px; margin: 0 auto;"><div class="u-ico" style="margin-bottom: 0.5rem;"><i class="ph ph-folder-open" style="font-size:32px;color:var(--text-secondary)"></i></div><p>Click or drag to select <b>CSV or Excel statement</b></p></div>'
      +'<input type="file" id="file-unified" accept=".csv,.xlsx,.xls" style="display:none">'
      +'<div class="msg" id="upload-msg" style="margin-top:.75rem;font-size:13px"></div></div>'
      +'<div id="confirm-sec" style="display:none"><div class="section">'
      +'<div class="sec-title" style="display:flex; justify-content:space-between; align-items:center;">'
      +'  <span>Review & Confirm Uploaded transactions <span id="txn-count" style="font-size:12px;color:#8892b0;font-weight:400;margin-left:8px;"></span></span>'
      +'  <div><button class="btn btn-outline" id="btn-del-selected" style="padding: 6px 16px; font-size:13px; margin-right:8px; display:none; border-color:#ef4444; color:#ef4444;" onclick="deleteSelectedPending()">Delete Selected</button>'
      +'  <button class="btn btn-green" id="btn-confirm-all" style="padding: 6px 16px; font-size:13px; opacity: 0.5; pointer-events: none;" onclick="confirmSelectedPending()">Confirm Selected (0)</button></div>'
      +'</div>'
      +'<p style="font-size:12px;color:#8892b0;margin-bottom:1.5rem"><span style="color:#ff6b6b">■</span> Orange rows = unmatched - please select a category.</p>'
      +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:1.5rem">'
      +'<div style="display:flex; gap:16px; margin-bottom:1.5rem; align-items:end; flex-wrap:wrap;">'
      +'  <div class="field" style="width:200px;"><label>Month</label><div style="position:relative"><i class="ph ph-calendar-blank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
    +'    <select id="pend-month" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary);"><option value="all">All Months</option><option value="01">January</option><option value="02">February</option><option value="03">March</option><option value="04">April</option><option value="05">May</option><option value="06">June</option><option value="07">July</option><option value="08">August</option><option value="09">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select>'
    +'    <i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>'
    +'  <div class="field" style="width:200px;"><label>Year</label><div style="position:relative"><i class="ph ph-calendar-blank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
    +'    <select id="pend-year" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary);">'+ys+'</select>'
    +'    <i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>'
    +'  <div class="field" style="width:200px;"><label>Bank Name</label><div style="position:relative"><i class="ph ph-bank" style="position:absolute;left:12px;top:12px;color:var(--text-secondary)"></i>'
    +'    <select id="pend-bank" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:10px 12px 10px 36px;appearance:none;color:var(--text-primary);">'
    +'      <option value="All">All Banks</option>'
    +'    </select><i class="ph ph-caret-down" style="position:absolute;right:12px;top:12px;color:var(--text-secondary);pointer-events:none"></i></div></div>'
    +'  <div style="display:flex;height:42px;"><button class="btn btn-blue-glow" style="padding:0 24px;" onclick="fetchPendingTxns()">Apply Filters</button></div>'
    +'</div></div>'
    +'<div class="tbl-wrap"><table class="data-tbl"><thead><tr><th style="width:40px;text-align:center;"><input type="checkbox" id="selectAllPending" onchange="toggleAllPending(this.checked)"></th><th>Date</th><th>Description</th><th>Bank Name</th><th>Type</th><th>Amount</th><th>Category</th><th>Sub-category</th><th>Action</th></tr></thead>'
    +'<tbody id="confirm-body"></tbody></table></div>'
    +'</div></div>';

  var z = document.getElementById('zone-unified');
  var f = document.getElementById('file-unified');
  if(z && f) {
    z.onclick = function() { f.click(); };
    z.ondragover = function(e){ e.preventDefault(); z.style.borderColor = '#64ffda'; };
    z.ondragleave = function(e){ e.preventDefault(); z.style.borderColor = '#233554'; };
    z.ondrop = function(e){
      e.preventDefault();
      z.style.borderColor = '#233554';
      if(e.dataTransfer.files && e.dataTransfer.files.length>0) {
        handleUnifiedFile(e.dataTransfer.files[0]);
      }
    };
    f.onchange = function(e) {
      if(e.target.files && e.target.files.length>0) {
        handleUnifiedFile(e.target.files[0]);
      }
    };
  }
  
  if(currentUser) {
    sb.from('transactions').select('bank_name').eq('user_id', currentUser.id).eq('status', 'PENDING').then(function(res) {
      if(res.data) {
        var bSel = document.getElementById('pend-bank');
        if(bSel) {
          var banks = [...new Set(res.data.filter(function(t){return t.bank_name;}).map(function(t){return t.bank_name;}))].sort();
          var currentVal = bSel.value;
          var html = '<option value="All">All Banks</option>';
          banks.forEach(function(b) { html += '<option value="'+b+'" '+(currentVal===b?'selected':'')+'>'+b+'</option>'; });
          bSel.innerHTML = html;
        }
      }
    });
  }
  
  fetchPendingTxns();
  });
};

window.handleUnifiedFile = function(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  var sel = document.getElementById('bank-selector');
  var accountId = sel.value;
  var bankCode = sel.options[sel.selectedIndex].getAttribute('data-bank');
  setMsg(document.getElementById('upload-msg'), 'info', 'Parsing ' + file.name + '...');

  if(ext === 'csv') {
    var reader = new FileReader();
    reader.onload = function(e) { processParsedResult(e.target.result, accountId, bankCode, 'csv'); };
    reader.readAsText(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    if(typeof XLSX === 'undefined') { setMsg(document.getElementById('upload-msg'), 'err', 'Excel parser missing.'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var data = new Uint8Array(e.target.result);
      try {
        var workbook = XLSX.read(data, {type: 'array'});
        var csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        processParsedResult(csv, accountId, bankCode, 'excel');
      } catch (err) {
        var errStr = (err.message || '').toLowerCase();
        if(errStr.includes('password') || errStr.includes('encrypt') || errStr.includes('cfb')) {
          var pwd = prompt("This Excel file is password protected. Please enter the password to decrypt:");
          if(!pwd) {
            setMsg(document.getElementById('upload-msg'), 'err', 'Upload cancelled: Password is required.');
            return;
          }
          
          setMsg(document.getElementById('upload-msg'), 'info', '<i class="ph ph-spinner ph-spin"></i> Decrypting securely at the edge...');
          
          // Convert array buffer to base64
          var binary = '';
          for (var i = 0; i < data.byteLength; i++) {
            binary += String.fromCharCode(data[i]);
          }
          var base64 = btoa(binary);

          sb.functions.invoke('decrypt-excel', {
            body: { fileBase64: base64, password: pwd }
          }).then(function(res) {
            if(res.error) {
              setMsg(document.getElementById('upload-msg'), 'err', 'Decryption failed: ' + res.error.message);
              return;
            }
            if(!res.data || res.data.error) {
              setMsg(document.getElementById('upload-msg'), 'err', 'Decryption failed: ' + (res.data ? res.data.error : 'Incorrect password'));
              return;
            }
            
            try {
              var decBin = atob(res.data.csvBase64 || res.data.excelBase64);
              var decArr = new Uint8Array(decBin.length);
              for(var k=0; k<decBin.length; k++) { decArr[k] = decBin.charCodeAt(k); }
              var decWb = XLSX.read(decArr, {type: 'array'});
              var decCsv = XLSX.utils.sheet_to_csv(decWb.Sheets[decWb.SheetNames[0]]);
              setMsg(document.getElementById('upload-msg'), 'info', 'File decrypted successfully! Parsing...');
              processParsedResult(decCsv, accountId, bankCode, 'excel');
            } catch(e2) {
               setMsg(document.getElementById('upload-msg'), 'err', 'Failed to read decrypted file content.');
            }
          }).catch(function(funcErr) {
            setMsg(document.getElementById('upload-msg'), 'err', 'Edge function error: ' + funcErr.message);
          });
        } else {
          setMsg(document.getElementById('upload-msg'), 'err', 'Failed to read Excel file: ' + err.message);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    setMsg(document.getElementById('upload-msg'), 'err', 'Unsupported file type: ' + ext);
  }
};

window.processParsedResult = function(csvString, accountId, bankCode, type) {
  var lines = [];
  var currentLine = '';
  var inQGlobal = false;
  for(var i=0; i<csvString.length; i++) {
    var c = csvString[i];
    if(c === '"') { inQGlobal = !inQGlobal; }
    
    if((c === '\n' || c === '\r') && !inQGlobal) {
      if (c === '\r' && csvString[i+1] === '\n') i++;
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += c;
    }
  }
  if(currentLine) lines.push(currentLine);

  var txns = [];
  var foundHeader = false;
  var latestDate = '';
  var latestBal = 0;
  
  var sel = document.getElementById('bank-selector');
  var bankPretty = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : bankCode;

  for(var i=0; i<lines.length; i++) {
    var line = lines[i].trim();
    if(!line) continue;
    var cols = []; var inQ = false, val = '';
    for(var j=0; j<line.length; j++) {
      var c = line[j];
      if(c === '"') { inQ = !inQ; }
      else if(c === ',' && !inQ) { cols.push(val.trim()); val = ''; }
      else { val += c; }
    }
    cols.push(val.trim());
    var lc = line.toLowerCase();
    if(!foundHeader) {
      if(bankCode === 'kotak' && lc.includes('sl') && lc.includes('description')) { foundHeader = true; }
      else if (bankCode === 'sbi' && lc.includes('date') && (lc.includes('narration') || lc.includes('description') || lc.includes('particulars') || lc.includes('details'))) { foundHeader = true; }
      else if (bankCode === 'hdfc' && lc.includes('date') && lc.includes('narration')) { foundHeader = true; }
      continue;
    }
    if(bankCode === 'kotak' && cols.length >= 9) {
      var dateStr = cols[2].trim();
      var desc = cols[3].trim();
      var amtStr = cols[5] ? cols[5].replace(/,/g,'') : '0';
      var amt = parseFloat(amtStr);
      var typeStr = cols[6] ? cols[6].toUpperCase().trim() : '';
      
      var tType = (typeStr === 'CR') ? 'Deposit' : 'Withdrawal';
      
      var dateSep = dateStr.includes('-') ? '-' : '/';
      var dateParts = dateStr.split(dateSep);
      if(dateParts.length === 3) {
        var yy = dateParts[2].length === 2 ? '20'+dateParts[2] : dateParts[2];
        var mm = dateParts[1].padStart(2, '0');
        var dd = dateParts[0].padStart(2, '0');
        var date = yy + '-' + mm + '-' + dd;
        if(amt > 0) txns.push({date: date, desc: desc, amount: amt, type: tType, bank_name: bankPretty, account_id: accountId});
      }
    } else if (bankCode === 'sbi' && cols.length >= 5) {
      var dateStr = cols[0] ? cols[0].trim() : '';
      var desc = cols[1] ? cols[1].trim() : '';
      var dr = parseFloat(cols[3] ? cols[3].replace(/,/g,'') : '0');
      var cr = parseFloat(cols[4] ? cols[4].replace(/,/g,'') : '0');
      var bal = parseFloat(cols[5] ? cols[5].replace(/,/g,'') : '0');
      
      var dateSep = dateStr.includes('/') ? '/' : '-';
      var dateParts = dateStr.split(dateSep);
      if(dateParts.length === 3) {
        var m = MONTHS.indexOf(dateParts[1]);
        var mStr = m !== -1 ? (m+1).toString().padStart(2, '0') : dateParts[1].padStart(2, '0');
        var yStr = dateParts[2].length === 2 ? '20'+dateParts[2] : dateParts[2];
        var parsedDate = yStr+'-'+mStr+'-'+dateParts[0].padStart(2, '0');
        var amt = dr > 0 ? dr : cr;
        if(amt > 0) txns.push({date: parsedDate, desc: desc, amount: amt, type: dr>0?'Withdrawal':'Deposit', bank_name: bankPretty, account_id: accountId});
        if(bal > 0 && parsedDate > latestDate) { latestDate = parsedDate; latestBal = bal; }
      }
    } else if (bankCode === 'hdfc' && cols.length >= 7) {
      var dateStr = cols[0] ? cols[0].trim() : '';
      var desc = cols[1] ? cols[1].trim() : '';
      var dr = parseFloat(cols[4] ? cols[4].replace(/,/g,'') : '0');
      var cr = parseFloat(cols[5] ? cols[5].replace(/,/g,'') : '0');
      var bal = parseFloat(cols[6] ? cols[6].replace(/,/g,'') : '0');
      
      var dateSep = dateStr.includes('/') ? '/' : '-';
      var dateParts = dateStr.split(dateSep);
      if(dateParts.length >= 3) {
        var m = MONTHS.indexOf(dateParts[1]);
        var mStr = m !== -1 ? (m+1).toString().padStart(2, '0') : dateParts[1].padStart(2, '0');
        var yStr = dateParts[2].length === 2 ? '20'+dateParts[2] : dateParts[2];
        var parsedDate = yStr+'-'+mStr+'-'+dateParts[0].padStart(2, '0');
        var amt = dr > 0 ? dr : cr;
        if(amt > 0) txns.push({date: parsedDate, desc: desc, amount: amt, type: dr>0?'Withdrawal':'Deposit', bank_name: bankPretty, account_id: accountId});
        if(bal > 0 && parsedDate > latestDate) { latestDate = parsedDate; latestBal = bal; }
      }
    }
  }
  if(txns.length > 0) {
    setMsg(document.getElementById('upload-msg'), 'info', 'Auto-categorizing ' + txns.length + ' txns...');
    getRules().then(function(rules) {
      var accountRules = rules.filter(function(r) { return r.account_id === accountId; });
      var globalRules = rules.filter(function(r) { return r.applies_to_all_accounts === true; });
      var activeRules = accountRules.concat(globalRules);
      
      for(var i=0; i<txns.length; i++) {
        var t = txns[i];
        for (var j = 0; j < activeRules.length; j++) {
          if (activeRules[j].keyword && typeof fuzzyMatch === 'function' && fuzzyMatch(t.desc, activeRules[j].keyword)) {
            var cat = activeRules[j].category;
            if (cat === 'Income' && t.type !== 'Deposit') continue;
            if (cat === 'Expenses' && t.type !== 'Withdrawal') continue;
            t.cat = cat;
            t.subcat = activeRules[j].subcategory;
            break;
          } else if (activeRules[j].type === t.type && activeRules[j].keyword && t.desc.toLowerCase().includes(activeRules[j].keyword.toLowerCase())) {
            t.cat = activeRules[j].category;
            t.subcat = activeRules[j].subcategory;
            break;
          }
        }
      }
      autoCategorizeUpload(txns);
      if((bankCode === 'sbi' || bankCode === 'hdfc') && latestBal > 0) {
        var d = getMonthYear();
        var banner = '<div id="bal-banner" style="background:#0c2a1a;border:1px solid #1D9E75;border-radius:8px;padding:.85rem 1rem;margin-top:.75rem;font-size:13px;color:#e8eaf0">'
          +'<b style="color:#00d4a0">Bank balance detected: '+fmt(latestBal)+'</b><br>'
          +'<span style="font-size:12px;color:#8892b0">Closing balance for '+MFULL[d.m]+' '+d.y+'. Save to assets?</span><br>'
          +'<div style="display:flex;gap:8px;margin-top:.6rem">'
          +'<button class="btn btn-green btn-sm" onclick="saveBankBal('+latestBal+')">Yes, save</button>'
          +'</div></div>';
        var msgEl = document.getElementById('upload-msg');
        if(msgEl) msgEl.insertAdjacentHTML('afterend', banner);
      }
    });
  } else {
    setMsg(document.getElementById('upload-msg'), 'err', 'No transactions found. Check bank selection.');
  }
};

window.autoCategorizeUpload = function(txns) {
  var batchId = crypto.randomUUID();
  var toInsert = txns.map(function(t) {
    return {
      user_id: currentUser.id, date: t.date, description: t.desc, amount: t.amount, type: t.type,
      category: t.cat || null, subcategory: t.subcat || null, status: 'PENDING', upload_batch_id: batchId,
      bank_name: t.bank_name || null, account_id: t.account_id || null
    };
  });
  sb.from('transactions').insert(toInsert).then(function(res) {
    if(res.error) setMsg(document.getElementById('upload-msg'), 'err', res.error.message);
    else {
      setMsg(document.getElementById('upload-msg'), 'ok', 'Uploaded successfully!');
      document.getElementById('zone-unified').style.display = 'none';
      fetchPendingTxns();
    }
  });
};

window.fetchPendingTxns = function() {
  if(!currentUser) return;
  
  var mSel = document.getElementById('pend-month'); 
  var ySel = document.getElementById('pend-year');
  var bSel = document.getElementById('pend-bank');
  var q = sb.from('transactions').select('*').eq('user_id', currentUser.id).eq('status', 'PENDING');
  
  if (bSel && bSel.value !== 'All') {
    q = q.eq('bank_name', bSel.value);
  }
  
  if (mSel && ySel) {
    var mm = mSel.value; var yy = ySel.value;
    if (yy !== 'all') {
      if(mm !== 'all') {
        var nextM = parseInt(mm)+1; var nextY = parseInt(yy); if(nextM>12){ nextM=1; nextY++; }
        q = q.gte('date', yy+'-'+mm+'-01').lt('date', nextY+'-'+nextM.toString().padStart(2,'0')+'-01');
      } else { 
        q = q.gte('date', yy+'-01-01').lte('date', yy+'-12-31'); 
      }
    }
  }

  q.order('date', {ascending: false}).then(function(res) {
    if(res.error) { console.error(res.error); return; }
    window.pendingTxns = res.data || [];
    showConfirm(window.pendingTxns);
  });
};

window.confirmSelectedPending = function() {
  var cbs = document.querySelectorAll('.pending-cb:checked');
  if(cbs.length === 0) return;
  
  var selectedIds = [];
  for(var i=0; i<cbs.length; i++) selectedIds.push(cbs[i].value);
  
  var selectedTxns = (window.pendingTxns || []).filter(function(t) { return selectedIds.includes(t.id); });
  var uncat = selectedTxns.find(function(t){ return !t.category || t.category === '' || !t.subcategory || t.subcategory === ''; });
  
  if(uncat) { 
    alert('One or more selected transactions are missing a Category/Subcategory. Please fix them or uncheck them before confirming.'); 
    return; 
  }
  
  var btn = document.getElementById('btn-confirm-all');
  var origText = btn ? btn.innerText : '';
  if(btn) { btn.innerText = 'Confirming...'; btn.disabled = true; }
  
  sb.from('transactions').update({status: 'CONFIRMED'}).in('id', selectedIds).then(function(res) {
    if(btn) { btn.innerText = origText; btn.disabled = false; }
    if(res.error) { alert('Error: ' + res.error.message); }
    else { 
       var selectAll = document.getElementById('selectAllPending');
       if (selectAll) selectAll.checked = false;
       toggleBulkDeleteBtn();
       fetchPendingTxns(); 
    }
  });
};

var origUpdCat = window.updCat;
window.updCat = function(idx, val) {
  if(window.pendingTxns && window.pendingTxns[idx]) {
    window.pendingTxns[idx].category = val; window.pendingTxns[idx].subcategory = '';
    sb.from('transactions').update({category: val, subcategory: null}).eq('id', window.pendingTxns[idx].id).then(function(){ showConfirm(window.pendingTxns); });
  } else if(origUpdCat) origUpdCat(idx, val);
};

var origUpdSubCat = window.updSubCat;
window.updSubCat = function(idx, val) {
  if(window.pendingTxns && window.pendingTxns[idx]) {
    window.pendingTxns[idx].subcategory = val;
    sb.from('transactions').update({subcategory: val}).eq('id', window.pendingTxns[idx].id).then(function(){ showConfirm(window.pendingTxns); });
  } else if(origUpdSubCat) origUpdSubCat(idx, val);
};

window.showConfirm = function(arr) {
  var sec = document.getElementById('confirm-sec'); var bdy = document.getElementById('confirm-body');
  if(!sec || !bdy) return;
  sec.style.display = 'block'; document.getElementById('txn-count').innerText = '(' + arr.length + ')';
  
  var html = '';
  var ddStyle = 'width:100%;min-width:140px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text-primary);cursor:pointer;font-size:13px;outline:none;';
  
  for(var i=0; i<arr.length; i++) {
    var t = arr[i]; var bg = (!t.category) ? 'rgba(255,107,107,0.15)' : 'transparent';
    var catOpt = '<option value="">Select</option>';
    if (typeof CAT_MAP !== 'undefined') {
      for(var k in CAT_MAP) catOpt += '<option '+(t.category===k?'selected':'')+'>'+k+'</option>';
    }
    var subOpt = getSubcatOptionsHTML(t.category, t.subcategory);
    var dParts = t.date.split('-');
    var displayDate = dParts.length === 3 ? (dParts[2] + '-' + dParts[1] + '-' + dParts[0]) : t.date;
    html += '<tr style="background:'+bg+'"><td style="text-align:center;"><input type="checkbox" class="pending-cb" value="'+t.id+'" onchange="toggleBulkDeleteBtn()"></td><td style="white-space:nowrap;">'+displayDate+'</td><td class="desc-cell" title="'+(t.description||t.desc)+'">'+(t.description||t.desc)+'</td>'
      +'<td><span class="badge" style="background:var(--bg-card2);color:var(--text-primary);border:1px solid var(--border);font-size:11px;padding:2px 6px;white-space:nowrap">'+(t.bank_name || '-')+'</span></td>'
      +'<td><span class="badge '+(t.type==='Withdrawal'?'b-wit':'b-dep')+'">'+t.type+'</span></td>'
      +'<td style="font-weight:600">'+fmt(t.amount)+'</td>'
      +'<td><select style="'+ddStyle+'" onchange="updCat('+i+', this.value)">'+catOpt+'</select></td>'
      +'<td><select style="'+ddStyle+'" onchange="handleSubcatChange(this, pendingTxns['+i+'].category, function(v){updSubCat('+i+', v)})">'+subOpt+'</select></td>'
      +'<td><button class="action-btn" style="background:transparent; border:none; cursor:pointer; color:var(--text-secondary); padding:4px;" onclick="openActionMenu(event, null, null, null, '+i+')"><i class="ph ph-dots-three-vertical" style="font-size:20px;"></i></button></td></tr>';
  }
  bdy.innerHTML = html;
};

var originalFetchDashboardTxns = window.fetchDashboardTxns;
window.fetchDashboardTxns = function() {
  if(!currentUser) return;
  var mSel = document.getElementById('dash-month'); var ySel = document.getElementById('dash-year');
  if(!mSel || !ySel) return;
  var mm = mSel.value; var yy = ySel.value;
  var q = sb.from('transactions').select('*').eq('user_id', currentUser.id).eq('status', 'CONFIRMED');
  if(mm !== 'all') {
    var nextM = parseInt(mm)+1; var nextY = parseInt(yy); if(nextM>12){ nextM=1; nextY++; }
    q = q.gte('date', yy+'-'+mm+'-01').lt('date', nextY+'-'+nextM.toString().padStart(2,'0')+'-01');
  } else { q = q.gte('date', yy+'-01-01').lte('date', yy+'-12-31'); }
  q.order('date', {ascending:false}).then(function(res) {
    if(!res.error) { window.dashboardTxns = res.data || []; if(typeof renderDashboardTables === 'function') renderDashboardTables(); if(typeof renderCharts === 'function') renderCharts(); }
  });
};
window.toggleAllPending = function(checked) {
  var cbs = document.querySelectorAll('.pending-cb');
  for(var i=0; i<cbs.length; i++) cbs[i].checked = checked;
  toggleBulkDeleteBtn();
};
window.toggleBulkDeleteBtn = function() {
  var cbs = document.querySelectorAll('.pending-cb:checked');
  
  var delBtn = document.getElementById('btn-del-selected');
  if(delBtn) delBtn.style.display = cbs.length > 0 ? 'inline-block' : 'none';
  
  var confBtn = document.getElementById('btn-confirm-all');
  if(confBtn) {
    if(cbs.length > 0) {
      confBtn.innerText = 'Confirm Selected (' + cbs.length + ')';
      confBtn.style.opacity = '1';
      confBtn.style.pointerEvents = 'auto';
    } else {
      confBtn.innerText = 'Confirm Selected (0)';
      confBtn.style.opacity = '0.5';
      confBtn.style.pointerEvents = 'none';
    }
  }
  
  var selectAll = document.getElementById('selectAllPending');
  var totalCbs = document.querySelectorAll('.pending-cb');
  if(selectAll && totalCbs.length > 0) {
    selectAll.checked = cbs.length === totalCbs.length;
  }
};
window.deleteSelectedPending = function() {
  var cbs = document.querySelectorAll('.pending-cb:checked');
  if(cbs.length === 0) return;
  if(!confirm('Are you sure you want to delete ' + cbs.length + ' transactions?')) return;
  
  var ids = [];
  for(var i=0; i<cbs.length; i++) ids.push(cbs[i].value);
  
  var btn = document.getElementById('btn-del-selected');
  var origText = btn.innerText;
  btn.innerText = 'Deleting...'; btn.disabled = true;
  
  sb.from('transactions').delete().in('id', ids).then(function(res) {
    btn.innerText = origText; btn.disabled = false;
    if(res.error) { alert('Delete failed: ' + res.error.message); }
    else { 
       var selectAll = document.getElementById('selectAllPending');
       if (selectAll) selectAll.checked = false;
       toggleBulkDeleteBtn();
       fetchPendingTxns(); 
    }
  });
};

window.toggleAllDash = function(checked) {
  var cbs = document.querySelectorAll('.dash-cb');
  for(var i=0; i<cbs.length; i++) cbs[i].checked = checked;
  checkDashActions();
};

window.checkDashActions = function() {
  var checked = document.querySelectorAll('.dash-cb:checked').length;
  var btn = document.getElementById('btn-delete-dash');
  if(btn) {
    btn.style.opacity = checked > 0 ? '1' : '0.5';
    btn.style.pointerEvents = checked > 0 ? 'auto' : 'none';
    btn.innerText = 'Delete Selected (' + checked + ')';
  }
};

window.deleteSelectedDash = function() {
  var cbs = document.querySelectorAll('.dash-cb:checked');
  if(cbs.length === 0) return;
  if(!confirm('Are you sure you want to delete ' + cbs.length + ' transactions?')) return;
  
  var ids = [];
  for(var i=0; i<cbs.length; i++) ids.push(cbs[i].value);
  
  var btn = document.getElementById('btn-delete-dash');
  var origText = btn.innerText;
  btn.innerText = 'Deleting...'; btn.disabled = true;
  
  sb.from('transactions').delete().in('id', ids).then(function(res) {
    btn.innerText = origText; btn.disabled = false;
    if(res.error) { alert('Delete failed: ' + res.error.message); }
    else { 
       var selectAll = document.getElementById('selectAllDash');
       if (selectAll) selectAll.checked = false;
       checkDashActions();
       renderTxn(); 
    }
  });
};

window.openDashActionMenu = function(e, txnId, groupId) {
  if(e) e.stopPropagation();
  var menu = document.getElementById('global-action-menu');
  if(!menu) {
    menu = document.createElement('div');
    menu.id = 'global-action-menu';
    menu.className = 'action-menu';
    menu.innerHTML = '<div id="action-menu-content"></div>';
    document.body.appendChild(menu);
  }
  var content = document.getElementById('action-menu-content');
  var html = '';
  
  if (groupId) {
    html += '<div class="action-menu-item" onclick="editSplitGroup(\''+groupId+'\')"><i class="ph ph-pencil-simple"></i> Edit Split Group</div>';
    html += '<div class="action-menu-item danger" onclick="deleteSplitGroup(\''+groupId+'\')"><i class="ph ph-trash"></i> Delete Split Group</div>';
  } else {
    var amt = 0;
    var t = window.dashboardTxns ? window.dashboardTxns.find(function(x) { return x.id === txnId; }) : null;
    if (t) amt = t.amount;
    
    html += '<div class="action-menu-item" onclick="openEditTxnModal(\''+txnId+'\')"><i class="ph ph-pencil-simple"></i> Edit</div>';
    html += '<div class="action-menu-item" onclick="openSplitModal(\''+txnId+'\', '+amt+')"><i class="ph ph-git-branch"></i> Split Transaction</div>';
    html += '<div class="action-menu-item danger" onclick="deleteTxn(\''+txnId+'\')"><i class="ph ph-trash"></i> Delete</div>';
  }
  
  content.innerHTML = html;
  menu.style.display = 'block';
  menu.classList.remove('hide');
  
  var targetEl = e.target.closest('button') || e.target.closest('div') || e.target;
  var rect = targetEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY) + 'px';
  menu.style.left = (rect.right + window.scrollX - 140) + 'px';
};

window.currentEditTxnId = null;

window.closeEditModal = function() {
  document.getElementById('modal-edit').classList.add('hide');
};

window.openEditTxnModal = function(txnId) {
  window.currentEditTxnId = txnId;
  var t = window.dashboardTxns.find(function(x) { return x.id === txnId; });
  if(!t) return;
  
  document.getElementById('edit-amount').value = t.amount;
  
  var catEl = document.getElementById('edit-cat');
  var subcatEl = document.getElementById('edit-subcat');
  
  catEl.innerHTML = '<option value="">Select category</option>' + Object.keys(CAT_MAP).map(function(c) {
    return '<option '+(t.category===c?'selected':'')+'>'+c+'</option>';
  }).join('');
  
  window.updateEditSubcat = function() {
    var c = catEl.value;
    subcatEl.innerHTML = getSubcatOptionsHTML(c, t.subcategory);
    subcatEl.onchange = function() {
      handleSubcatChange(subcatEl, c);
    };
  };
  
  updateEditSubcat();
  
  document.getElementById('modal-edit').classList.remove('hide');
  document.getElementById('msg-edit').innerHTML = '';
};

window.saveEditTxn = function() {
  var amt = parseFloat(document.getElementById('edit-amount').value);
  var cat = document.getElementById('edit-cat').value;
  var sub = document.getElementById('edit-subcat').value;
  
  if(!cat || !sub || isNaN(amt)) {
    document.getElementById('msg-edit').innerHTML = '<span style="color:var(--red)">Please fill all fields</span>';
    return;
  }
  
  var btn = document.getElementById('btn-save-edit');
  var orig = btn.innerText;
  btn.innerText = 'Saving...'; btn.disabled = true;
  
  sb.from('transactions').update({
    amount: amt,
    category: cat,
    subcategory: sub
  }).eq('id', window.currentEditTxnId).then(function(res) {
    btn.innerText = orig; btn.disabled = false;
    if(res.error) {
      document.getElementById('msg-edit').innerHTML = '<span style="color:var(--red)">Error saving</span>';
    } else {
      closeEditModal();
      renderTxn();
    }
  });
};
// --- SUBCATEGORIES MANAGEMENT ---
var currentSubcatSelectTarget = null;
var currentSubcatCategory = null;

function loadCustomSubcategories(callback) {
  sb.from('subcategories').select('*').then(function(res) {
    if (!res.error && res.data) {
      // Rebuild CAT_MAP dynamically
      CAT_MAP = { 'Income': [], 'Expenses': [], 'Assets': [], 'Liabilities': [] };
      // Map DB names to App names
      var nameMap = { 'Expense': 'Expenses', 'Asset': 'Assets', 'Liability': 'Liabilities', 'Income': 'Income' };
      
      // First, ensure all mapped categories exist
      for (var dbCat in nameMap) {
        if (!CAT_MAP[nameMap[dbCat]]) CAT_MAP[nameMap[dbCat]] = [];
      }
      
      res.data.forEach(function(row) {
        var cat = nameMap[row.category] || row.category;
        if (!CAT_MAP[cat]) CAT_MAP[cat] = [];
        CAT_MAP[cat].push(row.subcategory_name);
      });
    }
    if (callback) callback();
  });
}

function getSubcatOptionsHTML(cat, selectedVal) {
  var html = '<option value="">Select sub-category</option>';
  if (cat && CAT_MAP[cat]) {
    html += CAT_MAP[cat].map(function(s) {
      return '<option value="' + s + '" ' + (selectedVal === s ? 'selected' : '') + '>' + s + '</option>';
    }).join('');
    html += '<option disabled>----------</option>';
    html += '<option value="__ADD_NEW__">+ Add New Subcategory</option>';
  }
  return html;
}

function handleSubcatChange(sel, cat, callback) {
  if (sel.value === '__ADD_NEW__') {
    sel.value = ''; // Reset temporarily
    openAddSubcatModal(cat, sel, callback);
  } else if (callback) {
    callback(sel.value);
  }
}

function openAddSubcatModal(cat, selectElement, callback) {
  currentSubcatSelectTarget = selectElement;
  currentSubcatCategory = cat;
  
  // Convert App category name back to DB name for display
  var reverseMap = { 'Expenses': 'Expense', 'Assets': 'Asset', 'Liabilities': 'Liability', 'Income': 'Income' };
  document.getElementById('add-subcat-cat').value = reverseMap[cat] || cat;
  document.getElementById('add-subcat-name').value = '';
  document.getElementById('add-subcat-msg').innerText = '';
  document.getElementById('modal-add-subcat').classList.remove('hide');
}

function closeAddSubcatModal() {
  document.getElementById('modal-add-subcat').classList.add('hide');
  currentSubcatSelectTarget = null;
  currentSubcatCategory = null;
}

function saveCustomSubcat() {
  var name = document.getElementById('add-subcat-name').value.trim();
  var msg = document.getElementById('add-subcat-msg');
  var cat = document.getElementById('add-subcat-cat').value;
  var appCat = currentSubcatCategory;
  
  if (!name) {
    msg.innerText = 'Subcategory name cannot be blank.';
    return;
  }
  
  // Check duplicates locally
  if (CAT_MAP[appCat] && CAT_MAP[appCat].includes(name)) {
    msg.innerText = 'This subcategory already exists.';
    return;
  }
  
  var btn = document.getElementById('btn-save-subcat');
  var orig = btn.innerText;
  btn.innerText = 'Saving...';
  btn.disabled = true;
  
  sb.from('subcategories').insert({
    user_id: currentUser.id,
    category: cat,
    subcategory_name: name,
    is_default: false
  }).then(function(res) {
    btn.innerText = orig;
    btn.disabled = false;
    
    if (res.error) {
      msg.innerText = 'Error: ' + res.error.message;
    } else {
      // Add to local state
      CAT_MAP[appCat].push(name);
      
      // Update the target dropdown
      if (currentSubcatSelectTarget) {
        currentSubcatSelectTarget.innerHTML = getSubcatOptionsHTML(appCat, name);
        // Trigger any original onchange logic if it wasn't intercepted
        var evt = new Event('change', { bubbles: true });
        currentSubcatSelectTarget.dispatchEvent(evt);
      }
      
      closeAddSubcatModal();
    }
  });
}
