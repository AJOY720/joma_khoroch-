// DOM helper
const $ = id => document.getElementById(id);

// Storage keys
const STORAGE_KEY = 'joma-khoroch-v2-records';
const PIN_KEY = 'joma-khoroch-v2-pin';
const CURRENCY_KEY = 'joma-khoroch-currency';

// State
let records = [];
try {
  records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
} catch (e) {
  records = [];
}

let activeCurrency = localStorage.getItem(CURRENCY_KEY) || '₹';
let unlocked = false;

// Helpers
const pad = n => String(n).padStart(2, '0');
const formatDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();
const todayStr = formatDate(today);

// Format Money
function money(amount) {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount);
  return `${activeCurrency}${formatted}`;
}

// Persist records
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
}

// --- PIN SECURITY ---
function pinConfig() {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

async function hash(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function showApp() {
  unlocked = true;
  $('lockScreen').hidden = true;
  $('app').hidden = false;
  render();
}

function lock() {
  unlocked = false;
  $('app').hidden = true;
  $('lockScreen').hidden = false;
  $('pinInput').value = '';
  $('lockError').textContent = '';
  const hasPin = !!pinConfig();
  $('setupArea').hidden = hasPin;
  $('unlockForm').hidden = !hasPin;
  $('lockTitle').textContent = hasPin ? 'জমা-খরচ আনলক করুন' : 'প্রথমবার PIN সেট করুন';
  $('lockText').textContent = hasPin ? 'আপনার PIN/পাসওয়ার্ড লিখুন' : 'অ্যাপ ব্যবহারের আগে একটি PIN তৈরি করুন';
}

$('unlockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const cfg = pinConfig();
  if (!cfg) return;
  const got = await hash($('pinInput').value);
  if (got === cfg.hash) {
    showApp();
  } else {
    $('lockError').textContent = 'PIN সঠিক নয়। আবার চেষ্টা করুন।';
  }
});

// Reset PIN if forgotten
if ($('resetPinBtn')) {
  $('resetPinBtn').addEventListener('click', () => {
    if (confirm('আপনি কি PIN লকটি মুছে ফেলে সরাসরি অ্যাপে ঢুকতে চান?')) {
      localStorage.removeItem(PIN_KEY);
      showApp();
      alert('PIN লক সরানো হয়েছে! এখন আপনি সরাসরি অ্যাপটি ব্যবহার করতে পারবেন।');
    }
  });
}

$('setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const a = $('newPin').value, b = $('confirmPin').value;
  if (a.length < 4) {
    $('lockError').textContent = 'কমপক্ষে ৪ অক্ষর/সংখ্যা দিন।';
    return;
  }
  if (a !== b) {
    $('lockError').textContent = 'দুটি PIN মিলছে না।';
    return;
  }
  localStorage.setItem(PIN_KEY, JSON.stringify({ hash: await hash(a) }));
  showApp();
});

$('lockNow').addEventListener('click', lock);

$('changePin').addEventListener('click', async () => {
  const cfg = pinConfig();
  if (!cfg) {
    alert('বর্তমানে কোনো PIN সেট করা নেই।');
    return;
  }
  const current = prompt('বর্তমান PIN লিখুন:');
  if (current === null) return;
  if (await hash(current) !== cfg.hash) {
    alert('বর্তমান PIN সঠিক নয়।');
    return;
  }
  const next = prompt('নতুন PIN দিন (কমপক্ষে ৪ সংখ্যা):');
  if (next === null) return;
  if (next.length < 4) {
    alert('কমপক্ষে ৪ সংখ্যা দিন।');
    return;
  }
  const confirmNext = prompt('নতুন PIN আবার লিখুন:');
  if (next !== confirmNext) {
    alert('দুটি PIN মিলছে না।');
    return;
  }
  localStorage.setItem(PIN_KEY, JSON.stringify({ hash: await hash(next) }));
  alert('PIN সফলভাবে পরিবর্তন হয়েছে।');
});

$('removePin').addEventListener('click', async () => {
  const cfg = pinConfig();
  if (!cfg) {
    alert('বর্তমানে কোনো PIN সেট করা নেই।');
    return;
  }
  const current = prompt('বর্তমান PIN দিয়ে নিষ্ক্রিয় করার অনুমতি দিন:');
  if (current === null) return;
  if (await hash(current) !== cfg.hash) {
    alert('বর্তমান PIN সঠিক নয়।');
    return;
  }
  localStorage.removeItem(PIN_KEY);
  alert('PIN নিষ্ক্রিয় করা হয়েছে।');
});

// --- CURRENCY SELECT ---
$('currencySelect').value = activeCurrency;
$('currencySelect').addEventListener('change', e => {
  activeCurrency = e.target.value;
  localStorage.setItem(CURRENCY_KEY, activeCurrency);
  render();
});

// --- DATE PRESETS LOGIC ---
function applyPreset(presetKey) {
  const now = new Date();
  let start = '', end = '';

  if (presetKey === 'today') {
    start = end = formatDate(now);
  } else if (presetKey === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    start = end = formatDate(y);
  } else if (presetKey === 'this_week') {
    const curr = new Date(now);
    const day = curr.getDay(); // 0 is Sunday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    start = formatDate(monday);
    end = formatDate(sunday);
  } else if (presetKey === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start = formatDate(firstDay);
    end = formatDate(lastDay);
  } else if (presetKey === 'last_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    start = formatDate(firstDay);
    end = formatDate(lastDay);
  } else if (presetKey === 'this_year') {
    start = `${now.getFullYear()}-01-01`;
    end = `${now.getFullYear()}-12-31`;
  } else if (presetKey === 'all') {
    start = '1970-01-01';
    end = '2099-12-31';
  }

  $('reportStartDate').value = start;
  $('reportEndDate').value = end;

  document.querySelectorAll('.presetBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  });

  render();
}

document.querySelectorAll('.presetBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyPreset(btn.dataset.preset);
  });
});

$('reportStartDate').addEventListener('change', () => {
  document.querySelectorAll('.presetBtn').forEach(btn => btn.classList.remove('active'));
  render();
});
$('reportEndDate').addEventListener('change', () => {
  document.querySelectorAll('.presetBtn').forEach(btn => btn.classList.remove('active'));
  render();
});
$('reportFilterType').addEventListener('change', render);
$('reportFilterCategory').addEventListener('change', render);
$('search').addEventListener('input', render);

// --- ENTRY FORM SUBMIT & EDIT ---
$('date').value = todayStr;

$('entryForm').addEventListener('submit', e => {
  e.preventDefault();
  const amount = Number($('amount').value);
  const editId = $('editId').value;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert('সঠিক টাকার পরিমাণ লিখুন।');
    return;
  }

  const item = {
    id: editId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    type: document.querySelector('input[name="type"]:checked').value,
    amount: amount,
    note: $('note').value.trim(),
    category: $('category').value,
    date: $('date').value,
    paymentMethod: $('paymentMethod').value
  };

  if (editId) {
    records = records.map(x => x.id === editId ? item : x);
  } else {
    records.push(item);
  }

  persist();
  resetForm();
});

function resetForm() {
  $('entryForm').reset();
  $('editId').value = '';
  $('date').value = todayStr;
  $('formTitle').textContent = 'নতুন হিসাব যোগ করুন';
  $('saveBtn').textContent = 'হিসাব সেভ করুন';
  $('cancelEdit').hidden = true;
  document.querySelector('input[name="type"][value="expense"]').checked = true;
}

$('cancelEdit').addEventListener('click', resetForm);

// --- CSV EXPORT HELPER ---
function csvDownload(list, filename) {
  if (!list.length) {
    alert('ডাউনলোড করার মতো কোনো হিসাব নেই।');
    return;
  }
  const rows = [
    ['তারিখ', 'ধরন', 'বিবরণ', 'ক্যাটাগরি', `টাকার পরিমাণ (${activeCurrency})`, 'পেমেন্ট মাধ্যম'],
    ...list.map(x => [
      x.date,
      x.type === 'income' ? 'জমা' : 'খরচ',
      x.note,
      x.category,
      x.amount,
      x.paymentMethod || 'নগদ'
    ])
  ];

  const csv = '\ufeff' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- RENDER MAIN UI & REPORTS ---
function sum(list, type) {
  return list.filter(x => x.type === type).reduce((s, x) => s + x.amount, 0);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function render() {
  // 1. Overall Lifetime Summary
  const inc = sum(records, 'income');
  const exp = sum(records, 'expense');
  $('totalIncome').textContent = money(inc);
  $('totalExpense').textContent = money(exp);
  $('balance').textContent = money(inc - exp);

  // 2. Date-to-Date & Category Filtered Report
  const startDate = $('reportStartDate').value || '1970-01-01';
  const endDate = $('reportEndDate').value || '2099-12-31';
  const reportType = $('reportFilterType').value;
  const reportCategory = $('reportFilterCategory').value;

  const reportItems = records.filter(x => {
    const inDate = x.date >= startDate && x.date <= endDate;
    const typeMatch = reportType === 'all' || x.type === reportType;
    const catMatch = reportCategory === 'all' || x.category === reportCategory;
    return inDate && typeMatch && catMatch;
  });

  const repInc = sum(reportItems, 'income');
  const repExp = sum(reportItems, 'expense');
  $('reportIncome').textContent = money(repInc);
  $('reportExpense').textContent = money(repExp);
  $('reportNet').textContent = money(repInc - repExp);
  $('reportCount').textContent = `${reportItems.length}টি`;

  // 3. Category Visual Breakdown
  const catMap = {};
  reportItems.forEach(item => {
    if (!catMap[item.category]) {
      catMap[item.category] = { income: 0, expense: 0, count: 0 };
    }
    if (item.type === 'income') catMap[item.category].income += item.amount;
    else catMap[item.category].expense += item.amount;
    catMap[item.category].count++;
  });

  const catTotalVolume = repInc + repExp;
  const sortedCategories = Object.keys(catMap).sort((a, b) => {
    const totalA = catMap[a].income + catMap[a].expense;
    const totalB = catMap[b].income + catMap[b].expense;
    return totalB - totalA;
  });

  if (sortedCategories.length === 0) {
    $('categoryBars').innerHTML = '<p class="empty" style="padding: 10px 0;">কোনো ক্যাটাগরির হিসাব পাওয়া যায়নি।</p>';
  } else {
    $('categoryBars').innerHTML = sortedCategories.map(cat => {
      const data = catMap[cat];
      const catVolume = data.income + data.expense;
      const pct = catTotalVolume > 0 ? Math.round((catVolume / catTotalVolume) * 100) : 0;
      const isExpenseDominant = data.expense >= data.income;

      return `
        <div class="catBarItem">
          <div class="catBarHead">
            <span><strong>${esc(cat)}</strong> <small>(${data.count}টি)</small></span>
            <span>
              ${data.income > 0 ? `<span class="incomeText">+${money(data.income)}</span> ` : ''}
              ${data.expense > 0 ? `<span class="expenseText">-${money(data.expense)}</span> ` : ''}
              <strong>${pct}%</strong>
            </span>
          </div>
          <div class="catProgressBg">
            <div class="catProgressFill ${isExpenseDominant ? 'expenseFill' : 'incomeFill'}" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Search & Filtered Entries List
  const q = $('search').value.trim().toLowerCase();
  const searchResults = records.filter(x => {
    return (
      (x.note || '').toLowerCase().includes(q) ||
      (x.category || '').toLowerCase().includes(q) ||
      (x.date || '').includes(q) ||
      (x.paymentMethod || '').toLowerCase().includes(q) ||
      String(x.amount).includes(q)
    );
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  $('empty').hidden = searchResults.length > 0;
  $('entries').innerHTML = searchResults.map(x => `
    <div class="entryItem" data-id="${x.id}">
      <div class="entryMain">
        <strong>${esc(x.note || 'হিসাব')}</strong>
        <div class="entryMeta">
          <span class="catPill">${esc(x.category)}</span>
          <span>📅 ${esc(x.date)}</span>
          ${x.paymentMethod ? `<span>💳 ${esc(x.paymentMethod)}</span>` : ''}
        </div>
      </div>
      <div class="entryMoney">
        <div class="entryAmount ${x.type === 'income' ? 'incomeText' : 'expenseText'}">
          ${x.type === 'income' ? '+' : '−'}${money(x.amount)}
        </div>
        <div class="entryActions">
          <button class="btnAction edit" data-action="edit" data-id="${x.id}">✏️ এডিট</button>
          <button class="btnAction delete" data-action="delete" data-id="${x.id}">🗑️ মুছুন</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Entries delegation (Edit & Delete)
$('entries').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const item = records.find(r => r.id === id);
  if (!item) return;

  if (btn.dataset.action === 'delete') {
    if (confirm(`“${item.note}” (${money(item.amount)}) হিসাবটি মুছে ফেলতে চান?`)) {
      records = records.filter(r => r.id !== id);
      persist();
      if ($('editId').value === id) resetForm();
    }
  } else if (btn.dataset.action === 'edit') {
    $('editId').value = item.id;
    $('amount').value = item.amount;
    $('note').value = item.note;
    $('category').value = item.category;
    $('date').value = item.date;
    if ($('paymentMethod')) $('paymentMethod').value = item.paymentMethod || 'নগদ';
    document.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;

    $('formTitle').textContent = 'হিসাব সম্পাদনা করুন';
    $('saveBtn').textContent = 'পরিবর্তন সেভ করুন';
    $('cancelEdit').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// CSV Exports
$('exportAllCsv').addEventListener('click', () => {
  csvDownload(records, 'joma-khoroch-all.csv');
});

$('exportReportCsv').addEventListener('click', () => {
  const startDate = $('reportStartDate').value || 'All';
  const endDate = $('reportEndDate').value || 'All';
  const reportType = $('reportFilterType').value;
  const reportCategory = $('reportFilterCategory').value;

  const reportItems = records.filter(x => {
    const inDate = (startDate === 'All' || x.date >= startDate) && (endDate === 'All' || x.date <= endDate);
    const typeMatch = reportType === 'all' || x.type === reportType;
    const catMatch = reportCategory === 'all' || x.category === reportCategory;
    return inDate && typeMatch && catMatch;
  });

  csvDownload(reportItems, `joma-khoroch-report-${startDate}-to-${endDate}.csv`);
});

// Seed demo data if totally empty on first visit
if (records.length === 0) {
  const d = new Date();
  records = [
    { id: '1', type: 'income', amount: 45000, note: 'মাসিক বেতন', category: 'বেতন', date: todayStr, paymentMethod: 'ব্যাংক' },
    { id: '2', type: 'expense', amount: 12500, note: 'বাড়িভাড়া', category: 'বাড়িভাড়া', date: todayStr, paymentMethod: 'ব্যাংক' },
    { id: '3', type: 'expense', amount: 3200, note: 'কাঁচাবাজার ও মাছ', category: 'বাজার', date: todayStr, paymentMethod: 'নগদ' },
    { id: '4', type: 'expense', amount: 1450, note: 'বিদ্যুৎ ও ওয়াইফাই বিল', category: 'বিল', date: todayStr, paymentMethod: 'বিকাশ' },
    { id: '5', type: 'income', amount: 8500, note: 'ব্যবসায়িক আয়', category: 'ব্যবসা', date: todayStr, paymentMethod: 'ব্যাংক' }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Initial setup
applyPreset('this_month');
if (pinConfig()) {
  lock();
} else {
  showApp();
}
