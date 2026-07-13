var splitRowsData = [];
window.currentSplitBaseTxn = null;

function openSplitModal(txnId, amount) {
  currentSplitTxnId = txnId;
  currentSplitGroupId = null;
  currentSplitTotal = parseFloat(amount);
  
  if (window.currentSplitPendingIndex !== null) {
    window.currentSplitBaseTxn = window.pendingTxns[window.currentSplitPendingIndex];
  } else {
    window.currentSplitBaseTxn = (window.dashboardTxns || []).find(function(t) { return t.id === txnId; });
  }
  
  $('split-orig-amt').innerText = fmt(currentSplitTotal);
  splitRowsData = [];
  addSplitRow();
  addSplitRow();
  
  renderSplitRows();
  $('modal-split').classList.remove('hide');
  $('msg-split').innerHTML = '';
}

function editSplitGroup(groupId) {
  currentSplitGroupId = groupId;
  currentSplitTxnId = null;
  
  getAllTxns().then(function(allTxns) {
    var groupTxns = allTxns.filter(function(t) { return t.split_group_id === groupId; });
    if(groupTxns.length === 0) return;
    
    window.currentSplitBaseTxn = groupTxns[0];
    
    currentSplitTotal = groupTxns.reduce(function(sum, t) { return sum + parseFloat(t.amount); }, 0);
    $('split-orig-amt').innerText = fmt(currentSplitTotal);
    
    splitRowsData = groupTxns.map(function(t) {
      return {
        amount: parseFloat(t.amount),
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
  splitRowsData.push({ amount: '', category: '', subcategory: '' });
  renderSplitRows();
}

function removeSplitRow(index) {
  splitRowsData.splice(index, 1);
  renderSplitRows();
}

function renderSplitRows() {
  var html = '';
  var currentSum = 0;
  
  var ddStyle = 'width:100%;min-width:140px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text-primary);cursor:pointer;font-size:13px;outline:none;';
  
  splitRowsData.forEach(function(row, i) {
    var amt = parseFloat(row.amount) || 0;
    currentSum += amt;
    
    var catOptions = '<option value="">Select Category</option>' + Object.keys(CAT_MAP).map(function(c){return'<option '+(row.category===c?'selected':'')+'>'+c+'</option>';}).join('');
    var subOptions = '<option value="">Select sub-category</option>' + (CAT_MAP[row.category]||[]).map(function(s){return'<option '+(row.subcategory===s?'selected':'')+'>'+s+'</option>';}).join('');
    
    html += '<div class="split-row">'
      +'<input type="number" class="split-amt" placeholder="Amount" value="'+(row.amount||'')+'" oninput="updateSplitAmt('+i+', this.value)">'
      +'<select class="split-cat" style="'+ddStyle+'" onchange="updateSplitData('+i+', \'category\', this.value)">'+catOptions+'</select>'
      +'<select class="split-cat" style="'+ddStyle+'" id="split-sub-'+i+'" onchange="updateSplitData('+i+', \'subcategory\', this.value)">'+subOptions+'</select>'
      +'<div class="split-row-del" onclick="removeSplitRow('+i+')">&times;</div>'
      +'</div>';
  });
  
  $('split-rows').innerHTML = html;
  
  var rem = currentSplitTotal - currentSum;
  var remEl = $('split-rem-amt');
  remEl.innerText = fmt(rem);
  remEl.style.color = (Math.abs(rem) < 0.01) ? 'var(--green)' : 'var(--red)';
}

window.updateSplitAmt = function(index, value) {
  splitRowsData[index].amount = value;
  var currentSum = 0;
  splitRowsData.forEach(function(row) { currentSum += (parseFloat(row.amount) || 0); });
  var rem = currentSplitTotal - currentSum;
  var remEl = $('split-rem-amt');
  remEl.innerText = fmt(rem);
  remEl.style.color = (Math.abs(rem) < 0.01) ? 'var(--green)' : 'var(--red)';
};

function updateSplitData(index, field, value) {
  splitRowsData[index][field] = value;
  if (field === 'category') {
    splitRowsData[index].subcategory = '';
  }
  renderSplitRows();
}

window.saveSplitTxn = function() {
  var rem = currentSplitTotal - splitRowsData.reduce(function(s, r){ return s + (parseFloat(r.amount)||0); }, 0);
  if (Math.abs(rem) > 0.01) { setMsg(document.getElementById('msg-split'), 'err', 'Remaining amount must be exactly 0.'); return; }
  for(var i=0; i<splitRowsData.length; i++) { if (!splitRowsData[i].amount || !splitRowsData[i].category) { setMsg(document.getElementById('msg-split'), 'err', 'Please fill amount and category for all rows.'); return; } }
  
  setMsg(document.getElementById('msg-split'), 'info', 'Saving split...');
  var rpcName = currentSplitGroupId ? 'update_split_group' : 'split_transaction';
  
  var baseType = window.currentSplitBaseTxn ? window.currentSplitBaseTxn.type : 'Withdrawal';
  var payloadSplits = splitRowsData.map(function(r) {
    return {
      amount: r.amount,
      category: r.category,
      subcategory: r.subcategory,
      type: baseType
    };
  });
  
  var payload = { p_splits: payloadSplits };
  var newGroupId = '';
  if (currentSplitGroupId) {
    newGroupId = currentSplitGroupId;
    payload.p_split_group_id = currentSplitGroupId;
  } else {
    payload.p_original_txn_id = currentSplitTxnId;
    newGroupId = 'SPLIT-' + crypto.randomUUID();
    payload.p_split_group_id = newGroupId;
  }
  
  sb.rpc(rpcName, payload).then(function(res) {
    if (res.error) {
      setMsg(document.getElementById('msg-split'), 'err', res.error.message || 'Database error occurred.');
    } else {
      var statusToSet = (window.currentSplitPendingIndex !== null) ? 'PENDING' : 'CONFIRMED';
      sb.from('transactions').update({status: statusToSet}).eq('split_group_id', newGroupId).then(function() {
         closeSplitModal();
         if (window.currentSplitPendingIndex !== null) fetchPendingTxns();
         else renderTxn();
      });
    }
  });
};

function deleteSplitGroup(groupId) {
  if(!confirm('Are you sure you want to delete this entire split group?')) return;
  sb.from('transactions').delete().eq('split_group_id', groupId).then(function(){ renderTxn(); });
}

window.deletePendingTxn = function(index) {
  var t = window.pendingTxns[index];
  if(t && t.id) { sb.from('transactions').delete().eq('id', t.id).then(function(){ fetchPendingTxns(); }); }
};

window.currentSplitPendingIndex = null;
window.openSplitModalSaved = function(txnId, amount) {
  window.currentSplitPendingIndex = null;
  openSplitModal(txnId, amount);
};

window.openSplitModalPending = function(index) {
  var t = window.pendingTxns[index];
  window.currentSplitPendingIndex = index;
  openSplitModal(t.id, t.amount);
};

window.openActionMenu = function(e, txnId, amount, groupId, pendingIdx) {
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
  
  if (pendingIdx !== undefined && pendingIdx !== null) {
    html += '<div class="action-menu-item" onclick="openSplitModalPending('+pendingIdx+')"><i class="ph ph-git-branch"></i> Split Transaction</div>';
    html += '<div class="action-menu-item danger" onclick="deletePendingTxn('+pendingIdx+')"><i class="ph ph-trash"></i> Remove from Import</div>';
  } else {
    if (groupId) {
      html += '<div class="action-menu-item" onclick="editSplitGroup(\''+groupId+'\')"><i class="ph ph-pencil-simple"></i> Edit Split Group</div>';
      html += '<div class="action-menu-item danger" onclick="deleteSplitGroup(\''+groupId+'\')"><i class="ph ph-trash"></i> Delete Split Group</div>';
    } else {
      html += '<div class="action-menu-item" onclick="alert(\'Edit coming soon!\')"><i class="ph ph-pencil-simple"></i> Edit</div>';
      html += '<div class="action-menu-item" onclick="openSplitModalSaved(\''+txnId+'\', '+amount+')"><i class="ph ph-git-branch"></i> Split Transaction</div>';
      html += '<div class="action-menu-item danger" onclick="deleteTxn(\''+txnId+'\')"><i class="ph ph-trash"></i> Delete</div>';
    }
  }
  
  content.innerHTML = html;
  menu.style.display = 'block';
  menu.classList.remove('hide');
  
  var targetEl = e.target.closest('button') || e.target.closest('div') || e.target;
  var rect = targetEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY) + 'px';
  menu.style.left = (rect.right + window.scrollX - 140) + 'px';
};

document.addEventListener('click', function(e) {
  var menu = document.getElementById('global-action-menu');
  if(menu && menu.style.display === 'block') {
    menu.style.display = 'none';
  }
});