(() => {
  'use strict';

  // Data now lives in the local Supabase database (see supabase/migrations).
  // Only per-browser conveniences stay in localStorage: appearance and the shopping cart.
  const STORAGE = {
    appearance: 'cjude_b2c_appearance_v2'
  };
  const db = window.CJude && window.CJude.db;

  const defaultStoreSettings = {
    storeName: "C'JUDE CO.",
    tagline: 'Wear more. Waste less.',
    announcement: 'PRE-LOVED • CURATED • READY FOR A SECOND LIFE',
    gcashName: "C'JUDE CO.",
    gcashNumber: '09XX XXX XXXX',
    shippingFee: 80,
    contactNumber: ''
  };

  const defaultAppearance = {
    theme: 'dark',
    primary: '#a754b5',
    secondary: '#f5f1f7'
  };

  const ORDER_STATUSES = ['New', 'Preparing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

  const $ = (id) => document.getElementById(id);
  const els = {
    authScreen: $('authScreen'), appShell: $('appShell'), loginTab: $('loginTab'), signupTab: $('signupTab'),
    loginForm: $('loginForm'), signupForm: $('signupForm'), loginEmail: $('loginEmail'), loginPassword: $('loginPassword'), loginError: $('loginError'),
    signupName: $('signupName'), signupEmail: $('signupEmail'), signupPassword: $('signupPassword'), signupConfirm: $('signupConfirm'), signupTerms: $('signupTerms'), signupError: $('signupError'),
    accountButton: $('accountButton'), accountMenu: $('accountMenu'), logoutButton: $('logoutButton'), accountInitial: $('accountInitial'), accountName: $('accountName'), accountRole: $('accountRole'), menuAccountName: $('menuAccountName'), menuAccountEmail: $('menuAccountEmail'),
    headerStoreName: $('headerStoreName'), headerTagline: $('headerTagline'), announcementBar: $('announcementBar'),
    searchInput: $('searchInput'), categoryFilter: $('categoryFilter'), sortSelect: $('sortSelect'), productGrid: $('productGrid'), productEmpty: $('productEmpty'), shopProductCount: $('shopProductCount'), shopCategoryCount: $('shopCategoryCount'),
    cartButton: $('cartButton'), cartCount: $('cartCount'), cartDrawer: $('cartDrawer'), cartItems: $('cartItems'), cartSubtotal: $('cartSubtotal'), cartShipping: $('cartShipping'), cartTotal: $('cartTotal'), checkoutButton: $('checkoutButton'),
    productModal: $('productModal'), productModalContent: $('productModalContent'),
    checkoutModal: $('checkoutModal'), checkoutForm: $('checkoutForm'), checkoutFullName: $('checkoutFullName'), checkoutEmail: $('checkoutEmail'), checkoutCountry: $('checkoutCountry'), checkoutProvince: $('checkoutProvince'), checkoutCity: $('checkoutCity'), checkoutBarangay: $('checkoutBarangay'), checkoutRegion: $('checkoutRegion'), gcashBox: $('gcashBox'), gcashReference: $('gcashReference'), checkoutGcashName: $('checkoutGcashName'), checkoutGcashNumber: $('checkoutGcashNumber'), checkoutItems: $('checkoutItems'), checkoutSubtotal: $('checkoutSubtotal'), checkoutShipping: $('checkoutShipping'), checkoutTotal: $('checkoutTotal'), checkoutError: $('checkoutError'),
    successModal: $('successModal'), successOrderId: $('successOrderId'), successSummary: $('successSummary'), copyOrderButton: $('copyOrderButton'),
    customerOrdersList: $('customerOrdersList'),
    productForm: $('productForm'), productFormTitle: $('productFormTitle'), productFormError: $('productFormError'), editingProductId: $('editingProductId'), productImage: $('productImage'), imagePreview: $('imagePreview'), removeProductImage: $('removeProductImage'), productName: $('productName'), productCategory: $('productCategory'), productSize: $('productSize'), productCondition: $('productCondition'), productStock: $('productStock'), productPrice: $('productPrice'), productDescription: $('productDescription'), saveProductButton: $('saveProductButton'), cancelEditButton: $('cancelEditButton'), newProductButton: $('newProductButton'), inventoryCount: $('inventoryCount'), inventoryList: $('inventoryList'),
    ownerOrdersList: $('ownerOrdersList'), exportOrdersButton: $('exportOrdersButton'), metricOrders: $('metricOrders'), metricPending: $('metricPending'), metricDelivered: $('metricDelivered'), metricRevenue: $('metricRevenue'),
    feedbackList: $('feedbackList'), metricReviews: $('metricReviews'), metricAverageRating: $('metricAverageRating'), metricFiveStar: $('metricFiveStar'),
    appearanceForm: $('appearanceForm'), themeSelect: $('themeSelect'), primaryColor: $('primaryColor'), secondaryColor: $('secondaryColor'), resetAppearanceButton: $('resetAppearanceButton'),
    storeSettingsForm: $('storeSettingsForm'), settingStoreName: $('settingStoreName'), settingTagline: $('settingTagline'), settingAnnouncement: $('settingAnnouncement'), settingGcashName: $('settingGcashName'), settingGcashNumber: $('settingGcashNumber'), settingShippingFee: $('settingShippingFee'), settingContactNumber: $('settingContactNumber'),
    toastRegion: $('toastRegion'), loadingBar: $('loadingBar')
  };

  let products = [];
  let orders = [];
  let reviews = [];
  let storeSettings = { ...defaultStoreSettings };
  let appearance = { ...defaultAppearance, ...loadJSON(STORAGE.appearance, {}) };
  let session = null;
  let currentRoute = 'shop';
  let pendingProductImage = '';
  let pendingImageFile = null;
  let removeImageRequested = false;
  let activeProductId = null;
  let selectedReviewStars = 0;
  let lastOrderText = '';
  let dataReady = false;
  let busyCount = 0;

  // ---------- Generic utilities ----------
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`Could not read ${key}.`, error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function saveSession(nextSession) {
    session = nextSession;
  }

  // Only used for the address lookup endpoints (/api/locations/*) served by server.py / server.js.
  async function apiFetch(path, options = {}) {
    if (window.location.protocol === 'file:') {
      throw new Error('Start the local server and open http://localhost:3000. Do not open index.html directly.');
    }
    try {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The local service is unavailable.');
      return payload;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Cannot reach the local server. Run python server.py, then open http://localhost:3000.');
      }
      throw error;
    }
  }

  // ---------- Loading + error helpers ----------
  function setBusy(on) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    if (els.loadingBar) els.loadingBar.classList.toggle('active', busyCount > 0);
    document.body.setAttribute('aria-busy', String(busyCount > 0));
  }

  async function withLoading(task, scope) {
    const buttons = scope ? [...scope.querySelectorAll('button[type="submit"]')] : [];
    buttons.forEach((button) => { button.disabled = true; button.classList.add('is-loading'); });
    setBusy(true);
    try { return await task(); }
    finally {
      setBusy(false);
      buttons.forEach((button) => { button.disabled = false; button.classList.remove('is-loading'); });
    }
  }

  function handleRemoteError(error) {
    if (error && error.sessionExpired) return forceLogout(error.message);
    toast((error && error.message) || 'Something went wrong.', 'error');
  }

  function makeId(prefix = 'id') {
    const id = (crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${id}`;
  }

  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function money(value) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0); }
  function dateText(value) { return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function isOwner() { return session?.role === 'owner'; }
  function isConsumer() { return session?.role === 'consumer'; }
  function validHex(value) { return /^#[0-9a-fA-F]{6}$/.test(String(value)); }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return `${parseInt(clean.slice(0,2),16)}, ${parseInt(clean.slice(2,4),16)}, ${parseInt(clean.slice(4,6),16)}`;
  }

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast${type === 'error' ? ' error' : ''}`;
    node.textContent = message;
    els.toastRegion.appendChild(node);
    window.setTimeout(() => node.remove(), 3000);
  }

  function setFormError(element, message = '') { element.textContent = message; }

  function validateForm(form, errorElement) {
    if (form.checkValidity()) return true;
    const firstInvalid = form.querySelector(':invalid');
    firstInvalid?.focus();
    setFormError(errorElement, firstInvalid?.validationMessage || 'Please complete all required fields correctly.');
    return false;
  }

  function userCartKey() { return session?.id ? `cjude_b2c_cart_v2_${session.id}` : ''; }
  function getCart() { return isConsumer() ? loadJSON(userCartKey(), []) : []; }
  function saveCart(cart) { if (isConsumer()) saveJSON(userCartKey(), cart); }

  // ---------- Appearance and store settings ----------
  function applyAppearance() {
    const theme = appearance.theme === 'light' ? 'light' : 'dark';
    const primary = validHex(appearance.primary) ? appearance.primary : defaultAppearance.primary;
    const secondary = validHex(appearance.secondary) ? appearance.secondary : defaultAppearance.secondary;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-rgb', hexToRgb(primary));
    document.documentElement.style.setProperty('--secondary', secondary);
    document.documentElement.style.setProperty('--secondary-rgb', hexToRgb(secondary));
  }

  function renderStoreIdentity() {
    els.headerStoreName.textContent = storeSettings.storeName;
    els.headerTagline.textContent = storeSettings.tagline;
    els.announcementBar.textContent = storeSettings.announcement;
    els.checkoutGcashName.textContent = storeSettings.gcashName;
    els.checkoutGcashNumber.textContent = storeSettings.gcashNumber;
    document.title = `${storeSettings.storeName} | B2C Thrift Store`;
  }

  function loadSettingsForms() {
    els.themeSelect.value = appearance.theme;
    els.primaryColor.value = validHex(appearance.primary) ? appearance.primary : defaultAppearance.primary;
    els.secondaryColor.value = validHex(appearance.secondary) ? appearance.secondary : defaultAppearance.secondary;
    els.settingStoreName.value = storeSettings.storeName;
    els.settingTagline.value = storeSettings.tagline;
    els.settingAnnouncement.value = storeSettings.announcement;
    els.settingGcashName.value = storeSettings.gcashName;
    els.settingGcashNumber.value = storeSettings.gcashNumber;
    els.settingShippingFee.value = storeSettings.shippingFee;
    els.settingContactNumber.value = storeSettings.contactNumber;
  }

  // ---------- Authentication ----------
  function showAuth(mode = 'login') {
    els.authScreen.classList.remove('hidden');
    els.appShell.classList.add('hidden');
    els.appShell.setAttribute('aria-hidden', 'true');
    switchAuthMode(mode);
    closeAccountMenu();
  }

  async function showApp() {
    if (!session) return showAuth('login');
    els.authScreen.classList.add('hidden');
    els.appShell.classList.remove('hidden');
    els.appShell.setAttribute('aria-hidden', 'false');
    renderRoleUI();
    renderAccount();
    renderStoreIdentity();
    loadSettingsForms();
    routeTo('shop', true);
    await loadRemoteData();
  }

  async function loadRemoteData() {
    dataReady = false;
    try {
      await withLoading(async () => {
        const [nextProducts, nextReviews, nextSettings, nextOrders] = await Promise.all([
          db.products.list(), db.reviews.list(), db.settings.get(), db.orders.list()
        ]);
        products = nextProducts;
        reviews = nextReviews;
        orders = nextOrders;
        storeSettings = { ...defaultStoreSettings, ...nextSettings };
      });
      dataReady = true;
      renderStoreIdentity();
      loadSettingsForms();
      refreshAllDataViews();
    } catch (error) {
      handleRemoteError(error);
    }
  }

  async function refreshRemote(kind) {
    if (!session || !dataReady) return;
    try {
      if (kind === 'orders') {
        orders = await db.orders.list();
        if (isConsumer()) renderCustomerOrders();
        if (isOwner()) renderOwnerOrders();
      } else if (kind === 'feedback') {
        reviews = await db.reviews.list();
        renderFeedback();
      }
    } catch (error) {
      handleRemoteError(error);
    }
  }

  function switchAuthMode(mode) {
    const login = mode === 'login';
    els.loginTab.classList.toggle('active', login);
    els.signupTab.classList.toggle('active', !login);
    els.loginTab.setAttribute('aria-selected', String(login));
    els.signupTab.setAttribute('aria-selected', String(!login));
    els.loginForm.classList.toggle('hidden', !login);
    els.signupForm.classList.toggle('hidden', login);
    setFormError(els.loginError);
    setFormError(els.signupError);
  }

  function renderRoleUI() {
    document.querySelectorAll('.owner-only').forEach((node) => node.classList.toggle('hidden', !isOwner()));
    document.querySelectorAll('.consumer-only').forEach((node) => node.classList.toggle('hidden', !isConsumer()));
  }

  function renderAccount() {
    const name = session?.name || 'User';
    els.accountInitial.textContent = name.trim().charAt(0).toUpperCase() || 'U';
    els.accountName.textContent = name;
    els.accountRole.textContent = isOwner() ? 'Owner' : 'Customer';
    els.menuAccountName.textContent = name;
    els.menuAccountEmail.textContent = session?.email || '';
  }

  async function handleLogin(event) {
    event.preventDefault();
    setFormError(els.loginError);
    if (!validateForm(els.loginForm, els.loginError)) return;

    const email = normalizeEmail(els.loginEmail.value);
    const password = els.loginPassword.value;

    try {
      const user = await withLoading(() => window.CJude.auth.signIn(email, password), els.loginForm);
      saveSession(user);
      els.loginForm.reset();
      await showApp();
      toast(`Welcome back, ${user.name}.`);
    } catch (error) {
      saveSession(null);
      setFormError(els.loginError, error.message);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setFormError(els.signupError);
    if (!validateForm(els.signupForm, els.signupError)) return;

    const name = els.signupName.value.trim();
    const email = normalizeEmail(els.signupEmail.value);
    const password = els.signupPassword.value;
    const confirmPassword = els.signupConfirm.value;

    if (password !== confirmPassword) {
      setFormError(els.signupError, 'Passwords do not match.');
      els.signupConfirm.focus();
      return;
    }
    if (password.length < 8) {
      setFormError(els.signupError, 'Use a password with at least 8 characters.');
      return;
    }

    try {
      await withLoading(() => window.CJude.auth.signUp({ name, email, password }), els.signupForm);
      els.signupForm.reset();
      switchAuthMode('login');
      els.loginEmail.value = email;
      toast('Account created. You can now log in.');
    } catch (error) {
      setFormError(els.signupError, error.message);
    }
  }

  function clearLocalState() {
    saveSession(null);
    products = [];
    reviews = [];
    orders = [];
    storeSettings = { ...defaultStoreSettings };
    dataReady = false;
    renderStoreIdentity();
  }

  async function logout() {
    closeAllOverlays();
    clearLocalState();
    showAuth('login');
    toast('You have been logged out.');
    try { await window.CJude.auth.signOut(); } catch (error) { console.warn('Sign-out request failed.', error); }
  }

  function forceLogout(message = 'Your session ended. Please log in again.') {
    if (!session) return;
    closeAllOverlays();
    clearLocalState();
    showAuth('login');
    toast(message, 'error');
  }

  // ---------- Routing / transition navigation ----------
  function allowedRoute(route) {
    const common = ['shop', 'settings'];
    const ownerRoutes = ['inventory', 'orders', 'feedback'];
    const consumerRoutes = ['my-orders'];
    return common.includes(route) || (isOwner() && ownerRoutes.includes(route)) || (isConsumer() && consumerRoutes.includes(route));
  }

  function routeTo(route, immediate = false) {
    if (!session || !allowedRoute(route)) route = 'shop';
    const next = document.querySelector(`[data-view="${route}"]`);
    const current = document.querySelector('.app-view.active');
    if (!next || next === current) {
      updateNav(route);
      currentRoute = route;
      refreshRoute(route);
      return;
    }

    if (current && !immediate) {
      current.classList.add('exit-left');
      window.setTimeout(() => current.classList.remove('active', 'exit-left'), 270);
    } else if (current) current.classList.remove('active', 'exit-left');

    next.classList.remove('exit-left');
    if (immediate) next.classList.add('active');
    else requestAnimationFrame(() => next.classList.add('active'));

    currentRoute = route;
    updateNav(route);
    refreshRoute(route);
  }

  function updateNav(route) {
    document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.route === route));
  }

  function refreshRoute(route) {
    if (route === 'shop') renderProducts();
    if (route === 'my-orders') { renderCustomerOrders(); void refreshRemote('orders'); }
    if (route === 'inventory') renderInventory();
    if (route === 'orders') { renderOwnerOrders(); void refreshRemote('orders'); }
    if (route === 'feedback') { renderFeedback(); void refreshRemote('feedback'); }
    if (route === 'settings') loadSettingsForms();
  }

  // ---------- Product and rating helpers ----------
  function reviewStats(productId) {
    const rows = reviews.filter((review) => review.productId === productId);
    const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.stars), 0) / rows.length : 0;
    return { count: rows.length, average };
  }

  function starString(value) {
    const rounded = Math.round(Number(value) || 0);
    return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
  }

  function productImageMarkup(product, className = '') {
    if (product.image) return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="${className}" />`;
    return '<div class="product-placeholder" aria-label="No product image">C\'</div>';
  }

  function getFilteredProducts() {
    const query = els.searchInput.value.trim().toLowerCase();
    const category = els.categoryFilter.value;
    const sort = els.sortSelect.value;
    let list = products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.category} ${product.size} ${product.condition} ${product.description}`.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || product.category === category;
      return matchesQuery && matchesCategory;
    });

    list.sort((a,b) => {
      if (sort === 'price-low') return Number(a.price) - Number(b.price);
      if (sort === 'price-high') return Number(b.price) - Number(a.price);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'rating') return reviewStats(b.id).average - reviewStats(a.id).average;
      return Number(b.createdAt) - Number(a.createdAt);
    });
    return list;
  }

  function renderCategoryOptions() {
    const selected = els.categoryFilter.value || 'all';
    const categories = [...new Set(products.map((product) => product.category.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    els.categoryFilter.innerHTML = `<option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
    els.categoryFilter.value = categories.includes(selected) ? selected : 'all';
    els.shopCategoryCount.textContent = String(categories.length);
  }

  function renderProducts() {
    renderCategoryOptions();
    const list = getFilteredProducts();
    els.shopProductCount.textContent = String(products.filter((p) => Number(p.stock) > 0).length);
    els.productEmpty.classList.toggle('hidden', list.length > 0);
    els.productGrid.classList.toggle('hidden', list.length === 0);

    els.productGrid.innerHTML = list.map((product) => {
      const stats = reviewStats(product.id);
      const soldOut = Number(product.stock) <= 0;
      const cardAction = isOwner()
        ? `<div class="product-card-actions owner-actions"><button class="secondary-button" type="button" data-view-product="${product.id}">View</button><button class="primary-button" type="button" data-edit-product="${product.id}">Edit</button></div>`
        : `<div class="product-card-actions"><button class="primary-button" type="button" data-add-cart="${product.id}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold Out' : 'Add to Cart'}</button><button class="secondary-button" type="button" data-view-product="${product.id}">Details</button></div>`;
      return `<article class="product-card">
        <div class="product-image">${productImageMarkup(product)}<div class="product-badges"><span>${escapeHtml(product.category)}</span>${soldOut ? '<span class="sold">SOLD OUT</span>' : `<span>${Number(product.stock)} left</span>`}</div></div>
        <div class="product-info"><div class="product-title-row"><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong></div><div class="product-meta"><span>Size ${escapeHtml(product.size)}</span><span>${escapeHtml(product.condition)}</span></div><div class="rating-line"><span class="stars-static">${starString(stats.average)}</span><span>${stats.count ? `${stats.average.toFixed(1)} · ${stats.count} review${stats.count === 1 ? '' : 's'}` : 'No ratings yet'}</span></div>${cardAction}</div>
      </article>`;
    }).join('');
  }

  function openProductModal(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    activeProductId = productId;
    const stats = reviewStats(productId);
    const ownReview = isConsumer() ? reviews.find((review) => review.productId === productId && review.userId === session.id) : null;
    selectedReviewStars = ownReview?.stars || 0;

    const consumerReviewBox = isConsumer() ? `<div class="review-box"><h3>${ownReview ? 'Update your rating' : 'Rate this product'}</h3><p>Choose 1 to 5 stars and leave optional feedback.</p><div id="starInput" class="star-input" role="radiogroup" aria-label="Product rating">${[1,2,3,4,5].map((star) => `<button class="star-button ${star <= selectedReviewStars ? 'active' : ''}" type="button" data-star="${star}" aria-label="${star} star${star > 1 ? 's' : ''}">★</button>`).join('')}</div><label>Feedback<textarea id="reviewFeedback" rows="3" maxlength="500" placeholder="What did you think about this item?">${escapeHtml(ownReview?.feedback || '')}</textarea></label><p id="reviewError" class="form-error"></p><div class="review-actions"><button class="primary-button" type="button" data-save-review>${ownReview ? 'Update Review' : 'Submit Review'}</button>${ownReview ? '<button class="secondary-button" type="button" data-delete-review>Delete Review</button>' : ''}</div></div>` : '';

    const ownerNote = isOwner() ? '<div class="review-box"><h3>Owner view</h3><p>Customers can rate and review this product. Use Inventory to edit listing details.</p></div>' : '';

    els.productModalContent.innerHTML = `<div class="product-detail-grid"><div class="product-detail-media">${productImageMarkup(product)}</div><div class="product-detail-copy"><p class="eyebrow">${escapeHtml(product.category)}</p><h2 id="productModalTitle">${escapeHtml(product.name)}</h2><div class="product-detail-price">${money(product.price)}</div><div class="product-meta"><span>Size ${escapeHtml(product.size)}</span><span>${escapeHtml(product.condition)}</span><span>${Number(product.stock)} in stock</span></div><div class="rating-line"><span class="stars-static">${starString(stats.average)}</span><span>${stats.count ? `${stats.average.toFixed(1)} from ${stats.count} review${stats.count === 1 ? '' : 's'}` : 'No ratings yet'}</span></div><p class="product-description">${escapeHtml(product.description)}</p>${isConsumer() ? `<button class="primary-button" type="button" data-add-cart="${product.id}" ${Number(product.stock) <= 0 ? 'disabled' : ''}>${Number(product.stock) <= 0 ? 'Sold Out' : 'Add to Cart'}</button>` : `<button class="primary-button" type="button" data-edit-product="${product.id}">Edit Product</button>`}${consumerReviewBox}${ownerNote}</div></div>`;
    openModal(els.productModal);
  }

  async function saveReview() {
    if (!isConsumer() || !activeProductId) return;
    const errorNode = $('reviewError');
    setFormError(errorNode);
    if (selectedReviewStars < 1 || selectedReviewStars > 5) {
      setFormError(errorNode, 'Please choose a rating from 1 to 5 stars.');
      return;
    }
    const feedback = $('reviewFeedback')?.value.trim() || '';
    const existing = reviews.find((item) => item.productId === activeProductId && item.userId === session.id);
    try {
      const saved = await withLoading(() => existing
        ? db.reviews.update(existing.id, { stars: selectedReviewStars, feedback })
        : db.reviews.create({ productId: activeProductId, userId: session.id, stars: selectedReviewStars, feedback }));
      saved.userName = session.name;
      reviews = existing ? reviews.map((item) => item.id === saved.id ? saved : item) : [...reviews, saved];
      renderProducts();
      renderFeedback();
      toast('Your rating and feedback were saved.');
      openProductModal(activeProductId);
    } catch (error) {
      if (error.sessionExpired) return handleRemoteError(error);
      setFormError(errorNode, error.message);
    }
  }

  async function deleteOwnReview() {
    if (!isConsumer() || !activeProductId) return;
    const existing = reviews.find((item) => item.productId === activeProductId && item.userId === session.id);
    if (!existing) return;
    try {
      await withLoading(() => db.reviews.remove(existing.id));
      reviews = reviews.filter((item) => item.id !== existing.id);
      renderProducts();
      renderFeedback();
      toast('Your review was removed.');
      openProductModal(activeProductId);
    } catch (error) {
      handleRemoteError(error);
    }
  }

  // ---------- Cart / checkout ----------
  function sanitizeCart(cart) {
    return cart.map((entry) => {
      const product = products.find((item) => item.id === entry.productId);
      if (!product || Number(product.stock) <= 0) return null;
      return { productId: entry.productId, qty: Math.max(1, Math.min(Number(entry.qty) || 1, Number(product.stock))) };
    }).filter(Boolean);
  }

  function addToCart(productId) {
    if (!isConsumer()) return toast('Only customer accounts can add products to cart.', 'error');
    const product = products.find((item) => item.id === productId);
    if (!product || Number(product.stock) <= 0) return toast('This item is sold out.', 'error');
    const cart = sanitizeCart(getCart());
    const entry = cart.find((item) => item.productId === productId);
    if (entry) {
      if (entry.qty >= Number(product.stock)) return toast('You already have the maximum available stock in your cart.', 'error');
      entry.qty += 1;
    } else cart.push({ productId, qty: 1 });
    saveCart(cart);
    renderCart();
    toast(`${product.name} added to cart.`);
  }

  function changeCartQty(productId, delta) {
    const cart = sanitizeCart(getCart());
    const entry = cart.find((item) => item.productId === productId);
    const product = products.find((item) => item.id === productId);
    if (!entry || !product) return;
    entry.qty = Math.max(0, Math.min(Number(product.stock), entry.qty + delta));
    const next = cart.filter((item) => item.qty > 0);
    saveCart(next);
    renderCart();
  }

  function removeFromCart(productId) {
    const cart = sanitizeCart(getCart()).filter((item) => item.productId !== productId);
    saveCart(cart);
    renderCart();
  }

  function cartTotals() {
    const cart = sanitizeCart(getCart());
    const subtotal = cart.reduce((sum, entry) => {
      const product = products.find((item) => item.id === entry.productId);
      return sum + (product ? Number(product.price) * entry.qty : 0);
    }, 0);
    const shipping = cart.length ? Math.max(0, Number(storeSettings.shippingFee) || 0) : 0;
    return { cart, subtotal, shipping, total: subtotal + shipping };
  }

  function renderCart() {
    if (!isConsumer()) return;
    const { cart, subtotal, shipping, total } = cartTotals();
    saveCart(cart);
    els.cartCount.textContent = String(cart.reduce((sum, entry) => sum + entry.qty, 0));
    els.cartSubtotal.textContent = money(subtotal);
    els.cartShipping.textContent = money(shipping);
    els.cartTotal.textContent = money(total);
    els.checkoutButton.disabled = cart.length === 0;
    els.cartItems.innerHTML = cart.length ? cart.map((entry) => {
      const product = products.find((item) => item.id === entry.productId);
      return `<article class="cart-item"><div class="cart-item-thumb">${productImageMarkup(product)}</div><div><h3>${escapeHtml(product.name)}</h3><p>${money(product.price)} · Size ${escapeHtml(product.size)}</p><div class="qty-control"><button type="button" data-cart-minus="${product.id}" aria-label="Decrease quantity">−</button><span>${entry.qty}</span><button type="button" data-cart-plus="${product.id}" aria-label="Increase quantity">+</button></div></div><button class="cart-remove" type="button" data-cart-remove="${product.id}">Remove</button></article>`;
    }).join('') : '<div class="empty-state"><div class="empty-mark">C\'</div><h2>Your cart is empty.</h2><p>Add a thrift piece from the shop.</p></div>';
  }

  function renderCheckout() {
    const { cart, subtotal, shipping, total } = cartTotals();
    if (!cart.length) return false;
    els.checkoutFullName.value = session.name;
    els.checkoutEmail.value = session.email;
    els.checkoutGcashName.textContent = storeSettings.gcashName;
    els.checkoutGcashNumber.textContent = storeSettings.gcashNumber;
    els.checkoutItems.innerHTML = cart.map((entry) => {
      const product = products.find((item) => item.id === entry.productId);
      return `<div class="checkout-item"><span>${entry.qty} × ${escapeHtml(product.name)}</span><b>${money(Number(product.price) * entry.qty)}</b></div>`;
    }).join('');
    els.checkoutSubtotal.textContent = money(subtotal);
    els.checkoutShipping.textContent = money(shipping);
    els.checkoutTotal.textContent = money(total);
    setFormError(els.checkoutError);
    updatePaymentUI();
    return true;
  }

  async function loadLocations(endpoint, params) {
    const query = new URLSearchParams(params || {}).toString();
    const response = await apiFetch(`${endpoint}${query ? `?${query}` : ''}`);
    return response;
  }

  async function populateProvinces() {
    const provinces = await loadLocations('/api/locations/provinces');
    els.checkoutProvince.innerHTML = '<option value="">Select province</option>' + provinces.map((province) => `<option value="${escapeHtml(province)}">${escapeHtml(province)}</option>`).join('');
    els.checkoutProvince.disabled = false;
  }

  async function populateCities(province) {
    els.checkoutCity.innerHTML = '<option value="">Select city / municipality</option>';
    els.checkoutBarangay.innerHTML = '<option value="">Select city first</option>';
    els.checkoutCity.disabled = true;
    els.checkoutBarangay.disabled = true;
    els.checkoutRegion.value = '';
    if (!province) return;
    const result = await loadLocations('/api/locations/cities', { province });
    els.checkoutRegion.value = result.region;
    els.checkoutCity.innerHTML += result.cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('');
    els.checkoutCity.disabled = false;
  }

  async function populateBarangays(province, city) {
    els.checkoutBarangay.innerHTML = '<option value="">Select barangay</option>';
    els.checkoutBarangay.disabled = true;
    if (!province || !city) return;
    const result = await loadLocations('/api/locations/barangays', { province, city });
    els.checkoutBarangay.innerHTML += result.barangays.map((barangay) => `<option value="${escapeHtml(barangay)}">${escapeHtml(barangay)}</option>`).join('');
    els.checkoutBarangay.disabled = false;
  }

  function updatePaymentUI() {
    const method = els.checkoutForm.querySelector('input[name="paymentMethod"]:checked')?.value || 'gcash';
    const gcash = method === 'gcash';
    els.gcashBox.classList.toggle('hidden', !gcash);
    els.gcashReference.required = gcash;
    if (!gcash) els.gcashReference.value = '';
  }

  async function createOrder(formData) {
    if (!isConsumer()) throw new Error('Only customer accounts can place orders.');
    const { cart } = cartTotals();
    if (!cart.length) throw new Error('Your cart is empty.');

    for (const entry of cart) {
      const product = products.find((item) => item.id === entry.productId);
      if (!product || Number(product.stock) < entry.qty) throw new Error(`Stock changed for ${product?.name || 'an item'}. Please review your cart.`);
    }

    const method = String(formData.get('paymentMethod') || '');
    if (!['gcash', 'cod'].includes(method)) throw new Error('Choose GCash or Cash on Delivery.');
    const gcashReference = String(formData.get('gcashReference') || '').trim();
    if (method === 'gcash' && !gcashReference) throw new Error('Enter the GCash reference number.');

    let order;
    try {
      order = await withLoading(() => db.orders.place({
        items: cart,
        customer: { name: String(formData.get('fullName') || '').trim(), phone: String(formData.get('phone') || '').trim() },
        shipping: {
          country: String(formData.get('country') || '').trim(),
          region: String(formData.get('region') || '').trim(),
          street: String(formData.get('street') || '').trim(),
          barangay: String(formData.get('barangay') || '').trim(),
          city: String(formData.get('city') || '').trim(),
          province: String(formData.get('province') || '').trim(),
          postalCode: String(formData.get('postalCode') || '').trim(),
          notes: String(formData.get('deliveryNotes') || '').trim()
        },
        payment: { method, gcashReference: method === 'gcash' ? gcashReference : '' }
      }), els.checkoutForm);
    } catch (error) {
      // Most failures are "stock changed"; refresh so the cart and shop show the truth.
      try { products = await db.products.list(); renderProducts(); renderCart(); } catch { /* keep original error */ }
      throw error;
    }

    saveCart([]);
    // Stock and the order list changed in the database; pull the fresh copies.
    try { [products, orders] = await Promise.all([db.products.list(), db.orders.list()]); }
    catch (error) { console.warn('Order saved, but the lists could not be refreshed.', error); orders = [order, ...orders]; }
    return order;
  }

  function orderText(order) {
    const address = `${order.shipping.street}, Brgy. ${order.shipping.barangay}, ${order.shipping.city}, ${order.shipping.province} ${order.shipping.postalCode}`;
    return [`C'JUDE CO. ORDER ${order.id}`, `Status: ${order.status}`, `Customer: ${order.customer.name}`, `Phone: ${order.customer.phone}`, `Email: ${order.customer.email}`, `Ship to: ${address}`, order.shipping.notes ? `Delivery notes: ${order.shipping.notes}` : '', `Payment: ${order.payment.method === 'gcash' ? `GCash (${order.payment.gcashReference})` : 'Cash on Delivery'}`, `Items: ${order.items.map((item) => `${item.qty}x ${item.name} [${item.size}]`).join(', ')}`, `Subtotal: ${money(order.subtotal)}`, `Shipping: ${money(order.shippingFee)}`, `Total: ${money(order.total)}`].filter(Boolean).join('\n');
  }

  async function handleCheckout(event) {
    event.preventDefault();
    setFormError(els.checkoutError);
    if (!validateForm(els.checkoutForm, els.checkoutError)) return;
    try {
      const order = await createOrder(new FormData(els.checkoutForm));
      lastOrderText = orderText(order);
      els.successOrderId.textContent = order.id;
      els.successSummary.textContent = lastOrderText;
      els.checkoutForm.reset();
      closeModal(els.checkoutModal);
      renderProducts(); renderCart(); renderCustomerOrders(); renderOwnerOrders();
      openModal(els.successModal);
    } catch (error) {
      setFormError(els.checkoutError, error.message || 'Could not place the order.');
    }
  }

  // ---------- Owner inventory ----------
  function resetProductForm() {
    els.productForm.reset();
    els.editingProductId.value = '';
    els.productStock.value = '1';
    pendingProductImage = '';
    pendingImageFile = null;
    removeImageRequested = false;
    els.productFormTitle.textContent = 'Add product';
    els.saveProductButton.textContent = 'Publish product';
    els.cancelEditButton.classList.add('hidden');
    els.removeProductImage.classList.add('hidden');
    els.imagePreview.innerHTML = '<strong>+ Insert product image</strong><span>JPG, PNG, or WEBP. Use images under 1.5 MB.</span>';
    setFormError(els.productFormError);
  }

  function editProduct(productId) {
    if (!isOwner()) return;
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    routeTo('inventory');
    els.editingProductId.value = product.id;
    els.productName.value = product.name;
    els.productCategory.value = product.category;
    els.productSize.value = product.size;
    els.productCondition.value = product.condition;
    els.productStock.value = product.stock;
    els.productPrice.value = product.price;
    els.productDescription.value = product.description;
    pendingProductImage = product.image || '';
    pendingImageFile = null;
    removeImageRequested = false;
    els.productFormTitle.textContent = 'Edit product';
    els.saveProductButton.textContent = 'Save changes';
    els.cancelEditButton.classList.remove('hidden');
    els.removeProductImage.classList.toggle('hidden', !product.image);
    els.imagePreview.innerHTML = product.image ? `<img src="${escapeHtml(product.image)}" alt="Current product image" />` : '<strong>+ Insert product image</strong><span>This listing currently has no image.</span>';
  }

  function handleProductImage(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      els.productImage.value = '';
      return toast('Please use a JPG, PNG, or WEBP image.', 'error');
    }
    if (file.size > 1.5 * 1024 * 1024) {
      els.productImage.value = '';
      return toast('Please use an image smaller than 1.5 MB.', 'error');
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageFile = file;
      pendingProductImage = String(reader.result || '');
      removeImageRequested = false;
      els.imagePreview.innerHTML = `<img src="${pendingProductImage}" alt="Product image preview" />`;
      els.removeProductImage.classList.remove('hidden');
    };
    reader.onerror = () => toast('The image could not be read.', 'error');
    reader.readAsDataURL(file);
  }

  async function handleProductSave(event) {
    event.preventDefault();
    if (!isOwner()) return;
    setFormError(els.productFormError);
    if (!validateForm(els.productForm, els.productFormError)) return;

    const editingId = els.editingProductId.value;
    const existing = products.find((item) => item.id === editingId);
    const fields = {
      name: els.productName.value.trim(),
      category: els.productCategory.value.trim(),
      size: els.productSize.value.trim(),
      condition: els.productCondition.value,
      stock: Math.max(0, Math.floor(Number(els.productStock.value) || 0)),
      price: Math.max(0, Number(els.productPrice.value) || 0),
      description: els.productDescription.value.trim()
    };
    if (fields.price <= 0) return setFormError(els.productFormError, 'Price must be greater than zero.');

    try {
      const saved = await withLoading(() => existing
        ? db.products.update(existing, fields, { file: pendingImageFile, removeImage: removeImageRequested })
        : db.products.create(fields, pendingImageFile), els.productForm);
      products = existing ? products.map((item) => item.id === saved.id ? saved : item) : [saved, ...products];
      resetProductForm();
      renderProducts();
      renderInventory();
      toast(existing ? 'Product updated.' : 'Product published.');
    } catch (error) {
      if (error.sessionExpired) return handleRemoteError(error);
      setFormError(els.productFormError, error.message);
    }
  }

  async function deleteProduct(productId) {
    if (!isOwner()) return;
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    if (!window.confirm(`Delete \u201c${product.name}\u201d? This cannot be undone.`)) return;
    try {
      await withLoading(() => db.products.remove(product));
      products = products.filter((item) => item.id !== productId);
      reviews = reviews.filter((review) => review.productId !== productId);
      renderProducts(); renderInventory(); renderFeedback();
      toast('Product deleted.');
    } catch (error) {
      handleRemoteError(error);
    }
  }

  function renderInventory() {
    if (!isOwner()) return;
    els.inventoryCount.textContent = `${products.length} item${products.length === 1 ? '' : 's'}`;
    els.inventoryList.innerHTML = products.length ? products.map((product) => `<article class="inventory-item"><div class="inventory-thumb">${productImageMarkup(product)}</div><div class="inventory-copy"><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.category)} · Size ${escapeHtml(product.size)} · ${escapeHtml(product.condition)}</p><b>${money(product.price)} · Stock ${Number(product.stock)}</b></div><div class="inventory-actions"><button class="small-button" type="button" data-edit-product="${product.id}">Edit</button><button class="small-button danger-button" type="button" data-delete-product="${product.id}">Delete</button></div></article>`).join('') : '<div class="empty-state"><div class="empty-mark">C\'</div><h2>No products yet.</h2><p>Add your first product using the editor.</p></div>';
  }

  // ---------- Orders ----------
  function customerOrderMarkup(order) {
    return `<article class="order-card"><div class="order-card-head"><div><h3>${escapeHtml(order.id)}</h3><p>${escapeHtml(dateText(order.createdAt))}</p></div><span class="status-chip">${escapeHtml(order.status)}</span></div><div class="order-body"><div class="order-section"><h4>Items</h4><div class="order-items-mini">${order.items.map((item) => `<div><span>${item.qty} × ${escapeHtml(item.name)} · ${escapeHtml(item.size)}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}</div></div><div class="order-section"><h4>Shipment & Payment</h4><p>${escapeHtml(order.shipping.street)}, Brgy. ${escapeHtml(order.shipping.barangay)}, ${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.province)} ${escapeHtml(order.shipping.postalCode)}<br>${order.payment.method === 'gcash' ? `GCash · Ref ${escapeHtml(order.payment.gcashReference)}` : 'Cash on Delivery'}</p></div></div><div class="order-card-footer"><span class="total">${money(order.total)}</span><span class="pill">${order.items.reduce((sum,item) => sum + item.qty, 0)} item${order.items.reduce((sum,item) => sum + item.qty, 0) === 1 ? '' : 's'}</span></div></article>`;
  }

  function renderCustomerOrders() {
    if (!isConsumer()) return;
    const mine = orders.filter((order) => order.customerId === session.id);
    els.customerOrdersList.innerHTML = mine.length ? mine.map(customerOrderMarkup).join('') : '<div class="empty-state"><div class="empty-mark">C\'</div><h2>No orders yet.</h2><p>Your completed checkout orders will appear here.</p></div>';
  }

  function ownerOrderMarkup(order) {
    const statusOptions = ORDER_STATUSES.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('');
    return `<article class="order-card"><div class="order-card-head"><div><h3>${escapeHtml(order.id)} · ${escapeHtml(order.customer.name)}</h3><p>${escapeHtml(dateText(order.createdAt))}</p></div><span class="status-chip">${escapeHtml(order.status)}</span></div><div class="order-body"><div class="order-section"><h4>Ship To</h4><p><b>${escapeHtml(order.customer.name)}</b><br>${escapeHtml(order.customer.phone)} · ${escapeHtml(order.customer.email)}<br>${escapeHtml(order.shipping.street)}, Brgy. ${escapeHtml(order.shipping.barangay)}, ${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.province)} ${escapeHtml(order.shipping.postalCode)}${order.shipping.notes ? `<br><b>Notes:</b> ${escapeHtml(order.shipping.notes)}` : ''}</p></div><div class="order-section"><h4>Order</h4><div class="order-items-mini">${order.items.map((item) => `<div><span>${item.qty} × ${escapeHtml(item.name)}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}</div><p style="margin-top:8px"><b>Payment:</b> ${order.payment.method === 'gcash' ? `GCash · ${escapeHtml(order.payment.gcashReference)}` : 'Cash on Delivery'}</p></div></div><div class="order-card-footer"><div class="button-row"><select data-order-status="${order.id}" aria-label="Order status">${statusOptions}</select><button class="small-button" type="button" data-copy-order="${order.id}">Copy Details</button><button class="small-button" type="button" data-print-order="${order.id}">Print Shipping Slip</button></div><span class="total">${money(order.total)}</span></div></article>`;
  }

  function renderOwnerOrders() {
    if (!isOwner()) return;
    els.ownerOrdersList.innerHTML = orders.length ? orders.map(ownerOrderMarkup).join('') : '<div class="empty-state"><div class="empty-mark">C\'</div><h2>No customer orders yet.</h2><p>Placed customer orders will appear here.</p></div>';
    els.metricOrders.textContent = String(orders.length);
    els.metricPending.textContent = String(orders.filter((order) => !['Delivered','Cancelled'].includes(order.status)).length);
    els.metricDelivered.textContent = String(orders.filter((order) => order.status === 'Delivered').length);
    const revenue = orders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + Number(order.total || 0), 0);
    els.metricRevenue.textContent = money(revenue);
  }

  function printShippingSlip(order) {
    if (!isOwner()) return;
    const popup = window.open('', '_blank', 'width=780,height=900');
    if (!popup) return toast('Allow pop-ups to print the shipping slip.', 'error');
    const address = `${order.shipping.street}, Brgy. ${order.shipping.barangay}, ${order.shipping.city}, ${order.shipping.province} ${order.shipping.postalCode}`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(order.id)} Shipping Slip</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.slip{border:2px solid #111;padding:24px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:18px}h1{margin:0}.box{border:1px solid #333;padding:14px;margin:12px 0}h3{font-size:11px;letter-spacing:.1em;margin:0 0 8px;text-transform:uppercase}p{line-height:1.5;margin:0}.total{font-size:22px;font-weight:800;text-align:right;margin-top:18px}@media print{button{display:none}}</style></head><body><div class="slip"><div class="top"><div><h1>${escapeHtml(storeSettings.storeName)}</h1><div>${escapeHtml(storeSettings.tagline)}</div></div><div><b>ORDER</b><br>${escapeHtml(order.id)}<br>${escapeHtml(dateText(order.createdAt))}</div></div><div class="box"><h3>Ship To</h3><p><b>${escapeHtml(order.customer.name)}</b><br>${escapeHtml(order.customer.phone)}<br>${escapeHtml(address)}${order.shipping.notes ? `<br><b>Notes:</b> ${escapeHtml(order.shipping.notes)}` : ''}</p></div><div class="box"><h3>Items</h3><p>${order.items.map((item) => `${item.qty} × ${escapeHtml(item.name)} — Size ${escapeHtml(item.size)}`).join('<br>')}</p></div><div class="box"><h3>Payment</h3><p>${order.payment.method === 'gcash' ? `GCash · Ref ${escapeHtml(order.payment.gcashReference)}` : 'Cash on Delivery'}</p></div><div class="total">Total: ${escapeHtml(money(order.total))}</div></div><br><button onclick="window.print()">Print</button></body></html>`);
    popup.document.close();
  }

  function exportOrders() {
    if (!isOwner()) return;
    if (!orders.length) return toast('There are no orders to export.', 'error');
    const rows = [['Order ID','Date','Status','Customer','Phone','Email','Street','Barangay','City','Province','Postal Code','Delivery Notes','Payment','GCash Reference','Items','Subtotal','Shipping','Total']];
    orders.forEach((order) => rows.push([order.id, dateText(order.createdAt), order.status, order.customer.name, order.customer.phone, order.customer.email, order.shipping.street, order.shipping.barangay, order.shipping.city, order.shipping.province, order.shipping.postalCode, order.shipping.notes, order.payment.method.toUpperCase(), order.payment.gcashReference, order.items.map((item) => `${item.qty}x ${item.name} (${item.size})`).join(' | '), order.subtotal, order.shippingFee, order.total]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cjude-orders.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Feedback owner view ----------
  function renderFeedback() {
    if (!isOwner()) return;
    const ordered = [...reviews].sort((a,b) => Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt));
    els.metricReviews.textContent = String(ordered.length);
    const average = ordered.length ? ordered.reduce((sum, review) => sum + Number(review.stars), 0) / ordered.length : 0;
    els.metricAverageRating.textContent = ordered.length ? average.toFixed(1) : '—';
    els.metricFiveStar.textContent = String(ordered.filter((review) => Number(review.stars) === 5).length);
    els.feedbackList.innerHTML = ordered.length ? ordered.map((review) => {
      const product = products.find((item) => item.id === review.productId);
      return `<article class="feedback-card"><div><h3>${escapeHtml(product?.name || 'Deleted product')}</h3><div class="reviewer">${escapeHtml(review.userName)} · ${escapeHtml(starString(review.stars))}</div></div><p>${review.feedback ? escapeHtml(review.feedback) : '<em>No written feedback.</em>'}</p><time>${escapeHtml(dateText(review.updatedAt || review.createdAt))}</time></article>`;
    }).join('') : '<div class="empty-state"><div class="empty-mark">★</div><h2>No reviews yet.</h2><p>Customer ratings and feedback will appear here.</p></div>';
  }

  // ---------- Settings ----------
  function handleAppearanceSave(event) {
    event.preventDefault();
    const next = { theme: els.themeSelect.value === 'light' ? 'light' : 'dark', primary: els.primaryColor.value, secondary: els.secondaryColor.value };
    if (!validHex(next.primary) || !validHex(next.secondary)) return toast('Choose valid colors.', 'error');
    appearance = next;
    saveJSON(STORAGE.appearance, appearance);
    applyAppearance();
    toast('Appearance settings saved.');
  }

  function resetAppearance() {
    appearance = clone(defaultAppearance);
    saveJSON(STORAGE.appearance, appearance);
    applyAppearance();
    loadSettingsForms();
    toast('Appearance reset to the C\'JUDE CO. default.');
  }

  async function handleStoreSettingsSave(event) {
    event.preventDefault();
    if (!isOwner()) return;
    if (!els.storeSettingsForm.checkValidity()) {
      els.storeSettingsForm.querySelector(':invalid')?.focus();
      return toast('Complete all required store settings.', 'error');
    }
    const next = {
      storeName: els.settingStoreName.value.trim(),
      tagline: els.settingTagline.value.trim(),
      announcement: els.settingAnnouncement.value.trim(),
      gcashName: els.settingGcashName.value.trim(),
      gcashNumber: els.settingGcashNumber.value.trim(),
      shippingFee: Math.max(0, Number(els.settingShippingFee.value) || 0),
      contactNumber: els.settingContactNumber.value.trim()
    };
    try {
      storeSettings = { ...defaultStoreSettings, ...(await withLoading(() => db.settings.save(next), els.storeSettingsForm)) };
      renderStoreIdentity();
      renderCart();
      toast('Store settings saved.');
    } catch (error) {
      handleRemoteError(error);
    }
  }

  // ---------- Modal / menu helpers ----------
  function openModal(element) { element.classList.add('open'); element.setAttribute('aria-hidden', 'false'); }
  function closeModal(element) { element.classList.remove('open'); element.setAttribute('aria-hidden', 'true'); }
  function openCart() { if (!isConsumer()) return; renderCart(); els.cartDrawer.classList.add('open'); els.cartDrawer.setAttribute('aria-hidden', 'false'); }
  function closeCart() { els.cartDrawer.classList.remove('open'); els.cartDrawer.setAttribute('aria-hidden', 'true'); }
  function closeAccountMenu() { els.accountMenu.classList.add('hidden'); els.accountButton.setAttribute('aria-expanded', 'false'); }
  function closeAllOverlays() { closeCart(); [els.productModal, els.checkoutModal, els.successModal].forEach(closeModal); closeAccountMenu(); }

  // ---------- Refresh ----------
  function refreshAllDataViews() {
    renderProducts();
    if (isConsumer()) { renderCart(); renderCustomerOrders(); }
    if (isOwner()) { renderInventory(); renderOwnerOrders(); renderFeedback(); }
  }

  // ---------- Event listeners ----------
  els.loginTab.addEventListener('click', () => switchAuthMode('login'));
  els.signupTab.addEventListener('click', () => switchAuthMode('signup'));
  els.loginForm.addEventListener('submit', handleLogin);
  els.signupForm.addEventListener('submit', handleSignup);

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.classList.contains('password-toggle') || target.dataset.togglePassword) {
      const input = target.dataset.togglePassword ? $(target.dataset.togglePassword) : target.closest('.password-field')?.querySelector('input');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      target.textContent = show ? 'Hide' : 'Show';
      return;
    }
    if (target.dataset.route) { routeTo(target.dataset.route); closeAccountMenu(); return; }
    if (target.dataset.closeModal) { const modal = $(target.dataset.closeModal); if (modal) closeModal(modal); return; }
    if (target.hasAttribute('data-close-cart')) { closeCart(); return; }
    if (target.dataset.addCart) { addToCart(target.dataset.addCart); return; }
    if (target.dataset.viewProduct) { openProductModal(target.dataset.viewProduct); return; }
    if (target.dataset.editProduct) { closeModal(els.productModal); editProduct(target.dataset.editProduct); return; }
    if (target.dataset.deleteProduct) { deleteProduct(target.dataset.deleteProduct); return; }
    if (target.dataset.cartMinus) { changeCartQty(target.dataset.cartMinus, -1); return; }
    if (target.dataset.cartPlus) { changeCartQty(target.dataset.cartPlus, 1); return; }
    if (target.dataset.cartRemove) { removeFromCart(target.dataset.cartRemove); return; }
    if (target.dataset.star) {
      selectedReviewStars = Number(target.dataset.star);
      document.querySelectorAll('#starInput .star-button').forEach((button) => button.classList.toggle('active', Number(button.dataset.star) <= selectedReviewStars));
      return;
    }
    if (target.hasAttribute('data-save-review')) { saveReview(); return; }
    if (target.hasAttribute('data-delete-review')) { deleteOwnReview(); return; }
    if (target.dataset.copyOrder) {
      const order = orders.find((item) => item.id === target.dataset.copyOrder);
      if (order) navigator.clipboard?.writeText(orderText(order)).then(() => toast('Order details copied.')).catch(() => toast('Copy failed. Select and copy manually.', 'error'));
      return;
    }
    if (target.dataset.printOrder) {
      const order = orders.find((item) => item.id === target.dataset.printOrder);
      if (order) printShippingSlip(order);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllOverlays();
  });

  els.accountButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = els.accountMenu.classList.contains('hidden');
    els.accountMenu.classList.toggle('hidden', !opening);
    els.accountButton.setAttribute('aria-expanded', String(opening));
  });
  document.addEventListener('click', (event) => { if (!els.accountMenu.contains(event.target) && !els.accountButton.contains(event.target)) closeAccountMenu(); });
  els.logoutButton.addEventListener('click', logout);

  els.searchInput.addEventListener('input', renderProducts);
  els.categoryFilter.addEventListener('change', renderProducts);
  els.sortSelect.addEventListener('change', renderProducts);
  els.cartButton.addEventListener('click', openCart);
  els.checkoutButton.addEventListener('click', () => { if (renderCheckout()) { closeCart(); openModal(els.checkoutModal); } });
  els.checkoutProvince.addEventListener('change', () => { void populateCities(els.checkoutProvince.value); });
  els.checkoutCity.addEventListener('change', () => { void populateBarangays(els.checkoutProvince.value, els.checkoutCity.value); });
  els.checkoutForm.addEventListener('change', (event) => { if (event.target.name === 'paymentMethod') updatePaymentUI(); });
  els.checkoutForm.addEventListener('submit', handleCheckout);
  els.copyOrderButton.addEventListener('click', () => {
    if (!lastOrderText) return;
    navigator.clipboard?.writeText(lastOrderText).then(() => toast('Order details copied.')).catch(() => toast('Copy failed.', 'error'));
  });

  els.productImage.addEventListener('change', (event) => handleProductImage(event.target.files?.[0]));
  els.removeProductImage.addEventListener('click', () => {
    pendingProductImage = '';
    pendingImageFile = null;
    removeImageRequested = true;
    els.productImage.value = '';
    els.imagePreview.innerHTML = '<strong>+ Insert product image</strong><span>The current image will be removed when you save.</span>';
    els.removeProductImage.classList.add('hidden');
  });
  els.productForm.addEventListener('submit', handleProductSave);
  els.cancelEditButton.addEventListener('click', resetProductForm);
  els.newProductButton.addEventListener('click', () => { resetProductForm(); els.productName.focus(); });

  els.ownerOrdersList.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-order-status]');
    if (!select || !isOwner()) return;
    const order = orders.find((item) => item.id === select.dataset.orderStatus);
    if (!order || !ORDER_STATUSES.includes(select.value)) return;
    try {
      const updated = await withLoading(() => db.orders.setStatus(order.id, select.value));
      Object.assign(order, updated);
      renderOwnerOrders();
      toast('Order status updated.');
      // Cancelling or re-opening an order changes stock in the database.
      products = await db.products.list();
      renderProducts();
      renderInventory();
    } catch (error) {
      select.value = order.status;
      handleRemoteError(error);
    }
  });
  els.exportOrdersButton.addEventListener('click', exportOrders);

  els.appearanceForm.addEventListener('submit', handleAppearanceSave);
  els.resetAppearanceButton.addEventListener('click', resetAppearance);
  els.primaryColor.addEventListener('input', () => {
    if (validHex(els.primaryColor.value)) {
      document.documentElement.style.setProperty('--primary', els.primaryColor.value);
      document.documentElement.style.setProperty('--primary-rgb', hexToRgb(els.primaryColor.value));
    }
  });
  els.secondaryColor.addEventListener('input', () => {
    if (validHex(els.secondaryColor.value)) {
      document.documentElement.style.setProperty('--secondary', els.secondaryColor.value);
      document.documentElement.style.setProperty('--secondary-rgb', hexToRgb(els.secondaryColor.value));
    }
  });
  els.themeSelect.addEventListener('change', () => { document.documentElement.dataset.theme = els.themeSelect.value === 'light' ? 'light' : 'dark'; });
  els.storeSettingsForm.addEventListener('submit', handleStoreSettingsSave);

  // ---------- Initialization ----------
  applyAppearance();
  renderStoreIdentity();
  void populateProvinces().catch((error) => toast(error.message, 'error'));

  if (!db || window.CJude.configError) {
    showAuth('login');
    setFormError(els.loginError, (window.CJude && window.CJude.configError) || 'The Supabase scripts did not load.');
  } else {
    window.CJude.auth.onSignedOut(() => { if (session) forceLogout('You were signed out. Please log in again.'); });
    (async () => {
      try {
        const user = await withLoading(() => window.CJude.auth.restoreSession());
        if (user) { saveSession(user); await showApp(); }
        else showAuth('login');
      } catch (error) {
        showAuth('login');
        toast(error.message, 'error');
      }
    })();
  }
})();
