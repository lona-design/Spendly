/**
 * PocketLog — Calm, Premium, Refined Daily Expense Tracker
 * Vanilla JavaScript Implementation
 */

(() => {
  'use strict';

  // --- Constants & Configuration ---
  const STORAGE_KEY = 'pocketlog_expenses';
  const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

  // --- Application State ---
  let expenses = [];
  let editingExpenseId = null;
  let pendingDeleteId = null;
  let lastFocusedTrigger = null;
  let initialFormValues = null;

  // --- DOM Elements ---

  // Summary Metrics (Global scope, independent of filters)
  const monthAmountEl = document.getElementById('month-amount');
  const monthPeriodLabelEl = document.getElementById('month-period-label');
  const alltimeAmountEl = document.getElementById('alltime-amount');
  const totalCountEl = document.getElementById('total-count');

  // Expenses Section & Results Subtotal
  const resultsCountEl = document.getElementById('results-count');
  const resultsSubtotalEl = document.getElementById('results-subtotal');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterCategorySelect = document.getElementById('filter-category');
  const filterDateSelect = document.getElementById('filter-date');

  // Custom Date Range Sub-controls
  const customDateContainer = document.getElementById('custom-date-container');
  const customDateStartInput = document.getElementById('custom-date-start');
  const customDateEndInput = document.getElementById('custom-date-end');
  const customDateErrorEl = document.getElementById('custom-date-error');
  const filterStatusBar = document.getElementById('filter-status-bar');
  const resetAllFiltersBtn = document.getElementById('reset-all-filters-btn');

  // List & State Containers
  const desktopListHeader = document.getElementById('desktop-list-header');
  const expenseListEl = document.getElementById('expense-list');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsStateEl = document.getElementById('no-results-state');
  const emptyStateAddBtn = document.getElementById('empty-state-add-btn');
  const noResultsClearBtn = document.getElementById('no-results-clear-btn');

  // Header CTA Trigger
  const openAddDialogBtn = document.getElementById('open-add-dialog-btn');

  // Add / Edit Dialog Elements
  const expenseDialog = document.getElementById('expense-dialog');
  const dialogTitleEl = document.getElementById('dialog-title');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');
  const dialogCancelBtn = document.getElementById('dialog-cancel-btn');
  const dialogSubmitBtn = document.getElementById('dialog-submit-btn');
  const submitBtnText = document.getElementById('submit-btn-text');
  const expenseForm = document.getElementById('expense-form');

  // Form Fields & Error Elements
  const amountInput = document.getElementById('expense-amount');
  const descInput = document.getElementById('expense-description');
  const categorySelect = document.getElementById('expense-category');
  const dateInput = document.getElementById('expense-date');

  const amountErrorEl = document.getElementById('amount-error');
  const descErrorEl = document.getElementById('desc-error');
  const categoryErrorEl = document.getElementById('category-error');
  const dateErrorEl = document.getElementById('date-error');

  // Delete Confirmation Dialog Elements
  const deleteDialog = document.getElementById('delete-dialog');
  const deletePreviewContent = document.getElementById('delete-preview-content');
  const deleteCancelBtn = document.getElementById('delete-cancel-btn');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  // Unsaved Changes Discard Dialog Elements
  const discardDialog = document.getElementById('discard-dialog');
  const discardStayBtn = document.getElementById('discard-stay-btn');
  const discardConfirmBtn = document.getElementById('discard-confirm-btn');

  // Toast Container
  const toastRegion = document.getElementById('toast-region');

  // --- Utility Functions ---

  /**
   * Return today's date in local calendar 'YYYY-MM-DD' format.
   * Avoids UTC shift bugs by reading local year, month, day.
   */
  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Return 'YYYY-MM' for the current local calendar month.
   */
  function getCurrentMonthPrefix() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Return 'YYYY-MM' for the previous local calendar month.
   */
  function getLastMonthPrefix() {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // 0-indexed, so 0 (Jan) becomes month 12 of y-1
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  /**
   * Format month prefix ('YYYY-MM') to readable text, e.g. "November 2026".
   */
  function formatMonthYearLabel(prefix) {
    if (!prefix) return '';
    const parts = prefix.split('-');
    if (parts.length !== 2) return prefix;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = new Date(y, m, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  /**
   * Convert currency amount to integer paise to prevent floating-point calculation errors.
   */
  function toPaise(amt) {
    return Math.round((Number(amt) || 0) * 100);
  }

  /**
   * Convert integer paise back to float.
   */
  function fromPaise(paise) {
    return paise / 100;
  }

  /**
   * Sum an array of expense records with floating-point precision safety.
   */
  function sumExpenses(list) {
    if (!list || !list.length) return 0;
    const totalPaise = list.reduce((acc, item) => acc + toPaise(item.amount), 0);
    return fromPaise(totalPaise);
  }

  /**
   * Format a numeric amount to Indian Rupee standard format (e.g. ₹1,250.00).
   */
  function formatINR(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format 'YYYY-MM-DD' into readable date, e.g. "06 Nov 2026".
   */
  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);

    if (isNaN(dateObj.getTime())) return dateStr;

    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Escape HTML strings when rendering dynamically to prevent XSS.
   */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- LocalStorage Management (Graceful failure handling) ---

  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        expenses = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Backward-compatible schema validation: preserve IDs and timestamps
        expenses = parsed.map((item) => ({
          id: item.id || ('exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
          description: String(item.description || ''),
          amount: Math.abs(parseFloat(Number(item.amount).toFixed(2))) || 0,
          category: VALID_CATEGORIES.includes(item.category) ? item.category : 'Other',
          date: item.date || getTodayDateString(),
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
        }));
      } else {
        expenses = [];
      }
    } catch (err) {
      console.error('Failed to parse expenses from localStorage:', err);
      showToast('Could not read existing expenses from browser storage.', null, null, 'error');
      expenses = [];
    }
  }

  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      return true;
    } catch (err) {
      console.error('Failed to save expenses to localStorage:', err);
      showToast('Storage full or restricted. Changes could not be saved to this browser.', null, null, 'error');
      return false;
    }
  }

  // --- Toast Notification Region (Status messages, aria-live="polite") ---

  /**
   * Show a non-blocking toast notification.
   */
  // Inline SVG paths for toast icons (feedback never relies on colour alone)
  const TOAST_ICONS = {
    success: '<polyline points="20 6 9 17 4 12"></polyline>',
    error: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
  };

  function showToast(message, actionLabel = null, actionCallback = null, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    toast.insertAdjacentHTML(
      'beforeend',
      `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</svg>`
    );

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (actionLabel && typeof actionCallback === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'btn btn-ghost btn-sm toast-action-btn';
      actionBtn.textContent = actionLabel;
      actionBtn.addEventListener('click', () => {
        actionCallback();
        removeToast(toast);
      });
      toast.appendChild(actionBtn);
    }

    toastRegion.appendChild(toast);

    const timer = setTimeout(() => {
      removeToast(toast);
    }, duration);

    function removeToast(el) {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.style.transition = 'opacity 0.16s ease';
      el.style.opacity = '0';
      setTimeout(() => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 180);
    }
  }

  // --- Summary Metrics (All-time and Current Month) ---

  /**
   * Update top summary cards.
   * Defined from ALL saved expenses regardless of list filters.
   */
  function updateSummaryMetrics() {
    const currentMonth = getCurrentMonthPrefix();
    const currentMonthExpenses = expenses.filter((item) => item.date.startsWith(currentMonth));

    const monthTotal = sumExpenses(currentMonthExpenses);
    const alltimeTotal = sumExpenses(expenses);
    const countTotal = expenses.length;

    monthAmountEl.textContent = formatINR(monthTotal);
    monthPeriodLabelEl.textContent = formatMonthYearLabel(currentMonth);

    alltimeAmountEl.textContent = formatINR(alltimeTotal);
    totalCountEl.textContent = countTotal.toLocaleString('en-IN');
  }

  // --- Filtering & Sorting ---

  function isFilterActive() {
    const hasSearch = searchInput.value.trim().length > 0;
    const hasCategory = filterCategorySelect.value !== 'ALL';
    const hasDate = filterDateSelect.value !== 'ALL';
    return hasSearch || hasCategory || hasDate;
  }

  function getFilteredAndSortedExpenses() {
    const searchQuery = searchInput.value.trim().toLowerCase();
    const selectedCategory = filterCategorySelect.value;
    const selectedDateMode = filterDateSelect.value;

    const currentMonth = getCurrentMonthPrefix();
    const lastMonth = getLastMonthPrefix();

    const customStart = customDateStartInput.value;
    const customEnd = customDateEndInput.value;

    return expenses
      .filter((item) => {
        // 1. Description Search Match (case-insensitive substring)
        if (searchQuery && !item.description.toLowerCase().includes(searchQuery)) {
          return false;
        }

        // 2. Category Match
        if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
          return false;
        }

        // 3. Date Range Match
        if (selectedDateMode === 'THIS_MONTH') {
          if (!item.date.startsWith(currentMonth)) return false;
        } else if (selectedDateMode === 'LAST_MONTH') {
          if (!item.date.startsWith(lastMonth)) return false;
        } else if (selectedDateMode === 'CUSTOM') {
          if (customStart && item.date < customStart) return false;
          if (customEnd && item.date > customEnd) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Newest date first
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        // Secondary sort: newest added first
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  /**
   * Check if a specific expense matches the currently active search & filters.
   */
  function doesExpenseMatchActiveFilters(item) {
    const searchQuery = searchInput.value.trim().toLowerCase();
    const selectedCategory = filterCategorySelect.value;
    const selectedDateMode = filterDateSelect.value;
    const currentMonth = getCurrentMonthPrefix();
    const lastMonth = getLastMonthPrefix();
    const customStart = customDateStartInput.value;
    const customEnd = customDateEndInput.value;

    if (searchQuery && !item.description.toLowerCase().includes(searchQuery)) return false;
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

    if (selectedDateMode === 'THIS_MONTH' && !item.date.startsWith(currentMonth)) return false;
    if (selectedDateMode === 'LAST_MONTH' && !item.date.startsWith(lastMonth)) return false;
    if (selectedDateMode === 'CUSTOM') {
      if (customStart && item.date < customStart) return false;
      if (customEnd && item.date > customEnd) return false;
    }

    return true;
  }

  // --- Rendering Expenses List ---

  function renderList() {
    const hasAnyExpenses = expenses.length > 0;
    const filtered = getFilteredAndSortedExpenses();
    const hasFilteredResults = filtered.length > 0;
    const filterActive = isFilterActive();

    // Toggle clear search button
    if (searchInput.value.trim().length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    // Mark individual filter fields as selected (plum styling hook)
    searchInput.closest('.filter-field').classList.toggle('is-active', searchInput.value.trim().length > 0);
    filterCategorySelect.closest('.filter-field').classList.toggle('is-active', filterCategorySelect.value !== 'ALL');
    filterDateSelect.closest('.filter-field').classList.toggle('is-active', filterDateSelect.value !== 'ALL');

    // Toggle active filter status bar
    if (filterActive) {
      filterStatusBar.classList.remove('hidden');
    } else {
      filterStatusBar.classList.add('hidden');
    }

    // Update Results Subtotal and Count
    const filteredSubtotal = sumExpenses(filtered);
    resultsCountEl.textContent = `${filtered.length} matching ${filtered.length === 1 ? 'expense' : 'expenses'}`;
    resultsSubtotalEl.textContent = formatINR(filteredSubtotal);

    // View States:
    // Case 1: No saved expenses at all in the entire app
    if (!hasAnyExpenses) {
      desktopListHeader.classList.add('hidden');
      expenseListEl.innerHTML = '';
      expenseListEl.classList.add('hidden');
      noResultsStateEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    // Case 2: Saved expenses exist, but active filters yield 0 records
    if (!hasFilteredResults) {
      desktopListHeader.classList.add('hidden');
      expenseListEl.innerHTML = '';
      expenseListEl.classList.add('hidden');
      emptyStateEl.classList.add('hidden');
      noResultsStateEl.classList.remove('hidden');
      return;
    }

    // Case 3: Matching expenses exist
    emptyStateEl.classList.add('hidden');
    noResultsStateEl.classList.add('hidden');
    desktopListHeader.classList.remove('hidden');
    expenseListEl.classList.remove('hidden');
    expenseListEl.innerHTML = '';

    filtered.forEach((expense) => {
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.dataset.id = expense.id;

      li.innerHTML = `
        <div class="col-desc">
          <span class="desc-text">${escapeHtml(expense.description)}</span>
        </div>

        <div class="col-meta-wrapper">
          <div class="col-cat">
            <span class="category-badge">
              ${escapeHtml(expense.category)}
            </span>
          </div>
          <div class="col-date">
            <span>${formatDateDisplay(expense.date)}</span>
          </div>
        </div>

        <div class="col-amount">
          <span>${formatINR(expense.amount)}</span>
        </div>

        <div class="col-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${expense.id}" aria-label="Edit expense: ${escapeHtml(expense.description)}">
            Edit
          </button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete" data-id="${expense.id}" aria-label="Delete expense: ${escapeHtml(expense.description)}">
            Delete
          </button>
        </div>
      `;

      // Event Listeners for Edit & Delete buttons
      const editBtn = li.querySelector('[data-action="edit"]');
      const deleteBtn = li.querySelector('[data-action="delete"]');

      if (editBtn) {
        editBtn.addEventListener('click', () => openEditDialog(expense.id, editBtn));
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => openDeleteConfirmation(expense.id, deleteBtn));
      }

      expenseListEl.appendChild(li);
    });
  }

  function refreshAll() {
    updateSummaryMetrics();
    renderList();
  }

  // --- Reset Filters ---

  function resetAllFilters() {
    searchInput.value = '';
    filterCategorySelect.value = 'ALL';
    filterDateSelect.value = 'ALL';
    customDateStartInput.value = '';
    customDateEndInput.value = '';
    customDateErrorEl.textContent = '';
    customDateContainer.classList.add('hidden');
    clearSearchBtn.classList.add('hidden');
    renderList();
  }

  // --- Add / Edit Dialog Management ---

  function clearFormErrors() {
    amountInput.classList.remove('is-invalid');
    descInput.classList.remove('is-invalid');
    categorySelect.classList.remove('is-invalid');
    dateInput.classList.remove('is-invalid');

    amountErrorEl.textContent = '';
    descErrorEl.textContent = '';
    categoryErrorEl.textContent = '';
    dateErrorEl.textContent = '';
  }

  function recordInitialFormState() {
    initialFormValues = {
      amount: amountInput.value.trim(),
      description: descInput.value.trim(),
      category: categorySelect.value,
      date: dateInput.value
    };
  }

  function isFormDirty() {
    if (!initialFormValues) return false;
    return (
      amountInput.value.trim() !== initialFormValues.amount ||
      descInput.value.trim() !== initialFormValues.description ||
      categorySelect.value !== initialFormValues.category ||
      dateInput.value !== initialFormValues.date
    );
  }

  function openAddDialog(triggerEl = null) {
    lastFocusedTrigger = triggerEl || openAddDialogBtn;
    editingExpenseId = null;

    clearFormErrors();
    expenseForm.reset();

    // Set Default Values
    dateInput.value = getTodayDateString();
    categorySelect.value = '';

    // Update Dialog UI
    dialogTitleEl.textContent = 'Add expense';
    submitBtnText.textContent = 'Save expense';
    dialogSubmitBtn.disabled = false;

    recordInitialFormState();

    if (typeof expenseDialog.showModal === 'function') {
      expenseDialog.showModal();
    } else {
      expenseDialog.setAttribute('open', '');
    }

    setTimeout(() => {
      amountInput.focus();
    }, 40);
  }

  function openEditDialog(id, triggerEl = null) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;

    lastFocusedTrigger = triggerEl;
    editingExpenseId = id;

    clearFormErrors();

    // Populate Fields
    amountInput.value = Number(expense.amount).toFixed(2);
    descInput.value = expense.description;
    categorySelect.value = expense.category;
    dateInput.value = expense.date;

    // Update Dialog UI
    dialogTitleEl.textContent = 'Edit expense';
    submitBtnText.textContent = 'Save changes';
    dialogSubmitBtn.disabled = false;

    recordInitialFormState();

    if (typeof expenseDialog.showModal === 'function') {
      expenseDialog.showModal();
    } else {
      expenseDialog.setAttribute('open', '');
    }

    setTimeout(() => {
      amountInput.focus();
    }, 40);
  }

  function closeExpenseDialog(force = false) {
    if (!force && isFormDirty()) {
      openDiscardDialog();
      return;
    }

    if (typeof expenseDialog.close === 'function') {
      expenseDialog.close();
    } else {
      expenseDialog.removeAttribute('open');
    }

    clearFormErrors();
    editingExpenseId = null;
    initialFormValues = null;

    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
    }
  }

  // --- Unsaved Changes Guard Dialog ---

  function openDiscardDialog() {
    if (typeof discardDialog.showModal === 'function') {
      discardDialog.showModal();
    } else {
      discardDialog.setAttribute('open', '');
    }
    setTimeout(() => {
      discardStayBtn.focus();
    }, 40);
  }

  function closeDiscardDialog() {
    if (typeof discardDialog.close === 'function') {
      discardDialog.close();
    } else {
      discardDialog.removeAttribute('open');
    }
  }

  // --- Form Validation & Submission ---

  function validateExpenseForm() {
    clearFormErrors();
    let isValid = true;
    let firstInvalidField = null;

    // 1. Amount Validation
    const amountValRaw = amountInput.value.trim();
    if (!amountValRaw) {
      amountInput.classList.add('is-invalid');
      amountErrorEl.textContent = 'Please enter an amount greater than ₹0.';
      isValid = false;
      firstInvalidField = firstInvalidField || amountInput;
    } else {
      const amountNum = Number(amountValRaw);
      if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
        amountInput.classList.add('is-invalid');
        amountErrorEl.textContent = 'Amount must be a valid number greater than ₹0.';
        isValid = false;
        firstInvalidField = firstInvalidField || amountInput;
      } else {
        const parts = amountValRaw.split('.');
        if (parts.length > 1 && parts[1].length > 2) {
          amountInput.classList.add('is-invalid');
          amountErrorEl.textContent = 'Amount can have at most 2 decimal places.';
          isValid = false;
          firstInvalidField = firstInvalidField || amountInput;
        }
      }
    }

    // 2. Description Validation
    const descVal = descInput.value.trim();
    if (!descVal) {
      descInput.classList.add('is-invalid');
      descErrorEl.textContent = 'Please enter a description.';
      isValid = false;
      firstInvalidField = firstInvalidField || descInput;
    } else if (descVal.length > 120) {
      descInput.classList.add('is-invalid');
      descErrorEl.textContent = 'Description cannot exceed 120 characters.';
      isValid = false;
      firstInvalidField = firstInvalidField || descInput;
    }

    // 3. Category Validation
    const categoryVal = categorySelect.value;
    if (!categoryVal || !VALID_CATEGORIES.includes(categoryVal)) {
      categorySelect.classList.add('is-invalid');
      categoryErrorEl.textContent = 'Please select a valid category.';
      isValid = false;
      firstInvalidField = firstInvalidField || categorySelect;
    }

    // 4. Date Validation (Local calendar date)
    const dateVal = dateInput.value;
    if (!dateVal) {
      dateInput.classList.add('is-invalid');
      dateErrorEl.textContent = 'Please select a valid date.';
      isValid = false;
      firstInvalidField = firstInvalidField || dateInput;
    } else {
      const parts = dateVal.split('-');
      if (parts.length !== 3 || isNaN(Date.parse(dateVal))) {
        dateInput.classList.add('is-invalid');
        dateErrorEl.textContent = 'Please enter a valid calendar date.';
        isValid = false;
        firstInvalidField = firstInvalidField || dateInput;
      }
    }

    if (!isValid && firstInvalidField) {
      firstInvalidField.focus();
    }

    return isValid;
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateExpenseForm()) {
      return;
    }

    // Prevent accidental double submission
    dialogSubmitBtn.disabled = true;

    const description = descInput.value.trim();
    const amount = parseFloat(Number(amountInput.value).toFixed(2));
    const category = categorySelect.value;
    const date = dateInput.value;

    let savedExpense = null;
    let isEditMode = Boolean(editingExpenseId);

    if (isEditMode) {
      const targetIndex = expenses.findIndex((item) => item.id === editingExpenseId);
      if (targetIndex !== -1) {
        expenses[targetIndex] = {
          ...expenses[targetIndex],
          description,
          amount,
          category,
          date
        };
        savedExpense = expenses[targetIndex];
      }
    } else {
      savedExpense = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        description,
        amount,
        category,
        date,
        createdAt: Date.now()
      };
      expenses.push(savedExpense);
    }

    // Persist to localStorage
    const saveSucceeded = saveExpenses();

    if (!saveSucceeded) {
      // Re-enable button and preserve inputs
      dialogSubmitBtn.disabled = false;
      return;
    }

    // Force close dialog without dirty confirmation
    closeExpenseDialog(true);
    refreshAll();

    // Check if the saved expense is visible with current filters active
    const isVisibleUnderFilters = doesExpenseMatchActiveFilters(savedExpense);

    if (!isVisibleUnderFilters) {
      showToast(
        'Expense saved, but it is currently hidden by active filters.',
        'Clear filters',
        () => resetAllFilters()
      );
    } else {
      showToast(isEditMode ? 'Changes saved.' : 'Expense added successfully.', null, null, 'success');

      // Highlight the saved row in the list
      setTimeout(() => {
        const itemEl = document.querySelector(`.expense-item[data-id="${savedExpense.id}"]`);
        if (itemEl) {
          itemEl.classList.add('item-highlight');
          itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }

  // --- Delete Confirmation Flow ---

  function openDeleteConfirmation(id, triggerEl = null) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;

    pendingDeleteId = id;
    lastFocusedTrigger = triggerEl;

    deletePreviewContent.innerHTML = `
      <div class="delete-preview-details">
        <span class="delete-preview-title">${escapeHtml(expense.description)}</span>
        <span class="delete-preview-sub">${escapeHtml(expense.category)} &bull; ${formatDateDisplay(expense.date)}</span>
      </div>
      <span class="delete-preview-amount">${formatINR(expense.amount)}</span>
    `;

    if (typeof deleteDialog.showModal === 'function') {
      deleteDialog.showModal();
    } else {
      deleteDialog.setAttribute('open', '');
    }

    // Safer initial focus on Cancel button
    setTimeout(() => {
      deleteCancelBtn.focus();
    }, 40);
  }

  function closeDeleteConfirmation() {
    pendingDeleteId = null;
    if (typeof deleteDialog.close === 'function') {
      deleteDialog.close();
    } else {
      deleteDialog.removeAttribute('open');
    }

    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
    }
  }

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const idToDelete = pendingDeleteId;
    expenses = expenses.filter((item) => item.id !== idToDelete);

    saveExpenses();
    closeDeleteConfirmation();
    refreshAll();

    showToast('Expense deleted.', null, null, 'success');
  }

  // --- Real-time Input Validation Clearing ---

  amountInput.addEventListener('input', () => {
    if (amountInput.classList.contains('is-invalid')) {
      amountInput.classList.remove('is-invalid');
      amountErrorEl.textContent = '';
    }
  });

  descInput.addEventListener('input', () => {
    if (descInput.classList.contains('is-invalid')) {
      descInput.classList.remove('is-invalid');
      descErrorEl.textContent = '';
    }
  });

  categorySelect.addEventListener('change', () => {
    if (categorySelect.classList.contains('is-invalid')) {
      categorySelect.classList.remove('is-invalid');
      categoryErrorEl.textContent = '';
    }
  });

  dateInput.addEventListener('input', () => {
    if (dateInput.classList.contains('is-invalid')) {
      dateInput.classList.remove('is-invalid');
      dateErrorEl.textContent = '';
    }
  });

  // --- Event Listeners ---

  // Dialog triggers
  openAddDialogBtn.addEventListener('click', () => openAddDialog(openAddDialogBtn));
  emptyStateAddBtn.addEventListener('click', () => openAddDialog(emptyStateAddBtn));

  dialogCloseBtn.addEventListener('click', () => closeExpenseDialog());
  dialogCancelBtn.addEventListener('click', () => closeExpenseDialog());
  expenseForm.addEventListener('submit', handleFormSubmit);

  // Discard Confirmation Dialog buttons
  discardStayBtn.addEventListener('click', () => {
    closeDiscardDialog();
    amountInput.focus();
  });

  discardConfirmBtn.addEventListener('click', () => {
    closeDiscardDialog();
    closeExpenseDialog(true);
  });

  // Delete Dialog buttons
  deleteCancelBtn.addEventListener('click', closeDeleteConfirmation);
  deleteConfirmBtn.addEventListener('click', handleConfirmDelete);

  // Search & Filter Listeners
  searchInput.addEventListener('input', () => {
    renderList();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    renderList();
  });

  filterCategorySelect.addEventListener('change', () => {
    renderList();
  });

  filterDateSelect.addEventListener('change', () => {
    if (filterDateSelect.value === 'CUSTOM') {
      customDateContainer.classList.remove('hidden');
      if (!customDateStartInput.value) customDateStartInput.value = getTodayDateString();
      if (!customDateEndInput.value) customDateEndInput.value = getTodayDateString();
    } else {
      customDateContainer.classList.add('hidden');
      customDateErrorEl.textContent = '';
    }
    renderList();
  });

  // Custom Date range change & validation
  function handleCustomDateChange() {
    const startVal = customDateStartInput.value;
    const endVal = customDateEndInput.value;

    if (startVal && endVal && startVal > endVal) {
      customDateErrorEl.textContent = 'Start date cannot be after end date.';
    } else {
      customDateErrorEl.textContent = '';
      renderList();
    }
  }

  customDateStartInput.addEventListener('change', handleCustomDateChange);
  customDateEndInput.addEventListener('change', handleCustomDateChange);

  // Reset Filters CTAs
  resetAllFiltersBtn.addEventListener('click', resetAllFilters);
  noResultsClearBtn.addEventListener('click', resetAllFilters);

  // Backdrop click handling for native <dialog>
  [expenseDialog, deleteDialog, discardDialog].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      // If clicked on backdrop (target === dialog itself and coordinates outside dialog content box)
      if (e.target === dlg) {
        const rect = dlg.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );

        if (!isInDialog) {
          if (dlg === expenseDialog) {
            closeExpenseDialog();
          } else if (dlg === deleteDialog) {
            closeDeleteConfirmation();
          } else if (dlg === discardDialog) {
            closeDiscardDialog();
          }
        }
      }
    });

    // Native cancel event (triggered by Escape key)
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (dlg === expenseDialog) {
        closeExpenseDialog();
      } else if (dlg === deleteDialog) {
        closeDeleteConfirmation();
      } else if (dlg === discardDialog) {
        closeDiscardDialog();
      }
    });
  });

  // --- Initialization ---

  function init() {
    loadExpenses();
    updateSummaryMetrics();
    renderList();
  }

  init();
})();
