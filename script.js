/**
 * PocketLog - Daily Expense Tracker
 * Vanilla JavaScript implementation
 */

(() => {
  'use strict';

  // --- Constants & Storage Key ---
  const STORAGE_KEY = 'pocketlog_expenses';
  const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

  // --- State ---
  let expenses = [];
  let editingExpenseId = null;
  let pendingDeleteId = null;

  // --- DOM Elements ---
  const totalAmountEl = document.getElementById('total-amount');
  const totalCountEl = document.getElementById('total-count');
  const filteredCountEl = document.getElementById('filtered-count');

  const formEl = document.getElementById('expense-form');
  const formHeadingEl = document.getElementById('form-heading');
  const formBadgeEl = document.getElementById('form-badge');
  const submitBtn = document.getElementById('submit-btn');
  const submitBtnText = submitBtn.querySelector('span');
  const cancelBtn = document.getElementById('cancel-btn');

  const descInput = document.getElementById('expense-description');
  const amountInput = document.getElementById('expense-amount');
  const categorySelect = document.getElementById('expense-category');
  const dateInput = document.getElementById('expense-date');

  const descError = document.getElementById('desc-error');
  const amountError = document.getElementById('amount-error');
  const categoryError = document.getElementById('category-error');
  const dateError = document.getElementById('date-error');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterCategorySelect = document.getElementById('filter-category');

  const expenseListEl = document.getElementById('expense-list');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsStateEl = document.getElementById('no-results-state');
  const emptyAddBtn = document.getElementById('empty-add-btn');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');

  // Modal elements
  const confirmModal = document.getElementById('confirm-modal');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const deletePreviewEl = document.getElementById('delete-preview');

  // --- Utilities ---

  /**
   * Return today's local date in 'YYYY-MM-DD' format.
   */
  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format a numeric amount to Indian Rupee currency format (e.g. ₹1,250.00).
   */
  function formatINR(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format YYYY-MM-DD date string to readable format (e.g. "06 Nov 2026").
   */
  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    if (isNaN(dateObj.getTime())) return dateStr;

    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Generate CSS category class for badge styling.
   */
  function getCategoryClass(category) {
    const cat = (category || '').toLowerCase();
    switch (cat) {
      case 'food': return 'cat-food';
      case 'transport': return 'cat-transport';
      case 'shopping': return 'cat-shopping';
      case 'bills': return 'cat-bills';
      case 'health': return 'cat-health';
      default: return 'cat-other';
    }
  }

  // --- LocalStorage Management ---

  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        expenses = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        expenses = parsed;
      } else {
        expenses = [];
      }
    } catch (err) {
      console.error('Failed to parse expenses from localStorage:', err);
      expenses = [];
    }
  }

  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch (err) {
      console.error('Failed to save expenses to localStorage:', err);
    }
  }

  // --- Summary & Overview ---

  /**
   * Update the top overview statistics.
   * Calculated from ALL saved expenses regardless of current filter.
   */
  function updateOverviewStats() {
    const totalCount = expenses.length;
    const totalAmount = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    totalCountEl.textContent = totalCount.toLocaleString('en-IN');
    totalAmountEl.textContent = formatINR(totalAmount);
  }

  // --- Validation ---

  function clearValidationErrors() {
    descInput.classList.remove('is-invalid');
    amountInput.classList.remove('is-invalid');
    categorySelect.classList.remove('is-invalid');
    dateInput.classList.remove('is-invalid');

    descError.textContent = '';
    amountError.textContent = '';
    categoryError.textContent = '';
    dateError.textContent = '';
  }

  function validateForm() {
    clearValidationErrors();
    let isValid = true;

    // Validate Description
    const descValue = descInput.value.trim();
    if (!descValue) {
      descInput.classList.add('is-invalid');
      descError.textContent = 'Please enter an expense description.';
      isValid = false;
    } else if (descValue.length > 100) {
      descInput.classList.add('is-invalid');
      descError.textContent = 'Description cannot exceed 100 characters.';
      isValid = false;
    }

    // Validate Amount
    const amountValRaw = amountInput.value.trim();
    if (!amountValRaw) {
      amountInput.classList.add('is-invalid');
      amountError.textContent = 'Please enter an amount.';
      isValid = false;
    } else {
      const amountNumber = Number(amountValRaw);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        amountInput.classList.add('is-invalid');
        amountError.textContent = 'Amount must be a number greater than ₹0.';
        isValid = false;
      } else {
        // Check decimal places (maximum 2 decimals allowed)
        const parts = amountValRaw.split('.');
        if (parts.length > 1 && parts[1].length > 2) {
          amountInput.classList.add('is-invalid');
          amountError.textContent = 'Amount can have at most 2 decimal places.';
          isValid = false;
        }
      }
    }

    // Validate Category
    const categoryValue = categorySelect.value;
    if (!categoryValue || !VALID_CATEGORIES.includes(categoryValue)) {
      categorySelect.classList.add('is-invalid');
      categoryError.textContent = 'Please select a valid category.';
      isValid = false;
    }

    // Validate Date
    const dateValue = dateInput.value;
    if (!dateValue) {
      dateInput.classList.add('is-invalid');
      dateError.textContent = 'Please pick a valid date.';
      isValid = false;
    } else {
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        dateInput.classList.add('is-invalid');
        dateError.textContent = 'Invalid date selected.';
        isValid = false;
      }
    }

    return isValid;
  }

  // --- Filtering & Sorting ---

  /**
   * Filter and sort expenses.
   * Newest dates first. If same date, newest added first (createdAt descending).
   */
  function getFilteredAndSortedExpenses() {
    const searchQuery = searchInput.value.trim().toLowerCase();
    const selectedCategory = filterCategorySelect.value;

    return expenses
      .filter((item) => {
        // Description match
        const matchesSearch = !searchQuery || item.description.toLowerCase().includes(searchQuery);

        // Category match
        const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        // Sort newest dates first (YYYY-MM-DD string comparison)
        const dateComparison = b.date.localeCompare(a.date);
        if (dateComparison !== 0) {
          return dateComparison;
        }
        // Secondary sort: createdAt descending (newest entry first)
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  // --- Rendering ---

  function renderList() {
    const filtered = getFilteredAndSortedExpenses();
    const hasTotalExpenses = expenses.length > 0;
    const hasFilteredResults = filtered.length > 0;

    // Toggle clear search button visibility
    if (searchInput.value.trim().length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    // Update filtered count badge
    filteredCountEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`;

    // Handle view states
    if (!hasTotalExpenses) {
      // 1. App is completely empty (no saved expenses)
      expenseListEl.innerHTML = '';
      expenseListEl.classList.add('hidden');
      noResultsStateEl.classList.add('hidden');
      emptyStateEl.classList.remove('hidden');
      return;
    }

    if (!hasFilteredResults) {
      // 2. Saved expenses exist, but filter/search yielded 0 matches
      expenseListEl.innerHTML = '';
      expenseListEl.classList.add('hidden');
      emptyStateEl.classList.add('hidden');
      noResultsStateEl.classList.remove('hidden');
      return;
    }

    // 3. Normal state: render matching expense items
    emptyStateEl.classList.add('hidden');
    noResultsStateEl.classList.add('hidden');
    expenseListEl.classList.remove('hidden');

    expenseListEl.innerHTML = '';

    filtered.forEach((expense) => {
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.dataset.id = expense.id;

      // Safe text construction using DOM methods to prevent any XSS
      const mainInfo = document.createElement('div');
      mainInfo.className = 'expense-main-info';

      const descRow = document.createElement('div');
      descRow.className = 'expense-desc-row';

      const descSpan = document.createElement('span');
      descSpan.className = 'expense-desc';
      descSpan.textContent = expense.description;

      const categoryPill = document.createElement('span');
      categoryPill.className = `category-pill ${getCategoryClass(expense.category)}`;
      categoryPill.textContent = expense.category;

      descRow.appendChild(descSpan);
      descRow.appendChild(categoryPill);

      const dateRow = document.createElement('div');
      dateRow.className = 'expense-date';
      dateRow.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>${formatDateDisplay(expense.date)}</span>
      `;

      mainInfo.appendChild(descRow);
      mainInfo.appendChild(dateRow);

      const rightInfo = document.createElement('div');
      rightInfo.className = 'expense-right-info';

      const amountSpan = document.createElement('span');
      amountSpan.className = 'expense-amount';
      amountSpan.textContent = formatINR(expense.amount);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'expense-actions';

      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-sm edit-btn';
      editBtn.setAttribute('aria-label', `Edit expense: ${expense.description}`);
      editBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        <span>Edit</span>
      `;
      editBtn.addEventListener('click', () => startEditing(expense.id));

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-outline-danger btn-sm delete-btn';
      deleteBtn.setAttribute('aria-label', `Delete expense: ${expense.description}`);
      deleteBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Delete</span>
      `;
      deleteBtn.addEventListener('click', () => promptDelete(expense.id));

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);

      rightInfo.appendChild(amountSpan);
      rightInfo.appendChild(actionsDiv);

      li.appendChild(mainInfo);
      li.appendChild(rightInfo);

      expenseListEl.appendChild(li);
    });
  }

  function refreshAll() {
    updateOverviewStats();
    renderList();
  }

  // --- Form Reset & Mode Switch ---

  function resetForm() {
    editingExpenseId = null;
    formEl.reset();
    clearValidationErrors();

    // Default date to today
    dateInput.value = getTodayDateString();

    // Reset heading & buttons
    formHeadingEl.textContent = 'Add Expense';
    formBadgeEl.classList.add('hidden');
    submitBtnText.textContent = 'Add Expense';
    cancelBtn.classList.add('hidden');
  }

  function startEditing(id) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;

    editingExpenseId = id;
    clearValidationErrors();

    // Populate form fields
    descInput.value = expense.description;
    amountInput.value = Number(expense.amount).toFixed(2);
    categorySelect.value = expense.category;
    dateInput.value = expense.date;

    // Update UI headers & buttons
    formHeadingEl.textContent = 'Edit Expense';
    formBadgeEl.classList.remove('hidden');
    submitBtnText.textContent = 'Save Changes';
    cancelBtn.classList.remove('hidden');

    // Scroll form into view and focus description field
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    descInput.focus();
  }

  // --- Submit / Save Expense ---

  function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const description = descInput.value.trim();
    const amount = parseFloat(Number(amountInput.value).toFixed(2));
    const category = categorySelect.value;
    const date = dateInput.value;

    if (editingExpenseId) {
      // Update existing expense
      const index = expenses.findIndex((item) => item.id === editingExpenseId);
      if (index !== -1) {
        expenses[index] = {
          ...expenses[index],
          description,
          amount,
          category,
          date
        };
      }
      const editedId = editingExpenseId;
      resetForm();
      saveExpenses();
      refreshAll();

      // Subtle highlight of the edited item in list
      setTimeout(() => {
        const itemEl = document.querySelector(`.expense-item[data-id="${editedId}"]`);
        if (itemEl) {
          itemEl.classList.add('highlight-edit');
          itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    } else {
      // Create new expense
      const newExpense = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        description,
        amount,
        category,
        date,
        createdAt: Date.now()
      };

      expenses.push(newExpense);
      resetForm();
      saveExpenses();
      refreshAll();
    }
  }

  // --- Delete Modal & Flow ---

  function promptDelete(id) {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;

    pendingDeleteId = id;

    // Populate preview info in modal
    deletePreviewEl.innerHTML = `
      <span style="color: var(--text-main);">${escapeHtml(expense.description)} (${expense.category})</span>
      <span style="color: var(--danger);">${formatINR(expense.amount)}</span>
    `;

    confirmModal.classList.remove('hidden');
    modalCancelBtn.focus();
  }

  function closeModal() {
    pendingDeleteId = null;
    confirmModal.classList.add('hidden');
  }

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const idToDelete = pendingDeleteId;
    expenses = expenses.filter((item) => item.id !== idToDelete);

    // If currently editing this item, cancel editing
    if (editingExpenseId === idToDelete) {
      resetForm();
    }

    saveExpenses();
    closeModal();
    refreshAll();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Realtime Input Listeners (Clear validation errors on typing) ---

  descInput.addEventListener('input', () => {
    if (descInput.classList.contains('is-invalid')) {
      descInput.classList.remove('is-invalid');
      descError.textContent = '';
    }
  });

  amountInput.addEventListener('input', () => {
    if (amountInput.classList.contains('is-invalid')) {
      amountInput.classList.remove('is-invalid');
      amountError.textContent = '';
    }
  });

  categorySelect.addEventListener('change', () => {
    if (categorySelect.classList.contains('is-invalid')) {
      categorySelect.classList.remove('is-invalid');
      categoryError.textContent = '';
    }
  });

  dateInput.addEventListener('input', () => {
    if (dateInput.classList.contains('is-invalid')) {
      dateInput.classList.remove('is-invalid');
      dateError.textContent = '';
    }
  });

  // --- Event Listeners ---

  formEl.addEventListener('submit', handleFormSubmit);

  cancelBtn.addEventListener('click', () => {
    resetForm();
  });

  // Search & Filter Events
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

  // Empty state button: Focuses description in form
  emptyAddBtn.addEventListener('click', () => {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    descInput.focus();
  });

  // Reset filters button
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterCategorySelect.value = 'ALL';
    renderList();
  });

  // Delete modal actions
  modalCancelBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', handleConfirmDelete);

  // Close modal when clicking on overlay backdrop
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeModal();
    }
  });

  // Keyboard navigation for modal (Escape closes modal)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // --- Initialization ---

  function init() {
    loadExpenses();

    // Default form date to today
    dateInput.value = getTodayDateString();

    refreshAll();
  }

  init();
})();

