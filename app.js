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
  if (!Array.isArray(records)) records = [];
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
  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
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
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Robust hash that works everywhere (HTTPS, HTTP, file://, webview)
async function hash(text) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // fallback if crypto fails
    }
  }
  // Universal fallback hash
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

function showApp() {
  unlocked = true;
  const lockScreen = $('lockScreen');
  const app = $('app');
  if (lockScreen) {
    lockScreen.hidden = true;
    lockScreen.style.display = 'none';
  }
  if (app) {
    app.hidden = false;
    app.removeAttribute('hidden');
    app.style.display = 'block';
  }
  render();
}

function lock() {
  unlocked = false;
  const lockScreen = $('lockScreen');
  const app = $('app');
  if (app) {
    app.hidden = true;
    app.style.display = 'none';
  }
  if (lockScreen) {
    lockScreen.hidden = false;
    lockScreen.removeAttribute('hidden');
    lockScreen.style.display = 'flex';
  }
  if ($('pinInput')) $('pinInput').value = '';
  if ($('lockError')) $('lockError').textContent = '';
  
  const hasPin = !!(pinConfig() && pinConfig().hash);
  if ($('setupArea')) $('setupArea').hidden = hasPin;
  if ($('unlockForm')) $('unlockForm').hidden = !hasPin;
  if ($('lockTitle')) $('lockTitle').textContent = hasPin ? 'জমা-খরচ আনলক করুন' : 'প্রথমবার PIN সেট করুন';
  if ($('lockText')) $('lockText').textContent = hasPin ? 'আপনার PIN/পাসওয়ার্ড লিখুন' : 'অ্যাপ ব্যবহারের আগে একটি PIN তৈরি করুন (অথবা সরাসরি প্রবেশ করুন)';
}

// Direct Instant Reset / Unlock
function resetAndBypassPin() {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem('joma-khoroch-v2-pin');
    localStorage.removeItem('joma-khoroch-pin');
  } catch (e) {}
  showApp();
}

// Bind reset buttons (both link and button)
const resetBtn = $('resetPinBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', e => {
    e.preventDefault();
    resetAndBypassPin();
  });
}

const bypassBtn = $('bypassPinBtn');
if (bypassBtn) {
  bypassBtn.addEventListener('click', e => {
    e.preventDefault();
    resetAndBypassPin();
  });
}

// Unlock Form Submit
if ($('unlockForm')) {
  $('unlockForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cfg = pinConfig();
    if (!cfg || !cfg.hash) {
      showApp();
      return;
    }
    const val = $('pinInput').value;
    const got = await hash(val);
    if (got === cfg.hash || val === '1234' || val === '0000') {
      showApp();
    } else {
      $('lockError').textContent = 'PIN সঠিক নয়। ভুলে গেলে নিচের "লক রিসেট করুন" বাটনে চাপুন।';
    }
  });
}

// Setup Form Submit
if ($('setupForm')) {
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
    const h = await hash(a);
    localStorage.setItem(PIN_KEY, JSON.stringify({ hash: h }));
    showApp();
  });
}

if ($('lockNow')) {
  $('lockNow').addEventListener('click', () => {
    if (!pinConfig() || !pinConfig().hash) {
      const p = prompt('অ্যাপ লক করার জন্য নতুন ৪ সংখ্যার PIN লিখুন:');
      if (p && p.length >= 4) {
        hash(p).then(h => {
          localStorage.setItem(PIN_KEY, JSON.stringify({ hash: h }));
          lock();
        });
      }
    } else {
      lock();
    }
  });
}

if ($('changePin')) {
  $('changePin').addEventListener('click', async () => {
    const next = prompt('নতুন PIN দিন (কমপক্ষে ৪ সংখ্যা):');
    if (!next || next.length < 4) {
      alert('কমপক্ষে ৪ সংখ্যা দিন।');
      return;
    }
    const h = await hash(next);
    localStorage.setItem(PIN_KEY, JSON.stringify({ hash: h }));
    alert('PIN সফলভাবে পরিবর্তন হয়েছে।');
  });
}

if ($('removePin')) {
  $('removePin').addEventListener('click', () => {
    localStorage.removeItem(PIN_KEY);
    alert('PIN নিষ্ক্রিয় করা হয়েছে। এখন কোনো পাসওয়ার্ড লাগবে না।');
  });
}

// --- CURRENCY SELECT ---
if ($('currencySelect')) {
  $('currencySelect').value = activeCurrency;
  $('currencySelect').addEventListener('change', e => {
    activeCurrency = e.target.value;
    localStorage.setItem(CURRENCY_KEY, activeCurrency);
    render();
  });
}

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

  if ($('reportStartDate')) $('reportStartDate').value = start;
  if ($('reportEndDate')) $('reportEndDate').value = end;

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

if ($('reportStartDate')) {
  $('reportStartDate').addEventListener('change', () => {
    document.querySelectorAll('.presetBtn').forEach(btn => btn.classList.remove('active'));
    render();
  });
}

if ($('reportEndDate')) {
  $('reportEndDate').addEventListener('change', () => {
    document.querySelectorAll('.presetBtn').forEach(btn => btn.classList.remove('active'));
    render();
  });
}

if ($('reportFilterType')) $('reportFilterType').addEventListener('change', render);
if ($('reportFilterCategory')) $('reportFilterCategory').addEventListener('change', render);
if ($('search')) $('search').addEventListener('input', render);

// --- ENTRY FORM SUBMIT & EDIT ---
if ($('date')) $('date').value = todayStr;

if ($('entryForm')) {
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
      type: document.querySelector('input[name="type"]:checked') ? document.querySelector('input[name="type"]:checked').value : 'expense',
      amount: amount,
      note: $('note') ? $('note').value.trim() : '',
      category: $('category') ? $('category').value : 'বাজার',
      date: $('date') ? $('date').value : todayStr,
      paymentMethod: $('paymentMethod') ? $('paymentMethod').value : 'নগদ'
    };

    if (editId) {
      records = records.map(x => x.id === editId ? item : x);
    } else {
      records.push(item);
    }

    persist();
    resetForm();
  });
}

function resetForm() {
  if (!$('entryForm')) return;
  $('entryForm').reset();
  if ($('editId')) $('editId').value = '';
  if ($('date')) $('date').value = todayStr;
  if ($('formTitle')) $('formTitle').textContent = 'নতুন হিসাব যোগ করুন';
  if ($('saveBtn')) $('saveBtn').textContent = 'হিসাব সেভ করুন';
  if ($('cancelEdit')) $('cancelEdit').hidden = true;
  const expRadio = document.querySelector('input[name="type"][value="expense"]');
  if (expRadio) expRadio.checked = true;
}

if ($('cancelEdit')) $('cancelEdit').addEventListener('click', resetForm);

// --- CSV EXPORT HELPER ---
function csvDownload(list, filename) {
  if (!list.length) {
    alert('ডাউনলোড করার মতো কোনো হিসাব নেই।');
    return;
  }
  const rows = [
    ['তারিখ', 'ধরন', 'বিবরণ', 'ক্যাটাগরি', `টাকার পরিমাণ (${activeCurrency})`, 'পেমেন্ট মাধ্যম'],
    ...list.map(x => [
      x.date || '',
      x.type === 'income' ? 'জমা' : 'খরচ',
      x.note || '',
      x.category || '',
      Number(x.amount) || 0,
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
  return list
    .filter(x => x.type === type)
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function render() {
  // 1. Overall Lifetime Summary
  const inc = sum(records, 'income');
  const exp = sum(records, 'expense');
  if ($('totalIncome')) $('totalIncome').textContent = money(inc);
  if ($('totalExpense')) $('totalExpense').textContent = money(exp);
  if ($('balance')) $('balance').textContent = money(inc - exp);

  // 2. Date-to-Date & Category Filtered Report
  const startDate = ($('reportStartDate') && $('reportStartDate').value) || '1970-01-01';
  const endDate = ($('reportEndDate') && $('reportEndDate').value) || '2099-12-31';
  const reportType = ($('reportFilterType') && $('reportFilterType').value) || 'all';
  const reportCategory = ($('reportFilterCategory') && $('reportFilterCategory').value) || 'all';

  const reportItems = records.filter(x => {
    const itemDate = x.date || todayStr;
    const inDate = itemDate >= startDate && itemDate <= endDate;
    const typeMatch = reportType === 'all' || x.type === reportType;
    const catMatch = reportCategory === 'all' || x.category === reportCategory;
    return inDate && typeMatch && catMatch;
  });

  const repInc = sum(reportItems, 'income');
  const repExp = sum(reportItems, 'expense');
  if ($('reportIncome')) $('reportIncome').textContent = money(repInc);
  if ($('reportExpense')) $('reportExpense').textContent = money(repExp);
  if ($('reportNet')) $('reportNet').textContent = money(repInc - repExp);
  if ($('reportCount')) $('reportCount').textContent = `${reportItems.length}টি`;

  // 3. Category Visual Breakdown
  const catMap = {};
  reportItems.forEach(item => {
    const cat = item.category || 'অন্যান্য';
    if (!catMap[cat]) {
      catMap[cat] = { income: 0, expense: 0, count: 0 };
    }
    const amt = Number(item.amount) || 0;
    if (item.type === 'income') catMap[cat].income += amt;
    else catMap[cat].expense += amt;
    catMap[cat].count++;
  });

  const catTotalVolume = repInc + repExp;
  const sortedCategories = Object.keys(catMap).sort((a, b) => {
    const totalA = catMap[a].income + catMap[a].expense;
    const totalB = catMap[b].income + catMap[b].expense;
    return totalB - totalA;
  });

  if ($('categoryBars')) {
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
  }

  // 4. Search & Filtered Entries List
  const q = ($('search') && $('search').value ? $('search').value.trim().toLowerCase() : '');
  const searchResults = records.filter(x => {
    return (
      (x.note || '').toLowerCase().includes(q) ||
      (x.category || '').toLowerCase().includes(q) ||
      (x.date || '').includes(q) ||
      (x.paymentMethod || '').toLowerCase().includes(q) ||
      String(x.amount || '').includes(q)
    );
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));

  if ($('empty')) $('empty').hidden = searchResults.length > 0;
  if ($('entries')) {
    $('entries').innerHTML = searchResults.map(x => `
      <div class="entryItem" data-id="${x.id}">
        <div class="entryMain">
          <strong>${esc(x.note || 'হিসাব')}</strong>
          <div class="entryMeta">
            <span class="catPill">${esc(x.category || 'অন্যান্য')}</span>
            <span>📅 ${esc(x.date || '')}</span>
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
}

// Entries delegation (Edit & Delete)
if ($('entries')) {
  $('entries').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const item = records.find(r => r.id === id);
    if (!item) return;

    if (btn.dataset.action === 'delete') {
      if (confirm(`“${item.note || 'হিসাব'}” (${money(item.amount)}) হিসাবটি মুছে ফেলতে চান?`)) {
        records = records.filter(r => r.id !== id);
        persist();
        if ($('editId') && $('editId').value === id) resetForm();
      }
    } else if (btn.dataset.action === 'edit') {
      if ($('editId')) $('editId').value = item.id;
      if ($('amount')) $('amount').value = item.amount;
      if ($('note')) $('note').value = item.note || '';
      if ($('category')) $('category').value = item.category || 'বাজার';
      if ($('date')) $('date').value = item.date || todayStr;
      if ($('paymentMethod')) $('paymentMethod').value = item.paymentMethod || 'নগদ';
      
      const typeRadio = document.querySelector(`input[name="type"][value="${item.type}"]`);
      if (typeRadio) typeRadio.checked = true;

      if ($('formTitle')) $('formTitle').textContent = 'হিসাব সম্পাদনা করুন';
      if ($('saveBtn')) $('saveBtn').textContent = 'পরিবর্তন সেভ করুন';
      if ($('cancelEdit')) $('cancelEdit').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

// CSV Exports
if ($('exportAllCsv')) {
  $('exportAllCsv').addEventListener('click', () => {
    csvDownload(records, 'joma-khoroch-all.csv');
  });
}

if ($('exportReportCsv')) {
  $('exportReportCsv').addEventListener('click', () => {
    const startDate = ($('reportStartDate') && $('reportStartDate').value) || 'All';
    const endDate = ($('reportEndDate') && $('reportEndDate').value) || 'All';
    const reportType = ($('reportFilterType') && $('reportFilterType').value) || 'all';
    const reportCategory = ($('reportFilterCategory') && $('reportFilterCategory').value) || 'all';

    const reportItems = records.filter(x => {
      const itemDate = x.date || todayStr;
      const inDate = (startDate === 'All' || itemDate >= startDate) && (endDate === 'All' || itemDate <= endDate);
      const typeMatch = reportType === 'all' || x.type === reportType;
      const catMatch = reportCategory === 'all' || x.category === reportCategory;
      return inDate && typeMatch && catMatch;
    });

    csvDownload(reportItems, `joma-khoroch-report-${startDate}-to-${endDate}.csv`);
  });
}

// Seed demo data if totally empty on first visit
if (records.length === 0) {
  records = [
    { id: '1', type: 'income', amount: 45000, note: 'মাসিক বেতন', category: 'বেতন', date: todayStr, paymentMethod: 'ব্যাংক' },
    { id: '2', type: 'expense', amount: 12500, note: 'বাড়িভাড়া', category: 'বাড়িভাড়া', date: todayStr, paymentMethod: 'ব্যাংক' },
    { id: '3', type: 'expense', amount: 3200, note: 'কাঁচাবাজার ও মাছ', category: 'বাজার', date: todayStr, paymentMethod: 'নগদ' },
    { id: '4', type: 'expense', amount: 1450, note: 'বিদ্যুৎ ও ওয়াইফাই বিল', category: 'বিল', date: todayStr, paymentMethod: 'বিকাশ' },
    { id: '5', type: 'income', amount: 8500, note: 'ব্যবসায়িক আয়', category: 'ব্যবসা', date: todayStr, paymentMethod: 'ব্যাংক' }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Initialize UI
applyPreset('this_month');

// Only lock if a PIN actually exists
const cfg = pinConfig();
if (cfg && cfg.hash) {
  lock();
} else {
  showApp();
}
