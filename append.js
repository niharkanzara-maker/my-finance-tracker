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
