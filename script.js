/**
 * PocketLog — daily expense tracker
 * Vanilla JavaScript. Data lives in localStorage under STORAGE_KEY.
 */

(() => {
  'use strict';

  // --- Constants -----------------------------------------------------------

  const STORAGE_KEY = 'pocketlog_expenses';
  const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

  // Small outline icons (24px grid, stroke 2) for category badges
  const ICON_TAG = '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>';
  const CATEGORY_META = {
    Food: { cls: 'cat-food', icon: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>' },
    Transport: { cls: 'cat-transport', icon: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16"/><path d="M8 18v3"/><path d="M16 18v3"/><circle cx="8" cy="14.5" r=".5"/><circle cx="16" cy="14.5" r=".5"/>' },
    Shopping: { cls: 'cat-shopping', icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    Bills: { cls: 'cat-bills', icon: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>' },
    Health: { cls: 'cat-health', icon: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>' },
    Other: { cls: 'cat-other', icon: ICON_TAG }
  };

  const TOAST_ICONS = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
  };

  const DOTS_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>';

  // --- State ---------------------------------------------------------------

  let expenses = [];
  let storageLocked = false;      // true if existing data could not be read; protects it from being overwritten
  let editingExpenseId = null;
  let pendingDeleteId = null;
  let lastFocusedTrigger = null;
  let initialFormValues = null;
  let isSubmitting = false;
  let menuTrigger = null;
  let menuExpenseId = null;

  // --- DOM -----------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  const monthAmountEl = $('month-amount');
  const monthPeriodLabelEl = $('month-period-label');
  const alltimeAmountEl = $('alltime-amount');
  const totalCountEl = $('total-count');

  const resultsMetaEl = $('results-meta');
  const resultsCountEl = $('results-count');
  const resultsSubtotalEl = $('results-subtotal');
  const toolbarEl = $('toolbar');
  const searchInput = $('search-input');
  const clearSearchBtn = $('clear-search-btn');
  const filterCategorySelect = $('filter-category');
  const filterDateSelect = $('filter-date');
  const clearFiltersBtn = $('clear-filters-btn');
  const customDateContainer = $('custom-date-container');
  const customDateStartInput = $('custom-date-start');
  const customDateEndInput = $('custom-date-end');
  const customDateErrorEl = $('custom-date-error');

  const tableHeadEl = $('desktop-list-header');
  const expenseListEl = $('expense-list');
  const emptyStateEl = $('empty-state');
  const noResultsStateEl = $('no-results-state');
  const emptyStateAddBtn = $('empty-state-add-btn');
  const noResultsClearBtn = $('no-results-clear-btn');
  const openAddDialogBtn = $('open-add-dialog-btn');

  const menuEl = $('row-actions-menu');
  const menuItems = Array.from(menuEl.querySelectorAll('[role="menuitem"]'));

  const expenseDialog = $('expense-dialog');
  const dialogTitleEl = $('dialog-title');
  const dialogCloseBtn = $('dialog-close-btn');
  const dialogCancelBtn = $('dialog-cancel-btn');
  const dialogSubmitBtn = $('dialog-submit-btn');
  const submitBtnText = $('submit-btn-text');
  const expenseForm = $('expense-form');

  const amountInput = $('expense-amount');
  const descInput = $('expense-description');
  const categorySelect = $('expense-category');
  const dateInput = $('expense-date');
  const FIELD_ERRORS = [
    [amountInput, $('amount-error')],
    [descInput, $('desc-error')],
    [categorySelect, $('category-error')],
    [dateInput, $('date-error')]
  ];

  const deleteDialog = $('delete-dialog');
  const deletePreviewContent = $('delete-preview-content');
  const deleteCancelBtn = $('delete-cancel-btn');
  const deleteConfirmBtn = $('delete-confirm-btn');

  const discardDialog = $('discard-dialog');
  const discardStayBtn = $('discard-stay-btn');
  const discardConfirmBtn = $('discard-confirm-btn');

  const toastRegion = $('toast-region');
  const alertRegion = $('alert-region');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- Utilities -----------------------------------------------------------

  const pad2 = (n) => String(n).padStart(2, '0');

  /** Local calendar date as 'YYYY-MM-DD' (no UTC shift). */
  function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function getCurrentMonthPrefix() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }

  function getLastMonthPrefix() {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // previous month, 1-based
    if (m === 0) { m = 12; y -= 1; }
    return `${y}-${pad2(m)}`;
  }

  /** True for a real calendar date in 'YYYY-MM-DD' form. */
  function isValidDateString(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function formatMonthYearLabel(prefix) {
    const [y, m] = prefix.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  // Money in integer paise to avoid floating-point artifacts
  const toPaise = (amt) => Math.round((Number(amt) || 0) * 100);
  const sumExpenses = (list) => list.reduce((acc, item) => acc + toPaise(item.amount), 0) / 100;

  function formatINR(amount) {
    return '₹' + (Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateDisplay(dateStr) {
    if (!isValidDateString(dateStr)) return dateStr || '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const generateId = () => 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  function categoryBadge(category) {
    const meta = CATEGORY_META[category];
    const cls = meta ? meta.cls : 'cat-unknown';
    const icon = meta ? meta.icon : ICON_TAG;
    return `<span class="category-badge ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${escapeHtml(category)}</span></span>`;
  }

  const isVisible = (el) => Boolean(el && document.contains(el) && el.offsetParent !== null);

  // --- Storage -------------------------------------------------------------

  /** Normalise a stored record for display while keeping every saved field. */
  function normaliseRecord(item) {
    return {
      ...item,
      id: item.id || generateId(),
      description: String(item.description ?? ''),
      amount: Math.abs(parseFloat(Number(item.amount).toFixed(2))) || 0,
      // Unknown categories are kept exactly as saved and shown with a neutral badge
      category: typeof item.category === 'string' && item.category ? item.category : 'Other',
      date: typeof item.date === 'string' && item.date ? item.date : getTodayDateString(),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
    };
  }

  function loadExpenses() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('localStorage is unavailable:', err);
      storageLocked = true;
      expenses = [];
      showToast('This browser is blocking storage, so expenses can’t be saved here.', { type: 'error' });
      return;
    }

    if (!raw) {
      expenses = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every((i) => i && typeof i === 'object')) {
        throw new Error('Unexpected data format');
      }
      expenses = parsed.map(normaliseRecord);
    } catch (err) {
      // Never overwrite data we couldn't read
      console.error('Failed to read saved expenses:', err);
      storageLocked = true;
      expenses = [];
      showToast('Your saved expenses couldn’t be read. To protect them, new changes won’t be saved.', { type: 'error' });
    }
  }

  /** Persist a new list. Returns true only if the write succeeded. */
  function persist(nextExpenses) {
    if (storageLocked) {
      showToast('Changes weren’t saved because existing data in this browser couldn’t be read.', { type: 'error' });
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextExpenses));
      expenses = nextExpenses;
      return true;
    } catch (err) {
      console.error('Failed to save expenses:', err);
      showToast('Couldn’t save. Browser storage may be full or restricted.', { type: 'error' });
      return false;
    }
  }

  // --- Toasts --------------------------------------------------------------

  /**
   * Show a status message. Success/info messages auto-dismiss;
   * errors stay until dismissed.
   */
  function showToast(message, { type = 'success', actionLabel = null, onAction = null, duration = 4000 } = {}) {
    const isError = type === 'error';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</svg>`;

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    toast.appendChild(msg);

    let timer = null;
    const remove = () => {
      clearTimeout(timer);
      if (!toast.parentNode) return;
      toast.style.transition = 'opacity 0.16s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 170);
    };

    if (actionLabel && typeof onAction === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => { onAction(); remove(); });
      toast.appendChild(btn);
    }

    if (isError) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn-icon';
      close.setAttribute('aria-label', 'Dismiss message');
      close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      close.addEventListener('click', remove);
      toast.appendChild(close);
    } else {
      timer = setTimeout(remove, duration);
    }

    (isError ? alertRegion : toastRegion).appendChild(toast);
  }

  // --- Summary (global; ignores list filters) ------------------------------

  let metricsReady = false; // no highlight on the first render

  /** Write a metric's final value immediately; briefly highlight it only if it changed. */
  function setMetric(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    if (!metricsReady || prefersReducedMotion.matches) return;
    el.classList.remove('metric-changed');
    void el.offsetWidth; // restart the animation if it's already running
    el.classList.add('metric-changed');
  }

  function updateSummaryMetrics() {
    const currentMonth = getCurrentMonthPrefix();
    const monthExpenses = expenses.filter((item) => item.date.startsWith(currentMonth));

    setMetric(monthAmountEl, formatINR(sumExpenses(monthExpenses)));
    monthPeriodLabelEl.textContent = formatMonthYearLabel(currentMonth);
    setMetric(alltimeAmountEl, formatINR(sumExpenses(expenses)));
    setMetric(totalCountEl, expenses.length.toLocaleString('en-IN'));
  }

  [monthAmountEl, alltimeAmountEl, totalCountEl].forEach((el) => {
    el.addEventListener('animationend', () => el.classList.remove('metric-changed'));
  });

  // --- Filtering -----------------------------------------------------------

  function isFilterActive() {
    return searchInput.value.trim().length > 0 ||
      filterCategorySelect.value !== 'ALL' ||
      filterDateSelect.value !== 'ALL';
  }

  function matchesFilters(item) {
    const query = searchInput.value.trim().toLowerCase();
    const category = filterCategorySelect.value;
    const dateMode = filterDateSelect.value;

    if (query && !item.description.toLowerCase().includes(query)) return false;
    if (category !== 'ALL' && item.category !== category) return false;

    if (dateMode === 'THIS_MONTH' && !item.date.startsWith(getCurrentMonthPrefix())) return false;
    if (dateMode === 'LAST_MONTH' && !item.date.startsWith(getLastMonthPrefix())) return false;
    if (dateMode === 'CUSTOM') {
      const start = customDateStartInput.value;
      const end = customDateEndInput.value;
      if (start && item.date < start) return false; // boundaries inclusive
      if (end && item.date > end) return false;
    }
    return true;
  }

  function getFilteredAndSortedExpenses() {
    return expenses
      .filter(matchesFilters)
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        (b.createdAt || 0) - (a.createdAt || 0) ||
        String(a.id).localeCompare(String(b.id))
      );
  }

  // --- Rendering -----------------------------------------------------------

  function renderRow(expense) {
    const desc = escapeHtml(expense.description);
    const id = escapeHtml(expense.id);
    return `
      <li class="expense-item" data-id="${id}">
        <div class="cell-desc">${desc}</div>
        <div class="cell-meta">
          <div class="cell-category">${categoryBadge(expense.category)}</div>
          <div class="cell-date"><time datetime="${escapeHtml(expense.date)}">${escapeHtml(formatDateDisplay(expense.date))}</time></div>
        </div>
        <div class="cell-amount">${formatINR(expense.amount)}</div>
        <div class="cell-actions">
          <button type="button" class="menu-trigger" data-id="${id}"
            aria-haspopup="menu" aria-expanded="false" aria-controls="row-actions-menu"
            aria-label="Actions for ${desc}">${DOTS_ICON}</button>
        </div>
      </li>`;
  }

  function renderList() {
    closeMenu(false);

    const hasAnyExpenses = expenses.length > 0;
    const filtered = getFilteredAndSortedExpenses();
    const filterActive = isFilterActive();

    // Toolbar state
    clearSearchBtn.classList.toggle('hidden', searchInput.value.length === 0);
    clearFiltersBtn.classList.toggle('hidden', !filterActive);
    searchInput.closest('.field').classList.toggle('is-active', searchInput.value.trim().length > 0);
    filterCategorySelect.closest('.field').classList.toggle('is-active', filterCategorySelect.value !== 'ALL');
    filterDateSelect.closest('.field').classList.toggle('is-active', filterDateSelect.value !== 'ALL');

    // First use: no toolbar or results line, just the welcome state
    toolbarEl.classList.toggle('hidden', !hasAnyExpenses);
    resultsMetaEl.classList.toggle('hidden', !hasAnyExpenses);

    const n = filtered.length;
    resultsCountEl.textContent = `${n.toLocaleString('en-IN')} ${n === 1 ? 'expense' : 'expenses'}`;
    resultsSubtotalEl.textContent = formatINR(sumExpenses(filtered));

    emptyStateEl.classList.toggle('hidden', hasAnyExpenses);
    noResultsStateEl.classList.toggle('hidden', !hasAnyExpenses || n > 0);
    tableHeadEl.classList.toggle('hidden', n === 0);
    expenseListEl.classList.toggle('hidden', n === 0);
    expenseListEl.innerHTML = filtered.map(renderRow).join('');
  }

  function refreshAll() {
    updateSummaryMetrics();
    renderList();
  }

  const findRowTrigger = (id) => expenseListEl.querySelector(`.menu-trigger[data-id="${CSS.escape(id)}"]`);

  /** Move focus somewhere sensible when the previous target is gone. */
  function focusFallback() {
    if (isVisible(emptyStateAddBtn)) emptyStateAddBtn.focus();
    else if (isVisible(noResultsClearBtn)) noResultsClearBtn.focus();
    else openAddDialogBtn.focus();
  }

  // --- Filters -------------------------------------------------------------

  function validateCustomRange() {
    const start = customDateStartInput.value;
    const end = customDateEndInput.value;
    const invalid = Boolean(start && end && start > end);
    customDateErrorEl.textContent = invalid ? 'The start date must be on or before the end date.' : '';
    customDateStartInput.classList.toggle('is-invalid', invalid);
    customDateEndInput.classList.toggle('is-invalid', invalid);
    customDateStartInput.setAttribute('aria-invalid', String(invalid));
    customDateEndInput.setAttribute('aria-invalid', String(invalid));
  }

  function resetAllFilters() {
    searchInput.value = '';
    filterCategorySelect.value = 'ALL';
    filterDateSelect.value = 'ALL';
    customDateStartInput.value = '';
    customDateEndInput.value = '';
    validateCustomRange();
    customDateContainer.classList.add('hidden');
    renderList();
  }

  // --- Actions menu --------------------------------------------------------

  function positionMenu() {
    if (!menuTrigger) return;
    const rect = menuTrigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;

    // Anchor scrolled out of view: close rather than float detached
    if (rect.bottom < 0 || rect.top > vh) {
      closeMenu(false);
      return;
    }

    const gap = 4;
    const margin = 8;
    const mw = menuEl.offsetWidth;
    const mh = menuEl.offsetHeight;

    let top = rect.bottom + gap;
    if (top + mh > vh - margin && rect.top - gap - mh >= margin) {
      top = rect.top - gap - mh; // flip above
    }
    top = Math.max(margin, Math.min(top, vh - mh - margin));

    let left = rect.right - mw;
    left = Math.max(margin, Math.min(left, vw - mw - margin));

    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.dataset.placement = top < rect.top ? 'top' : 'bottom';
  }

  function openMenu(trigger, focusIndex = 0) {
    if (menuTrigger && menuTrigger !== trigger) closeMenu(false);
    menuTrigger = trigger;
    menuExpenseId = trigger.dataset.id;
    trigger.setAttribute('aria-expanded', 'true');
    menuEl.setAttribute('aria-label', trigger.getAttribute('aria-label'));
    menuEl.hidden = false;
    positionMenu();
    if (!menuTrigger) return; // closed during positioning
    const index = focusIndex < 0 ? menuItems.length - 1 : focusIndex;
    menuItems[index].focus();
  }

  function closeMenu(returnFocus) {
    if (!menuTrigger) return;
    const trigger = menuTrigger;
    trigger.setAttribute('aria-expanded', 'false');
    menuEl.hidden = true;
    menuTrigger = null;
    menuExpenseId = null;
    if (returnFocus && document.contains(trigger)) trigger.focus();
  }

  expenseListEl.addEventListener('click', (e) => {
    const trigger = e.target.closest('.menu-trigger');
    if (!trigger) return;
    if (menuTrigger === trigger) closeMenu(true);
    else openMenu(trigger, 0);
  });

  expenseListEl.addEventListener('keydown', (e) => {
    const trigger = e.target.closest('.menu-trigger');
    if (!trigger) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu(trigger, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(trigger, -1);
    }
    // Enter / Space trigger a native click
  });

  menuEl.addEventListener('keydown', (e) => {
    const index = menuItems.indexOf(document.activeElement);
    const last = menuItems.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        menuItems[index >= last ? 0 : index + 1].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        menuItems[index <= 0 ? last : index - 1].focus();
        break;
      case 'Home':
        e.preventDefault();
        menuItems[0].focus();
        break;
      case 'End':
        e.preventDefault();
        menuItems[last].focus();
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        // Return focus to the trigger, then let Tab continue from there
        closeMenu(true);
        break;
      default:
        break;
    }
  });

  menuEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-menu-action]');
    if (!item || !menuTrigger) return;
    const id = menuExpenseId;
    const trigger = menuTrigger;
    closeMenu(false);
    if (item.dataset.menuAction === 'edit') openEditDialog(id, trigger);
    else openDeleteConfirmation(id, trigger);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!menuTrigger) return;
    if (menuEl.contains(e.target) || menuTrigger.contains(e.target)) return;
    closeMenu(false);
  }, true);

  window.addEventListener('scroll', positionMenu, true);
  window.addEventListener('resize', positionMenu);

  // --- Dialog helpers ------------------------------------------------------

  function showDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function hideDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  // --- Add / Edit ----------------------------------------------------------

  function clearFormErrors() {
    FIELD_ERRORS.forEach(([input, errorEl]) => {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
    });
  }

  function setFieldError(input, message) {
    const entry = FIELD_ERRORS.find(([el]) => el === input);
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    entry[1].textContent = message;
  }

  const readFormValues = () => ({
    amount: amountInput.value.trim(),
    description: descInput.value.trim(),
    category: categorySelect.value,
    date: dateInput.value
  });

  function isFormDirty() {
    if (!initialFormValues) return false;
    const now = readFormValues();
    return Object.keys(now).some((k) => now[k] !== initialFormValues[k]);
  }

  function openFormDialog(triggerEl) {
    lastFocusedTrigger = triggerEl;
    isSubmitting = false;
    dialogSubmitBtn.disabled = false;
    initialFormValues = readFormValues();
    showDialog(expenseDialog);
    amountInput.focus();
  }

  function openAddDialog(triggerEl) {
    editingExpenseId = null;
    clearFormErrors();
    expenseForm.reset();
    dateInput.value = getTodayDateString();
    categorySelect.value = '';
    dialogTitleEl.textContent = 'Add expense';
    submitBtnText.textContent = 'Save expense';
    openFormDialog(triggerEl || openAddDialogBtn);
  }

  function openEditDialog(id, triggerEl) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;
    editingExpenseId = id;
    clearFormErrors();
    amountInput.value = Number(expense.amount).toFixed(2);
    descInput.value = expense.description;
    // An unrecognised saved category leaves the select empty so the user picks one
    categorySelect.value = VALID_CATEGORIES.includes(expense.category) ? expense.category : '';
    dateInput.value = expense.date;
    dialogTitleEl.textContent = 'Edit expense';
    submitBtnText.textContent = 'Save changes';
    openFormDialog(triggerEl);
  }

  /** Close the form. Asks first if there are unsaved changes (unless forced). */
  function closeExpenseDialog(force = false, restoreFocus = true) {
    if (!force && isFormDirty()) {
      showDialog(discardDialog);
      discardStayBtn.focus();
      return;
    }
    hideDialog(expenseDialog);
    clearFormErrors();
    const editedId = editingExpenseId;
    editingExpenseId = null;
    initialFormValues = null;

    if (!restoreFocus) return;
    if (isVisible(lastFocusedTrigger)) lastFocusedTrigger.focus();
    else if (editedId && findRowTrigger(editedId)) findRowTrigger(editedId).focus();
    else focusFallback();
  }

  function validateExpenseForm() {
    clearFormErrors();
    const invalid = [];

    const amountRaw = amountInput.value.trim();
    const amountNum = Number(amountRaw);
    if (!amountRaw) {
      setFieldError(amountInput, 'Enter an amount greater than ₹0.');
      invalid.push(amountInput);
    } else if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFieldError(amountInput, 'Amount must be a number greater than ₹0.');
      invalid.push(amountInput);
    } else if ((amountRaw.split('.')[1] || '').length > 2) {
      setFieldError(amountInput, 'Use at most 2 decimal places.');
      invalid.push(amountInput);
    }

    const desc = descInput.value.trim();
    if (!desc) {
      setFieldError(descInput, 'Enter a description.');
      invalid.push(descInput);
    } else if (desc.length > 120) {
      setFieldError(descInput, 'Keep the description to 120 characters or fewer.');
      invalid.push(descInput);
    }

    if (!VALID_CATEGORIES.includes(categorySelect.value)) {
      setFieldError(categorySelect, 'Choose a category.');
      invalid.push(categorySelect);
    }

    if (!dateInput.value) {
      setFieldError(dateInput, 'Choose a date.');
      invalid.push(dateInput);
    } else if (!isValidDateString(dateInput.value)) {
      setFieldError(dateInput, 'Enter a valid calendar date.');
      invalid.push(dateInput);
    }

    if (invalid.length) invalid[0].focus();
    return invalid.length === 0;
  }

  function highlightRow(id) {
    const row = expenseListEl.querySelector(`.expense-item[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    row.classList.add('item-highlight');
    row.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateExpenseForm()) return;

    isSubmitting = true;
    dialogSubmitBtn.disabled = true;

    const values = {
      description: descInput.value.trim(),
      amount: parseFloat(Number(amountInput.value).toFixed(2)),
      category: categorySelect.value,
      date: dateInput.value
    };

    const isEdit = Boolean(editingExpenseId);
    let saved;
    let next;

    if (isEdit) {
      next = expenses.map((item) => {
        if (item.id !== editingExpenseId) return item;
        saved = { ...item, ...values };
        return saved;
      });
      if (!saved) {
        // Record vanished (e.g. deleted elsewhere); don't create a duplicate
        isSubmitting = false;
        dialogSubmitBtn.disabled = false;
        showToast('This expense no longer exists, so it couldn’t be updated.', { type: 'error' });
        return;
      }
    } else {
      saved = { id: generateId(), ...values, createdAt: Date.now() };
      next = [...expenses, saved];
    }

    if (!persist(next)) {
      // Keep the dialog open with the user's input intact
      isSubmitting = false;
      dialogSubmitBtn.disabled = false;
      return;
    }

    const returnTo = lastFocusedTrigger;
    closeExpenseDialog(true, false);
    refreshAll();

    if (!matchesFilters(saved)) {
      showToast('Expense saved. It’s hidden by your current filters.', {
        type: 'info',
        actionLabel: 'Clear filters',
        onAction: () => { resetAllFilters(); highlightRow(saved.id); },
        duration: 7000
      });
      if (isVisible(returnTo)) returnTo.focus(); else focusFallback();
      return;
    }

    showToast(isEdit ? 'Changes saved.' : 'Expense added.');
    if (isEdit && findRowTrigger(saved.id)) findRowTrigger(saved.id).focus();
    else if (isVisible(returnTo)) returnTo.focus();
    else openAddDialogBtn.focus();
    highlightRow(saved.id);
  }

  // --- Delete --------------------------------------------------------------

  function openDeleteConfirmation(id, triggerEl) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;
    pendingDeleteId = id;
    lastFocusedTrigger = triggerEl;

    deletePreviewContent.innerHTML = `
      <div class="delete-preview-details">
        <span class="delete-preview-title">${escapeHtml(expense.description)}</span>
        <span class="delete-preview-sub">${escapeHtml(expense.category)} · ${escapeHtml(formatDateDisplay(expense.date))}</span>
      </div>
      <span class="delete-preview-amount">${formatINR(expense.amount)}</span>`;

    showDialog(deleteDialog);
    deleteCancelBtn.focus(); // safer default
  }

  function closeDeleteConfirmation(restoreFocus = true) {
    pendingDeleteId = null;
    hideDialog(deleteDialog);
    if (restoreFocus) {
      if (isVisible(lastFocusedTrigger)) lastFocusedTrigger.focus();
      else focusFallback();
    }
  }

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;

    // Work out where focus should go once the row disappears
    const visibleIds = getFilteredAndSortedExpenses().map((item) => item.id);
    const pos = visibleIds.indexOf(id);
    const neighbourId = visibleIds[pos + 1] || visibleIds[pos - 1] || null;

    if (!persist(expenses.filter((item) => item.id !== id))) {
      closeDeleteConfirmation(true);
      return;
    }

    closeDeleteConfirmation(false);
    refreshAll();
    showToast('Expense deleted.');

    const neighbour = neighbourId && findRowTrigger(neighbourId);
    if (neighbour) neighbour.focus();
    else focusFallback();
  }

  // --- Events --------------------------------------------------------------

  // Form: clear a field's error as soon as it's edited
  FIELD_ERRORS.forEach(([input, errorEl]) => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, () => {
      if (!input.classList.contains('is-invalid')) return;
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
    });
  });

  openAddDialogBtn.addEventListener('click', () => openAddDialog(openAddDialogBtn));
  emptyStateAddBtn.addEventListener('click', () => openAddDialog(emptyStateAddBtn));
  dialogCloseBtn.addEventListener('click', () => closeExpenseDialog());
  dialogCancelBtn.addEventListener('click', () => closeExpenseDialog());
  expenseForm.addEventListener('submit', handleFormSubmit);

  discardStayBtn.addEventListener('click', () => {
    hideDialog(discardDialog);
    amountInput.focus();
  });
  discardConfirmBtn.addEventListener('click', () => {
    hideDialog(discardDialog);
    closeExpenseDialog(true);
  });

  deleteCancelBtn.addEventListener('click', () => closeDeleteConfirmation(true));
  deleteConfirmBtn.addEventListener('click', handleConfirmDelete);

  searchInput.addEventListener('input', renderList);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    renderList();
    searchInput.focus();
  });
  filterCategorySelect.addEventListener('change', renderList);

  filterDateSelect.addEventListener('change', () => {
    const custom = filterDateSelect.value === 'CUSTOM';
    customDateContainer.classList.toggle('hidden', !custom);
    if (custom) {
      if (!customDateStartInput.value) customDateStartInput.value = `${getCurrentMonthPrefix()}-01`;
      if (!customDateEndInput.value) customDateEndInput.value = getTodayDateString();
    } else {
      customDateStartInput.value = '';
      customDateEndInput.value = '';
    }
    validateCustomRange();
    renderList();
  });

  [customDateStartInput, customDateEndInput].forEach((input) => {
    input.addEventListener('change', () => {
      validateCustomRange();
      renderList();
    });
  });

  clearFiltersBtn.addEventListener('click', () => {
    resetAllFilters();
    searchInput.focus(); // the button itself is now hidden
  });
  noResultsClearBtn.addEventListener('click', () => {
    resetAllFilters();
    searchInput.focus();
  });

  // Backdrop clicks and Escape for each dialog
  const dialogCloseHandlers = new Map([
    [expenseDialog, () => closeExpenseDialog()],
    [deleteDialog, () => closeDeleteConfirmation(true)],
    [discardDialog, () => { hideDialog(discardDialog); amountInput.focus(); }]
  ]);

  dialogCloseHandlers.forEach((handler, dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) handler();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      handler();
    });
  });

  // --- Init ----------------------------------------------------------------

  loadExpenses();
  refreshAll();
  metricsReady = true;
})();
