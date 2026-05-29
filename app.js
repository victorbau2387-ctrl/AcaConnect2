
// ═══════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════
const SUPA_URL = 'https://tjfpwsnshkuotrimlzgg.supabase.co';
const SUPA_KEY = 'sb_publishable_PuAd91zK6iu3HPywDEaJfQ_YETFwkCd'; // ← REEMPLAZAR con tu clave completa

// ── Analytics tracker ──────────────────────────────────
const _sesionId = 'ses-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
const _dispositivo = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile'
                   : /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop';

function trackEvento(tipo, pagina, referencia) {
  // Fire-and-forget: nunca bloquea la UI
  fetch(SUPA_URL + '/rest/v1/eventos_analytics', {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY,
                'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      tipo, pagina: pagina || null, referencia: referencia ? String(referencia) : null,
      usuario_id: currentUser?.id || null,
      sesion_id: _sesionId, dispositivo: _dispositivo
    })
  }).catch(() => {});
}

async function supaFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const extraHeaders = {};
  if (['POST','PATCH','DELETE'].includes(method) && currentUser && currentUser.id) {
    extraHeaders['x-user-id'] = String(currentUser.id);
  }
  // DELETE no necesita devolver datos — return=minimal evita conflictos con RLS
  const prefer = method === 'DELETE' ? 'return=minimal' : 'return=representation';
  const res = await fetch(SUPA_URL + endpoint, {
    ...options,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': prefer,
      ...extraHeaders,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error ' + res.status);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let currentUser = null;
let userAcaPoints = 0;
let userSaldoTarjeta = 0;
let selectedCat = null;
let activePill  = 'todos';
let allServices = [];

const PLACEHOLDER_IMGS = {
  gastronomia:  'https://images.unsplash.com/photo-1504544750208-dc0358e411f5?w=600&q=80',
  hospedaje:    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
  servicios:    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&q=80',
  experiencias: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80',
};

// ═══════════════════════════════════════════════
//  NAVEGACIÓN
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  TEMA OSCURO / CLARO
// ═══════════════════════════════════════════════
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  try { localStorage.setItem('aca_theme', newTheme); } catch(e) {}
}

function applyTheme(theme) {
  const icon  = document.getElementById('theme-icon');
  const ddIcon = document.getElementById('dropdown-theme-icon');
  const ddText = document.getElementById('dropdown-theme-text');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (icon)   icon.textContent   = '☀️';
    if (ddIcon) ddIcon.textContent = '☀️';
    if (ddText) ddText.textContent = 'Tema claro';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (icon)   icon.textContent   = '🌙';
    if (ddIcon) ddIcon.textContent = '🌙';
    if (ddText) ddText.textContent = 'Tema oscuro';
  }
}

function initTheme() {
  try {
    const saved = localStorage.getItem('aca_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  } catch(e) {}
}

// ═══════════════════════════════════════════════
//  CARRUSELES "SOBRE ACAPULCO"
// ═══════════════════════════════════════════════
const _sliders = {};   // estado por slider-id

function initSliders() {
  const N = 6;
  for (let i = 0; i < N; i++) {
    const id = 'slider-' + i;
    const el = document.getElementById(id);
    if (!el) continue;

    _sliders[id] = { current: 0, total: 5, paused: false };

    // Crear dots
    const dotsWrap = document.getElementById('dots-' + id);
    for (let d = 0; d < 5; d++) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (d === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Slide ' + (d+1));
      dot.onclick = (function(sid, idx){ return function(){ slideTo(sid, idx); }; })(id, d);
      dotsWrap.appendChild(dot);
    }

    // Auto-slide cada 5 segundos con offset para que no se muevan todos juntos
    (function(sid, offset){
      setTimeout(function(){
        _sliders[sid].autoTimer = setInterval(function(){
          if (!_sliders[sid].paused) {
            const next = (_sliders[sid].current + 1) % _sliders[sid].total;
            slideTo(sid, next);
          }
        }, 5000);
      }, offset);
    })(id, i * 900);   // desfase de 0.9s entre carruseles

    // Pausar en hover
    el.addEventListener('mouseenter', function(){ _sliders[id].paused = true; });
    el.addEventListener('mouseleave', function(){ _sliders[id].paused = false; });

    // Soporte swipe táctil
    let touchStartX = 0;
    el.addEventListener('touchstart', function(e){ touchStartX = e.touches[0].clientX; }, {passive:true});
    el.addEventListener('touchend', function(e){
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) slideMove(id, diff > 0 ? 1 : -1);
    }, {passive:true});
  }
}

function slideTo(id, index) {
  const s = _sliders[id];
  if (!s) return;
  s.current = ((index % s.total) + s.total) % s.total;
  const el = document.getElementById(id);
  if (!el) return;
  const slides = el.querySelector('.about-slides');
  if (slides) slides.style.transform = 'translateX(-' + (s.current * 100) + '%)';
  // Actualizar dots
  const dots = document.querySelectorAll('#dots-' + id + ' .slider-dot');
  dots.forEach(function(d, i){ d.classList.toggle('active', i === s.current); });
}

function slideMove(id, dir) {
  const s = _sliders[id];
  if (!s) return;
  slideTo(id, s.current + dir);
}

function showPage(name) {
  closeMobileMenu();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const t = document.getElementById('page-' + name);
  if (!t) return;
  t.classList.add('active');
  document.documentElement.scrollTop = 0;
  t.scrollTop = 0; // reset scroll interno (page-home)
  const nav = document.getElementById('main-nav');
  if (name === 'home') { nav.classList.remove('scrolled'); }
  else { nav.classList.add('scrolled'); }
  if (name === 'marketplace') loadServices();
  if (name === 'about' && !_sliders['slider-0']) initSliders();
  if (name === 'publish' && currentUser) {
    const tel = (currentUser.telefono || '').replace(/\D/g,'').replace(/^52/,'');
    const waEl = document.getElementById('pub-whatsapp');
    if (waEl && tel && !waEl.value) waEl.value = tel;
  }
  // Guardar en localStorage Y en el hash de la URL para sobrevivir Ctrl+R
  try { localStorage.setItem('aca_page', name); } catch(e) {}
  try {
    const newHash = name === 'home' ? '' : '#' + name;
    if (location.hash !== newHash) history.replaceState(null, '', newHash || location.pathname);
  } catch(e) {}
}

window.addEventListener('scroll', () => {
  const isHome = document.getElementById('page-home').classList.contains('active');
  if (isHome) document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 80);
});

// ═══════════════════════════════════════════════
//  MARKETPLACE — carga desde Supabase
// ═══════════════════════════════════════════════
async function loadServices() {
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando servicios de Acapulco...</p></div>';
  try {
    const data = await supaFetch('/rest/v1/servicios?select=*,usuarios(nombre,telefono)&estado=eq.activo&order=creado_en.desc');
    allServices = data;
    renderCards();
  } catch(e) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>No se pudieron cargar los servicios. Intenta de nuevo.</p></div>';
    console.error(e);
  }
}

function renderCards() {
  const query  = (document.getElementById('search-input').value || '').toLowerCase();
  const grid   = document.getElementById('cards-grid');
  const count  = document.getElementById('mkt-count');
  const sub    = document.getElementById('mkt-subtitle');

  let filtered = allServices.filter(s => {
    const matchCat = activePill === 'todos' || s.categoria === activePill;
    const matchQ   = !query || s.titulo.toLowerCase().includes(query) || s.descripcion.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  count.textContent = filtered.length + ' resultado' + (filtered.length !== 1 ? 's' : '');
  sub.textContent   = 'Explora ' + allServices.length + ' servicios disponibles en Acapulco';

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>No se encontraron servicios que coincidan.</p></div>';
    return;
  }

  window.filteredServices = filtered;
  grid.innerHTML = filtered.map((s, idx) => {
    const isOwner = currentUser && String(currentUser.id) === String(s.usuario_id);
    const deleteBtn = isOwner
      ? `<button class="btn-delete" onclick="deleteService(event, ${s.id})">🗑 Eliminar</button>`
      : '';
    return `
    <div class="card" onclick="openDetailByIdx(${idx})">
      <div class="card-img">
        <img src="${s.imagen_url || PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios}"
             alt="${s.titulo}" loading="lazy"
             onerror="this.src='${PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios}'"/>
        <div class="card-badge">${catLabel(s.categoria)}</div>
        <div class="card-price">${
          esPrecioVariable(s.precio_tipo)
            ? `<strong style="color:#E65100;">💵 A convenir</strong>`
            : esRangoPrecio(s.precio_tipo)
              ? `<strong>${s.precio_tipo}</strong>`
              : `<strong>$${Number(s.precio).toLocaleString('es-MX')}</strong>/${s.precio_tipo}`
        }</div>
      </div>
      <div class="card-body">
        <h3>${s.titulo}</h3>
        <div class="card-loc">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${s.ubicacion}
        </div>
      </div>
      <div class="card-footer">
        <div class="card-rating" style="padding:0;border:none;margin:0;">
          <div class="stars-row">${starsHTML(s.promedio_estrellas || 0)}</div>
          <span class="rating-count">(${s.total_resenas || 0})</span>
        </div>
        ${deleteBtn}
      </div>
    </div>`;
  }).join('');
}

function catLabel(c) {
  return {gastronomia:'Gastronomía',hospedaje:'Hospedaje',servicios:'Servicios',experiencias:'Experiencias'}[c] || c;
}
function starsHTML(r) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<span class="star ${r >= i ? 'filled' : ''}">★</span>`;
  return h;
}
function filterPill(el) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activePill = el.dataset.cat;
  renderCards();
}
function filterCards() { renderCards(); }
function sortCards(val) {
  if (val === 'precio-asc')   allServices.sort((a,b) => a.precio - b.precio);
  else if (val === 'precio-desc') allServices.sort((a,b) => b.precio - a.precio);
  else if (val === 'mejor-rating') allServices.sort((a,b) => (b.promedio_estrellas||0) - (a.promedio_estrellas||0));
  else allServices.sort((a,b) => new Date(b.creado_en) - new Date(a.creado_en));
  renderCards();
}

// ═══════════════════════════════════════════════
//  PUBLICAR — guarda en Supabase
// ═══════════════════════════════════════════════
function selectCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedCat = btn.dataset.cat;
  togglePrecioPanels();
}

function togglePrecioPanels() {
  const esGastro = selectedCat === 'gastronomia';
  const estandar = document.getElementById('precio-estandar-panel');
  const rango    = document.getElementById('precio-rango-panel');
  if (estandar) { estandar.style.display = esGastro ? 'none'  : 'block'; }
  if (rango)    { rango.style.display    = esGastro ? 'block' : 'none';  }
  const prev = document.getElementById('rango-preview');
  if (prev) prev.style.display = 'none';
}
function updateCount() {
  document.getElementById('char-count').textContent = document.getElementById('pub-desc').value.length + '/500';
}

async function publishService() {
  if (!currentUser) { openModal('login'); showToast('Inicia sesión para publicar'); return; }
  const titulo = document.getElementById('pub-title').value.trim();

  // ── Leer tipo de precio ──────────────────────────────────
  const selTipoEl = document.getElementById('pub-price-type');
  const pTipoRaw  = selTipoEl ? selTipoEl.value : 'precio fijo';
  const esVariable = pTipoRaw === 'variable (a convenir)';

  // ── Leer precio según categoría y tipo ───────────────────
  let precio, pTipo;

  if (esVariable) {
    // Precio variable → solo efectivo, precio = 0 guardado como "A convenir"
    precio = 0;
    pTipo  = 'variable';
  } else if (selectedCat === 'gastronomia') {
    const min = parseFloat(document.getElementById('pub-price-min')?.value) || 0;
    const max = parseFloat(document.getElementById('pub-price-max')?.value) || 0;
    if (!min || !max || min > max) {
      showToast('⚠️ Ingresa un rango de precios válido (mínimo < máximo)'); return;
    }
    precio = min;
    pTipo  = `$${min.toLocaleString('es-MX')}–$${max.toLocaleString('es-MX')} por persona`;
  } else {
    const priceInput = document.querySelector('#precio-estandar-panel input[type="number"]');
    precio = priceInput ? parseFloat(priceInput.value) : 0;
    pTipo  = pTipoRaw;
  }

  const ubicacion = document.getElementById('pub-location').value;
  const desc      = document.getElementById('pub-desc').value.trim();
  const waInput   = (document.getElementById('pub-whatsapp').value || '').trim().replace(/\D/g,'');
  const mapsUrl   = (document.getElementById('pub-maps-url').value || '').trim();

  // WhatsApp: usar el del campo, o el del perfil como fallback
  const perfilTel = (currentUser.telefono || '').replace(/\D/g,'').replace(/^52/,'');
  const waFinal   = waInput || perfilTel;

  if (!titulo || !selectedCat || !ubicacion || !desc) {
    showToast('⚠️ Completa todos los campos requeridos'); return;
  }
  if (!esVariable && !precio) {
    showToast('⚠️ Ingresa un precio válido'); return;
  }
  if (!mapsUrl) {
    showToast('⚠️ El enlace de Google Maps es obligatorio para aparecer en el mapa');
    document.getElementById('pub-maps-url').focus(); return;
  }
  if (!waFinal || waFinal.length !== 10) {
    showToast('⚠️ Agrega un número de WhatsApp de contacto (10 dígitos)');
    document.getElementById('pub-whatsapp').focus(); return;
  }
  if (!mainPhotoFile) { showToast('⚠️ Agrega al menos una foto principal'); return; }

  const btn = document.querySelector('.btn-publish');
  btn.textContent = 'Subiendo fotos...'; btn.disabled = true;

  try {
    // Subir foto principal
    setProgress(20);
    const mainURL = await uploadToStorage(mainPhotoFile, 'servicios/' + currentUser.id);
    setProgress(50);

    // Subir fotos extra
    const extrasURLs = [];
    let done = 0;
    for (let i = 0; i < 4; i++) {
      if (extraPhotoFiles[i]) {
        const url = await uploadToStorage(extraPhotoFiles[i], 'servicios/' + currentUser.id);
        extrasURLs.push(url);
      }
      done++; setProgress(50 + done * 10);
    }
    setProgress(90);

    const payload = {
      usuario_id: currentUser.id,
      titulo, descripcion: desc, categoria: selectedCat,
      precio, precio_tipo: pTipo, ubicacion,
      imagen_url: mainURL,
      fotos_extra: extrasURLs,
      estado: 'pendiente', activo: true,
      metodos_pago: esVariable ? ['efectivo'] : getSelectedPayMethods()
    };
    if (mapsUrl) payload.maps_url = mapsUrl;

    // Verificar T&C aceptados
    if (!document.getElementById('pub-tyc')?.checked) {
      showToast('⚠️ Debes aceptar los Términos y Condiciones'); return;
    }
    const newServicio = await supaFetch('/rest/v1/servicios', { method: 'POST', body: JSON.stringify({...payload, terminos_aceptados: true}) });
    // Guardar registro de T&C en tabla dedicada
    supaFetch('/rest/v1/terminos_aceptados', {
      method: 'POST',
      body: JSON.stringify({ usuario_id: currentUser.id, version: '1.0' })
    }).catch(()=>{});
    const newId = Array.isArray(newServicio) ? newServicio[0]?.id : newServicio?.id;

    // Guardar horarios y disponibilidad si el servicio fue creado
    if (newId) {
      await guardarHorariosServicio(newId);
      await guardarDisponibilidadServicio(newId);
      guardarCoordsServicio(newId, payload.ubicacion, payload.maps_url); // coords precisas del link o zona
    }

    setProgress(100);
    showToast('✅ Servicio enviado. Un administrador lo revisará pronto.');

    // Reset form
    document.getElementById('pub-title').value = '';
    document.getElementById('pub-price').value = '';
    document.getElementById('pub-desc').value  = '';
    document.getElementById('pub-location').value = '';
    document.getElementById('pub-whatsapp').value = '';
    document.getElementById('pub-maps-url').value = '';
    document.getElementById('char-count').textContent = '0/500';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    selectedCat = null;
    removeMain();
    for (let i = 0; i < 4; i++) removeExtra(i);
    setTimeout(() => { setProgress(0); showPage('marketplace'); }, 1200);
  } catch(e) {
    showToast('❌ Error al publicar: ' + e.message);
    setProgress(0);
  } finally {
    btn.textContent = 'Publicar Servicio'; btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════
//  CONTACTO — guarda en Supabase
// ═══════════════════════════════════════════════
async function sendContact() {
  const nombre  = document.getElementById('contact-nombre').value.trim();
  const email   = document.getElementById('contact-email').value.trim();
  const mensaje = document.getElementById('contact-mensaje').value.trim();
  if (!nombre || !email || mensaje.length < 10) {
    showToast('⚠️ Completa todos los campos'); return;
  }
  try {
    await supaFetch('/rest/v1/mensajes_contacto', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, mensaje, leido: false })
    });
    showToast('✅ Mensaje enviado. ¡Pronto te contactaremos!');
    document.getElementById('contact-nombre').value  = '';
    document.getElementById('contact-email').value   = '';
    document.getElementById('contact-mensaje').value = '';
  } catch(e) {
    showToast('❌ Error al enviar: ' + e.message);
  }
}

// ═══════════════════════════════════════════════
//  AUTH — usa tabla usuarios en Supabase
// ═══════════════════════════════════════════════
function openModal(tab) {
  document.getElementById('auth-modal').classList.add('open');
  switchTab(tab);
  // Siempre resetear al paso 1 del registro
  const s1 = document.getElementById('reg-step-datos');
  const s2 = document.getElementById('reg-step-codigo');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  if (_regState && _regState.timer) clearInterval(_regState.timer);
}
function closeModal()   { document.getElementById('auth-modal').classList.remove('open'); }
function closeModalOutside(e) { if (e.target === document.getElementById('auth-modal')) closeModal(); }
function switchTab(tab) {
  document.querySelectorAll('.modal-tab').forEach((t,i) => {
    t.classList.toggle('active',(i===0&&tab==='login')||(i===1&&tab==='register'));
  });
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-register').classList.toggle('active', tab==='register');
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('⚠️ Ingresa correo y contraseña'); return; }
  try {
    const users = await supaFetch('/rest/v1/usuarios?email=eq.' + encodeURIComponent(email) + '&activo=eq.true&select=*');
    if (!users.length) { showToast('❌ Correo no registrado'); return; }
    const user = users[0];
    // Verificar contraseña
    if (user.password_hash !== pass) {
      showToast('❌ Contraseña incorrecta');
      return;
    }
    setUser(user);
    closeModal();
    showToast('¡Bienvenido, ' + user.nombre + '!');
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

// ─── REGISTRO CON VERIFICACIÓN DE CORREO ───
let _regState = { nombre:'', email:'', pass:'', phone:'', code:'', expires:0, timer:null };

async function doRegister() {
  const nombre = document.getElementById('reg-name').value.trim();
  const email  = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass   = document.getElementById('reg-pass').value;
  const phone  = (document.getElementById('reg-phone').value || '').trim();

  if (!nombre) { showToast('⚠️ Ingresa tu nombre'); return; }
  if (!email || !email.includes('@')) { showToast('⚠️ Ingresa un correo válido'); return; }
  if (pass.length < 6) { showToast('⚠️ La contraseña debe tener mínimo 6 caracteres'); return; }

  const btn = document.getElementById('btn-reg-continuar');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const existing = await supaFetch('/rest/v1/usuarios?email=eq.' + encodeURIComponent(email) + '&select=id');
    if (existing.length) { showToast('❌ Ese correo ya está registrado'); return; }

    // Guardar datos y generar código
    _regState.nombre = nombre;
    _regState.email  = email;
    _regState.pass   = pass;
    _regState.phone  = phone;
    _regState.code   = Math.floor(100000 + Math.random() * 900000).toString();
    _regState.expires = Date.now() + 10 * 60 * 1000;

    // Enviar código por EmailJS
    await emailjs.send('service_jofv7kc', 'template_ntiki4y', {
      to_email: email,
      to_name:  nombre,
      code:     _regState.code,
      mensaje:  'Tu código de verificación para crear tu cuenta en AcaConnect es: ' + _regState.code + '. Válido por 10 minutos.'
    });

    // Mostrar paso 2
    document.getElementById('reg-step-datos').style.display  = 'none';
    document.getElementById('reg-step-codigo').style.display = 'block';
    document.getElementById('reg-email-display').textContent = email;
    document.getElementById('reg-codigo').value = '';
    document.getElementById('reg-codigo').focus();
    _regStartTimer();
    showToast('📧 Código enviado a ' + email);

  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continuar →'; }
  }
}

function _regStartTimer() {
  if (_regState.timer) clearInterval(_regState.timer);
  const el = document.getElementById('reg-timer');
  const tick = () => {
    const r = _regState.expires - Date.now();
    if (!el) return;
    if (r <= 0) { clearInterval(_regState.timer); el.textContent = '00:00'; return; }
    const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
    el.textContent = m + ':' + String(s).padStart(2, '0');
  };
  tick();
  _regState.timer = setInterval(tick, 1000);
}

async function confirmarRegistro() {
  const code = document.getElementById('reg-codigo').value.trim();
  if (code.length !== 6) { showToast('⚠️ Ingresa el código de 6 dígitos'); return; }
  if (Date.now() > _regState.expires) { showToast('⏱ El código expiró. Solicita uno nuevo'); return; }
  if (code !== _regState.code) {
    showToast('❌ Código incorrecto');
    const inp = document.getElementById('reg-codigo');
    inp.style.border = '2px solid #E53935';
    setTimeout(() => { inp.style.border = ''; }, 1500);
    return;
  }

  const btn = document.querySelector('#reg-step-codigo .btn-modal-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta...'; }

  try {
    const payload = { nombre: _regState.nombre, email: _regState.email, password_hash: _regState.pass, tipo: 'cliente', rol: 'cliente' };
    if (_regState.phone) payload.telefono = '+52' + _regState.phone;
    const newUser = await supaFetch('/rest/v1/usuarios', { method: 'POST', body: JSON.stringify(payload) });
    const userData = Array.isArray(newUser) ? newUser[0] : newUser;

    // Asignar rol cliente en usuarios_roles
    if (userData && userData.id) {
      const rolData = await supaFetch('/rest/v1/roles?slug=eq.cliente&select=id').catch(()=>[]);
      if (rolData && rolData.length > 0) {
        supaFetch('/rest/v1/usuarios_roles', {
          method: 'POST',
          body: JSON.stringify({ usuario_id: userData.id, rol_id: rolData[0].id, asignado_por: userData.id })
        }).catch(()=>{});
      }
    }

    if (_regState.timer) clearInterval(_regState.timer);
    _regState = { nombre:'', email:'', pass:'', phone:'', code:'', expires:0, timer:null };
    setUser(userData);
    closeModal();
    trackEvento('registro', 'auth', 'cliente');
    showToast('🎉 ¡Cuenta creada! Bienvenido a AcaConnect');
  } catch(e) {
    showToast('❌ Error al crear cuenta: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✅ Verificar y crear cuenta'; }
  }
}

async function reenviarCodigoReg() {
  const btn = document.getElementById('btn-reenviar-reg');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  _regState.code    = Math.floor(100000 + Math.random() * 900000).toString();
  _regState.expires = Date.now() + 10 * 60 * 1000;
  _regStartTimer();
  try {
    await emailjs.send('service_jofv7kc', 'template_ntiki4y', {
      to_email: _regState.email, to_name: _regState.nombre,
      code: _regState.code,
      mensaje: 'Tu nuevo código de verificación para AcaConnect es: ' + _regState.code + '. Válido por 10 minutos.'
    });
    showToast('📧 Nuevo código enviado');
  } catch(e) { showToast('❌ Error: ' + e.message); }
  finally { if (btn) { setTimeout(() => { btn.disabled = false; btn.textContent = 'Reenviar código'; }, 30000); } }
}

function volverRegDatos() {
  if (_regState.timer) clearInterval(_regState.timer);
  document.getElementById('reg-step-codigo').style.display = 'none';
  document.getElementById('reg-step-datos').style.display  = 'block';
}

// ═══════════════════════════════════════════════
//  RECUPERACIÓN DE CONTRASEÑA
// ═══════════════════════════════════════════════
let _forgotState = { email: null, code: null, codeExpires: null, userId: null };

function openForgotPass() {
  closeModal();
  document.getElementById('forgot-overlay').classList.add('open');
  // Reset al paso 1
  document.getElementById('forgot-step-email').style.display = 'block';
  document.getElementById('forgot-step-code').style.display = 'none';
  document.getElementById('forgot-step-newpass').style.display = 'none';
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-code').value = '';
  document.getElementById('forgot-newpass').value = '';
  document.getElementById('forgot-newpass2').value = '';
  _forgotState = { email: null, code: null, codeExpires: null, userId: null };
}

function closeForgotPass() {
  document.getElementById('forgot-overlay').classList.remove('open');
}

async function sendForgotCode() {
  const emailInput = document.getElementById('forgot-email');
  const email = (_forgotState.email || emailInput.value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    showToast('⚠️ Ingresa un correo válido');
    return;
  }
  try {
    // Verificar que el correo exista en la base de datos
    const users = await supaFetch('/rest/v1/usuarios?email=eq.' + encodeURIComponent(email) + '&select=id,nombre,email');
    if (!users.length) {
      showToast('❌ Ese correo no está registrado');
      return;
    }
    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    _forgotState.email = email;
    _forgotState.code = code;
    _forgotState.codeExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
    _forgotState.userId = users[0].id;

    // Intentar enviar el correo con EmailJS si está disponible
    let emailSent = false;
    if (typeof emailjs !== 'undefined' && window.EMAILJS_CONFIG) {
      try {
        await emailjs.send(
          window.EMAILJS_CONFIG.serviceId,
          window.EMAILJS_CONFIG.templateId,
          {
            to_email: email,
            to_name: users[0].nombre,
            code: code,
            mensaje: 'Tu código de recuperación de contraseña es: ' + code + '. Es válido por 10 minutos.'
          }
        );
        emailSent = true;
      } catch(e) {
        console.error('EmailJS error:', e);
      }
    }

    // Avanzar al paso 2
    document.getElementById('forgot-email-display').textContent = email;
    document.getElementById('forgot-step-email').style.display = 'none';
    document.getElementById('forgot-step-code').style.display = 'block';
    document.getElementById('forgot-code').focus();

    if (emailSent) {
      showToast('📧 Código enviado a tu correo');
    } else {
      // Fallback: mostrar el código en consola/toast (modo desarrollo)
      showToast('🔑 Código (demo): ' + code);
      console.log('[Modo demo] Código de recuperación:', code);
    }
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  }
}

function verifyForgotCode() {
  const inputCode = document.getElementById('forgot-code').value.trim();
  if (inputCode.length !== 6) {
    showToast('⚠️ El código debe tener 6 dígitos');
    return;
  }
  if (Date.now() > _forgotState.codeExpires) {
    showToast('⏱ El código expiró. Solicita uno nuevo');
    return;
  }
  if (inputCode !== _forgotState.code) {
    showToast('❌ Código incorrecto');
    return;
  }
  // Avanzar al paso 3
  document.getElementById('forgot-step-code').style.display = 'none';
  document.getElementById('forgot-step-newpass').style.display = 'block';
  document.getElementById('forgot-newpass').focus();
  showToast('✅ Código verificado');
}

async function resetPassword() {
  const pass1 = document.getElementById('forgot-newpass').value;
  const pass2 = document.getElementById('forgot-newpass2').value;
  if (pass1.length < 6) {
    showToast('⚠️ La contraseña debe tener mínimo 6 caracteres');
    return;
  }
  if (pass1 !== pass2) {
    showToast('❌ Las contraseñas no coinciden');
    return;
  }
  if (!_forgotState.userId) {
    showToast('❌ Sesión de recuperación inválida');
    return;
  }
  try {
    await supaFetch('/rest/v1/usuarios?id=eq.' + _forgotState.userId, {
      method: 'PATCH',
      body: JSON.stringify({ password_hash: pass1 })
    });
    closeForgotPass();
    openModal('login');
    showToast('✅ Contraseña actualizada. Inicia sesión');
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  }
}

function setUser(user) {
  // Guardar en localStorage para persistir al refrescar
  try { localStorage.setItem('aca_user', JSON.stringify(user)); } catch(e) {}
  currentUser = user;
  const actions = document.getElementById('nav-actions');
  const nav = document.getElementById('main-nav');
  const color = nav.classList.contains('scrolled') ? 'var(--text-dark)' : '#fff';
  const rolU = user.rol || user.tipo || 'cliente';
  const adminBtn = (rolU === 'admin' || rolU === 'supervisor')
    ? `<button onclick="openAdmin()" style="background:${rolU==='admin'?'var(--orange)':'#F57C00'};border:none;color:#fff;padding:7px 16px;border-radius:100px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;margin-right:4px;">${rolU==='admin'?'⚙️ Admin':'🔍 Supervisor'}</button>`
    : '';
  const avatarContent = user.foto_perfil
    ? `<img src="${user.foto_perfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
    : `<span style="color:#fff;font-weight:700;font-size:14px;">${user.nombre[0].toUpperCase()}</span>`;
  actions.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;" id="profile-dropdown-wrapper">
      ${adminBtn}
      <div class="profile-dropdown">
        <div class="profile-trigger" onclick="toggleDropdown()">
          <div class="profile-avatar">${avatarContent}</div>
          <span class="profile-name" style="color:${color}">${user.nombre}</span>
          <span class="profile-caret" id="profile-caret" style="color:${color}">▾</span>
        </div>
        <div class="dropdown-menu" id="profile-dropdown-menu">
          <div class="dropdown-user-header">
            <strong>${user.nombre}</strong>
            <span>${user.email}</span>
          </div>
          <button class="dropdown-item" onclick="openProfileModal()">
            <span class="item-icon">👤</span> Actualizar perfil
          </button>
          <button class="dropdown-item" onclick="openMisPub()">
            <span class="item-icon">📋</span> Mis publicaciones
          </button>
          <button class="dropdown-item" onclick="closeDropdown();openMisCompras()">
            <span class="item-icon">🛍️</span> Mis compras
          </button>
          <button class="dropdown-item" onclick="closeDropdown();openMisVentas()" style="justify-content:space-between;">
            <span><span class="item-icon">📦</span> Mis ventas</span>
            <span id="nav-ventas-badge" style="display:none;background:rgba(0,128,128,.12);color:var(--teal);font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px;"></span>
          </button>
          <button class="dropdown-item" onclick="closeDropdown();showPage('acapoints')" style="justify-content:space-between;">
            <span><span class="item-icon">🪙</span> AcaPoints</span>
            <span id="nav-acapoints-badge" style="background:rgba(0,128,128,.12);color:var(--teal);font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px;">0</span>
          </button>
          <button class="dropdown-item" onclick="closeDropdown();openBilletera()">
            <span class="item-icon">💼</span> Mi Billetera
          </button>
          <button class="dropdown-item" onclick="openNotificaciones()" style="position:relative;">
            <span class="item-icon">🔔</span> Notificaciones
            <span class="notif-dot" id="notif-dot"></span>
          </button>
          <button class="dropdown-item" onclick="toggleTheme()" id="dropdown-theme-btn">
            <span class="item-icon" id="dropdown-theme-icon">${document.documentElement.getAttribute('data-theme')==='dark' ? '☀️' : '🌙'}</span>
            <span id="dropdown-theme-text">${document.documentElement.getAttribute('data-theme')==='dark' ? 'Tema claro' : 'Tema oscuro'}</span>
          </button>
          ${user.tipo === 'admin' ? `<div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick="closeDropdown();openAdmin()">
            <span class="item-icon">⚙️</span> Panel de Admin
          </button>` : ''}
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" onclick="logout()">
            <span class="item-icon">🚪</span> Cerrar sesión
          </button>
        </div>
      </div>
    </div>`;
  if (user.tipo === 'admin') loadPendingCount();
  loadNotifCount();
}

function logout() {
  currentUser = null;
  userAcaPoints = 0;
  try { localStorage.removeItem('aca_user'); } catch(e) {}
  document.getElementById('nav-actions').innerHTML = `
    <button class="btn-login" onclick="openModal('login')">Iniciar Sesión</button>
    <button class="btn-register" onclick="openModal('register')">Registrarse</button>`;
  showToast('Sesión cerrada');
}

async function deleteService(e, id) {
  e.stopPropagation();
  if (!currentUser) { showToast('Debes iniciar sesión'); return; }
  if (!confirm('¿Seguro que quieres eliminar esta publicación?')) return;
  try {
    await supaFetch('/rest/v1/servicios?id=eq.' + id + '&usuario_id=eq.' + currentUser.id, {
      method: 'PATCH',
      body: JSON.stringify({ activo: false })
    });
    allServices = allServices.filter(s => s.id !== id);
    renderCards();
    showToast('✅ Publicación eliminada');
  } catch(e) {
    showToast('❌ No se pudo eliminar: ' + e.message);
  }
}






// ═══════════════════════════════════════════════
//  DROPDOWN PERFIL
// ═══════════════════════════════════════════════
let avatarFileToUpload = null;

function toggleDropdown() {
  const menu = document.getElementById('profile-dropdown-menu');
  const caret = document.getElementById('profile-caret');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  menu.classList.toggle('open', !isOpen);
  caret.classList.toggle('open', !isOpen);
}

function closeDropdown() {
  const menu  = document.getElementById('profile-dropdown-menu');
  const caret = document.getElementById('profile-caret');
  if (menu)  menu.classList.remove('open');
  if (caret) caret.classList.remove('open');
}

// ═══════════════════════════════════════════════
//  NOTIFICACIONES
// ═══════════════════════════════════════════════

// ── Crear notificación de pago (localStorage + Supabase best-effort) ──
function localNotifKey() { return 'aca_notif_' + (currentUser?.id || 'guest'); }

function localNotifAdd(notif) {
  try {
    const list = JSON.parse(localStorage.getItem(localNotifKey()) || '[]');
    list.unshift({ ...notif, id: 'local_' + Date.now(), leida: false, creado_en: new Date().toISOString() });
    localStorage.setItem(localNotifKey(), JSON.stringify(list.slice(0, 50)));
  } catch(e) {}
}

function localNotifGetAll() {
  try { return JSON.parse(localStorage.getItem(localNotifKey()) || '[]'); } catch(e) { return []; }
}

function localNotifMarkRead(id) {
  try {
    const list = JSON.parse(localStorage.getItem(localNotifKey()) || '[]');
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) { list[idx].leida = true; localStorage.setItem(localNotifKey(), JSON.stringify(list)); }
  } catch(e) {}
}

function localNotifMarkAllRead() {
  try {
    const list = JSON.parse(localStorage.getItem(localNotifKey()) || '[]');
    list.forEach(n => n.leida = true);
    localStorage.setItem(localNotifKey(), JSON.stringify(list));
  } catch(e) {}
}

async function crearNotifPago(titulo, mensaje, tipo) {
  // 1. Guardar local siempre
  localNotifAdd({ titulo, mensaje, tipo });
  // 2. Actualizar punto rojo inmediatamente
  const dot = document.getElementById('notif-dot');
  if (dot) dot.classList.add('visible');
  // 3. Intentar guardar en Supabase (best-effort)
  try {
    await supaFetch('/rest/v1/notificaciones', {
      method: 'POST',
      body: JSON.stringify({ usuario_id: currentUser.id, titulo, mensaje, tipo, leida: false })
    });
  } catch(e) { /* silencioso */ }
}

async function loadNotifCount() {
  if (!currentUser) return;
  // Contar locales no leídas
  const localUnread = localNotifGetAll().filter(n => !n.leida).length;
  const dot = document.getElementById('notif-dot');
  if (localUnread > 0) { if (dot) dot.classList.add('visible'); return; }
  // Si no hay locales, revisar Supabase
  try {
    const data = await supaFetch(
      '/rest/v1/notificaciones?usuario_id=eq.' + currentUser.id + '&leida=eq.false&select=id'
    );
    if (dot) dot.classList.toggle('visible', data.length > 0);
  } catch(e) { if (dot) dot.classList.remove('visible'); }
}

function openNotificaciones() {
  closeDropdown();
  document.getElementById('notif-overlay').classList.add('open');
  renderNotifList();
}

function closeNotificaciones() {
  document.getElementById('notif-overlay').classList.remove('open');
}

async function renderNotifList() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>';
  if (!currentUser) return;

  // Notifs locales (pagos, AcaPoints) — siempre disponibles
  const locales = localNotifGetAll().map(n => ({ ...n, _local: true }));

  // Notifs de Supabase (aprobaciones admin) — best-effort
  let remotas = [];
  try {
    remotas = await supaFetch(
      '/rest/v1/notificaciones?usuario_id=eq.' + currentUser.id +
      '&order=creado_en.desc&limit=30'
    ) || [];
  } catch(e) {}

  // Merge: remotas primero, luego locales, ordenadas por fecha
  const todas = [...remotas, ...locales].sort((a, b) =>
    new Date(b.creado_en) - new Date(a.creado_en)
  ).slice(0, 40);

  if (!todas.length) {
    list.innerHTML = '<div class="notif-empty"><div class="icon">🔔</div><p>Sin notificaciones por ahora</p></div>';
    return;
  }

  const iconosTipo = {
    activo: '✅', rechazado: '❌',
    pago_efectivo: '💵', pago_tarjeta: '💳', pago_acapoints: '🪙',
    compra_acapoints: '🪙'
  };
  const clasesTipo = {
    activo: 'accepted', rechazado: 'rejected',
    pago_efectivo: 'payment', pago_tarjeta: 'payment', pago_acapoints: 'payment',
    compra_acapoints: 'payment'
  };

  list.innerHTML = todas.map(n => {
    const icono = iconosTipo[n.tipo] || '🔔';
    const clase = clasesTipo[n.tipo] || 'accepted';
    const fecha = timeAgo(n.creado_en);
    const onclk = n._local
      ? `marcarLeidaLocal('${n.id}', this)`
      : `marcarLeida('${n.id}', this)`;
    return `
      <div class="notif-item ${n.leida ? '' : 'unread'}" onclick="${onclk}">
        <div class="notif-icon ${clase}">${icono}</div>
        <div class="notif-body">
          <div class="notif-title">${n.titulo}</div>
          <div class="notif-desc">${n.mensaje}</div>
          <div class="notif-time">${fecha}</div>
        </div>
        ${n.leida ? '' : '<div class="notif-unread-dot"></div>'}
      </div>`;
  }).join('');

  const dot = document.getElementById('notif-dot');
  if (dot) dot.classList.toggle('visible', todas.some(n => !n.leida));
}

function marcarLeidaLocal(id, el) {
  el.classList.remove('unread');
  const dot = el.querySelector('.notif-unread-dot');
  if (dot) dot.remove();
  localNotifMarkRead(id);
  loadNotifCount();
}

async function marcarLeida(id, el) {
  el.classList.remove('unread');
  const dot = el.querySelector('.notif-unread-dot');
  if (dot) dot.remove();
  try {
    await supaFetch('/rest/v1/notificaciones?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ leida: true })
    });
    loadNotifCount();
  } catch(e) {}
}

async function marcarTodasLeidas() {
  if (!currentUser) return;
  document.querySelectorAll('.notif-item.unread').forEach(el => {
    el.classList.remove('unread');
    const dot = el.querySelector('.notif-unread-dot');
    if (dot) dot.remove();
  });
  const dotEl = document.getElementById('notif-dot');
  if (dotEl) dotEl.classList.remove('visible');
  localNotifMarkAllRead();
  try {
    await supaFetch('/rest/v1/notificaciones?usuario_id=eq.' + currentUser.id + '&leida=eq.false', {
      method: 'PATCH', body: JSON.stringify({ leida: true })
    });
  } catch(e) {}
}

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Justo ahora';
  if (mins < 60)  return 'Hace ' + mins + ' min';
  if (hours < 24) return 'Hace ' + hours + 'h';
  if (days < 7)   return 'Hace ' + days + (days === 1 ? ' día' : ' días');
  return new Date(isoDate).toLocaleDateString('es-MX');
}

// ─── MENÚ MÓVIL ───
function initMobileNav() {
  const burger = document.getElementById('hamburger');
  if (!burger) return;
  const show = () => window.innerWidth <= 768;
  const toggle = () => { burger.style.display = show() ? 'flex' : 'none'; };
  toggle();
  window.addEventListener('resize', toggle);
}

function toggleMobileMenu() {
  const nav  = document.getElementById('main-nav');
  const menu = document.getElementById('nav-mobile-menu');
  const open = nav.classList.toggle('nav-mobile-open');
  menu.style.display = open ? 'block' : 'none';
  document.body.style.overflow = open ? 'hidden' : '';
}

function closeMobileMenu() {
  document.getElementById('main-nav').classList.remove('nav-mobile-open');
  const menu = document.getElementById('nav-mobile-menu');
  if (menu) menu.style.display = 'none';
  document.body.style.overflow = '';
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', function(e) {
  const nav  = document.getElementById('main-nav');
  const menu = document.getElementById('nav-mobile-menu');
  if (menu && nav && !nav.contains(e.target) && !menu.contains(e.target)) {
    closeMobileMenu();
  }
});

document.addEventListener('click', function(e) {
  const dd = document.getElementById('profile-dropdown-wrapper');
  if (dd && !dd.contains(e.target)) {
    const menu = document.getElementById('profile-dropdown-menu');
    const caret = document.getElementById('profile-caret');
    if (menu) menu.classList.remove('open');
    if (caret) caret.classList.remove('open');
  }
});

// ─── EDITAR PERFIL ──────────────────────────────
function openProfileModal() {
  const menu = document.getElementById('profile-dropdown-menu');
  if (menu) menu.classList.remove('open');
  if (!currentUser) return;

  // Llenar formulario con datos actuales
  document.getElementById('profile-nombre').value   = currentUser.nombre || '';
  document.getElementById('profile-email').value    = currentUser.email  || '';
  const tel = (currentUser.telefono || '').replace('+52','').replace(/\D/g,'');
  document.getElementById('profile-telefono').value = tel;

  // Avatar actual
  const preview = document.getElementById('avatar-big-preview');
  const letter  = document.getElementById('avatar-big-letter');
  if (currentUser.foto_perfil) {
    letter.innerHTML = `<img src="${currentUser.foto_perfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
  } else {
    letter.textContent = currentUser.nombre[0].toUpperCase();
  }
  avatarFileToUpload = null;
  document.getElementById('profile-modal-overlay').classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profile-modal-overlay').classList.remove('open');
  avatarFileToUpload = null;
}

function previewAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { showToast('⚠️ La foto no puede superar 3MB'); return; }
  avatarFileToUpload = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('avatar-big-letter').innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  if (!currentUser) return;
  const nombre = document.getElementById('profile-nombre').value.trim();
  const tel    = document.getElementById('profile-telefono').value.trim();
  if (!nombre) { showToast('⚠️ El nombre no puede estar vacío'); return; }

  const btn = document.querySelector('#profile-modal-overlay .btn-publish');
  btn.textContent = 'Guardando...'; btn.disabled = true;

  try {
    let fotoURL = currentUser.foto_perfil || null;

    // Subir nueva foto si seleccionó una
    if (avatarFileToUpload) {
      fotoURL = await uploadToStorage(avatarFileToUpload, 'avatares');
    }

    const payload = { nombre, foto_perfil: fotoURL };
    if (tel) payload.telefono = '+52' + tel.replace(/\D/g,'');

    await supaFetch('/rest/v1/usuarios?id=eq.' + currentUser.id, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    // Actualizar estado local
    currentUser = { ...currentUser, ...payload };
    try { localStorage.setItem('aca_user', JSON.stringify(currentUser)); } catch(e) {}
    setUser(currentUser);
    closeProfileModal();
    showToast('✅ Perfil actualizado');
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    btn.textContent = 'Guardar Cambios'; btn.disabled = false;
  }
}

// ─── MIS PUBLICACIONES ──────────────────────────
async function openMisPub() {
  const menu = document.getElementById('profile-dropdown-menu');
  if (menu) menu.classList.remove('open');
  if (!currentUser) return;
  document.getElementById('mispub-modal-overlay').classList.add('open');
  document.getElementById('mispub-content').innerHTML =
    '<div class="loading-state"><div class="spinner"></div><p>Cargando tus publicaciones...</p></div>';
  try {
    const pubs = await supaFetch(
      '/rest/v1/servicios?usuario_id=eq.' + currentUser.id + '&order=creado_en.desc&select=*'
    );
    renderMisPub(pubs);
  } catch(e) {
    document.getElementById('mispub-content').innerHTML =
      '<div class="mispub-empty">Error al cargar tus publicaciones.</div>';
  }
}

function closeMisPub() {
  document.getElementById('mispub-modal-overlay').classList.remove('open');
}

function verMisPub(s) {
  // Si el servicio está activo, lo abrimos en el detalle normal
  if (s.estado === 'activo') {
    closeMisPub();
    showPage('marketplace');
    // Esperamos a que carguen los servicios y luego abrimos el detalle
    const tryOpen = setInterval(() => {
      const found = allServices.find(x => x.id === s.id);
      if (found) { clearInterval(tryOpen); openDetail(found); }
    }, 300);
    setTimeout(() => clearInterval(tryOpen), 5000);
  } else {
    // Si está pendiente/rechazado, mostramos un detalle simplificado
    closeMisPub();
    const img = s.imagen_url || PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios;
    const estadoLabel = s.estado === 'pendiente' ? '⏳ En revisión' : '❌ Rechazado';
    alert('📋 ' + s.titulo + '\n\n' + estadoLabel + '\n\n' + (s.descripcion || '') + '\n\n$' + Number(s.precio).toLocaleString('es-MX') + ' / ' + s.precio_tipo);
  }
}

function abrirEditPub(s) {
  document.getElementById('edit-pub-id').value      = s.id;
  document.getElementById('edit-titulo').value      = s.titulo || '';
  document.getElementById('edit-desc').value        = s.descripcion || '';
  document.getElementById('edit-precio').value      = s.precio || '';
  document.getElementById('edit-precio-tipo').value = s.precio_tipo || 'precio fijo';
  document.getElementById('edit-ubicacion').value   = s.ubicacion || '';
  document.getElementById('edit-maps-url').value    = s.maps_url || '';
  document.getElementById('edit-pub-overlay').classList.add('open');
}

function closeEditPub() {
  document.getElementById('edit-pub-overlay').classList.remove('open');
}

async function saveEditPub() {
  const id      = document.getElementById('edit-pub-id').value;
  const titulo  = document.getElementById('edit-titulo').value.trim();
  const desc    = document.getElementById('edit-desc').value.trim();
  const precio  = parseFloat(document.getElementById('edit-precio').value);
  const pTipo   = document.getElementById('edit-precio-tipo').value;
  const ubic    = document.getElementById('edit-ubicacion').value;
  const mapsUrl = (document.getElementById('edit-maps-url').value || '').trim();

  if (!titulo || !desc || !precio || !ubic) {
    showToast('⚠️ Completa todos los campos requeridos'); return;
  }

  const payload = {
    titulo, descripcion: desc, precio, precio_tipo: pTipo, ubicacion: ubic,
    maps_url: mapsUrl || null,
    estado: 'pendiente', activo: false
  };

  const btn = document.querySelector('#edit-pub-overlay .btn-publish');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  try {
    await supaFetch('/rest/v1/servicios?id=eq.' + id + '&usuario_id=eq.' + currentUser.id, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    showToast('✅ Cambios guardados. Tu publicación quedó en revisión.');
    closeEditPub();
    openMisPub();
  } catch(e) {
    showToast('❌ Error al guardar: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '💾 Guardar cambios'; btn.disabled = false; }
  }
}

// Mapa en memoria para evitar JSON en atributos onclick
const _misPubMap = {};

function renderMisPub(pubs) {
  var el = document.getElementById('mispub-content');
  if (!pubs.length) {
    el.innerHTML = '<div class="mispub-empty">&#128505; Aún no tienes publicaciones.<br><br><button class="btn-publish" style="width:auto;padding:12px 28px;" onclick="closeMisPub();showPage(&quot;publish&quot;)">Publicar ahora</button></div>';
    return;
  }

  // Guardar objetos en el mapa usando su id
  pubs.forEach(function(s) { _misPubMap[s.id] = s; });

  var html = '<div class="mispub-grid">';
  pubs.forEach(function(s) {
    var img    = s.imagen_url || PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios;
    var precio = '$' + Number(s.precio).toLocaleString('es-MX');
    var estado = s.estado === 'activo'
      ? '<span class="mispub-estado activo">&#9989; Activo</span>'
      : s.estado === 'pendiente'
        ? '<span class="mispub-estado pendiente">&#9203; En revisión</span>'
        : '<span class="mispub-estado rechazado">&#10060; Rechazado</span>';

    html += `
      <div class="mispub-card">
        <img src="${img}" style="width:100%;height:130px;object-fit:cover;display:block;cursor:pointer;" alt=""
             onclick="_verMisPubById(${s.id})">
        <div class="mispub-card-body">
          <h4>${s.titulo}</h4>
          <div style="font-size:12px;color:var(--text-light);">${precio} &middot; ${catLabel(s.categoria)}</div>
          ${estado}
          <div class="mispub-card-actions" style="margin-top:10px;">
            <button class="btn-mispub-ver"  onclick="_verMisPubById(${s.id})">👁 Ver</button>
            <button class="btn-mispub-edit" onclick="_editMisPubById(${s.id})">✏️ Editar</button>
          </div>
          <button onclick="_deleteMisPubById(${s.id})"
            style="margin-top:8px;background:none;border:1px solid #FFCDD2;color:#E53935;border-radius:100px;
                   padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;width:100%;
                   font-family:'DM Sans',sans-serif;transition:all .18s;"
            onmouseover="this.style.background='#E53935';this.style.color='#fff';"
            onmouseout="this.style.background='none';this.style.color='#E53935';">
            🗑️ Eliminar
          </button>
        </div>
      </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function _verMisPubById(id) {
  const s = _misPubMap[id];
  if (s) verMisPub(s);
}

function _editMisPubById(id) {
  const s = _misPubMap[id];
  if (s) abrirEditPub(s);
}

function _deleteMisPubById(id) {
  confirmDeleteMisPub(id);
}

async function confirmDeleteMisPub(id) {
  const s = _misPubMap[id];
  const nombre = s ? s.titulo : 'esta publicación';
  if (!confirm('¿Eliminar "' + nombre + '"?\nEsta acción no se puede deshacer.')) return;
  try {
    await supaFetch('/rest/v1/servicios?id=eq.' + id + '&usuario_id=eq.' + currentUser.id, {
      method: 'DELETE'
    });
    showToast('🗑️ Publicación eliminada');
    delete _misPubMap[id];
    openMisPub(); // refresca la lista
  } catch(e) {
    showToast('❌ Error al eliminar: ' + e.message);
  }
}


// ═══════════════════════════════════════════════
//  RESEÑAS — cargar desde Supabase
// ═══════════════════════════════════════════════
let selectedStars = 0;

async function loadResenas(servicioId) {
  const list = document.getElementById('resenas-list');
  const formArea = document.getElementById('resena-form-area');
  list.innerHTML = '<div class="resenas-empty">Cargando reseñas...</div>';

  // Renderizar formulario o prompt de login
  if (currentUser) {
    formArea.innerHTML = `
      <div class="write-resena">
        <h4>Escribe tu reseña</h4>
        <div class="star-picker" id="star-picker">
          ${[1,2,3,4,5].map(n => `<span class="star-pick" data-val="${n}" onclick="pickStar(${n})">★</span>`).join('')}
        </div>
        <textarea class="resena-textarea" id="resena-texto" placeholder="Cuéntanos tu experiencia…" maxlength="500"></textarea>
        <button class="btn-send-resena" id="btn-send-resena" onclick="submitResena(${servicioId})">Publicar reseña</button>
      </div>`;
    selectedStars = 0;
  } else {
    formArea.innerHTML = `
      <div class="login-prompt">
        <p>Inicia sesión para dejar una reseña</p>
        <button class="btn-login-resena" onclick="openModal('login')">Iniciar sesión</button>
      </div>`;
  }

  try {
    const resenas = await supaFetch(
      '/rest/v1/resenas?servicio_id=eq.' + servicioId +
      '&aprobada=eq.true&select=*,usuarios(nombre)&order=creado_en.desc'
    );
    renderResenas(resenas, servicioId);
  } catch(e) {
    list.innerHTML = '<div class="resenas-empty">No se pudieron cargar las reseñas.</div>';
  }
}

function renderResenas(resenas, servicioId) {
  const list    = document.getElementById('resenas-list');
  const summary = document.getElementById('resenas-summary');

  if (!resenas.length) {
    summary.style.display = 'none';
    list.innerHTML = '<div class="resenas-empty">Aún no hay reseñas. ¡Sé el primero en opinar!</div>';
    return;
  }

  // Calcular promedio y distribución
  const total  = resenas.length;
  const avg    = resenas.reduce((a, r) => a + r.estrellas, 0) / total;
  const dist   = [5,4,3,2,1].map(n => ({ n, count: resenas.filter(r => r.estrellas === n).length }));

  summary.style.display = 'flex';
  document.getElementById('resena-avg').textContent      = avg.toFixed(1);
  document.getElementById('resena-avg-stars').innerHTML  = starsHTML(avg);
  document.getElementById('resena-total').textContent    = total + ' reseña' + (total !== 1 ? 's' : '');
  document.getElementById('resena-dist').innerHTML = dist.map(d => `
    <div class="dist-bar-row">
      <span class="dist-label">${d.n}</span>
      <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${total ? (d.count/total*100) : 0}%"></div></div>
      <span class="dist-count">${d.count}</span>
    </div>`).join('');

  list.innerHTML = resenas.map(r => {
    const nombre = (r.usuarios && r.usuarios.nombre) || 'Usuario';
    const fecha  = new Date(r.creado_en).toLocaleDateString('es-MX', {year:'numeric',month:'long',day:'numeric'});
    return `
    <div class="resena-item">
      <div class="resena-top">
        <div class="resena-avatar">${nombre[0].toUpperCase()}</div>
        <span class="resena-autor">${nombre}</span>
        <span class="resena-fecha">${fecha}</span>
      </div>
      <div class="resena-stars">${starsHTML(r.estrellas)}</div>
      ${r.comentario ? '<p class="resena-texto">' + r.comentario + '</p>' : ''}
    </div>`;
  }).join('');
}

function pickStar(n) {
  selectedStars = n;
  document.querySelectorAll('.star-pick').forEach(s => {
    s.classList.toggle('selected', parseInt(s.dataset.val) <= n);
  });
}

async function submitResena(servicioId) {
  if (!currentUser) { openModal('login'); return; }
  if (!selectedStars) { showToast('⚠️ Selecciona una calificación en estrellas'); return; }

  const comentario = (document.getElementById('resena-texto').value || '').trim();
  const btn = document.getElementById('btn-send-resena');
  btn.disabled = true;
  btn.textContent = 'Publicando...';

  try {
    await supaFetch('/rest/v1/resenas', {
      method: 'POST',
      body: JSON.stringify({
        servicio_id: servicioId,
        usuario_id:  currentUser.id,
        estrellas:   selectedStars,
        comentario:  comentario || null,
        aprobada:    true
      })
    });

    // Recalcular promedio en la tabla servicios
    const todas = await supaFetch('/rest/v1/resenas?servicio_id=eq.' + servicioId + '&aprobada=eq.true&select=estrellas');
    const avg   = todas.reduce((a,r) => a + r.estrellas, 0) / todas.length;
    await supaFetch('/rest/v1/servicios?id=eq.' + servicioId, {
      method: 'PATCH',
      body: JSON.stringify({ promedio_estrellas: parseFloat(avg.toFixed(2)), total_resenas: todas.length })
    });

    showToast('✅ ¡Gracias por tu reseña!');
    loadResenas(servicioId);
  } catch(e) {
    if (e.message.includes('duplicate') || e.message.includes('unique')) {
      showToast('⚠️ Ya dejaste una reseña para este servicio');
    } else {
      showToast('❌ Error: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = 'Publicar reseña';
  }
}

// ═══════════════════════════════════════════════
//  MODAL DETALLE SERVICIO
// ═══════════════════════════════════════════════
let currentDetail = null;

function openDetailByIdx(idx) {
  const s = filteredServices[idx];
  if (s) openDetail(s);
}

function openDetail(s) {
  trackEvento('vista_servicio', 'marketplace', s.id);
  currentDetail = s;
  const overlay = document.getElementById('detail-overlay');

  // Galería
  const allImgs = [s.imagen_url || PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios];
  const extras  = Array.isArray(s.fotos_extra) ? s.fotos_extra.filter(Boolean) : [];
  extras.forEach(u => allImgs.push(u));

  document.getElementById('detail-main-img').src = allImgs[0];
  const thumbsEl = document.getElementById('detail-thumbs');
  if (allImgs.length > 1) {
    thumbsEl.style.display = 'flex';
    thumbsEl.innerHTML = allImgs.map((u, i) =>
      `<img class="detail-thumb ${i===0?'active':''}" src="${u}" onclick="switchDetailImg(this,'${u}')" alt="foto ${i+1}"/>`
    ).join('');
  } else {
    thumbsEl.style.display = 'none';
  }

  // Info
  document.getElementById('detail-cat-badge').innerHTML   = '🏷️ ' + catLabel(s.categoria);
  document.getElementById('detail-title').textContent      = s.titulo;
  document.getElementById('detail-stars').innerHTML        = starsHTML(s.promedio_estrellas || 0);
  document.getElementById('detail-rating-num').textContent = s.promedio_estrellas ? Number(s.promedio_estrellas).toFixed(1) : '';
  document.getElementById('detail-reviews').textContent    = s.total_resenas ? '(' + s.total_resenas + ' reseñas)' : 'Sin reseñas aún';
  document.getElementById('detail-desc').textContent       = s.descripcion;
  document.getElementById('detail-loc-text').textContent   = s.ubicacion;
  // Botón de Google Maps — solo si el servicio tiene URL
  const mapsLink = document.getElementById('detail-maps-link');
  const mapsA    = document.getElementById('detail-maps-a');
  if (s.maps_url && mapsLink && mapsA) {
    mapsA.href = s.maps_url;
    mapsLink.style.display = 'block';
  } else if (mapsLink) {
    mapsLink.style.display = 'none';
  }
  const priceEl = document.getElementById('detail-price');
  const typEl   = document.getElementById('detail-price-type');
  if (esPrecioVariable(s.precio_tipo)) {
    priceEl.textContent = '💵 A convenir';
    priceEl.style.fontSize = '22px';
    typEl.textContent = 'El precio varía según lo que consumas';
    typEl.style.color = '#888';
  } else if (esRangoPrecio(s.precio_tipo)) {
    priceEl.textContent = s.precio_tipo;
    priceEl.style.fontSize = '';
    typEl.textContent = '';
  } else {
    priceEl.textContent = '$' + Number(s.precio).toLocaleString('es-MX');
    priceEl.style.fontSize = '';
    typEl.textContent = 'Por ' + s.precio_tipo;
  }
  document.getElementById('detail-cat-label-sim').textContent = catLabel(s.categoria);

  // Proveedor
  const prov = (s.usuarios && s.usuarios.nombre) || s.proveedor_nombre || 'Proveedor';
  document.getElementById('detail-provider').innerHTML = `
    <div class="detail-provider-avatar">${prov[0].toUpperCase()}</div>
    <div class="detail-provider-info">
      <strong>${prov}</strong>
      <span>Proveedor verificado</span>
    </div>`;

  // Similares
  const similares = allServices.filter(x => x.categoria === s.categoria && x.id !== s.id).slice(0, 4);
  const simGrid = document.getElementById('similares-grid');
  simGrid.innerHTML = similares.length ? similares.map(x => `
    <div class="sim-card" onclick="openSimilar(${allServices.indexOf(x)})">
      <img src="${x.imagen_url || PLACEHOLDER_IMGS[x.categoria]}" alt="${x.titulo}"
           onerror="this.src='${PLACEHOLDER_IMGS.servicios}'"/>
      <div class="sim-card-body">
        <h4>${x.titulo}</h4>
        <div class="sim-card-price">$${Number(x.precio).toLocaleString('es-MX')} <span style="font-weight:400;color:var(--text-light);font-size:12px;">/ ${x.precio_tipo}</span></div>
        <div class="sim-card-loc">📍 ${x.ubicacion}</div>
      </div>
    </div>`).join('') 
    : '<p style="color:var(--text-light);font-size:14px;">No hay más servicios en esta categoría por ahora.</p>';

  overlay.classList.add('open');
  overlay.scrollTop = 0; // resetear scroll del overlay al abrir
  // En iOS, overflow:hidden en body no funciona solo — usamos position:fixed
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.cssText = 'overflow:hidden;position:fixed;top:-' + window.scrollY + 'px;width:100%;';
  } else {
    document.body.style.overflow = 'hidden';
  }
  loadResenas(s.id);
}

function switchDetailImg(thumb, url) {
  document.getElementById('detail-main-img').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('detail-main-img').src = url;
    document.getElementById('detail-main-img').style.opacity = '1';
  }, 200);
  document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  // Restaurar scroll iOS
  const scrollY = document.body.dataset.scrollY;
  document.body.style.cssText = '';
  if (scrollY !== undefined) window.scrollTo(0, parseInt(scrollY) || 0);
}

function closeDetailOutside(e) {
  if (e.target === document.getElementById('detail-overlay')) closeDetail();
}

function filterByCatAndClose() {
  if (!currentDetail) return;
  closeDetail();
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === currentDetail.categoria);
  });
  activePill = currentDetail.categoria;
  showPage('marketplace');
  renderCards();
}

async function contactProvider() {
  if (currentDetail) trackEvento('click_contacto', 'marketplace', currentDetail.id);
  if (!currentDetail) return;

  // Prioridad: 1) WhatsApp propio de la publicación, 2) teléfono del perfil del proveedor
  const pubWa  = (currentDetail.contacto_whatsapp || '').replace(/\D/g,'');
  const u      = currentDetail.usuarios;
  const perfil = u && u.telefono ? u.telefono.replace(/\D/g,'') : null;
  let tel      = pubWa || perfil || null;

  if (!tel || tel.length < 10) {
    showToast('💬 Este proveedor aún no tiene WhatsApp registrado');
    return;
  }

  // Asegurar formato internacional México
  if (tel.length === 10) tel = '52' + tel;
  if (tel.startsWith('+')) tel = tel.slice(1);

  const msg = encodeURIComponent(
    '¡Hola! Vi tu servicio "' + currentDetail.titulo + '" en AcaConnect y me interesa. ¿Puedes darme más información?'
  );
  window.open('https://wa.me/' + tel + '?text=' + msg, '_blank');
}

async function shareService() {
  if (!currentDetail) return;
  const text = 'Mira este servicio en AcaConnect: ' + currentDetail.titulo + ' - ' + window.location.href;
  if (navigator.share) {
    navigator.share({ title: currentDetail.titulo, text, url: window.location.href });
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('🔗 Enlace copiado al portapapeles'));
  }
}

// ═══════════════════════════════════════════════
//  UPLOAD DE FOTOS — Supabase Storage
// ═══════════════════════════════════════════════
let mainPhotoFile   = null;
let mainPhotoURL    = null;
let extraPhotoFiles = [null, null, null, null];
let extraPhotoURLs  = [null, null, null, null];

function handleDrag(e, id)      { e.preventDefault(); document.getElementById(id).classList.add('dragover'); }
function handleDragLeave(e, id) { document.getElementById(id).classList.remove('dragover'); }
function handleDrop(e, type, idx) {
  e.preventDefault();
  const id = type === 'main' ? 'main-drop' : 'slot-' + idx;
  document.getElementById(id).classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file, type, idx);
}
function handleFileSelect(input, type, idx) {
  const file = input.files[0];
  if (file) processFile(file, type, idx);
}

function processFile(file, type, idx) {
  if (!file.type.startsWith('image/')) { showToast('⚠️ Solo se aceptan imágenes'); return; }
  if (file.size > 5 * 1024 * 1024)    { showToast('⚠️ La imagen no puede superar 5MB'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    if (type === 'main') {
      mainPhotoFile = file;
      const grid = document.getElementById('preview-main');
      grid.innerHTML = `
        <div class="foto-preview-item">
          <img src="${e.target.result}" alt="preview"/>
          <span class="main-badge">Principal</span>
          <button class="btn-rm" onclick="removeMain()">×</button>
        </div>`;
      document.getElementById('main-drop').style.display = 'none';
    } else {
      extraPhotoFiles[idx] = file;
      const slot = document.getElementById('slot-' + idx);
      slot.innerHTML = `
        <img src="${e.target.result}" alt="extra"/>
        <button class="btn-rm-extra" onclick="removeExtra(${idx})">×</button>`;
    }
  };
  reader.readAsDataURL(file);
}

function removeMain() {
  mainPhotoFile = null; mainPhotoURL = null;
  document.getElementById('preview-main').innerHTML = '';
  document.getElementById('main-drop').style.display = '';
}
function removeExtra(idx) {
  extraPhotoFiles[idx] = null; extraPhotoURLs[idx] = null;
  const slot = document.getElementById('slot-' + idx);
  slot.innerHTML = `<input type="file" accept="image/*" onchange="handleFileSelect(this,'extra',${idx})"/><span class="plus">+</span>`;
}

async function uploadToStorage(file, folder) {
  const ext  = file.name.split('.').pop();
  const name = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
  const res  = await fetch(SUPA_URL + '/storage/v1/object/servicios/' + name, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': file.type },
    body: file
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || 'Error subiendo imagen'); }
  return SUPA_URL + '/storage/v1/object/public/servicios/' + name;
}

function setProgress(pct) {
  const prog = document.getElementById('prog-main');
  const bar  = document.getElementById('progbar-main');
  if (!prog || !bar) return;
  prog.style.display = pct > 0 ? 'block' : 'none';
  bar.style.width = pct + '%';
}

// ═══════════════════════════════════════════════
//  PANEL ADMIN
// ═══════════════════════════════════════════════
let adminTabActual = 'pendientes';

async function loadPendingCount() {
  try {
    const data = await supaFetch('/rest/v1/servicios?select=id&estado=eq.pendiente');
    const badge = document.getElementById('admin-badge');
    if (badge) badge.textContent = data.length;
  } catch(e) {}
}

async function openAdmin() {
  if (!currentUser || !tieneRol(['admin','supervisor'])) {
    showToast('Solo administradores pueden acceder'); return;
  }
  document.getElementById('admin-panel').classList.add('open');
  adminTabActual = 'pendientes';
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'pendientes'));
  loadAdminList('pendientes');
  // Badge de verificaciones pendientes
  supaFetch('/rest/v1/datos_vendedor?estado=eq.pendiente&select=id').then(d => {
    const n = (d||[]).length;
    const tabEl = document.getElementById('tab-verificaciones');
    if (tabEl && n > 0) tabEl.innerHTML = `🪪 Verificaciones <span style="background:#E53935;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-left:4px;">${n}</span>`;
  }).catch(()=>{});
  loadMsgBadge();
  purgeExpiredRejected(); // eliminar rechazados expirados al abrir
}

function closeAdmin() {
  document.getElementById('admin-panel').classList.remove('open');
  if (_cdInterval) { clearInterval(_cdInterval); _cdInterval = null; }
}
function closeAdminOutside(e) { if (e.target === document.getElementById('admin-panel')) closeAdmin(); }

async function switchAdminTab(el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  adminTabActual = el.dataset.tab;
  loadAdminList(adminTabActual);
}

async function loadAdminList(tab) {
  const list = document.getElementById('admin-list');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>';
  try {
    if (tab === 'usuarios') {
      const users = await supaFetch('/rest/v1/usuarios?select=*&order=creado_en.desc');
      renderAdminUsers(users);
    } else if (tab === 'mensajes') {
      const msgs = await supaFetch('/rest/v1/mensajes_contacto?select=*&order=creado_en.desc');
      renderAdminMensajes(msgs);
    } else if (tab === 'ganancias') {
      renderAdminGanancias();
      return;
    } else if (tab === 'roles') {
      await renderAdminRoles();
      return;
    } else if (tab === 'verificaciones') {
      await renderAdminVerificaciones();
      return;
    } else if (tab === 'analytics') {
      await renderAdminAnalytics();
      return;
    } else {
      const estado = tab === 'pendientes' ? 'pendiente' : tab === 'activos' ? 'activo' : 'rechazado';
      const data = await supaFetch('/rest/v1/servicios?select=*&estado=eq.' + estado + '&order=creado_en.desc');
      renderAdminCards(data, tab);
    }
  } catch(e) {
    list.innerHTML = '<div class="admin-empty"><div class="icon">⚠️</div><p>Error al cargar: ' + e.message + '</p></div>';
  }
}

// ─── MENSAJES CONTACTO (Admin) ───
async function loadMsgBadge() {
  try {
    const data = await supaFetch('/rest/v1/mensajes_contacto?leido=eq.false&select=id');
    const badge = document.getElementById('msg-badge');
    if (badge) {
      if (data.length > 0) {
        badge.textContent = data.length;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch(e) {}
}

function renderAdminMensajes(msgs) {
  const list = document.getElementById('admin-list');
  // Actualizar badge
  const noLeidos = msgs.filter(m => !m.leido).length;
  const badge = document.getElementById('msg-badge');
  if (badge) { badge.textContent = noLeidos; badge.style.display = noLeidos > 0 ? 'inline' : 'none'; }

  if (!msgs.length) {
    list.innerHTML = '<div class="admin-empty"><div class="icon">✉️</div><p>No hay mensajes aún</p></div>';
    return;
  }
  list.innerHTML = '<div style="padding:8px 0;">' + msgs.map(m => {
    const inicial = (m.nombre || '?')[0].toUpperCase();
    const fecha = timeAgo(m.creado_en);
    const esNuevo = !m.leido;
    return `
    <div class="msg-card ${esNuevo ? 'unread' : ''}" id="msgcard-${m.id}">
      <div class="msg-card-top">
        <div class="msg-avatar">${inicial}</div>
        <div class="msg-card-info">
          <strong>${m.nombre} ${esNuevo ? '<span class="msg-unread-pill">Nuevo</span>' : ''}</strong>
          <span>📧 ${m.email}</span>
        </div>
        <span class="msg-card-time">${fecha}</span>
      </div>
      <div class="msg-card-body">${m.mensaje}</div>
      <div class="msg-card-actions">
        ${esNuevo ? `<button class="btn-msg-read" onclick="marcarMsgLeido('${m.id}')">✔ Marcar leído</button>` : '<span style="font-size:12px;color:var(--text-light);">✔ Leído</span>'}
        <button class="btn-msg-del" onclick="eliminarMsg('${m.id}')">🗑 Eliminar</button>
        <a href="mailto:${m.email}?subject=Re: Tu mensaje en AcaConnect" class="btn-msg-read" style="text-decoration:none;display:inline-flex;align-items:center;">↩ Responder</a>
      </div>
    </div>`;
  }).join('') + '</div>';
}

async function marcarMsgLeido(id) {
  try {
    await supaFetch('/rest/v1/mensajes_contacto?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ leido: true })
    });
    loadAdminList('mensajes');
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

async function eliminarMsg(id) {
  if (!confirm('¿Eliminar este mensaje?')) return;
  try {
    await supaFetch('/rest/v1/mensajes_contacto?id=eq.' + id, { method: 'DELETE' });
    const card = document.getElementById('msgcard-' + id);
    if (card) { card.style.transition='opacity .3s'; card.style.opacity='0'; setTimeout(()=>card.remove(),300); }
    showToast('🗑 Mensaje eliminado');
    loadMsgBadge();
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

// ─── CRONÓMETRO 36H RECHAZADOS ───
let _cdInterval = null;

function startCountdowns() {
  if (_cdInterval) clearInterval(_cdInterval);
  tickCountdowns();
  _cdInterval = setInterval(tickCountdowns, 60000); // actualiza cada minuto
}

function tickCountdowns() {
  const boxes = document.querySelectorAll('[id^="cd-"][data-expira]');
  const now = Date.now();
  boxes.forEach(box => {
    const expira = parseInt(box.dataset.expira);
    const resta  = expira - now;
    const timeEl = box.querySelector('[id^="cd-time-"]');
    if (!timeEl) return;
    if (resta <= 0) {
      timeEl.textContent = '¡Expirado!';
      box.classList.add('countdown-urgent');
      // Eliminar automáticamente
      const cardId = box.id.replace('cd-', '');
      autoDeleteService(cardId);
      return;
    }
    const horas = Math.floor(resta / 3600000);
    const mins  = Math.floor((resta % 3600000) / 60000);
    timeEl.textContent = horas + 'h ' + mins + 'm';
    if (horas < 6) box.classList.add('countdown-urgent');
  });
}

async function autoDeleteService(id) {
  const card = document.getElementById('acard-' + id);
  try {
    await supaFetch('/rest/v1/servicios?id=eq.' + id, { method: 'DELETE' });
    if (card) {
      card.style.transition = 'opacity .5s, transform .5s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(30px)';
      setTimeout(() => { card.remove(); showToast('🗑 Publicación eliminada por tiempo expirado'); }, 500);
    }
  } catch(e) {}
}

// Revisar rechazados expirados al abrir el panel (por si pasó tiempo sin abrir)
async function purgeExpiredRejected() {
  try {
    const LIMIT_MS = 36 * 60 * 60 * 1000;
    const rechazados = await supaFetch('/rest/v1/servicios?estado=eq.rechazado&select=id,rechazado_en,creado_en');
    for (const s of rechazados) {
      const base   = s.rechazado_en ? new Date(s.rechazado_en).getTime() : new Date(s.creado_en).getTime();
      const expira = base + LIMIT_MS;
      if (Date.now() >= expira) {
        await supaFetch('/rest/v1/servicios?id=eq.' + s.id, { method: 'DELETE' });
      }
    }
  } catch(e) {}
}

function renderAdminCards(items, tab) {
  const list = document.getElementById('admin-list');
  if (!items.length) {
    const msgs = {pendientes:'No hay publicaciones pendientes ✅', activos:'No hay servicios activos', rechazados:'No hay servicios rechazados'};
    list.innerHTML = '<div class="admin-empty"><div class="icon">📭</div><p>' + (msgs[tab]||'Sin resultados') + '</p></div>';
    return;
  }
  list.innerHTML = items.map(s => {
    const img = s.imagen_url || PLACEHOLDER_IMGS[s.categoria] || PLACEHOLDER_IMGS.servicios;
    const acciones = tab === 'pendientes' ? `
      <button class="btn-accept" onclick="reviewService(${s.id},'activo','${(s.titulo||'').replace(/'/g,'').substring(0,50)}',${s.usuario_id})">✅ Aceptar</button>
      <button class="btn-reject" onclick="reviewService(${s.id},'rechazado','${(s.titulo||'').replace(/'/g,'').substring(0,50)}',${s.usuario_id})">❌ Rechazar</button>` :
      tab === 'activos' ? `<button class="btn-reject" onclick="reviewService(${s.id},'rechazado','${(s.titulo||'').replace(/'/g,'').substring(0,50)}',${s.usuario_id})">❌ Rechazar</button>` :
      `<button class="btn-accept" onclick="reviewService(${s.id},'activo','${(s.titulo||'').replace(/'/g,'').substring(0,50)}',${s.usuario_id})">✅ Reactivar</button>`;

    // Bloque cronómetro solo para rechazados
    const countdownBlock = tab === 'rechazados' ? (() => {
      const LIMIT_MS = 36 * 60 * 60 * 1000;
      const base = s.rechazado_en ? new Date(s.rechazado_en).getTime() : (new Date(s.creado_en).getTime());
      const expira = base + LIMIT_MS;
      const resta = expira - Date.now();
      if (resta <= 0) return `<div class="countdown-box"><span style="font-size:14px;">⏰</span><div class="countdown-text">Pendiente de eliminar…</div></div>`;
      const horas = Math.floor(resta / 3600000);
      const mins  = Math.floor((resta % 3600000) / 60000);
      const urgent = horas < 6 ? 'countdown-urgent' : '';
      return `<div class="countdown-box ${urgent}" id="cd-${s.id}" data-expira="${expira}">
        <span style="font-size:18px;">⏳</span>
        <div class="countdown-text">
          Se elimina en:<span id="cd-time-${s.id}">${horas}h ${mins}m</span>
        </div>
      </div>`;
    })() : '';

    return `
    <div class="admin-card ${s.estado}" id="acard-${s.id}">
      <img class="admin-card-img" src="${img}" onerror="this.src='${PLACEHOLDER_IMGS.servicios}'" alt="${s.titulo}"/>
      <div class="admin-card-info">
        <h4>${s.titulo}</h4>
        <p>${s.descripcion ? s.descripcion.substring(0,120) + '...' : ''}</p>
        <div class="admin-card-meta">
          <span class="admin-meta-tag">📂 ${catLabel(s.categoria)}</span>
          <span class="admin-meta-tag">📍 ${s.ubicacion}</span>
          <span class="admin-meta-tag">💰 $${Number(s.precio).toLocaleString('es-MX')} / ${s.precio_tipo}</span>
          <span class="admin-meta-tag">🕐 ${new Date(s.creado_en).toLocaleDateString('es-MX')}</span>
        </div>
        ${countdownBlock}
      </div>
      <div class="admin-card-actions">${acciones}</div>
    </div>`;
  }).join('');

  // Arrancar cronómetros en vivo para la tab rechazados
  if (tab === 'rechazados') startCountdowns();
}

async function reviewService(id, nuevoEstado, titulo, usuarioId) {
  try {
    await supaFetch('/rest/v1/servicios?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({
        estado: nuevoEstado,
        activo: nuevoEstado === 'activo',
        rechazado_en: nuevoEstado === 'rechazado' ? new Date().toISOString() : null
      })
    });

    // Crear notificación para el dueño de la publicación
    if (usuarioId) {
      const esAceptado = nuevoEstado === 'activo';
      const tituloNotif = esAceptado
        ? '✅ Tu publicación fue aceptada'
        : '❌ Tu publicación no fue aceptada';
      const mensajeNotif = esAceptado
        ? `¡Buenas noticias! Tu publicación "${titulo}" ya está activa y visible en el Marketplace de AcaConnect.`
        : `Tu publicación "${titulo}" no cumplió con las normas de la comunidad de AcaConnect. Puedes corregirla y volver a publicarla.`;
      try {
        await supaFetch('/rest/v1/notificaciones', {
          method: 'POST',
          body: JSON.stringify({
            usuario_id: usuarioId,
            tipo: nuevoEstado,
            titulo: tituloNotif,
            mensaje: mensajeNotif,
            leida: false
          })
        });
      } catch(ne) { /* Si la tabla no existe aún, no romper el flujo */ }
    }

    const card = document.getElementById('acard-' + id);
    if (card) card.style.transition = 'opacity .3s', card.style.opacity = '0', setTimeout(() => card.remove(), 300);
    showToast(nuevoEstado === 'activo' ? '✅ Publicación aceptada' : '❌ Publicación rechazada');
    loadPendingCount();
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

function renderAdminUsers(users) {
  const list = document.getElementById('admin-list');
  if (!users.length) {
    list.innerHTML = '<div class="admin-empty"><div class="icon">👥</div><p>No hay usuarios registrados</p></div>';
    return;
  }
  list.innerHTML = `<div style="background:#fff;border-radius:14px;border:1.5px solid var(--border);padding:8px 20px;">` +
    users.map(u => {
      const esYo = currentUser && u.id === currentUser.id;
      const rolActual = u.rol || u.tipo || 'cliente';
      const ROLES_INFO = {
        admin:      { icon:'👑', color:'#E53935', bg:'#FFEBEE' },
        supervisor: { icon:'🔍', color:'#F57C00', bg:'#FFF3E0' },
        vendedor:   { icon:'🏪', color:'#1976D2', bg:'#E3F2FD' },
        cliente:    { icon:'👤', color:'#388E3C', bg:'#E8F5E9' },
      };
      const ri = ROLES_INFO[rolActual] || ROLES_INFO.cliente;
      const rolSelector = esYo
        ? `<span style="font-size:12px;color:#aaa;padding:6px 10px;">Tú</span>`
        : `<select class="rol-selector" onchange="cambiarRol('${u.id}', this.value, '${rolActual}')" 
             style="border:1.5px solid ${ri.color};background:${ri.bg};color:${ri.color};
                    font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;
                    padding:5px 10px;border-radius:20px;cursor:pointer;outline:none;">
            <option value="admin"      ${rolActual==='admin'      ?'selected':''}>👑 Admin</option>
            <option value="supervisor" ${rolActual==='supervisor' ?'selected':''}>🔍 Supervisor</option>
            <option value="vendedor"   ${rolActual==='vendedor'   ?'selected':''}>🏪 Vendedor</option>
            <option value="cliente"    ${rolActual==='cliente'    ?'selected':''}>👤 Cliente</option>
          </select>`;
      const btnEliminar = esYo
        ? ``
        : `<button class="btn-delete-user" onclick="eliminarUsuario('${u.id}','${u.nombre}')">🗑️ Eliminar</button>`;
      return `
      <div class="admin-user-row" id="urow-${u.id}">
        <div class="admin-user-avatar" style="background:${ri.bg};color:${ri.color};">${ri.icon}</div>
        <div class="admin-user-info">
          <strong>${u.nombre}</strong>
          <span>${u.email} · <span style="color:${ri.color};font-weight:600;">${rolActual}</span> · ${new Date(u.creado_en).toLocaleDateString('es-MX')}</span>
        </div>
        <div class="admin-user-actions">
          ${rolSelector}
          ${btnEliminar}
        </div>
      </div>`;
    }).join('') + `</div>`;
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

async function cambiarRol(userId, nuevoRol, rolAnterior) {
  const LABELS = { admin:'Administrador', supervisor:'Supervisor', vendedor:'Vendedor', cliente:'Cliente' };
  if (!confirm(`¿Cambiar a ${LABELS[nuevoRol]}?`)) {
    // Revertir el select si cancela
    loadAdminList('usuarios'); return;
  }
  try {
    // 1. Actualizar campo rol en usuarios
    //    Intentar actualizar ambos campos; si tipo falla por constraint, solo actualizar rol
    try {
      await supaFetch('/rest/v1/usuarios?id=eq.' + userId, {
        method: 'PATCH',
        body: JSON.stringify({ tipo: nuevoRol, rol: nuevoRol })
      });
    } catch(e) {
      // tipo tiene constraint viejo — actualizar solo 'rol' mientras se ejecuta el SQL de fix
      await supaFetch('/rest/v1/usuarios?id=eq.' + userId, {
        method: 'PATCH',
        body: JSON.stringify({ rol: nuevoRol })
      });
    }

    // 2. Actualizar usuarios_roles
    const rolData = await supaFetch('/rest/v1/roles?slug=eq.' + nuevoRol + '&select=id').catch(()=>[]);
    if (rolData && rolData.length > 0) {
      // Eliminar rol anterior y asignar nuevo
      await supaFetch('/rest/v1/usuarios_roles?usuario_id=eq.' + userId, {
        method: 'DELETE'
      }).catch(()=>{});
      await supaFetch('/rest/v1/usuarios_roles', {
        method: 'POST',
        body: JSON.stringify({ usuario_id: parseInt(userId), rol_id: rolData[0].id, asignado_por: currentUser.id })
      });
    }

    // 3. Registrar en historial
    supaFetch('/rest/v1/historial_roles', {
      method: 'POST',
      body: JSON.stringify({
        usuario_id:   parseInt(userId),
        rol_anterior: rolAnterior,
        rol_nuevo:    nuevoRol,
        cambiado_por: currentUser.id,
        motivo:       'Cambio manual desde panel admin'
      })
    }).catch(()=>{});

    showToast('✅ Rol cambiado a ' + LABELS[nuevoRol]);
    loadAdminList('usuarios');
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

// Mantener compatibilidad con llamadas antiguas a toggleAdmin
async function toggleAdmin(userId, tipoActual) {
  const nuevoRol = tipoActual === 'admin' ? 'cliente' : 'admin';
  await cambiarRol(userId, nuevoRol, tipoActual);
}

async function eliminarUsuario(userId, nombre) {
  if (!confirm('¿Eliminar al usuario "' + nombre + '"? Esta acción no se puede deshacer.')) return;
  try {
    await supaFetch('/rest/v1/usuarios?id=eq.' + userId, { method: 'DELETE' });
    const row = document.getElementById('urow-' + userId);
    if (row) {
      row.style.transition = 'opacity .3s, transform .3s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(20px)';
      setTimeout(() => row.remove(), 300);
    }
    showToast('🗑️ Usuario eliminado');
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

// ═══════════════════════════════════════════════
//  RESTAURAR SESIÓN AL CARGAR
// ═══════════════════════════════════════════════
(function restoreSession() {
  const VALID_PAGES = ['home', 'marketplace', 'publish', 'about', 'contact', 'promos'];

  // Restaurar usuario
  try {
    const saved = localStorage.getItem('aca_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.id && user.nombre) {
        currentUser = user;
        // Asegurar que el campo rol esté presente
        if (!currentUser.rol) currentUser.rol = currentUser.tipo || 'cliente';
      }
    }
  } catch(e) {}

  function init() {
    // 1. Restaurar usuario en UI
    if (currentUser) {
      setUser(currentUser);
      loadWallet(); // <-- cargar saldo desde Supabase al restaurar sesión
    }
    initMobileNav();
    initTheme();

    // 2. Determinar qué página mostrar:
    //    Prioridad: hash de URL > localStorage > home
    const hash = (location.hash || '').replace('#', '');
    const saved = localStorage.getItem('aca_page');
    const page = (VALID_PAGES.includes(hash) ? hash : null)
              || (VALID_PAGES.includes(saved) ? saved : null)
              || 'home';

    showPage(page);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}


// ── Helpers de rol ─────────────────────────────────────
const NIVEL_ROL = { admin:4, supervisor:3, vendedor:2, cliente:1 };

function rolActual() {
  return currentUser?.rol || currentUser?.tipo || 'cliente';
}
function nivelRol() {
  return NIVEL_ROL[rolActual()] || 1;
}
function tieneRol(roles) {
  return roles.includes(rolActual());
}
function esAdmin()      { return rolActual() === 'admin'; }
function esSupervisor() { return tieneRol(['admin','supervisor']); }
function esVendedor()   { return tieneRol(['admin','supervisor','vendedor']); }


// ── Tipo de precio variable → solo efectivo ──────────────
function onPriceTipoChange(sel) {
  const esVariable = sel.value === 'variable';
  const aviso      = document.getElementById('variable-aviso');
  const hint       = document.getElementById('precio-tipo-hint');

  if (aviso) aviso.style.display = esVariable ? 'block' : 'none';
  if (hint)  hint.style.display  = esVariable ? 'none'  : 'block';

  // Bloquear / desbloquear métodos de pago
  const btns = document.querySelectorAll('.pay-method-btn');
  btns.forEach(btn => {
    const met = btn.dataset.method;
    if (met === 'tarjeta' || met === 'acapoints') {
      if (esVariable) {
        // Desactivar y marcar como bloqueado
        btn.classList.remove('active');
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.style.cursor  = 'not-allowed';
        btn.title = 'No disponible con precio variable';
      } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor  = '';
        btn.title = '';
        btn.classList.add('active'); // re-activar
      }
    }
  });

  // Si es variable, asegurar que efectivo esté activo
  if (esVariable) {
    const efectivoBtn = document.querySelector('.pay-method-btn[data-method="efectivo"]');
    if (efectivoBtn) efectivoBtn.classList.add('active');
  }
}


// ── Helper: detectar si precio_tipo es un rango ──────────
function esRangoPrecio(tipo) {
  return tipo && /\$[\d,]+(–|-)\$[\d,]+/.test(tipo);
}
function esPrecioVariable(tipo) {
  return tipo === 'variable' || tipo === 'variable (a convenir)';
}
function formatPrecio(precio, tipo) {
  if (esPrecioVariable(tipo))  return '💵 A convenir';
  if (esRangoPrecio(tipo))      return tipo;
  return '$' + Number(precio).toLocaleString('es-MX') + (tipo ? ' / ' + tipo : '');
}

/* =====================================================
   SISTEMA DE PAGOS - ACACONNECT
   ===================================================== */

// Estado global de pagos
let selectedPayMethod = null;
let selectedPackage = null;
// userAcaPoints declarado al inicio

// ── Página AcaPoints ─────────────────────────────────────
let acapSelectedPkg = null;

function selectAcapPkg(el) {
  document.querySelectorAll('.acap-pkg').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  acapSelectedPkg = { mxn: parseFloat(el.dataset.mxn), pts: parseFloat(el.dataset.pts) };
  const form = document.getElementById('acap-buy-form');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('acap-selected-summary').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,128,128,.08);border:1.5px solid var(--teal);border-radius:12px;padding:14px 18px;">
      <div><span style="font-size:22px;">🪙</span> <strong>${acapSelectedPkg.pts} AcaPoints</strong></div>
      <div style="font-size:18px;font-weight:700;color:var(--teal);">$${acapSelectedPkg.mxn} MXN</div>
    </div>`;
}

async function confirmPageBuyPoints() {
  if (!currentUser) { openModal('login'); return; }
  if (!acapSelectedPkg) { showToast('⚠️ Selecciona un paquete primero'); return; }
  const num  = (document.getElementById('acap-card-num').value || '').replace(/\s/g,'');
  const name = (document.getElementById('acap-card-name').value || '').trim();
  const exp  = (document.getElementById('acap-card-exp').value || '').trim();
  const cvv  = (document.getElementById('acap-card-cvv').value || '').trim();
  if (num.length < 16) { showToast('⚠️ Número de tarjeta inválido'); return; }
  if (!name)           { showToast('⚠️ Ingresa el nombre del titular'); return; }
  if (exp.length < 5)  { showToast('⚠️ Fecha inválida'); return; }
  if (cvv.length < 3)  { showToast('⚠️ CVV inválido'); return; }

  const btn = document.getElementById('btn-acap-buy');
  btn.textContent = 'Procesando...'; btn.disabled = true;

  try {
    await new Promise(r => setTimeout(r, 1100));
    const nuevoSaldo = userAcaPoints + acapSelectedPkg.pts;

    await upsertWallet(nuevoSaldo, userSaldoTarjeta);
    txAdd({ tipo:'compra', puntos: acapSelectedPkg.pts, monto_mxn: acapSelectedPkg.mxn,
              descripcion: 'Compra de AcaPoints — $' + acapSelectedPkg.mxn + ' MXN' });
    billeteraAdd({
      tipo: 'recarga_acapoints',
      monto: acapSelectedPkg.mxn,
      puntos: acapSelectedPkg.pts,
      metodo: 'tarjeta',
      descripcion: 'Recarga: ' + acapSelectedPkg.pts + ' AcaPoints'
    });
    // Sync Supabase best-effort
    supaFetch('/rest/v1/transacciones_acapoints', { method:'POST', body: JSON.stringify({
      usuario_id: currentUser.id, tipo:'compra', puntos: acapSelectedPkg.pts,
      monto_mxn: acapSelectedPkg.mxn, descripcion: 'Compra de AcaPoints — $' + acapSelectedPkg.mxn + ' MXN'
    })}).catch(()=>{});

    await crearNotifPago(
      '🪙 AcaPoints comprados',
      'Compraste ' + acapSelectedPkg.pts + ' AcaPoints por $' + acapSelectedPkg.mxn + ' MXN. Saldo actual: ' + nuevoSaldo.toFixed(0) + ' AcaPoints.',
      'compra_acapoints'
    );
    showToast('✅ ¡' + acapSelectedPkg.pts + ' AcaPoints añadidos a tu cuenta!');

    // Reset form
    document.getElementById('acap-buy-form').style.display = 'none';
    document.getElementById('acap-card-num').value = '';
    document.getElementById('acap-card-name').value = '';
    document.getElementById('acap-card-exp').value = '';
    document.getElementById('acap-card-cvv').value = '';
    document.querySelectorAll('.acap-pkg').forEach(p => p.classList.remove('selected'));
    acapSelectedPkg = null;

    // Recargar historial
    loadAcaHistorial();

  } catch(e) {
    showToast('❌ Error al procesar. Intenta de nuevo.'); console.error(e);
  } finally {
    btn.textContent = '🪙 Comprar AcaPoints'; btn.disabled = false;
  }
}

async function loadAcaHistorial() {
  const section = document.getElementById('acap-historial-section');
  const list    = document.getElementById('acap-historial-list');
  if (!section || !list || !currentUser) return;
  section.style.display = 'block';
  // Leer desde localStorage (siempre disponible)
  const data = txGetAll();
  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:14px;text-align:center;padding:20px 0;">Aún no tienes movimientos.</p>';
    return;
  }
  const iconos = { compra:'🟢', gasto:'🔴', reembolso:'🔵' };
  const signos = { compra:'+', gasto:'-', reembolso:'+' };
  list.innerHTML = data.map(tx => {
    const fecha = new Date(tx.creado_en).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
    return `<div class="acap-tx-row">
      <span class="acap-tx-icon">${iconos[tx.tipo] || '⚪'}</span>
      <div class="acap-tx-desc">
        <strong>${tx.descripcion || tx.tipo}</strong>
        <span>${fecha}</span>
      </div>
      <div class="acap-tx-pts ${tx.tipo}">${signos[tx.tipo]}${tx.puntos} 🪙</div>
    </div>`;
  }).join('');
}

function updateAcaPointsUI() {
  // Badge en dropdown del nav
  const badge = document.getElementById('nav-acapoints-badge');
  if (badge) badge.textContent = Math.floor(userAcaPoints);
  // Página de AcaPoints
  const balNum = document.getElementById('acap-page-balance');
  const balMxn = document.getElementById('acap-page-mxn');
  if (balNum) balNum.textContent = Math.floor(userAcaPoints) + ' AcaPoints';
  if (balMxn) balMxn.textContent = Math.floor(userAcaPoints).toLocaleString('es-MX');
  // Modal de pago
  const modalBal = document.getElementById('modal-balance');
  if (modalBal) modalBal.textContent = Math.floor(userAcaPoints) + ' AcaPoints';
}

// Hook showPage para cargar datos cuando se entra a la página
const _origShowPage = showPage;
showPage = function(name) {
  if (name === 'publish') {
    if (!currentUser) { openModal('login'); showToast('⚠️ Inicia sesión para publicar'); return; }
    const rol = rolActual();
    if (rol === 'cliente') {
      _origShowPage(name);
      pvMostrarPanelSolicitud();
      return;
    }
    // vendedor, supervisor, admin → mostrar formulario normal
    _origShowPage(name);
    document.getElementById('pv-solicitud-panel').style.display = 'none';
    document.getElementById('pv-form-publicar').style.display   = 'block';
    // Sincronizar panel de precio con la categoría actual (con delay para GitHub Pages)
    setTimeout(togglePrecioPanels, 50);
    return;
  }
  _origShowPage(name);
  trackEvento('vista_pagina', name, null);
  if (name === 'acapoints') {
    if (!currentUser) {
      document.getElementById('acap-hero-balance').style.display = 'none';
      document.getElementById('acap-login-cta').style.display = 'block';
      document.querySelector('.acap-packages-grid') && (document.querySelector('.acap-packages-grid').style.opacity = '.4');
    } else {
      document.getElementById('acap-login-cta').style.display = 'none';
      document.getElementById('acap-hero-balance').style.display = 'flex';
      updateAcaPointsUI();
      loadAcaHistorial();
    }
  }
};

// ─────────────────────────────────────────────────────────
// WALLET — Supabase como fuente de verdad + localStorage cache
// Así el saldo es idéntico en celular, laptop y cualquier dispositivo
// ─────────────────────────────────────────────────────────

// userSaldoTarjeta declarado al inicio del archivo

function walletKey()       { return 'aca_wallet_' + (currentUser?.id || 'guest'); }
function walletTarjetaKey(){ return 'aca_wt_'     + (currentUser?.id || 'guest'); }
function txKey()           { return 'aca_tx_'     + (currentUser?.id || 'guest'); }

const TASA_RETIRO_ACA = 0.80;
const TASA_RETIRO_TAR = 1.00;

// ── Cache local (solo para UI instantánea, nunca fuente de verdad) ──
function _cacheAcaGet()       { try { return parseFloat(localStorage.getItem(walletKey())) || 0; } catch(e) { return 0; } }
function _cacheAcaSet(v)      { try { localStorage.setItem(walletKey(),       String(v)); } catch(e) {} }
function _cacheTarjetaGet()   { try { return parseFloat(localStorage.getItem(walletTarjetaKey())) || 0; } catch(e) { return 0; } }
function _cacheTarjetaSet(v)  { try { localStorage.setItem(walletTarjetaKey(), String(v)); } catch(e) {} }

// Estos son los que usa el resto del código — mantienen UI + cache en sync
function walletGet()           { return userAcaPoints; }
function walletSet(v)          { userAcaPoints = Math.max(0, v); _cacheAcaSet(userAcaPoints); updateAcaPointsUI(); }
function walletTarjetaGet()    { return userSaldoTarjeta; }
function walletTarjetaSet(v)   { userSaldoTarjeta = Math.max(0, v); _cacheTarjetaSet(userSaldoTarjeta); }

// ── Guardar en Supabase (ambos saldos en una sola fila) ─────────────
async function upsertWallet(nuevoAca, nuevoTarjeta) {
  const aca = (nuevoAca     !== undefined) ? nuevoAca     : userAcaPoints;
  const tar = (nuevoTarjeta !== undefined) ? nuevoTarjeta : userSaldoTarjeta;
  // Actualizar UI y cache local inmediatamente
  walletSet(aca);
  walletTarjetaSet(tar);

  const body = JSON.stringify({
    usuario_id:    currentUser.id,
    acapoints:     aca,
    saldo_tarjeta: tar,
    actualizado:   new Date().toISOString()
  });
  const headers = {
    'apikey':        SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type':  'application/json'
  };

  try {
    // 1. Intentar upsert (POST con merge-duplicates)
    const res = await fetch(SUPA_URL + '/rest/v1/wallets', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body
    });

    if (res.ok) return; // éxito

    const err = await res.json().catch(() => ({}));
    console.warn('upsert falló:', res.status, err.message);

    // 2. Fallback: intentar PATCH si ya existe el registro
    const patch = await fetch(
      SUPA_URL + '/rest/v1/wallets?usuario_id=eq.' + currentUser.id,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ acapoints: aca, saldo_tarjeta: tar, actualizado: new Date().toISOString() })
      }
    );
    if (!patch.ok) {
      const pErr = await patch.json().catch(() => ({}));
      console.warn('patch también falló:', patch.status, pErr.message);
    }
  } catch(e) {
    console.warn('wallet sin conexión:', e.message);
  }
}

// ── Cargar saldo desde Supabase al iniciar sesión ───────────────────
// ── Acreditar saldo al vendedor cuando alguien compra su servicio ──────
async function acreditarProveedor(proveedorId, monto, metodo, folio, tituloServicio) {
  if (!proveedorId) return;
  try {
    // 1. Leer wallet actual del proveedor
    const res = await fetch(
      SUPA_URL + '/rest/v1/wallets?usuario_id=eq.' + proveedorId + '&select=acapoints,saldo_tarjeta',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    let acaActual = 0, tarActual = 0;
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        acaActual = parseFloat(data[0].acapoints)     || 0;
        tarActual = parseFloat(data[0].saldo_tarjeta) || 0;
      }
    }

    // 2. Calcular nuevo saldo según método de pago
    const nuevoAca = metodo === 'acapoints' ? acaActual + monto : acaActual;
    const nuevoTar = metodo === 'tarjeta'   ? tarActual + monto : tarActual;

    // 3. Upsert wallet del proveedor
    const body = JSON.stringify({
      usuario_id:    proveedorId,
      acapoints:     nuevoAca,
      saldo_tarjeta: nuevoTar,
      actualizado:   new Date().toISOString()
    });
    const headers = {
      'apikey':        SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type':  'application/json'
    };

    const upsertRes = await fetch(SUPA_URL + '/rest/v1/wallets', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body
    });

    if (!upsertRes.ok) {
      // Fallback: PATCH
      await fetch(SUPA_URL + '/rest/v1/wallets?usuario_id=eq.' + proveedorId, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ acapoints: nuevoAca, saldo_tarjeta: nuevoTar, actualizado: new Date().toISOString() })
      });
    }

    // 4. Registrar transacción para el proveedor
    await fetch(SUPA_URL + '/rest/v1/transacciones_acapoints', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        usuario_id:  proveedorId,
        tipo:        'ingreso',
        puntos:      metodo === 'acapoints' ? monto : 0,
        monto_mxn:   metodo === 'tarjeta'   ? monto : 0,
        descripcion: 'Venta: ' + tituloServicio + ' · Folio ' + folio
      })
    });

  } catch(e) { console.warn('acreditarProveedor error:', e.message); }
}


async function loadWallet() {
  if (!currentUser) return;
  // Mostrar cache local mientras carga (UX instantánea)
  userAcaPoints    = _cacheAcaGet();
  userSaldoTarjeta = _cacheTarjetaGet();
  updateAcaPointsUI();

  // Usar fetch directo (misma clave que el upsert) para evitar problemas de RLS con supaFetch
  try {
    const res = await fetch(
      SUPA_URL + '/rest/v1/wallets?usuario_id=eq.' + currentUser.id + '&select=acapoints,saldo_tarjeta',
      {
        headers: {
          'apikey':        SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type':  'application/json'
        }
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('loadWallet error:', res.status, err.message || err);
      // Intentar crear/actualizar el registro si no existe o hay error de permisos
      await upsertWallet(userAcaPoints, userSaldoTarjeta);
      return;
    }

    const data = await res.json();

    if (data && data.length > 0) {
      const aca = parseFloat(data[0].acapoints)     || 0;
      const tar = parseFloat(data[0].saldo_tarjeta) || 0;
      walletSet(aca);
      walletTarjetaSet(tar);
      // Sincronizar cache local
      _cacheAcaSet(aca);
      _cacheTarjetaSet(tar);
    } else {
      // No existe el registro — crearlo con el saldo del cache local
      await upsertWallet(userAcaPoints, userSaldoTarjeta);
    }
  } catch(e) {
    console.warn('loadWallet sin conexión, usando cache local:', e.message);
  }
}

// ── Transacciones: Supabase + cache local ───────────────────────────
function txAdd(tx) {
  // Cache local para historial offline
  try {
    const list = JSON.parse(localStorage.getItem(txKey()) || '[]');
    list.unshift({ ...tx, creado_en: new Date().toISOString(), id: Date.now() });
    localStorage.setItem(txKey(), JSON.stringify(list.slice(0, 50)));
  } catch(e) {}
  // Sync Supabase
  supaFetch('/rest/v1/transacciones_acapoints', {
    method: 'POST',
    body: JSON.stringify({
      usuario_id:  currentUser?.id,
      tipo:        tx.tipo,
      puntos:      tx.puntos,
      monto_mxn:   tx.monto_mxn,
      descripcion: tx.descripcion
    })
  }).catch(() => {});
}
function txGetAll() {
  try { return JSON.parse(localStorage.getItem(txKey()) || '[]'); } catch(e) { return []; }
}

// ── Mostrar métodos de pago en el detalle del servicio ──
function renderPayMethods(metodos) {
  const el = document.getElementById('detail-pay-methods');
  if (!el) return;
  const labels = { efectivo:'💵 Efectivo', tarjeta:'💳 Tarjeta', acapoints:'🪙 AcaPoints' };
  const arr = Array.isArray(metodos) && metodos.length ? metodos : ['efectivo','tarjeta','acapoints'];
  el.innerHTML = arr.map(m => `<span class="pay-badge">${labels[m] || m}</span>`).join('');
}

// ── Toggle métodos en formulario de publicación ─────────
function togglePayMethod(btn) {
  btn.classList.toggle('active');
  const activos = document.querySelectorAll('.pay-method-btn.active');
  if (activos.length === 0) {
    btn.classList.add('active'); // Siempre al menos uno
    showToast('⚠️ Debes aceptar al menos un método de pago');
  }
}
function getSelectedPayMethods() {
  return Array.from(document.querySelectorAll('.pay-method-btn.active')).map(b => b.dataset.method);
}

// ── Abrir modal de pago ─────────────────────────────────
async function openPayModal() {
  if (!currentUser) { openModal('login'); showToast('Inicia sesión para contratar servicios'); return; }
  if (!currentDetail) return;

  const s = currentDetail;
  const precio = Number(s.precio);

  // Info del servicio
  const variableNotice = esPrecioVariable(s.precio_tipo)
    ? `<div style="background:#fff3e0;border:1.5px solid #ffcc80;border-radius:10px;padding:10px 14px;font-size:12px;color:#e65100;margin-bottom:10px;">
        ⚠️ <strong>Precio variable</strong> — el monto final depende de lo que consumas. Solo se acepta efectivo.
       </div>` : '';
  document.getElementById('pay-service-info').innerHTML = variableNotice + `
    <img src="${s.imagen_url || ''}" alt="${s.titulo}" onerror="this.src='https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100'"/>
    <div>
      <div class="psi-title">${s.titulo}</div>
      <div class="psi-price">${esRangoPrecio(s.precio_tipo)
        ? s.precio_tipo
        : `$${precio.toLocaleString('es-MX')} <span style="font-size:13px;font-weight:400;color:rgba(0,128,128,.7)">/ ${s.precio_tipo}</span>`
      }</div>
    </div>`;

  // Métodos disponibles del servicio
  // Si precio variable → forzar solo efectivo
  const metodos = esPrecioVariable(s.precio_tipo)
    ? ['efectivo']
    : (Array.isArray(s.metodos_pago) && s.metodos_pago.length
        ? s.metodos_pago : ['efectivo','tarjeta','acapoints']);

  const labels = { efectivo:'💵 Efectivo', tarjeta:'💳 Tarjeta', acapoints:'🪙 AcaPoints' };
  const selector = document.getElementById('pay-method-selector');
  selector.innerHTML = metodos.map(m => `
    <button class="pay-method-opt" data-method="${m}" onclick="selectPayMethod(this,'${m}')">
      <span class="pmo-icon">${m==='efectivo'?'💵':m==='tarjeta'?'💳':'🪙'}</span>
      ${m==='acapoints'?'AcaPoints':labels[m].split(' ')[1]}
    </button>`).join('');

  // Resumen
  document.getElementById('sum-price').textContent = '$' + precio.toLocaleString('es-MX') + ' MXN';
  document.getElementById('sum-total').textContent = '$' + precio.toLocaleString('es-MX') + ' MXN';

  // Cargar saldo
  await loadWallet();
  document.getElementById('modal-balance').textContent = userAcaPoints.toFixed(0) + ' AcaPoints';

  // Seleccionar primer método disponible
  selectedPayMethod = metodos[0];
  const firstBtn = selector.querySelector('.pay-method-opt');
  if (firstBtn) { firstBtn.classList.add('active'); showPayPanel(metodos[0]); }

  // Cerrar el detail overlay para que el modal de pago quede limpio en primer plano
  document.getElementById('detail-overlay').classList.remove('open');
  // Restaurar scroll iOS si aplica
  const scrollY = document.body.dataset.scrollY;
  document.body.style.cssText = '';
  if (scrollY !== undefined) window.scrollTo(0, parseInt(scrollY) || 0);

  const overlay = document.getElementById('pay-modal-overlay');
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
}

function selectPayMethod(btn, method) {
  document.querySelectorAll('.pay-method-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPayMethod = method;
  showPayPanel(method);
}

function showPayPanel(method) {
  ['efectivo','tarjeta','acapoints'].forEach(m => {
    const p = document.getElementById('panel-' + m);
    if (p) p.style.display = m === method ? 'block' : 'none';
  });
  if (method === 'acapoints') {
    const precio = Number(currentDetail?.precio || 0);
    const insuf = document.getElementById('acapoints-insuficiente');
    if (insuf) insuf.style.display = userAcaPoints < precio ? 'flex' : 'none';
    document.getElementById('sum-total').textContent = precio.toFixed(0) + ' AcaPoints 🪙';
  } else {
    const precio = Number(currentDetail?.precio || 0);
    document.getElementById('sum-total').textContent = '$' + precio.toLocaleString('es-MX') + ' MXN';
  }
}

function closePayModal() {
  document.getElementById('pay-modal-overlay').style.display = 'none';
  selectedPayMethod = null;
  // Reabrir el detalle del servicio si currentDetail sigue activo
  if (currentDetail) {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.add('open');
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      document.body.dataset.scrollY = window.scrollY;
      document.body.style.cssText = 'overflow:hidden;position:fixed;top:-' + window.scrollY + 'px;width:100%;';
    } else {
      document.body.style.overflow = 'hidden';
    }
  }
}

// ── Confirmar pago ──────────────────────────────────────
async function confirmPago() {
  if (!currentDetail || !currentUser) return;
  if (!selectedPayMethod) { showToast('⚠️ Selecciona un método de pago'); return; }

  const s = currentDetail;
  const precio = Number(s.precio);
  const btn = document.getElementById('btn-confirm-pay');

  // Validar tarjeta
  if (selectedPayMethod === 'tarjeta') {
    const num  = (document.getElementById('card-number').value || '').replace(/\s/g,'');
    const name = (document.getElementById('card-name').value || '').trim();
    const exp  = (document.getElementById('card-exp').value || '').trim();
    const cvv  = (document.getElementById('card-cvv').value || '').trim();
    if (num.length < 16) { showToast('⚠️ Número de tarjeta inválido'); return; }
    if (!name)           { showToast('⚠️ Ingresa el nombre del titular'); return; }
    if (exp.length < 5)  { showToast('⚠️ Fecha inválida'); return; }
    if (cvv.length < 3)  { showToast('⚠️ CVV inválido'); return; }
  }

  // Validar AcaPoints
  if (selectedPayMethod === 'acapoints') {
    if (userAcaPoints < precio) {
      showToast('⚠️ Saldo insuficiente. Compra más AcaPoints'); return;
    }
  }

  btn.textContent = 'Procesando...'; btn.disabled = true;

  try {
    // Simular delay de procesamiento
    await new Promise(r => setTimeout(r, 1200));

    const cardNum = selectedPayMethod === 'tarjeta'
      ? (document.getElementById('card-number').value || '').replace(/\s/g,'').slice(-4) : null;
    const cardName = selectedPayMethod === 'tarjeta'
      ? (document.getElementById('card-name').value || '').trim() : null;

    // Guardar pago en Supabase
    const pagoPayload = {
      servicio_id:      s.id,
      comprador_id:     currentUser.id,
      proveedor_id:     s.usuario_id,
      metodo_pago:      selectedPayMethod,
      monto:            precio,
      acapoints_usados: selectedPayMethod === 'acapoints' ? precio : 0,
      estado:           'completado',
      tarjeta_ultimos4: cardNum,
      tarjeta_titular:  cardName
    };
    // Guardar en localStorage (siempre disponible) + Supabase best-effort
    const folio = 'ACA-' + Date.now().toString(36).toUpperCase();
    const compraLocal = {
      folio,
      servicio_id:      s.id,
      servicio_titulo:  s.titulo,
      servicio_imagen:  s.imagen_url || '',
      servicio_cat:     s.categoria,
      servicio_ubicacion: s.ubicacion,
      proveedor_nombre: (s.usuarios && s.usuarios.nombre) || s.proveedor_nombre || 'Proveedor',
      metodo_pago:      selectedPayMethod,
      monto:            precio,
      precio_tipo:      s.precio_tipo,
      acapoints_usados: selectedPayMethod === 'acapoints' ? precio : 0,
      tarjeta_ultimos4: cardNum,
      tarjeta_titular:  cardName,
      estado:           'completado',
      creado_en:        new Date().toISOString()
    };
    comprasAdd(compraLocal);
    trackEvento('pago', 'marketplace', selectedPayMethod + ':' + precio);
    // Registrar en billetera: gasto reflejado
    billeteraAdd({
      tipo: selectedPayMethod === 'acapoints' ? 'gasto_acapoints' : 'gasto_tarjeta',
      monto: precio,
      metodo: selectedPayMethod,
      descripcion: 'Pago: ' + s.titulo,
      folio,
      tarjeta_ultimos4: cardNum,
      tarjeta_titular: cardName
    });
    // Acumular saldo retirable según método
    if (selectedPayMethod === 'tarjeta') {
      await upsertWallet(userAcaPoints, userSaldoTarjeta + precio);
    }
    // Guardar pago con folio en Supabase (await para garantizar que se guarde)
    try {
      await supaFetch('/rest/v1/pagos', {
        method: 'POST',
        body: JSON.stringify({ ...pagoPayload, folio })
      });
    } catch(e) {
      // Si falla (ej. columna folio no existe aún), reintentar sin folio
      supaFetch('/rest/v1/pagos', {
        method: 'POST',
        body: JSON.stringify(pagoPayload)
      }).catch(() => {});
    }

    // Acreditar saldo al proveedor del servicio
    acreditarProveedor(s.usuario_id, precio, selectedPayMethod, folio, s.titulo);

    // Si pagó con AcaPoints → descontar de la wallet
    if (selectedPayMethod === 'acapoints') {
      const nuevoSaldo = userAcaPoints - precio;
      await upsertWallet(nuevoSaldo, userSaldoTarjeta);
      txAdd({ tipo:'gasto', puntos: precio, descripcion: 'Pago por: ' + s.titulo });
      supaFetch('/rest/v1/transacciones_acapoints', { method:'POST', body: JSON.stringify({
        usuario_id: currentUser.id, tipo:'gasto', puntos: precio, descripcion: 'Pago por: ' + s.titulo
      })}).catch(()=>{});
      userAcaPoints = nuevoSaldo;
    }

    closePayModal();

    // Enviar notificación al usuario
    const notifTipo = 'pago_' + selectedPayMethod;
    const notifTitulos = { efectivo:'💵 Pago registrado', tarjeta:'💳 Pago con tarjeta', acapoints:'🪙 Pago con AcaPoints' };
    const notifMensajes = {
      efectivo: 'Reserva confirmada para "' + s.titulo + '". Coordina el pago en efectivo con el proveedor.',
      tarjeta:  'Pago simulado aprobado para "' + s.titulo + '". Transacción #' + Math.floor(Math.random()*900000+100000) + '.',
      acapoints:'Usaste ' + precio + ' AcaPoints en "' + s.titulo + '". Saldo restante: ' + userAcaPoints.toFixed(0) + ' AcaPoints.'
    };
    await crearNotifPago(notifTitulos[selectedPayMethod], notifMensajes[selectedPayMethod], notifTipo);

    // Mostrar éxito
    const metMsgs = {
      efectivo:   '💵 Pago en efectivo registrado.<br>Coordina el pago directamente con el proveedor.',
      tarjeta:    '💳 Pago con tarjeta simulado.<br>Transacción aprobada.',
      acapoints:  '🪙 AcaPoints descontados.<br>Saldo restante: ' + Math.floor(userAcaPoints) + ' AcaPoints'
    };
    document.getElementById('pago-success-msg').innerHTML =
      `<strong>${s.titulo}</strong> ha sido contratado exitosamente.<br><br>` +
      (metMsgs[selectedPayMethod] || 'Pago registrado.') +
      `<br><br>
       <div style="background:#f0faf8;border:1.5px solid #b2dfdb;border-radius:10px;padding:12px 16px;text-align:left;">
         <div style="font-size:11px;color:#666;margin-bottom:4px;">Folio de compra</div>
         <div style="font-family:monospace;font-size:16px;font-weight:800;color:#007a7a;">${folio}</div>
         <div style="font-size:11px;color:#888;margin-top:6px;">Guárdalo para consultar tu compra en "Mis compras"</div>
       </div>`;
    const successOvl = document.getElementById('pago-success-overlay');
    successOvl.style.display = 'flex';
    successOvl.style.alignItems = 'center';
    successOvl.style.justifyContent = 'center';

  } catch(e) {
    showToast('❌ Error al procesar el pago. Intenta de nuevo.');
    console.error('pago error:', e);
  } finally {
    btn.textContent = 'Confirmar Pago'; btn.disabled = false;
  }
}

function closePagoSuccess() {
  document.getElementById('pago-success-overlay').style.display = 'none';
  currentDetail = null;
  document.body.style.cssText = '';
}

// ── Comprar AcaPoints ───────────────────────────────────
function openBuyPoints() {
  const bpOverlay = document.getElementById('buypoints-modal-overlay');
  bpOverlay.style.display = 'flex';
  bpOverlay.style.alignItems = 'center';
  bpOverlay.style.justifyContent = 'center';
  selectedPackage = null;
}

function closeBuyPoints() {
  document.getElementById('buypoints-modal-overlay').style.display = 'none';
  document.getElementById('buypoints-card-form').style.display = 'none';
  selectedPackage = null;
}

function selectPackage(el) {
  document.querySelectorAll('.ap-package').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  selectedPackage = { mxn: parseFloat(el.dataset.mxn), pts: parseFloat(el.dataset.pts) };
  document.getElementById('buypoints-card-form').style.display = 'block';
}

async function confirmBuyPoints() {
  if (!selectedPackage) { showToast('⚠️ Selecciona un paquete'); return; }
  const num  = (document.getElementById('bp-card-number').value || '').replace(/\s/g,'');
  const name = (document.getElementById('bp-card-name').value || '').trim();
  const exp  = (document.getElementById('bp-card-exp').value || '').trim();
  const cvv  = (document.getElementById('bp-card-cvv').value || '').trim();
  if (num.length < 16) { showToast('⚠️ Número de tarjeta inválido'); return; }
  if (!name)           { showToast('⚠️ Ingresa el nombre del titular'); return; }
  if (exp.length < 5)  { showToast('⚠️ Fecha inválida'); return; }
  if (cvv.length < 3)  { showToast('⚠️ CVV inválido'); return; }

  try {
    await new Promise(r => setTimeout(r, 1000));

    // Actualizar wallet
    const nuevoSaldo = userAcaPoints + selectedPackage.pts;
    await upsertWallet(nuevoSaldo, userSaldoTarjeta);
    txAdd({ tipo:'compra', puntos: selectedPackage.pts, monto_mxn: selectedPackage.mxn,
              descripcion: 'Compra de AcaPoints — $' + selectedPackage.mxn + ' MXN' });
    supaFetch('/rest/v1/transacciones_acapoints', { method:'POST', body: JSON.stringify({
      usuario_id: currentUser.id, tipo:'compra', puntos: selectedPackage.pts,
      monto_mxn: selectedPackage.mxn, descripcion: 'Compra de AcaPoints — $' + selectedPackage.mxn + ' MXN'
    })}).catch(()=>{});

    document.getElementById('modal-balance').textContent = nuevoSaldo.toFixed(0) + ' AcaPoints';
    await crearNotifPago(
      '🪙 AcaPoints comprados',
      'Compraste ' + selectedPackage.pts + ' AcaPoints por $' + selectedPackage.mxn + ' MXN. Saldo actual: ' + nuevoSaldo.toFixed(0) + ' AcaPoints.',
      'compra_acapoints'
    );
    closeBuyPoints();
    showToast('✅ ¡' + selectedPackage.pts + ' AcaPoints añadidos a tu cuenta!');
  } catch(e) {
    showToast('❌ Error al procesar. Intenta de nuevo.'); console.error(e);
  }
}

// ── Helpers de formateo de tarjeta ─────────────────────
function formatCardNumber(input) {
  let v = input.value.replace(/\D/g,'').substring(0,16);
  input.value = v.replace(/(.{4})/g,'$1 ').trim();
}
function formatExpiry(input) {
  let v = input.value.replace(/\D/g,'');
  if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4);
  input.value = v;
}

// ── Patch: inyectar métodos de pago al abrir detalle ───
const _origOpenDetail = openDetail;
openDetail = function(s) {
  _origOpenDetail(s);
  renderPayMethods(s.metodos_pago);
};
// Cargar wallet al iniciar sesión
document.addEventListener('DOMContentLoaded', () => {
  const origLogin = window.loginUser;
  if (typeof loginUser === 'function') {
    const _orig = loginUser;
    window.loginUser = async function(...args) {
      await _orig(...args);
      loadWallet();
    };
  }
  // Intentar cargar si ya hay sesión
  setTimeout(() => { if (currentUser) loadWallet(); }, 800);
});


/* =====================================================
   MIS COMPRAS - ACACONNECT
   ===================================================== */

// ── localStorage helpers para compras ──────────────────
function comprasKey() { return 'aca_compras_' + (currentUser?.id || 'guest'); }

function comprasAdd(compra) {
  try {
    const list = JSON.parse(localStorage.getItem(comprasKey()) || '[]');
    list.unshift(compra);
    localStorage.setItem(comprasKey(), JSON.stringify(list));
  } catch(e) {}
}

function comprasGetAll() {
  try { return JSON.parse(localStorage.getItem(comprasKey()) || '[]'); } catch(e) { return []; }
}

// ── Abrir modal Mis Compras ─────────────────────────────
function openMisCompras() {
  if (!currentUser) { openModal('login'); return; }
  renderMisCompras();
  const overlay = document.getElementById('miscompras-overlay');
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'flex-start';
  overlay.style.justifyContent = 'center';
  document.body.style.overflow = 'hidden';
}

function closeMisCompras() {
  document.getElementById('miscompras-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function renderMisCompras(filtro) {
  const container = document.getElementById('miscompras-list');
  if (!container) return;
  let compras = comprasGetAll();

  // Filtro de búsqueda
  if (filtro) {
    const q = filtro.toLowerCase();
    compras = compras.filter(c =>
      c.folio.toLowerCase().includes(q) ||
      c.servicio_titulo.toLowerCase().includes(q) ||
      c.metodo_pago.toLowerCase().includes(q)
    );
  }

  // Stats
  const total = comprasGetAll().length;
  const gastado = comprasGetAll().reduce((s, c) => s + Number(c.monto), 0);
  document.getElementById('mc-stat-total').textContent = total;
  document.getElementById('mc-stat-monto').textContent = '$' + gastado.toLocaleString('es-MX') + ' MXN';

  if (compras.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 20px;">
        <div style="font-size:48px;margin-bottom:12px;">🛍️</div>
        <h3 style="color:var(--text);margin:0 0 8px;">Aún no tienes compras</h3>
        <p style="color:#888;font-size:14px;">Explora el marketplace y contrata tu primer servicio.</p>
        <button onclick="closeMisCompras();showPage('marketplace')" 
          style="margin-top:16px;background:var(--teal);color:#fff;border:none;padding:12px 28px;border-radius:100px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">
          Ir al Marketplace →
        </button>
      </div>`;
    return;
  }

  const metIcono = { efectivo:'💵', tarjeta:'💳', acapoints:'🪙' };
  const metLabel = { efectivo:'Efectivo', tarjeta:'Tarjeta', acapoints:'AcaPoints' };
  const catColor = { gastronomia:'#e8f5e9', hospedaje:'#e3f2fd', servicios:'#fff3e0', experiencias:'#f3e5f5' };
  const catIcon  = { gastronomia:'🍴', hospedaje:'🏨', servicios:'💼', experiencias:'⛵' };

  container.innerHTML = compras.map(c => {
    const fecha = new Date(c.creado_en).toLocaleDateString('es-MX', {
      day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
    const precioFmt = '$' + Number(c.monto).toLocaleString('es-MX');
    const cardInfo = c.metodo_pago === 'tarjeta' && c.tarjeta_ultimos4
      ? `<span style="font-size:11px;color:#888;"> •••• ${c.tarjeta_ultimos4}</span>` : '';
    const apInfo = c.metodo_pago === 'acapoints'
      ? `<span style="font-size:11px;color:#888;"> ${c.acapoints_usados} pts</span>` : '';
    const imgSrc = c.servicio_imagen || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=60';

    return `
    <div class="mc-card" onclick="openCompraDetalle('${c.folio}')">
      <div class="mc-card-img-wrap">
        <img src="${imgSrc}" alt="${c.servicio_titulo}" onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=60'"/>
        <span class="mc-cat-badge" style="background:${catColor[c.servicio_cat]||'#f0f0f0'}">
          ${catIcon[c.servicio_cat]||'🔖'} ${catLabel(c.servicio_cat)}
        </span>
      </div>
      <div class="mc-card-body">
        <div class="mc-folio">Folio: <strong>${c.folio}</strong></div>
        <h4 class="mc-titulo">${c.servicio_titulo}</h4>
        <div class="mc-meta">
          <span>📍 ${c.servicio_ubicacion || '—'}</span>
          <span>👤 ${c.proveedor_nombre}</span>
        </div>
        <div class="mc-footer">
          <div class="mc-precio">${precioFmt} <span style="font-size:12px;font-weight:400;color:#888">/ ${c.precio_tipo||''}</span></div>
          <div class="mc-metodo">${metIcono[c.metodo_pago]||'💰'} ${metLabel[c.metodo_pago]||c.metodo_pago}${cardInfo}${apInfo}</div>
        </div>
        <div class="mc-fecha">${fecha}</div>
      </div>
      <div class="mc-arrow">›</div>
    </div>`;
  }).join('');
}

// ── Abrir detalle de una compra ─────────────────────────
function openCompraDetalle(folio) {
  const compras = comprasGetAll();
  const c = compras.find(x => x.folio === folio);
  if (!c) return;

  const metIcono = { efectivo:'💵', tarjeta:'💳', acapoints:'🪙' };
  const metLabel = { efectivo:'Efectivo', tarjeta:'Tarjeta simulada', acapoints:'AcaPoints' };
  const fecha = new Date(c.creado_en).toLocaleDateString('es-MX', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
  const hora = new Date(c.creado_en).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  const imgSrc = c.servicio_imagen || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=70';

  document.getElementById('compra-detalle-body').innerHTML = `
    <div class="cd-hero">
      <img src="${imgSrc}" alt="${c.servicio_titulo}" onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'"/>
      <div class="cd-estado-badge">✅ Completado</div>
    </div>

    <div class="cd-section">
      <div class="cd-folio-box">
        <span class="cd-folio-label">Folio de compra</span>
        <span class="cd-folio-num">${c.folio}</span>
        <button class="cd-copy-btn" onclick="copyFolio('${c.folio}')">📋 Copiar</button>
      </div>
    </div>

    <div class="cd-section">
      <div class="cd-section-title">📦 Servicio contratado</div>
      <div class="cd-row"><span>Nombre</span><strong>${c.servicio_titulo}</strong></div>
      <div class="cd-row"><span>Categoría</span><strong>${catLabel(c.servicio_cat)}</strong></div>
      <div class="cd-row"><span>Ubicación</span><strong>${c.servicio_ubicacion || '—'}</strong></div>
      <div class="cd-row"><span>Proveedor</span><strong>${c.proveedor_nombre}</strong></div>
    </div>

    <div class="cd-section">
      <div class="cd-section-title">💰 Detalle del pago</div>
      <div class="cd-row"><span>Monto</span><strong style="color:#007a7a;font-size:18px;">$${Number(c.monto).toLocaleString('es-MX')} MXN</strong></div>
      <div class="cd-row"><span>Tipo de precio</span><strong>${c.precio_tipo || '—'}</strong></div>
      <div class="cd-row"><span>Método</span><strong>${metIcono[c.metodo_pago]} ${metLabel[c.metodo_pago]||c.metodo_pago}</strong></div>
      ${c.metodo_pago === 'tarjeta' && c.tarjeta_ultimos4 ? `<div class="cd-row"><span>Tarjeta</span><strong>•••• •••• •••• ${c.tarjeta_ultimos4}</strong></div>` : ''}
      ${c.metodo_pago === 'tarjeta' && c.tarjeta_titular ? `<div class="cd-row"><span>Titular</span><strong>${c.tarjeta_titular}</strong></div>` : ''}
      ${c.metodo_pago === 'acapoints' ? `<div class="cd-row"><span>AcaPoints usados</span><strong>🪙 ${c.acapoints_usados}</strong></div>` : ''}
    </div>

    <div class="cd-section">
      <div class="cd-section-title">📅 Fecha y hora</div>
      <div class="cd-row"><span>Fecha</span><strong>${fecha}</strong></div>
      <div class="cd-row"><span>Hora</span><strong>${hora}</strong></div>
    </div>

    <div class="cd-actions">
      <button onclick="imprimirTicketPDF('${c.folio}')"
        style="flex:1.2;padding:13px;background:linear-gradient(135deg,#0d2b2b,#005f5f);color:#fff;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
        🎫 Descargar ticket PDF
      </button>
      <button onclick="closeMisCompras();showPage('marketplace')" class="cd-btn-secondary" style="flex:1;">
        🛍️ Ver más servicios
      </button>
    </div>
  `;

  document.getElementById('miscompras-overlay').style.display = 'none';
  const det = document.getElementById('compra-detalle-overlay');
  det.style.display = 'flex';
  det.style.alignItems = 'flex-start';
  det.style.justifyContent = 'center';
}

function closeCompraDetalle() {
  document.getElementById('compra-detalle-overlay').style.display = 'none';
  openMisCompras();
}

function copyFolio(folio) {
  navigator.clipboard?.writeText(folio).then(() => showToast('✅ Folio copiado')).catch(() => showToast('Folio: ' + folio));
}


/* =====================================================
   BILLETERA VIRTUAL — ACACONNECT
   ===================================================== */

// ── localStorage helpers billetera ──────────────────────
function billeteraKey()  { return 'aca_billetera_' + (currentUser?.id || 'guest'); }
function retirosKey()    { return 'aca_retiros_'   + (currentUser?.id || 'guest'); }

function billeteraAdd(mov) {
  try {
    const list = JSON.parse(localStorage.getItem(billeteraKey()) || '[]');
    list.unshift({ ...mov, id: 'MOV-' + Date.now().toString(36).toUpperCase(), fecha: new Date().toISOString() });
    localStorage.setItem(billeteraKey(), JSON.stringify(list.slice(0, 100)));
  } catch(e) {}
}
function billeteraGetAll() {
  try { return JSON.parse(localStorage.getItem(billeteraKey()) || '[]'); } catch(e) { return []; }
}
function retirosAdd(r) {
  try {
    const list = JSON.parse(localStorage.getItem(retirosKey()) || '[]');
    list.unshift(r);
    localStorage.setItem(retirosKey(), JSON.stringify(list));
  } catch(e) {}
}
function retirosGetAll() {
  try { return JSON.parse(localStorage.getItem(retirosKey()) || '[]'); } catch(e) { return []; }
}

// ── Calcular resumen de billetera ───────────────────────
function billeteraResumen() {
  const movs = billeteraGetAllConIngresos();
  let gastoTarjeta   = 0;
  let gastoAcapoints = 0;
  let recargado      = 0;
  let retiradoAca    = 0;
  let retiradoTarjeta= 0;

  let ingresosTarjeta = 0, ingresosAca = 0;
  movs.forEach(m => {
    if (m.tipo === 'gasto_tarjeta')     gastoTarjeta    += Number(m.monto) || 0;
    if (m.tipo === 'gasto_acapoints')   gastoAcapoints  += Number(m.monto) || 0;
    if (m.tipo === 'recarga_acapoints') recargado       += Number(m.monto) || 0;
    if (m.tipo === 'retiro_aca')        retiradoAca     += Number(m.puntos) || 0;
    if (m.tipo === 'retiro_tarjeta')    retiradoTarjeta += Number(m.monto)  || 0;
    if (m.tipo === 'ingreso_tarjeta')   ingresosTarjeta += Number(m.monto)  || 0;
    if (m.tipo === 'ingreso_acapoints') ingresosAca     += Number(m.monto)  || 0;
    if (m.tipo === 'ingreso')           { ingresosTarjeta += Number(m.monto_mxn||0); ingresosAca += Number(m.puntos||0); }
  });

  const retiros = retirosGetAll();
  const pendienteRetiro = retiros
    .filter(r => r.estado === 'pendiente')
    .reduce((s,r) => s + Number(r.monto_mxn || r.monto), 0);

  // Saldos actuales disponibles para retirar
  const saldoAca     = userAcaPoints;
  const saldoTarjeta = userSaldoTarjeta;

  // Equivalente MXN al retirar (con tasas)
  const retirableAcaMxn     = Math.floor(saldoAca     * TASA_RETIRO_ACA * 100) / 100;
  const retirableTarjetaMxn = Math.floor(saldoTarjeta * TASA_RETIRO_TAR * 100) / 100;

  return {
    gastoTarjeta, gastoAcapoints, recargado,
    retiradoAca, retiradoTarjeta, pendienteRetiro,
    ingresosTarjeta, ingresosAca,
    saldoAca, saldoTarjeta,
    retirableAcaMxn, retirableTarjetaMxn,
    totalRetirableMxn: retirableAcaMxn + retirableTarjetaMxn,
    totalGastado: gastoTarjeta + gastoAcapoints,
    totalIngresos: ingresosTarjeta + ingresosAca
  };
}

// ── Abrir billetera ─────────────────────────────────────
// ── Cargar ingresos de ventas (proveedor) desde Supabase ──────────────
let _ingresosVentasCache = [];

async function cargarIngresosVentas() {
  if (!currentUser) return;
  try {
    const res = await fetch(
      SUPA_URL + '/rest/v1/transacciones_acapoints?usuario_id=eq.' + currentUser.id +
      '&tipo=eq.ingreso&order=creado_en.desc&limit=50',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.length) return;

    // Convertir a formato de billetera y mezclar con movimientos locales
    _ingresosVentasCache = data.map(tx => ({
      id:          'ing-' + tx.id,
      tipo:        tx.monto_mxn > 0 ? 'ingreso_tarjeta' : 'ingreso_acapoints',
      monto:       tx.monto_mxn > 0 ? tx.monto_mxn : tx.puntos,
      puntos:      tx.puntos || 0,
      descripcion: tx.descripcion || 'Venta de servicio',
      fecha:       tx.creado_en
    }));
  } catch(e) { console.warn('cargarIngresosVentas:', e.message); }
}

function billeteraGetAllConIngresos() {
  const local = billeteraGetAll();
  // Merge: ingresos de Supabase + movimientos locales, ordenados por fecha
  const merged = [...local, ..._ingresosVentasCache];
  merged.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  // Deduplicar por id
  const seen = new Set();
  return merged.filter(m => {
    const key = m.id || (m.tipo + m.descripcion + m.fecha);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


function openBilletera(tab) {
  if (!currentUser) { openModal('login'); return; }
  const userEl = document.getElementById('bl-header-user');
  if (userEl) userEl.textContent = currentUser.nombre + ' · ' + currentUser.email;
  // Cargar ingresos de ventas desde Supabase antes de renderizar
  cargarIngresosVentas().then(() => renderBilletera(tab || 'resumen'));
  const ovl = document.getElementById('billetera-overlay');
  ovl.style.display = 'flex';
  ovl.style.alignItems = 'flex-start';
  ovl.style.justifyContent = 'center';
  document.body.style.overflow = 'hidden';
}
function closeBilletera() {
  document.getElementById('billetera-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function switchBilleteraTab(tab) {
  document.querySelectorAll('.bl-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.bl-tab[data-tab="${tab}"]`).classList.add('active');
  renderBilleteraContent(tab);
}

function renderBilletera(tab) {
  const res = billeteraResumen();
  const saldo = userAcaPoints;

  // Header
  document.getElementById('bl-saldo-aca').textContent = Math.floor(saldo) + ' 🪙';
  document.getElementById('bl-saldo-mxn').textContent = '$' + Math.floor(saldo).toLocaleString('es-MX') + ' MXN';
  document.getElementById('bl-gasto-tarjeta').textContent = '$' + res.saldoTarjeta.toLocaleString('es-MX');
  document.getElementById('bl-gasto-aca').textContent     = Math.floor(res.saldoAca) + ' 🪙';
  document.getElementById('bl-recargado').textContent     = '$' + res.totalRetirableMxn.toLocaleString('es-MX');

  // Tabs
  document.querySelectorAll('.bl-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.bl-tab[data-tab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');

  renderBilleteraContent(tab);
}

function renderBilleteraContent(tab) {
  const container = document.getElementById('bl-content');
  if (tab === 'resumen')    container.innerHTML = renderBilleteraResumen();
  if (tab === 'movimientos') container.innerHTML = renderBilleteraMovimientos();
  if (tab === 'retirar')    container.innerHTML = renderBilleteraRetiro();
}

// ── Tab Resumen ──────────────────────────────────────────
function renderBilleteraResumen() {
  const movs = billeteraGetAll().slice(0, 3);
  const res  = billeteraResumen();
  const retiros = retirosGetAll();

  const ultimosMov = movs.length === 0
    ? `<p style="text-align:center;color:#aaa;padding:20px;font-size:13px;">Sin movimientos aún</p>`
    : movs.map(m => movHTML(m)).join('');

  const ultimosRetiros = retiros.slice(0, 2).map(r => `
    <div class="bl-retiro-row">
      <div class="bl-retiro-info">
        <strong>${r.banco} ····${r.cuenta_ultimos4}</strong>
        <span>${new Date(r.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</span>
      </div>
      <div>
        <span class="bl-retiro-monto">-$${Number(r.monto).toLocaleString('es-MX')}</span>
        <span class="bl-badge bl-badge-${r.estado}">${r.estado === 'pendiente' ? '⏳ En proceso' : '✅ Completado'}</span>
      </div>
    </div>`).join('') || `<p style="text-align:center;color:#aaa;padding:12px;font-size:13px;">Sin retiros aún</p>`;

  return `
    <div class="bl-resumen-cards">
      <div class="bl-mini-card tarjeta">
        <span class="bl-mini-icon">💳</span>
        <div class="bl-mini-label">Saldo tarjeta</div>
        <div class="bl-mini-val">$${res.saldoTarjeta.toLocaleString('es-MX')} MXN</div>
      </div>
      <div class="bl-mini-card acapoints">
        <span class="bl-mini-icon">🪙</span>
        <div class="bl-mini-label">Saldo AcaPoints</div>
        <div class="bl-mini-val">${Math.floor(res.saldoAca)} pts</div>
      </div>
      ${res.totalIngresos > 0 ? `
      <div class="bl-mini-card ingreso" style="grid-column:1/-1;background:#f1f8e9;border:1.5px solid #a5d6a7;">
        <span class="bl-mini-icon">💰</span>
        <div class="bl-mini-label">Ingresos por ventas</div>
        <div class="bl-mini-val" style="color:#2e7d32;">
          ${res.ingresosTarjeta > 0 ? '$'+res.ingresosTarjeta.toLocaleString('es-MX')+' MXN' : ''}
          ${res.ingresosTarjeta > 0 && res.ingresosAca > 0 ? ' · ' : ''}
          ${res.ingresosAca > 0 ? Math.floor(res.ingresosAca)+' 🪙' : ''}
        </div>
      </div>` : ''}
    </div>

    <div class="bl-section-title">Últimos movimientos</div>
    ${ultimosMov}
    ${movs.length > 0 ? `<button class="bl-ver-todos" onclick="switchBilleteraTab('movimientos')">Ver todos →</button>` : ''}

    <div class="bl-section-title" style="margin-top:20px;">Últimos retiros</div>
    ${ultimosRetiros}
    <button class="bl-btn-retirar" onclick="switchBilleteraTab('retirar')">
      🏦 Transferir a mi cuenta
    </button>`;
}

// ── Tab Movimientos ──────────────────────────────────────
function renderBilleteraMovimientos() {
  const movs = billeteraGetAllConIngresos();
  if (movs.length === 0) return `<p style="text-align:center;color:#aaa;padding:40px 20px;font-size:14px;">Sin movimientos registrados.</p>`;

  // Agrupar por mes
  const grupos = {};
  movs.forEach(m => {
    const k = new Date(m.fecha).toLocaleDateString('es-MX', { month:'long', year:'numeric' });
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(m);
  });

  return Object.entries(grupos).map(([mes, items]) => `
    <div class="bl-mes-label">${mes.charAt(0).toUpperCase() + mes.slice(1)}</div>
    ${items.map(m => movHTML(m)).join('')}
  `).join('');
}

function movHTML(m) {
  const conf = {
    gasto_tarjeta:    { icon:'💳', color:'#e53935', signo:'-', label:'Pago con tarjeta',   bg:'#fff5f5' },
    gasto_acapoints:  { icon:'🪙', color:'#e65100', signo:'-', label:'Pago con AcaPoints', bg:'#fff8f0' },
    recarga_acapoints:{ icon:'⬆️', color:'#2e7d32', signo:'+', label:'Recarga AcaPoints',  bg:'#f1f8e9' },
    retiro:           { icon:'🏦', color:'#1565c0', signo:'-', label:'Transferencia',       bg:'#e8f0fe' },
    retiro_tarjeta:   { icon:'🏦', color:'#1565c0', signo:'-', label:'Retiro tarjeta',      bg:'#e8f0fe' },
    retiro_aca:       { icon:'🏦', color:'#1565c0', signo:'-', label:'Retiro AcaPoints',    bg:'#e8f0fe' },
    ingreso_tarjeta:  { icon:'💰', color:'#2e7d32', signo:'+', label:'Ingreso tarjeta',     bg:'#f1f8e9' },
    ingreso_acapoints:{ icon:'💰', color:'#2e7d32', signo:'+', label:'Ingreso AcaPoints',   bg:'#f1f8e9' },
    ingreso:          { icon:'💰', color:'#2e7d32', signo:'+', label:'Venta de servicio',   bg:'#f1f8e9' },
  };
  const t = conf[m.tipo] || { icon:'💰', color:'#555', signo:'', label:m.tipo, bg:'#f5f5f5' };
  const fecha = new Date(m.fecha).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  const montoLabel = m.tipo === 'gasto_acapoints'
    ? `${t.signo}${Number(m.monto).toFixed(0)} 🪙`
    : m.tipo === 'recarga_acapoints'
    ? `${t.signo}${m.puntos} 🪙 / $${Number(m.monto).toLocaleString('es-MX')}`
    : `${t.signo}$${Number(m.monto).toLocaleString('es-MX')}`;
  const sub = m.tarjeta_ultimos4 ? ` ···· ${m.tarjeta_ultimos4}` : m.folio ? ` · ${m.folio}` : '';

  return `
    <div class="bl-mov-row" style="background:${t.bg}">
      <div class="bl-mov-icon">${t.icon}</div>
      <div class="bl-mov-info">
        <strong>${m.descripcion || t.label}</strong>
        <span>${fecha}${sub}</span>
      </div>
      <div class="bl-mov-monto" style="color:${t.color}">${montoLabel}</div>
    </div>`;
}

// ── Tab Retirar / Transferir ────────────────────────────
function renderBilleteraRetiro() {
  const res = billeteraResumen();
  const retiros = retirosGetAll();

  const historial = retiros.length === 0
    ? `<p style="text-align:center;color:#aaa;font-size:13px;padding:10px 0;">Sin transferencias anteriores</p>`
    : retiros.map(r => `
      <div class="bl-retiro-row">
        <div class="bl-retiro-info">
          <strong>${r.banco} ····${r.cuenta_ultimos4}</strong>
          <span>${new Date(r.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span>
        </div>
        <div style="text-align:right;">
          <div class="bl-retiro-monto">-$${Number(r.monto_mxn||r.monto).toLocaleString('es-MX')} MXN</div>
          <span class="bl-badge bl-badge-${r.estado}">${r.estado==='pendiente'?'⏳ En proceso':'✅ Completado'}</span>
        </div>
      </div>`).join('');

  return `
    <!-- Tarjetas de saldo -->
    <div class="bl-saldos-retiro-grid">
      <div class="bl-saldo-retiro-card tarjeta">
        <div class="bl-src-icon">💳</div>
        <div class="bl-src-label">Saldo Tarjeta</div>
        <div class="bl-src-monto">$${res.saldoTarjeta.toLocaleString('es-MX')} MXN</div>
        <div class="bl-src-tasa">Tasa retiro: $1.00 MXN / peso</div>
        <div class="bl-src-retirable">Retirable: <strong>$${res.retirableTarjetaMxn.toLocaleString('es-MX')} MXN</strong></div>
      </div>
      <div class="bl-saldo-retiro-card acapoints">
        <div class="bl-src-icon">🪙</div>
        <div class="bl-src-label">Saldo AcaPoints</div>
        <div class="bl-src-monto">${Math.floor(res.saldoAca)} pts</div>
        <div class="bl-src-tasa">Tasa retiro: $0.80 MXN / pt</div>
        <div class="bl-src-retirable">Retirable: <strong>$${res.retirableAcaMxn.toLocaleString('es-MX')} MXN</strong></div>
      </div>
    </div>

    <div class="bl-total-retirable">
      Total disponible para transferir:
      <strong>$${res.totalRetirableMxn.toLocaleString('es-MX')} MXN</strong>
    </div>

    <div class="bl-info-box" style="margin-top:12px;">
      <span>ℹ️</span>
      <div>
        <strong>Tasas de retiro</strong>
        <p>💳 Pagos con tarjeta: <strong>$1.00 MXN por cada peso</strong> (sin descuento).<br>
           🪙 AcaPoints: <strong>$0.80 MXN por punto</strong> (mismo valor que al comprar servicios).<br>
           Tiempo estimado: 1–3 días hábiles (simulado).</p>
      </div>
    </div>

    <div class="bl-form-retiro" id="bl-form-retiro">
      <div class="form-group" style="margin-top:16px;">
        <label class="form-label">¿De dónde retirar?</label>
        <div class="bl-fuente-selector">
          <button class="bl-fuente-btn active" data-fuente="tarjeta" onclick="blSelectFuente(this,'tarjeta')">
            💳 Tarjeta <span>$${res.retirableTarjetaMxn.toLocaleString('es-MX')}</span>
          </button>
          <button class="bl-fuente-btn" data-fuente="acapoints" onclick="blSelectFuente(this,'acapoints')">
            🪙 AcaPoints <span>${Math.floor(res.saldoAca)} pts</span>
          </button>
          <button class="bl-fuente-btn" data-fuente="ambos" onclick="blSelectFuente(this,'ambos')">
            🔀 Ambos
          </button>
        </div>
      </div>

      <div id="bl-inputs-tarjeta" class="form-group">
        <label class="form-label">Monto de tarjeta a retirar ($MXN)</label>
        <input class="form-input" id="bl-monto-tarjeta" type="number" min="0" max="${res.retirableTarjetaMxn}"
          placeholder="Ej: 400" oninput="blUpdateResumen()"/>
      </div>
      <div id="bl-inputs-aca" class="form-group" style="display:none;">
        <label class="form-label">AcaPoints a retirar</label>
        <input class="form-input" id="bl-monto-aca" type="number" min="0" max="${Math.floor(res.saldoAca)}"
          placeholder="Ej: 100" oninput="blUpdateResumen()"/>
        <p style="font-size:11px;color:#888;margin-top:4px;">1 AcaPoint → $0.80 MXN al retirar</p>
      </div>

      <div class="bl-retiro-resumen" id="bl-retiro-resumen" style="display:none;">
        <div class="bl-rr-row"><span>💳 Tarjeta</span><span id="bl-rr-tarjeta">$0</span></div>
        <div class="bl-rr-row"><span>🪙 AcaPoints</span><span id="bl-rr-aca">0 pts → $0</span></div>
        <div class="bl-rr-total"><span>Total a recibir</span><strong id="bl-rr-total">$0 MXN</strong></div>
      </div>

      <div class="form-group">
        <label class="form-label">Banco destino</label>
        <select class="form-select" id="bl-banco">
          <option value="">Selecciona tu banco</option>
          <option>BBVA</option><option>Banamex</option><option>Banorte</option>
          <option>Santander</option><option>HSBC</option><option>Scotiabank</option>
          <option>Inbursa</option><option>BanBajío</option><option>Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">CLABE interbancaria (18 dígitos)</label>
        <input class="form-input" id="bl-clabe" type="text" maxlength="18"
          placeholder="000000000000000000" oninput="this.value=this.value.replace(/\D/g,'')"/>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre del titular</label>
        <input class="form-input" id="bl-titular" type="text" placeholder="Como aparece en tu cuenta"/>
      </div>
      <button class="btn-publish" onclick="confirmarRetiro()" style="width:100%;margin-top:4px;">
        🏦 Confirmar transferencia
      </button>
    </div>

    <div class="bl-section-title" style="margin-top:24px;">Historial de transferencias</div>
    ${historial}`;
}

function blSelectFuente(btn, fuente) {
  document.querySelectorAll('.bl-fuente-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tar = document.getElementById('bl-inputs-tarjeta');
  const aca = document.getElementById('bl-inputs-aca');
  if (fuente === 'tarjeta')   { tar.style.display='block'; aca.style.display='none'; }
  if (fuente === 'acapoints') { tar.style.display='none';  aca.style.display='block'; }
  if (fuente === 'ambos')     { tar.style.display='block'; aca.style.display='block'; }
  blUpdateResumen();
}

function blUpdateResumen() {
  const montoTar = parseFloat(document.getElementById('bl-monto-tarjeta')?.value) || 0;
  const montoAca = parseFloat(document.getElementById('bl-monto-aca')?.value) || 0;
  const mxnTar   = montoTar;
  const mxnAca   = Math.floor(montoAca * TASA_RETIRO_ACA * 100) / 100;
  const total    = mxnTar + mxnAca;

  const res = document.getElementById('bl-retiro-resumen');
  if (!res) return;
  if (montoTar > 0 || montoAca > 0) {
    res.style.display = 'block';
    document.getElementById('bl-rr-tarjeta').textContent = '$' + mxnTar.toLocaleString('es-MX') + ' MXN';
    document.getElementById('bl-rr-aca').textContent     = montoAca + ' pts → $' + mxnAca.toLocaleString('es-MX') + ' MXN';
    document.getElementById('bl-rr-total').textContent   = '$' + total.toLocaleString('es-MX') + ' MXN';
  } else {
    res.style.display = 'none';
  }
}

async function confirmarRetiro() {
  const res       = billeteraResumen();
  const montoTar  = parseFloat(document.getElementById('bl-monto-tarjeta')?.value) || 0;
  const montoAca  = parseFloat(document.getElementById('bl-monto-aca')?.value)     || 0;
  const banco     = document.getElementById('bl-banco').value;
  const clabe     = document.getElementById('bl-clabe').value.trim();
  const titular   = document.getElementById('bl-titular').value.trim();

  const mxnAca    = Math.floor(montoAca * TASA_RETIRO_ACA * 100) / 100;
  const totalMxn  = montoTar + mxnAca;

  if (montoTar <= 0 && montoAca <= 0) { showToast('⚠️ Ingresa al menos un monto'); return; }
  if (montoTar > res.retirableTarjetaMxn) { showToast('⚠️ Saldo de tarjeta insuficiente'); return; }
  if (montoAca > res.saldoAca)            { showToast('⚠️ Saldo de AcaPoints insuficiente'); return; }
  if (!banco)                             { showToast('⚠️ Selecciona tu banco'); return; }
  if (clabe.length !== 18)                { showToast('⚠️ La CLABE debe tener 18 dígitos'); return; }
  if (!titular)                           { showToast('⚠️ Ingresa el titular de la cuenta'); return; }

  const btn = document.querySelector('#bl-form-retiro .btn-publish');
  btn.textContent = 'Procesando...'; btn.disabled = true;
  await new Promise(r => setTimeout(r, 1300));

  const folio           = 'RET-' + Date.now().toString(36).toUpperCase();
  const cuenta_ultimos4 = clabe.slice(-4);

  // Descontar ambos saldos y guardar en Supabase en una sola operación
  const nuevoAcaRet  = montoAca > 0 ? userAcaPoints - montoAca : userAcaPoints;
  const nuevoTarRet  = montoTar > 0 ? userSaldoTarjeta - montoTar : userSaldoTarjeta;
  await upsertWallet(nuevoAcaRet, nuevoTarRet);
  if (montoTar > 0) {
    billeteraAdd({ tipo:'retiro_tarjeta', monto:montoTar,
      descripcion:`Retiro tarjeta → ${banco}`, folio, banco, cuenta_ultimos4 });
  }
  // Descontar AcaPoints
  if (montoAca > 0) {
    {
    billeteraAdd({ tipo:'retiro_aca', puntos:montoAca, monto:mxnAca,
      descripcion:`Retiro AcaPoints → ${banco}`, folio, banco, cuenta_ultimos4 });
    txAdd({ tipo:'reembolso', puntos:montoAca, descripcion:`Retiro a ${banco} ····${cuenta_ultimos4}` });
    }
  }

  // Guardar retiro
  retirosAdd({
    folio, banco, cuenta_ultimos4, titular,
    monto_tarjeta: montoTar,
    puntos_aca: montoAca,
    mxn_aca: mxnAca,
    monto_mxn: totalMxn,
    clabe_enmascarada: clabe.slice(0,6) + '·'.repeat(8) + clabe.slice(-4),
    estado: 'pendiente',
    fecha: new Date().toISOString()
  });

  btn.textContent = 'Confirmar transferencia'; btn.disabled = false;

  // Pantalla de éxito
  document.getElementById('bl-content').innerHTML = `
    <div style="text-align:center;padding:32px 20px;">
      <div style="font-size:56px;margin-bottom:12px;">🎉</div>
      <h3 style="margin:0 0 8px;color:#1a1a1a;">¡Transferencia solicitada!</h3>
      <p style="color:#666;font-size:14px;margin-bottom:20px;">
        Tu retiro está en proceso y llegará a tu cuenta en 1–3 días hábiles.
      </p>
      <div style="background:#f0faf8;border:1.5px solid #b2dfdb;border-radius:14px;padding:16px 18px;margin-bottom:16px;text-align:left;">
        <div style="font-size:11px;color:#666;margin-bottom:6px;">Folio de retiro</div>
        <div style="font-family:monospace;font-size:15px;font-weight:800;color:#007a7a;">${folio}</div>
        <div style="height:1px;background:#e0e0e0;margin:10px 0;"></div>
        ${montoTar > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="color:#888;">💳 De tarjeta</span><strong>$${montoTar.toLocaleString('es-MX')} MXN</strong></div>` : ''}
        ${montoAca > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="color:#888;">🪙 De AcaPoints (${montoAca} pts)</span><strong>$${mxnAca.toLocaleString('es-MX')} MXN</strong></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;border-top:1px solid #e0e0e0;padding-top:8px;margin-top:4px;"><span>Total a recibir</span><span style="color:#007a7a;">$${totalMxn.toLocaleString('es-MX')} MXN</span></div>
        <div style="font-size:11px;color:#aaa;margin-top:8px;">${banco} · ····${cuenta_ultimos4}</div>
      </div>
      <button onclick="openBilletera('resumen')"
        style="background:var(--teal);color:#fff;border:none;border-radius:12px;padding:13px 32px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;width:100%;">
        Ver mi billetera
      </button>
    </div>`;
}



function closeMisCompras() {
  document.getElementById('miscompras-overlay').style.display = 'none';
  document.body.style.overflow = '';
}


function openCompraDetalle(folio) {
  const compras = comprasGetAll();
  const c = compras.find(x => x.folio === folio);
  if (!c) return;

  const metIcono = { efectivo:'💵', tarjeta:'💳', acapoints:'🪙' };
  const metLabel = { efectivo:'Efectivo', tarjeta:'Tarjeta simulada', acapoints:'AcaPoints' };
  const fecha = new Date(c.creado_en).toLocaleDateString('es-MX', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
  const hora = new Date(c.creado_en).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  const imgSrc = c.servicio_imagen || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=70';

  document.getElementById('compra-detalle-body').innerHTML = `
    <div class="cd-hero">
      <img src="${imgSrc}" alt="${c.servicio_titulo}" onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'"/>
      <div class="cd-estado-badge">✅ Completado</div>
    </div>

    <div class="cd-section">
      <div class="cd-folio-box">
        <span class="cd-folio-label">Folio de compra</span>
        <span class="cd-folio-num">${c.folio}</span>
        <button class="cd-copy-btn" onclick="copyFolio('${c.folio}')">📋 Copiar</button>
      </div>
    </div>

    <div class="cd-section">
      <div class="cd-section-title">📦 Servicio contratado</div>
      <div class="cd-row"><span>Nombre</span><strong>${c.servicio_titulo}</strong></div>
      <div class="cd-row"><span>Categoría</span><strong>${catLabel(c.servicio_cat)}</strong></div>
      <div class="cd-row"><span>Ubicación</span><strong>${c.servicio_ubicacion || '—'}</strong></div>
      <div class="cd-row"><span>Proveedor</span><strong>${c.proveedor_nombre}</strong></div>
    </div>

    <div class="cd-section">
      <div class="cd-section-title">💰 Detalle del pago</div>
      <div class="cd-row"><span>Monto</span><strong style="color:#007a7a;font-size:18px;">$${Number(c.monto).toLocaleString('es-MX')} MXN</strong></div>
      <div class="cd-row"><span>Tipo de precio</span><strong>${c.precio_tipo || '—'}</strong></div>
      <div class="cd-row"><span>Método</span><strong>${metIcono[c.metodo_pago]} ${metLabel[c.metodo_pago]||c.metodo_pago}</strong></div>
      ${c.metodo_pago === 'tarjeta' && c.tarjeta_ultimos4 ? `<div class="cd-row"><span>Tarjeta</span><strong>•••• •••• •••• ${c.tarjeta_ultimos4}</strong></div>` : ''}
      ${c.metodo_pago === 'tarjeta' && c.tarjeta_titular ? `<div class="cd-row"><span>Titular</span><strong>${c.tarjeta_titular}</strong></div>` : ''}
      ${c.metodo_pago === 'acapoints' ? `<div class="cd-row"><span>AcaPoints usados</span><strong>🪙 ${c.acapoints_usados}</strong></div>` : ''}
    </div>

    <div class="cd-section">
      <div class="cd-section-title">📅 Fecha y hora</div>
      <div class="cd-row"><span>Fecha</span><strong>${fecha}</strong></div>
      <div class="cd-row"><span>Hora</span><strong>${hora}</strong></div>
    </div>

    <div class="cd-actions">
      <button onclick="imprimirTicketPDF('${c.folio}')"
        style="flex:1.2;padding:13px;background:linear-gradient(135deg,#0d2b2b,#005f5f);color:#fff;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
        🎫 Descargar ticket PDF
      </button>
      <button onclick="closeMisCompras();showPage('marketplace')" class="cd-btn-secondary" style="flex:1;">
        🛍️ Ver más servicios
      </button>
    </div>
  `;

  document.getElementById('miscompras-overlay').style.display = 'none';
  const det = document.getElementById('compra-detalle-overlay');
  det.style.display = 'flex';
  det.style.alignItems = 'flex-start';
  det.style.justifyContent = 'center';
}

function closeCompraDetalle() {
  document.getElementById('compra-detalle-overlay').style.display = 'none';
  openMisCompras();
}

function copyFolio(folio) {
  navigator.clipboard?.writeText(folio).then(() => showToast('✅ Folio copiado')).catch(() => showToast('Folio: ' + folio));
}


/* =====================================================
   BILLETERA VIRTUAL — ACACONNECT
   ===================================================== */

// ── localStorage helpers billetera ──────────────────────
function billeteraKey()  { return 'aca_billetera_' + (currentUser?.id || 'guest'); }
function retirosKey()    { return 'aca_retiros_'   + (currentUser?.id || 'guest'); }

function billeteraAdd(mov) {
  try {
    const list = JSON.parse(localStorage.getItem(billeteraKey()) || '[]');
    list.unshift({ ...mov, id: 'MOV-' + Date.now().toString(36).toUpperCase(), fecha: new Date().toISOString() });
    localStorage.setItem(billeteraKey(), JSON.stringify(list.slice(0, 100)));
  } catch(e) {}
}
function billeteraGetAll() {
  try { return JSON.parse(localStorage.getItem(billeteraKey()) || '[]'); } catch(e) { return []; }
}
function retirosAdd(r) {
  try {
    const list = JSON.parse(localStorage.getItem(retirosKey()) || '[]');
    list.unshift(r);
    localStorage.setItem(retirosKey(), JSON.stringify(list));
  } catch(e) {}
}
function retirosGetAll() {
  try { return JSON.parse(localStorage.getItem(retirosKey()) || '[]'); } catch(e) { return []; }
}

// ── Calcular resumen de billetera ───────────────────────


/* =====================================================
   ADMIN — PANEL DE GANANCIAS
   ===================================================== */

// Precios y márgenes oficiales de AcaPoints
const ACA_PACKAGES = [
  { mxn: 50,  pts: 42,  ganancia: 8,  margen: 16.0 },
  { mxn: 100, pts: 85,  ganancia: 15, margen: 15.0 },
  { mxn: 200, pts: 170, ganancia: 30, margen: 15.0 },
  { mxn: 500, pts: 425, ganancia: 75, margen: 15.0 },
];
// Tasa retiro AcaPoints: usuario recibe $0.80 por punto → plataforma gana $0.20 extra por cada punto retirado
const MARGEN_RETIRO_ACA = 0.20; // $0.20 por AcaPoint retirado

async function renderAdminRoles() {
  const list = document.getElementById('admin-list');
  list.innerHTML = `<div style="text-align:center;padding:30px;color:#aaa;">⏳ Cargando roles...</div>`;

  try {
    const [roles, usuarios] = await Promise.all([
      supaFetch('/rest/v1/roles?order=nivel.desc&select=*').catch(()=>[]),
      supaFetch('/rest/v1/usuarios?select=id,nombre,email,rol,tipo&order=nombre.asc'),
    ]);

    const historial = await supaFetch('/rest/v1/historial_roles?order=cambiado_en.desc&limit=10&select=*').catch(()=>[]);

    const countByRol = {};
    (usuarios||[]).forEach(u => {
      const r = u.rol || u.tipo || 'cliente';
      countByRol[r] = (countByRol[r]||0) + 1;
    });

    const COLORS = { admin:'#E53935', supervisor:'#F57C00', vendedor:'#1976D2', cliente:'#388E3C' };
    const BG     = { admin:'#FFEBEE', supervisor:'#FFF3E0', vendedor:'#E3F2FD', cliente:'#E8F5E9' };
    const ICONS  = { admin:'👑', supervisor:'🔍', vendedor:'🏪', cliente:'👤' };

    list.innerHTML = `
    <div style="padding:4px 0;">

      <!-- Botón exportar PDF -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
        <button onclick="exportarUsuariosPDF()"
          style="background:#1565C0;color:#fff;border:none;border-radius:20px;padding:8px 16px;
                 font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
                 display:flex;align-items:center;gap:6px;">
          📄 Exportar usuarios PDF
        </button>
      </div>

      <!-- Tarjetas de roles -->
      <div style="font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Roles del sistema</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px;">
        ${(roles&&roles.length?roles:[
          {slug:'admin',nombre:'Administrador',descripcion:'Acceso total',icono:'👑',nivel:4},
          {slug:'supervisor',nombre:'Supervisor',descripcion:'Modera contenido',icono:'🔍',nivel:3},
          {slug:'vendedor',nombre:'Vendedor',descripcion:'Publica servicios',icono:'🏪',nivel:2},
          {slug:'cliente',nombre:'Cliente',descripcion:'Contrata servicios',icono:'👤',nivel:1},
        ]).map(r => `
        <div style="background:${BG[r.slug]||'#f5f5f5'};border:1.5px solid ${COLORS[r.slug]||'#ccc'};
                    border-radius:14px;padding:14px 16px;">
          <div style="font-size:24px;margin-bottom:4px;">${r.icono}</div>
          <div style="font-size:15px;font-weight:800;color:${COLORS[r.slug]||'#333'};">${r.nombre}</div>
          <div style="font-size:11px;color:#888;margin:4px 0 8px;">${r.descripcion||''}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="background:${COLORS[r.slug]||'#888'};color:white;font-size:12px;font-weight:700;
                         padding:3px 10px;border-radius:20px;">${countByRol[r.slug]||0} usuarios</span>
            <span style="font-size:11px;color:#aaa;">Nivel ${r.nivel}</span>
          </div>
        </div>`).join('')}
      </div>

      <!-- Lista de usuarios con rol -->
      <div style="font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Usuarios y sus roles</div>
      <div style="background:#fff;border:1.5px solid #e8e8e8;border-radius:14px;overflow:hidden;margin-bottom:20px;">
        ${(usuarios||[]).map(u => {
          const r   = u.rol || u.tipo || 'cliente';
          const esYo = currentUser && u.id === currentUser.id;
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #f5f5f5;">
            <div style="width:34px;height:34px;border-radius:50%;background:${BG[r]||'#f5f5f5'};
                        display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
              ${ICONS[r]||'👤'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#1a1a1a;">
                ${u.nombre}
                ${esYo?'<span style="font-size:10px;background:#eee;padding:1px 6px;border-radius:10px;color:#888;margin-left:4px;">Tú</span>':''}
              </div>
              <div style="font-size:11px;color:#aaa;">${u.email}</div>
            </div>
            ${esYo
              ? `<span style="font-size:11px;color:#aaa;padding:5px 10px;">—</span>`
              : `<select onchange="cambiarRol('${u.id}',this.value,'${r}')"
                  style="border:1.5px solid ${COLORS[r]||'#ccc'};background:${BG[r]||'#f5f5f5'};
                         color:${COLORS[r]||'#333'};font-family:'DM Sans',sans-serif;font-size:12px;
                         font-weight:700;padding:5px 10px;border-radius:20px;cursor:pointer;outline:none;">
                  <option value="admin"      ${r==='admin'      ?'selected':''}>👑 Admin</option>
                  <option value="supervisor" ${r==='supervisor' ?'selected':''}>🔍 Supervisor</option>
                  <option value="vendedor"   ${r==='vendedor'   ?'selected':''}>🏪 Vendedor</option>
                  <option value="cliente"    ${r==='cliente'    ?'selected':''}>👤 Cliente</option>
                </select>`
            }
          </div>`;
        }).join('')}
      </div>

      <!-- Historial reciente -->
      <div style="font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Cambios recientes de rol</div>
      <div style="background:#fff;border:1.5px solid #e8e8e8;border-radius:14px;overflow:hidden;">
        ${!(historial&&historial.length)
          ? `<p style="text-align:center;color:#aaa;padding:20px;font-size:13px;">Sin cambios registrados aún</p>`
          : historial.map(h => {
              const fecha = new Date(h.cambiado_en).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
              return `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f5f5f5;font-size:12px;">
                <span style="font-size:16px;">🔄</span>
                <div style="flex:1;">
                  <strong>Usuario #${h.usuario_id}</strong>
                  <span style="color:#aaa;"> · ${h.rol_anterior||'—'} → </span>
                  <span style="color:${COLORS[h.rol_nuevo]||'#333'};font-weight:700;">${h.rol_nuevo}</span>
                </div>
                <span style="color:#bbb;white-space:nowrap;">${fecha}</span>
              </div>`;
            }).join('')
        }
      </div>

    </div>`;

  } catch(e) {
    list.innerHTML = `<p style="color:red;padding:20px;font-size:13px;">Error al cargar roles: ${e.message}</p>`;
  }
}


async function renderAdminGanancias() {
  const list = document.getElementById('admin-list');
  list.innerHTML = `<div style="text-align:center;padding:30px;color:#aaa;">⏳ Cargando ganancias...</div>`;

  try {
    // ── Leer TODAS las transacciones desde Supabase ───────
    const [txs, retiros, pagos] = await Promise.all([
      supaFetch('/rest/v1/transacciones_acapoints?order=creado_en.desc&select=*'),
      supaFetch('/rest/v1/transacciones_acapoints?tipo=eq.reembolso&select=puntos,creado_en').catch(()=>[]),
      supaFetch('/rest/v1/pagos?select=id,metodo_pago,monto,creado_en&order=creado_en.desc').catch(()=>[]),
    ]);

    // ── Calcular ganancias ────────────────────────────────
    let totalVentaAca = 0, totalGananciaAca = 0, totalTransacciones = 0;
    let totalRetirosAca = 0, totalGananciaRetiros = 0;
    const ventasPorPaquete = { 50:0, 100:0, 200:0, 500:0 };

    (txs||[]).forEach(tx => {
      if (tx.tipo === 'compra' && tx.monto_mxn) {
        const mxn = Number(tx.monto_mxn);
        const pkg = ACA_PACKAGES.find(p => p.mxn === mxn);
        if (pkg) {
          totalVentaAca    += pkg.mxn;
          totalGananciaAca += pkg.ganancia;
          totalTransacciones++;
          ventasPorPaquete[pkg.mxn] = (ventasPorPaquete[pkg.mxn]||0) + 1;
        }
      }
      if (tx.tipo === 'reembolso' && tx.puntos) {
        totalRetirosAca      += Number(tx.puntos);
        totalGananciaRetiros += Number(tx.puntos) * MARGEN_RETIRO_ACA;
      }
    });

    // Ingresos por pagos con tarjeta (5% comisión implícita de la plataforma)
    const COMISION_TARJETA = 0.05;
    const totalPagosTarjeta = (pagos||[]).filter(p=>p.metodo_pago==='tarjeta').reduce((s,p)=>s+Number(p.monto||0),0);
    const gananciaTarjeta   = totalPagosTarjeta * COMISION_TARJETA;

    const totalGananciaBruta = totalGananciaAca + totalGananciaRetiros + gananciaTarjeta;
    const margenPromedio = totalVentaAca > 0
      ? ((totalGananciaAca / totalVentaAca) * 100).toFixed(1) : '15.0';

    // ── Ingresos por mes (últimos 6) ─────────────────────
    function porMes(arr, campoMonto) {
      const now = new Date();
      const meses = {};
      for (let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        meses[d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'})] = 0;
      }
      (arr||[]).forEach(item => {
        const d = new Date(item.creado_en);
        const k = d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'});
        if (meses[k] !== undefined) meses[k] += campoMonto ? Number(item[campoMonto]||0) : 1;
      });
      return meses;
    }
    const txCompras   = (txs||[]).filter(t=>t.tipo==='compra');
    const comprasMes  = porMes(txCompras, 'monto_mxn');
    const retirosMes  = porMes((txs||[]).filter(t=>t.tipo==='reembolso'));
    const meses       = Object.keys(comprasMes);

    const maxVentas = Math.max(...Object.values(ventasPorPaquete), 1);
    const barColors = { 50:'#42a5f5', 100:'#26c6da', 200:'#66bb6a', 500:'#ab47bc' };

    list.innerHTML = `
    <div class="ag-wrapper">

      <!-- Botón exportar PDF -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
        <button onclick="exportarGananciasPDF()"
          style="background:#2e7d32;color:#fff;border:none;border-radius:20px;padding:8px 16px;
                 font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
                 display:flex;align-items:center;gap:6px;">
          📄 Exportar reporte PDF
        </button>
      </div>

      <!-- KPI cards -->
      <div class="ag-kpis">
        <div class="ag-kpi verde">
          <div class="ag-kpi-icon">💰</div>
          <div class="ag-kpi-val">$${totalGananciaBruta.toLocaleString('es-MX',{minimumFractionDigits:2})} MXN</div>
          <div class="ag-kpi-label">Ganancia bruta total</div>
        </div>
        <div class="ag-kpi azul">
          <div class="ag-kpi-icon">🪙</div>
          <div class="ag-kpi-val">$${totalVentaAca.toLocaleString('es-MX')} MXN</div>
          <div class="ag-kpi-label">Ventas de AcaPoints</div>
        </div>
        <div class="ag-kpi naranja">
          <div class="ag-kpi-icon">📊</div>
          <div class="ag-kpi-val">${margenPromedio}%</div>
          <div class="ag-kpi-label">Margen promedio</div>
        </div>
        <div class="ag-kpi morado">
          <div class="ag-kpi-icon">🔄</div>
          <div class="ag-kpi-val">${totalTransacciones}</div>
          <div class="ag-kpi-label">Transacciones</div>
        </div>
      </div>

      <!-- Gráfica ingresos por mes -->
      <div class="ag-section">
        <div class="ag-section-title">📈 Ingresos por mes (últimos 6 meses)</div>
        <div style="background:#fff;border:1.5px solid #e8e8e8;border-radius:12px;padding:16px;">
          <canvas id="ag-chart-meses" height="160"></canvas>
        </div>
      </div>

      <!-- Desglose de ganancias -->
      <div class="ag-section">
        <div class="ag-section-title">📋 Desglose de ganancias</div>
        <div class="ag-table">
          <div class="ag-table-head">
            <span>Fuente</span><span>Ingresos</span><span>Costo</span><span>Ganancia</span><span>Margen</span>
          </div>
          ${ACA_PACKAGES.map(p => `
          <div class="ag-table-row">
            <span>🪙 Paquete $${p.mxn} MXN (${ventasPorPaquete[p.mxn]||0} ventas)</span>
            <span>$${((ventasPorPaquete[p.mxn]||0)*p.mxn).toLocaleString('es-MX')}</span>
            <span>$${((ventasPorPaquete[p.mxn]||0)*p.pts).toLocaleString('es-MX')}</span>
            <span class="ag-green">+$${((ventasPorPaquete[p.mxn]||0)*p.ganancia).toLocaleString('es-MX')}</span>
            <span><span class="ag-badge-green">${p.margen}%</span></span>
          </div>`).join('')}
          <div class="ag-table-row">
            <span>🏦 Retiros AcaPoints (${totalRetirosAca.toFixed(0)} pts)</span>
            <span>—</span><span>—</span>
            <span class="ag-green">+$${totalGananciaRetiros.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
            <span><span class="ag-badge-green">20%</span></span>
          </div>
          <div class="ag-table-row">
            <span>💳 Comisión tarjeta (${(COMISION_TARJETA*100).toFixed(0)}% de $${totalPagosTarjeta.toLocaleString('es-MX')})</span>
            <span>$${totalPagosTarjeta.toLocaleString('es-MX')}</span><span>—</span>
            <span class="ag-green">+$${gananciaTarjeta.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
            <span><span class="ag-badge-green">${(COMISION_TARJETA*100).toFixed(0)}%</span></span>
          </div>
          <div class="ag-table-row ag-total-row">
            <span><strong>TOTAL</strong></span>
            <span><strong>$${(totalVentaAca+totalPagosTarjeta).toLocaleString('es-MX')}</strong></span>
            <span><strong>—</strong></span>
            <span><strong class="ag-green">+$${totalGananciaBruta.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></span>
            <span><strong>${margenPromedio}%</strong></span>
          </div>
        </div>
      </div>

      <!-- Gráfica de ventas por paquete -->
      <div class="ag-section">
        <div class="ag-section-title">📊 Ventas por paquete</div>
        <div class="ag-chart">
          ${ACA_PACKAGES.map(p => {
            const ventas = ventasPorPaquete[p.mxn] || 0;
            const pct = maxVentas > 0 ? (ventas / maxVentas * 100) : 0;
            return `
            <div class="ag-bar-row">
              <div class="ag-bar-label">$${p.mxn} MXN → ${p.pts}pts</div>
              <div class="ag-bar-wrap">
                <div class="ag-bar" style="width:${Math.max(pct,2)}%;background:${barColors[p.mxn]}"></div>
              </div>
              <div class="ag-bar-val">${ventas} ventas · $${(ventas*p.ganancia).toLocaleString('es-MX')} gan.</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Política de precios -->
      <div class="ag-section">
        <div class="ag-section-title">⚙️ Política de precios AcaPoints</div>
        <div class="ag-policy">
          <div class="ag-policy-row"><span>💳 Valor para compras</span><strong>1 AcaPoint = $1.00 MXN</strong></div>
          <div class="ag-policy-row"><span>🏦 Tasa de retiro</span><strong>1 AcaPoint = $0.80 MXN</strong></div>
          <div class="ag-policy-row"><span>📈 Margen mínimo garantizado</span><strong class="ag-green">15%</strong></div>
          <div class="ag-policy-row"><span>💰 Ganancia en retiro por punto</span><strong class="ag-green">$0.20 MXN</strong></div>
          <div class="ag-policy-row"><span>💳 Comisión por pago con tarjeta</span><strong class="ag-green">5%</strong></div>
        </div>
        <div class="ag-packages-preview">
          ${ACA_PACKAGES.map(p => `
          <div class="ag-pkg-preview">
            <div class="ag-pkp-precio">$${p.mxn} MXN</div>
            <div class="ag-pkp-arrow">→</div>
            <div class="ag-pkp-pts">${p.pts} 🪙</div>
            <div class="ag-pkp-ganancia">+$${p.ganancia} gan.</div>
            <div class="ag-pkp-margen">${p.margen}%</div>
          </div>`).join('')}
        </div>
      </div>

    </div>`;

    // ── Gráfica ingresos por mes ──────────────────────────
    if (window.Chart) {
      const ctx = document.getElementById('ag-chart-meses');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: meses,
            datasets: [
              { label: 'Ingresos ($MXN)',  data: Object.values(comprasMes),
                backgroundColor: 'rgba(46,125,50,0.75)', borderRadius: 6, borderSkipped: false },
              { label: 'Retiros (cant.)',   data: Object.values(retirosMes),
                backgroundColor: 'rgba(21,101,192,0.6)', borderRadius: 6, borderSkipped: false, type: 'line',
                borderColor: '#1565C0', pointRadius: 4, tension: 0.3, fill: false, yAxisID: 'y2' }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
            scales: {
              y:  { beginAtZero: true, position: 'left', title: { display:true, text:'MXN' } },
              y2: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display:true, text:'Retiros' } },
              x:  { grid: { display: false } }
            }
          }
        });
      }
    }

  } catch(e) {
    list.innerHTML = `<div style="text-align:center;padding:30px;color:#c62828;">❌ Error: ${e.message}</div>`;
    console.error(e);
  }
}


/* =====================================================
   ADMIN — VERIFICACIONES DE VENDEDORES
   ===================================================== */

async function renderAdminVerificaciones() {
  const list = document.getElementById('admin-list');
  list.innerHTML = `<div style="text-align:center;padding:30px;color:#aaa;">Cargando solicitudes...</div>`;

  try {
    const solis = await supaFetch(
      '/rest/v1/datos_vendedor?order=creado_en.desc&select=*'
    );
    // Actualizar badge del tab
    const pendientes = (solis||[]).filter(s => s.estado === 'pendiente').length;
    const tabEl = document.getElementById('tab-verificaciones');
    if (tabEl && pendientes > 0) {
      tabEl.innerHTML = `🪪 Verificaciones <span style="background:#E53935;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-left:4px;">${pendientes}</span>`;
    }

    if (!solis || solis.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:48px 20px;">
        <div style="font-size:48px;margin-bottom:12px;">🪪</div>
        <h3 style="color:#1a1a1a;">Sin solicitudes aún</h3>
        <p style="color:#888;font-size:14px;">Las solicitudes de verificación aparecerán aquí.</p>
      </div>`; return;
    }

    const estadoConfig = {
      pendiente:  { color:'#F57C00', bg:'#FFF3E0', icon:'⏳', label:'Pendiente' },
      aprobado:   { color:'#2E7D32', bg:'#E8F5E9', icon:'✅', label:'Aprobado'  },
      rechazado:  { color:'#C62828', bg:'#FFEBEE', icon:'❌', label:'Rechazado' },
    };

    list.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">` +
    solis.map(s => {
      const est  = estadoConfig[s.estado] || estadoConfig.pendiente;
      const fecha = new Date(s.creado_en).toLocaleDateString('es-MX', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      return `
      <div style="background:#fff;border:1.5px solid #e8e8e8;border-radius:16px;overflow:hidden;">

        <div style="background:${est.bg};border-bottom:1.5px solid ${est.color}33;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#1a1a1a;">${s.nombre_completo}</div>
            <div style="font-size:11px;color:#888;">CURP: ${s.curp} · Usuario #${s.usuario_id} · ${fecha}</div>
          </div>
          <span style="background:${est.color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">
            ${est.icon} ${est.label}
          </span>
        </div>

        <div style="padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">Documentos</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            ${s.ine_url ? `<a href="${s.ine_url}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#e3f2fd;border:1.5px solid #90caf9;border-radius:8px;font-size:12px;font-weight:600;color:#1565c0;text-decoration:none;">🪪 INE Frente</a>` : ''}
            ${s.ine_reverso_url ? `<a href="${s.ine_reverso_url}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#e3f2fd;border:1.5px solid #90caf9;border-radius:8px;font-size:12px;font-weight:600;color:#1565c0;text-decoration:none;">🪪 INE Reverso</a>` : ''}
            ${s.acta_url ? `<a href="${s.acta_url}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#f3e5f5;border:1.5px solid #ce93d8;border-radius:8px;font-size:12px;font-weight:600;color:#7b1fa2;text-decoration:none;">📄 Acta</a>` : ''}
            ${s.selfie_url ? `<a href="${s.selfie_url}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#e8f5e9;border:1.5px solid #a5d6a7;border-radius:8px;font-size:12px;font-weight:600;color:#2e7d32;text-decoration:none;">🤳 Selfie</a>` : ''}
          </div>

          ${s.motivo_rechazo ? `<div style="background:#ffebee;border:1px solid #ffcdd2;border-radius:8px;padding:8px 12px;font-size:12px;color:#c62828;margin-bottom:10px;">❌ Rechazo anterior: ${s.motivo_rechazo}</div>` : ''}

          ${s.estado === 'pendiente' ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button onclick="resolverVerificacion(${s.id},${s.usuario_id},'aprobado','')"
              style="background:#2e7d32;color:#fff;border:none;border-radius:10px;padding:9px 20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;flex:1;">
              ✅ Aprobar vendedor
            </button>
            <button onclick="pedirMotivoRechazo(${s.id},${s.usuario_id})"
              style="background:#fff;color:#c62828;border:1.5px solid #ffcdd2;border-radius:10px;padding:9px 20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;flex:1;">
              ❌ Rechazar
            </button>
          </div>` : s.estado === 'aprobado' ? `
          <div style="font-size:12px;color:#2e7d32;">✅ Aprobado — el usuario ya tiene rol vendedor</div>
          ` : `
          <div style="font-size:12px;color:#c62828;margin-bottom:8px;">❌ Rechazado</div>
          <button onclick="resolverVerificacion(${s.id},${s.usuario_id},'aprobado','')"
            style="background:#2e7d32;color:#fff;border:none;border-radius:10px;padding:8px 18px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
            ✅ Aprobar de todas formas
          </button>`}
        </div>
      </div>`;
    }).join('') + `</div>`;
  } catch(e) {
    list.innerHTML = `<p style="color:red;padding:20px;font-size:13px;">Error: ${e.message}</p>`;
  }
}

// ── Aprobar o rechazar solicitud ─────────────────────────
async function resolverVerificacion(solId, usuarioId, decision, motivo) {
  try {
    // 1. Actualizar estado en datos_vendedor
    await supaFetch('/rest/v1/datos_vendedor?id=eq.' + solId, {
      method: 'PATCH',
      body: JSON.stringify({
        estado:          decision,
        motivo_rechazo:  motivo || null,
        revisado_por:    currentUser.id,
        revisado_en:     new Date().toISOString()
      })
    });

    if (decision === 'aprobado') {
      // 2. Cambiar rol del usuario a vendedor
      await cambiarRol(String(usuarioId), 'vendedor', 'cliente');
    }

    showToast(decision === 'aprobado' ? '✅ Vendedor aprobado' : '❌ Solicitud rechazada');
    renderAdminVerificaciones();
  } catch(e) { showToast('❌ Error: ' + e.message); }
}

function pedirMotivoRechazo(solId, usuarioId) {
  const motivo = prompt('Motivo del rechazo (opcional):') ?? '';
  if (motivo === null) return; // canceló
  resolverVerificacion(solId, usuarioId, 'rechazado', motivo);
}


/* =====================================================
   FLUJO SOLICITUD VENDEDOR — INTEGRADO EN PÁGINA
   ===================================================== */

async function pvMostrarPanelSolicitud() {
  // Ocultar formulario de publicar, mostrar panel de solicitud
  document.getElementById('pv-form-publicar').style.display   = 'none';
  document.getElementById('pv-solicitud-panel').style.display = 'block';
  // Ocultar todos los sub-paneles mientras carga
  ['pv-estado-pendiente','pv-estado-rechazado','pv-form-solicitud'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  try {
    const data = await supaFetch(
      '/rest/v1/datos_vendedor?usuario_id=eq.' + currentUser.id + '&select=estado,motivo_rechazo'
    );

    if (data && data.length > 0) {
      const sol = data[0];
      if (sol.estado === 'pendiente') {
        document.getElementById('pv-estado-pendiente').style.display = 'block';
        return;
      }
      if (sol.estado === 'rechazado') {
        const motEl = document.getElementById('pv-motivo-rechazo');
        if (motEl) motEl.textContent = sol.motivo_rechazo
          ? 'Motivo: ' + sol.motivo_rechazo + '. Puedes volver a enviar tus documentos.'
          : 'Puedes volver a enviar tus documentos.';
        document.getElementById('pv-estado-rechazado').style.display = 'block';
        // Mostrar también el formulario para reenviar
        document.getElementById('pv-form-solicitud').style.display = 'block';
        pvPaso(1);
        return;
      }
    }
    // Sin solicitud → mostrar formulario directamente
    document.getElementById('pv-form-solicitud').style.display = 'block';
    pvPaso(1);
  } catch(e) {
    document.getElementById('pv-form-solicitud').style.display = 'block';
    pvPaso(1);
  }
}

function pvPaso(n) {
  [1,2,3].forEach(i => {
    document.getElementById('pv-paso-' + i).style.display = i === n ? 'block' : 'none';
    const step = document.getElementById('pvs-' + i);
    if (step) step.classList.toggle('active', i <= n);
  });
  // Al llegar al paso 3, construir resumen
  if (n === 3) {
    const nombre = document.getElementById('pv-nombre').value.trim();
    const curp   = document.getElementById('pv-curp').value.trim();
    const ine    = document.getElementById('pv-file-ine').files[0];
    const acta   = document.getElementById('pv-file-acta').files[0];

    // Validar antes de avanzar
    if (!nombre) { showToast('⚠️ Ingresa tu nombre completo'); pvPaso(1); return; }
    if (curp.length !== 18) { showToast('⚠️ La CURP debe tener 18 caracteres'); pvPaso(1); return; }
    if (!ine)  { showToast('⚠️ Sube la foto del frente de tu INE'); pvPaso(2); return; }
    if (!acta) { showToast('⚠️ Sube tu acta de nacimiento'); pvPaso(2); return; }

    document.getElementById('pv-resumen').innerHTML = `
      <div class="pv-resumen-row"><span>👤 Nombre</span><strong>${nombre}</strong></div>
      <div class="pv-resumen-row"><span>🪪 CURP</span><strong style="font-family:monospace;">${curp}</strong></div>
      <div class="pv-resumen-row"><span>📷 INE frente</span><strong>✅ ${ine.name}</strong></div>
      <div class="pv-resumen-row"><span>📄 Acta</span><strong>✅ ${acta.name}</strong></div>
      ${document.getElementById('pv-file-iner').files[0] ? `<div class="pv-resumen-row"><span>📷 INE reverso</span><strong>✅ ${document.getElementById('pv-file-iner').files[0].name}</strong></div>` : ''}
      ${document.getElementById('pv-file-selfie').files[0] ? `<div class="pv-resumen-row"><span>🤳 Selfie</span><strong>✅ ${document.getElementById('pv-file-selfie').files[0].name}</strong></div>` : ''}
    `;
  }
  if (n === 2) {
    // Validar paso 1 antes de avanzar
    const nombre = document.getElementById('pv-nombre').value.trim();
    const curp   = document.getElementById('pv-curp').value.trim();
    if (!nombre) { showToast('⚠️ Ingresa tu nombre completo'); pvPaso(1); return; }
    if (curp.length !== 18) { showToast('⚠️ La CURP debe tener 18 caracteres'); pvPaso(1); return; }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pvPreview(input, prevId, phId) {
  const file = input.files[0];
  if (!file) return;
  const prev = document.getElementById(prevId);
  const ph   = document.getElementById(phId);
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      prev.src = e.target.result;
      prev.style.display = 'block';
      if (ph) ph.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    if (ph) ph.innerHTML = `<span style="font-size:20px;">📄</span><span>${file.name}</span>`;
  }
}

async function pvEnviarSolicitud() {
  const nombre  = document.getElementById('pv-nombre').value.trim();
  const curp    = document.getElementById('pv-curp').value.trim().toUpperCase();
  const fileIne = document.getElementById('pv-file-ine').files[0];
  const fileActa= document.getElementById('pv-file-acta').files[0];

  const btn = document.getElementById('pv-btn-enviar');
  btn.textContent = '⬆️ Subiendo documentos...'; btn.disabled = true;

  try {
    const ineUrl   = await uploadToStorage(fileIne,  'vendedores/' + currentUser.id);
    const actaUrl  = await uploadToStorage(fileActa, 'vendedores/' + currentUser.id);
    const fileIner = document.getElementById('pv-file-iner').files[0];
    const fileSelf = document.getElementById('pv-file-selfie').files[0];
    const inerUrl  = fileIner ? await uploadToStorage(fileIner, 'vendedores/' + currentUser.id) : null;
    const selfUrl  = fileSelf ? await uploadToStorage(fileSelf, 'vendedores/' + currentUser.id) : null;

    btn.textContent = '📨 Enviando solicitud...';

    await fetch(SUPA_URL + '/rest/v1/datos_vendedor', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        usuario_id: currentUser.id, nombre_completo: nombre, curp,
        ine_url: ineUrl, ine_reverso_url: inerUrl,
        acta_url: actaUrl, selfie_url: selfUrl,
        estado: 'pendiente', motivo_rechazo: null
      })
    });

    // Mostrar estado de éxito en la misma página
    document.getElementById('pv-form-solicitud').style.display  = 'none';
    document.getElementById('pv-estado-rechazado').style.display= 'none';
    document.getElementById('pv-estado-pendiente').style.display= 'block';
    showToast('🎉 ¡Solicitud enviada! Te avisaremos cuando sea aprobada.');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    btn.textContent = '🚀 Enviar solicitud'; btn.disabled = false;
  }
}

// ── Al aprobar desde admin, actualizar currentUser si es el mismo ────
const _origResolverVerificacion = resolverVerificacion;
resolverVerificacion = async function(solId, usuarioId, decision, motivo) {
  await _origResolverVerificacion(solId, usuarioId, decision, motivo);
  // Si el admin aprobó al usuario actual (caso self-review en demo), actualizar UI
  if (decision === 'aprobado' && currentUser && String(currentUser.id) === String(usuarioId)) {
    currentUser.rol  = 'vendedor';
    currentUser.tipo = 'vendedor';
    try { localStorage.setItem('aca_user', JSON.stringify(currentUser)); } catch(e) {}
  }
};


/* =====================================================
   EXPORTAR USUARIOS A PDF
   ===================================================== */

async function exportarUsuariosPDF() {
  const btn = document.querySelector('button[onclick="exportarUsuariosPDF()"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }

  try {
    // Cargar usuarios de Supabase (solo clientes y vendedores)
    const usuarios = await supaFetch(
      '/rest/v1/usuarios?rol=in.(cliente,vendedor)&order=creado_en.desc&select=id,nombre,email,rol,tipo,telefono,creado_en'
    );

    if (!usuarios || usuarios.length === 0) {
      showToast('⚠️ No hay usuarios para exportar');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const now = new Date();
    const fechaStr = now.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
    const horaStr  = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

    // ── Paleta de colores ──
    const TEAL   = [0, 95, 95];
    const DARK   = [10, 31, 31];
    const LIGHT  = [240, 250, 248];
    const GRAY   = [120, 120, 120];
    const WHITE  = [255, 255, 255];
    const GREEN  = [46, 125, 50];
    const BLUE   = [21, 101, 192];

    // ── ENCABEZADO ──────────────────────────────────────
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 38, 'F');

    // Logo placeholder (círculo)
    doc.setFillColor(...TEAL);
    doc.circle(18, 19, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('AC', 18, 22, { align: 'center' });

    // Título
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AcaConnect', 32, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 220, 210);
    doc.text('Reporte de Usuarios Registrados', 32, 23);

    // Fecha en encabezado
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.text(`Generado: ${fechaStr}  ${horaStr}`, W - 14, 16, { align: 'right' });
    doc.text(`Por: ${currentUser?.nombre || 'Admin'}`, W - 14, 22, { align: 'right' });

    // ── MÉTRICAS ─────────────────────────────────────────
    const totalClientes  = usuarios.filter(u => (u.rol||u.tipo) === 'cliente').length;
    const totalVendedores= usuarios.filter(u => (u.rol||u.tipo) === 'vendedor').length;
    const total          = usuarios.length;

    const metricas = [
      { label: 'Total Usuarios', valor: total,          color: TEAL  },
      { label: 'Clientes',       valor: totalClientes,  color: GREEN },
      { label: 'Vendedores',     valor: totalVendedores,color: BLUE  },
    ];

    const boxW = (W - 28) / 3;
    const boxY = 44;
    metricas.forEach((m, i) => {
      const x = 14 + i * (boxW + 4);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, boxY, boxW, 18, 3, 3, 'F');
      doc.setFillColor(...m.color);
      doc.roundedRect(x, boxY, 4, 18, 2, 2, 'F');
      doc.setTextColor(...m.color);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(m.valor), x + boxW / 2 + 2, boxY + 11, { align: 'center' });
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, x + boxW / 2 + 2, boxY + 16, { align: 'center' });
    });

    // ── TABLA ─────────────────────────────────────────────
    const rows = usuarios.map((u, i) => {
      const rol = u.rol || u.tipo || 'cliente';
      const fecha = new Date(u.creado_en).toLocaleDateString('es-MX', {
        day:'2-digit', month:'2-digit', year:'numeric'
      });
      return [
        i + 1,
        u.nombre || '—',
        u.email  || '—',
        u.telefono ? u.telefono.replace('+52','') : '—',
        rol.charAt(0).toUpperCase() + rol.slice(1),
        fecha
      ];
    });

    doc.autoTable({
      startY: boxY + 24,
      head: [['#', 'Nombre', 'Correo electrónico', 'Teléfono', 'Rol', 'Registro']],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        textColor: [40, 40, 40],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: DARK,
        textColor: WHITE,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 40 },
        2: { cellWidth: 52 },
        3: { cellWidth: 24 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [248, 252, 250] },
      didDrawCell: (data) => {
        // Colorear badge de rol
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw).toLowerCase();
          const col = val === 'vendedor' ? BLUE : GREEN;
          const x = data.cell.x + 2;
          const y = data.cell.y + 1.5;
          const w = data.cell.width - 4;
          const h = data.cell.height - 3;
          doc.setFillColor(col[0], col[1], col[2], 0.12);
          doc.setDrawColor(...col);
          doc.roundedRect(x, y, w, h, 2, 2, 'FD');
          doc.setTextColor(...col);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(data.cell.raw, x + w/2, y + h/2 + 1, { align: 'center' });
        }
      },
      // Pie de cada página
      didDrawPage: (data) => {
        const pgs = doc.internal.getNumberOfPages();
        const cur = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFillColor(...DARK);
        doc.rect(0, H - 10, W, 10, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('AcaConnect — Reporte Confidencial', 14, H - 4);
        doc.text(`Página ${cur} de ${pgs}`, W - 14, H - 4, { align: 'right' });
      }
    });

    // ── GUARDAR ───────────────────────────────────────────
    const filename = `AcaConnect_Usuarios_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(filename);
    showToast('✅ PDF generado: ' + filename);

  } catch(e) {
    showToast('❌ Error al generar PDF: ' + e.message);
    console.error(e);
  } finally {
    if (btn) { btn.textContent = '📄 Exportar PDF'; btn.disabled = false; }
  }
}


/* =====================================================
   ADMIN — DASHBOARD DE ANALYTICS
   ===================================================== */

let _chartInstances = {};

function destroyCharts() {
  Object.values(_chartInstances).forEach(ch => { try { ch.destroy(); } catch(e) {} });
  _chartInstances = {};
}

async function renderAdminAnalytics() {
  const list = document.getElementById('admin-list');
  destroyCharts();
  list.innerHTML = `<div style="text-align:center;padding:30px;color:#aaa;">⏳ Cargando datos...</div>`;

  try {
    // ── Cargar todos los datos en paralelo ──────────────
    const [usuarios, servicios, pagos, eventos, transacciones, resenas] = await Promise.all([
      supaFetch('/rest/v1/usuarios?select=id,rol,tipo,creado_en&order=creado_en.asc'),
      supaFetch('/rest/v1/servicios?select=id,categoria,estado,precio,creado_en&order=creado_en.asc'),
      supaFetch('/rest/v1/pagos?select=id,metodo_pago,monto,creado_en&order=creado_en.asc'),
      supaFetch('/rest/v1/eventos_analytics?select=tipo,pagina,dispositivo,creado_en&order=creado_en.desc&limit=2000').catch(()=>[]),
      supaFetch('/rest/v1/transacciones_acapoints?select=tipo,puntos,monto_mxn,creado_en&order=creado_en.desc&limit=500').catch(()=>[]),
      supaFetch('/rest/v1/resenas?select=estrellas,creado_en&aprobada=eq.true').catch(()=>[]),
    ]);

    // ── Calcular KPIs ───────────────────────────────────
    const totalUsuarios   = (usuarios||[]).length;
    const totalVendedores = (usuarios||[]).filter(u=>(u.rol||u.tipo)==='vendedor').length;
    const totalServicios  = (servicios||[]).length;
    const activosS        = (servicios||[]).filter(s=>s.estado==='activo').length;
    const totalPagos      = (pagos||[]).length;
    const ingresoTotal    = (pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    const totalEventos    = (eventos||[]).length;
    const sesionesUnicas  = new Set((eventos||[]).map(e=>e.sesion_id)).size;
    const avgEstrellas    = (resenas||[]).length
      ? ((resenas||[]).reduce((s,r)=>s+Number(r.estrellas||0),0)/(resenas||[]).length).toFixed(1)
      : '—';

    // ── Agrupar por mes (últimos 6) ─────────────────────
    function agruparPorMes(arr, campo='creado_en') {
      const meses = {};
      const now = new Date();
      for (let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        const k = d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'});
        meses[k] = 0;
      }
      (arr||[]).forEach(item => {
        const d = new Date(item[campo]);
        if (isNaN(d)) return;
        const k = d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'});
        if (meses[k] !== undefined) meses[k]++;
      });
      return meses;
    }

    const usuariosPorMes = agruparPorMes(usuarios);
    const pagosPorMes    = agruparPorMes(pagos);
    const meses          = Object.keys(usuariosPorMes);

    // Dispositivos
    const dispCount = { mobile:0, desktop:0, tablet:0 };
    (eventos||[]).forEach(e => { if (dispCount[e.dispositivo]!==undefined) dispCount[e.dispositivo]++; });

    // Páginas más visitadas
    const paginasCount = {};
    (eventos||[]).filter(e=>e.tipo==='vista_pagina').forEach(e => {
      const p = e.pagina||'home';
      paginasCount[p] = (paginasCount[p]||0) + 1;
    });
    const topPaginas = Object.entries(paginasCount).sort((a,b)=>b[1]-a[1]).slice(0,6);

    // Tipos de evento
    const tiposCount = {};
    (eventos||[]).forEach(e => { tiposCount[e.tipo] = (tiposCount[e.tipo]||0) + 1; });

    // Métodos de pago
    const metCount = { efectivo:0, tarjeta:0, acapoints:0 };
    (pagos||[]).forEach(p => { if(metCount[p.metodo_pago]!==undefined) metCount[p.metodo_pago]++; });

    // Categorías de servicios
    const catCount = {};
    (servicios||[]).filter(s=>s.estado==='activo').forEach(s => {
      catCount[s.categoria] = (catCount[s.categoria]||0) + 1;
    });

    // Roles de usuarios
    const rolesCount = {};
    (usuarios||[]).forEach(u => {
      const r = u.rol||u.tipo||'cliente';
      rolesCount[r] = (rolesCount[r]||0) + 1;
    });

    // Ingresos por mes
    function ingresosPorMes(arr) {
      const meses2 = {};
      const now = new Date();
      for (let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        meses2[d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'})] = 0;
      }
      (arr||[]).forEach(p => {
        const d = new Date(p.creado_en);
        const k = d.toLocaleDateString('es-MX',{month:'short',year:'2-digit'});
        if (meses2[k]!==undefined) meses2[k] += Number(p.monto||0);
      });
      return meses2;
    }
    const ingPorMes = ingresosPorMes(pagos);

    // ── HTML ─────────────────────────────────────────────
    list.innerHTML = `
    <div class="an-wrap">

      <!-- Botón exportar PDF -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
        <button onclick="exportarAnalyticsPDF()"
          style="background:#6A1B9A;color:#fff;border:none;border-radius:20px;padding:8px 16px;
                 font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
                 display:flex;align-items:center;gap:6px;">
          📄 Exportar reporte PDF
        </button>
      </div>

      <!-- KPIs -->
      <div class="an-kpis">
        <div class="an-kpi" style="--ac:#6A1B9A;--bg:#F3E5F5;">
          <span class="an-kpi-icon">👥</span>
          <div class="an-kpi-val">${totalUsuarios}</div>
          <div class="an-kpi-lbl">Usuarios totales</div>
        </div>
        <div class="an-kpi" style="--ac:#1565C0;--bg:#E3F2FD;">
          <span class="an-kpi-icon">📡</span>
          <div class="an-kpi-val">${sesionesUnicas}</div>
          <div class="an-kpi-lbl">Sesiones únicas</div>
        </div>
        <div class="an-kpi" style="--ac:#2E7D32;--bg:#E8F5E9;">
          <span class="an-kpi-icon">💰</span>
          <div class="an-kpi-val">$${Math.round(ingresoTotal).toLocaleString('es-MX')}</div>
          <div class="an-kpi-lbl">Ingresos MXN</div>
        </div>
        <div class="an-kpi" style="--ac:#E65100;--bg:#FFF3E0;">
          <span class="an-kpi-icon">🛒</span>
          <div class="an-kpi-val">${totalPagos}</div>
          <div class="an-kpi-lbl">Transacciones</div>
        </div>
        <div class="an-kpi" style="--ac:#00695C;--bg:#E0F2F1;">
          <span class="an-kpi-icon">📦</span>
          <div class="an-kpi-val">${activosS}/${totalServicios}</div>
          <div class="an-kpi-lbl">Servicios activos</div>
        </div>
        <div class="an-kpi" style="--ac:#F9A825;--bg:#FFFDE7;">
          <span class="an-kpi-icon">⭐</span>
          <div class="an-kpi-val">${avgEstrellas}</div>
          <div class="an-kpi-lbl">Calificación prom.</div>
        </div>
      </div>

      <!-- Fila 1: Usuarios + Ingresos -->
      <div class="an-row-2">
        <div class="an-card">
          <div class="an-card-title">📈 Nuevos usuarios por mes</div>
          <canvas id="ch-usuarios" height="200"></canvas>
        </div>
        <div class="an-card">
          <div class="an-card-title">💰 Ingresos por mes (MXN)</div>
          <canvas id="ch-ingresos" height="200"></canvas>
        </div>
      </div>

      <!-- Fila 2: Dispositivos + Métodos de pago -->
      <div class="an-row-2">
        <div class="an-card">
          <div class="an-card-title">📱 Tráfico por dispositivo</div>
          <div style="max-width:260px;margin:0 auto;">
            <canvas id="ch-dispositivos" height="220"></canvas>
          </div>
        </div>
        <div class="an-card">
          <div class="an-card-title">💳 Métodos de pago</div>
          <div style="max-width:260px;margin:0 auto;">
            <canvas id="ch-metodos" height="220"></canvas>
          </div>
        </div>
      </div>

      <!-- Fila 3: Categorías + Roles -->
      <div class="an-row-2">
        <div class="an-card">
          <div class="an-card-title">🏷️ Servicios por categoría</div>
          <canvas id="ch-categorias" height="200"></canvas>
        </div>
        <div class="an-card">
          <div class="an-card-title">👥 Distribución de roles</div>
          <div style="max-width:240px;margin:0 auto;">
            <canvas id="ch-roles" height="220"></canvas>
          </div>
        </div>
      </div>

      <!-- Fila 4: Páginas más visitadas + Actividad por tipo -->
      <div class="an-row-2">
        <div class="an-card">
          <div class="an-card-title">🔥 Páginas más visitadas</div>
          <canvas id="ch-paginas" height="200"></canvas>
        </div>
        <div class="an-card">
          <div class="an-card-title">⚡ Actividad por tipo de evento</div>
          <canvas id="ch-eventos" height="200"></canvas>
        </div>
      </div>

      <!-- Tabla: Top páginas detalle -->
      <div class="an-card" style="margin-top:0;">
        <div class="an-card-title">📋 Resumen de tráfico</div>
        <table class="an-table">
          <thead><tr><th>Página</th><th>Visitas</th><th>% del total</th><th>Barra</th></tr></thead>
          <tbody>
            ${topPaginas.map(([p,n])=>`
            <tr>
              <td>${{home:'🏠 Inicio',marketplace:'🛍️ Marketplace',publish:'📢 Publicar',
                   about:'ℹ️ Nosotros',contact:'✉️ Contacto',acapoints:'🪙 AcaPoints'}[p]||'📄 '+p}</td>
              <td><strong>${n}</strong></td>
              <td>${totalEventos>0?((n/totalEventos)*100).toFixed(1):'0'}%</td>
              <td><div style="background:#f0f0f0;border-radius:4px;height:8px;width:100%;"><div style="background:#6A1B9A;border-radius:4px;height:8px;width:${totalEventos>0?Math.round(n/Math.max(...topPaginas.map(x=>x[1]))*100):0}%;"></div></div></td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${totalEventos === 0 ? '<p style="text-align:center;color:#aaa;font-size:13px;padding:12px;">Los datos de tráfico aparecerán después de que los usuarios naveguen la plataforma.</p>' : ''}
      </div>

    </div>`;

    // ── Renderizar gráficas con Chart.js ─────────────────
    const TEAL_GRAD = ['rgba(0,95,95,0.8)','rgba(0,95,95,0.6)','rgba(0,95,95,0.4)'];
    const PALETTE   = ['#6A1B9A','#1565C0','#2E7D32','#E65100','#00695C','#F9A825','#C62828','#37474F'];

    // 1. Usuarios por mes (línea)
    _chartInstances.usuarios = new Chart(document.getElementById('ch-usuarios'), {
      type: 'line',
      data: {
        labels: meses,
        datasets: [{ label:'Nuevos usuarios', data: Object.values(usuariosPorMes),
          borderColor:'#6A1B9A', backgroundColor:'rgba(106,27,154,0.1)',
          tension:0.4, fill:true, pointRadius:4, pointHoverRadius:6 }]
      },
      options: { responsive:true, plugins:{legend:{display:false}},
        scales:{ y:{beginAtZero:true,ticks:{stepSize:1}}, x:{grid:{display:false}} } }
    });

    // 2. Ingresos por mes (barras)
    _chartInstances.ingresos = new Chart(document.getElementById('ch-ingresos'), {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [{ label:'MXN', data: Object.values(ingPorMes),
          backgroundColor:'rgba(46,125,50,0.75)', borderRadius:6, borderSkipped:false }]
      },
      options: { responsive:true, plugins:{legend:{display:false}},
        scales:{ y:{beginAtZero:true}, x:{grid:{display:false}} } }
    });

    // 3. Dispositivos (dona)
    const dispTotal = Object.values(dispCount).reduce((a,b)=>a+b,0)||1;
    _chartInstances.dispositivos = new Chart(document.getElementById('ch-dispositivos'), {
      type: 'doughnut',
      data: {
        labels:['📱 Móvil','🖥️ Escritorio','📟 Tablet'],
        datasets:[{ data:[dispCount.mobile,dispCount.desktop,dispCount.tablet],
          backgroundColor:['#1565C0','#6A1B9A','#E65100'],
          borderWidth:0, hoverOffset:6 }]
      },
      options:{ responsive:true, plugins:{
        legend:{ position:'bottom', labels:{padding:12,font:{size:11}} },
        tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/dispTotal*100)}%)` } }
      }}
    });

    // 4. Métodos de pago (dona)
    const metTotal = Object.values(metCount).reduce((a,b)=>a+b,0)||1;
    _chartInstances.metodos = new Chart(document.getElementById('ch-metodos'), {
      type: 'doughnut',
      data: {
        labels:['💵 Efectivo','💳 Tarjeta','🪙 AcaPoints'],
        datasets:[{ data:[metCount.efectivo,metCount.tarjeta,metCount.acapoints],
          backgroundColor:['#2E7D32','#1565C0','#F9A825'],
          borderWidth:0, hoverOffset:6 }]
      },
      options:{ responsive:true, plugins:{
        legend:{ position:'bottom', labels:{padding:12,font:{size:11}} },
        tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/metTotal*100)}%)` } }
      }}
    });

    // 5. Categorías (barras horizontales)
    const catLabels = { gastronomia:'🍴 Gastronomía', hospedaje:'🏨 Hospedaje',
                        servicios:'💼 Servicios', experiencias:'⛵ Experiencias' };
    const catKeys = Object.keys(catCount);
    _chartInstances.categorias = new Chart(document.getElementById('ch-categorias'), {
      type: 'bar',
      data: {
        labels: catKeys.map(k=>catLabels[k]||k),
        datasets:[{ label:'Servicios activos', data:catKeys.map(k=>catCount[k]),
          backgroundColor: catKeys.map((_,i)=>PALETTE[i%PALETTE.length]),
          borderRadius:6, borderSkipped:false }]
      },
      options:{ indexAxis:'y', responsive:true, plugins:{legend:{display:false}},
        scales:{ x:{beginAtZero:true,ticks:{stepSize:1}}, y:{grid:{display:false}} } }
    });

    // 6. Roles (dona)
    const rolKeys = Object.keys(rolesCount);
    const rolColors = { admin:'#E53935', supervisor:'#F57C00', vendedor:'#1976D2', cliente:'#388E3C' };
    _chartInstances.roles = new Chart(document.getElementById('ch-roles'), {
      type: 'doughnut',
      data: {
        labels: rolKeys.map(r=>({admin:'👑 Admin',supervisor:'🔍 Supervisor',vendedor:'🏪 Vendedor',cliente:'👤 Cliente'}[r]||r)),
        datasets:[{ data: rolKeys.map(r=>rolesCount[r]),
          backgroundColor: rolKeys.map(r=>rolColors[r]||'#888'),
          borderWidth:0, hoverOffset:6 }]
      },
      options:{ responsive:true, plugins:{
        legend:{ position:'bottom', labels:{padding:10,font:{size:11}} }
      }}
    });

    // 7. Páginas más visitadas (barras)
    _chartInstances.paginas = new Chart(document.getElementById('ch-paginas'), {
      type: 'bar',
      data: {
        labels: topPaginas.map(([p])=>({home:'Inicio',marketplace:'Marketplace',publish:'Publicar',
          about:'Nosotros',contact:'Contacto',acapoints:'AcaPoints'}[p]||p)),
        datasets:[{ data: topPaginas.map(([,n])=>n),
          backgroundColor:'rgba(106,27,154,0.7)', borderRadius:6, borderSkipped:false }]
      },
      options:{ responsive:true, plugins:{legend:{display:false}},
        scales:{ y:{beginAtZero:true,ticks:{stepSize:1}}, x:{grid:{display:false}} } }
    });

    // 8. Tipos de evento (barras)
    const evLabels = { vista_pagina:'Vista página', vista_servicio:'Vista servicio',
      login:'Login', registro:'Registro', pago:'Pago', click_contacto:'Contacto' };
    const evKeys = Object.keys(tiposCount).slice(0,6);
    _chartInstances.eventos = new Chart(document.getElementById('ch-eventos'), {
      type: 'bar',
      data: {
        labels: evKeys.map(k=>evLabels[k]||k),
        datasets:[{ data: evKeys.map(k=>tiposCount[k]),
          backgroundColor: evKeys.map((_,i)=>PALETTE[i]),
          borderRadius:6, borderSkipped:false }]
      },
      options:{ responsive:true, plugins:{legend:{display:false}},
        scales:{ y:{beginAtZero:true,ticks:{stepSize:1}}, x:{grid:{display:false}} } }
    });

  } catch(e) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:#c62828;">
      ❌ Error al cargar analytics: ${e.message}</div>`;
  }
}


/* =====================================================
   EXPORTAR REPORTE DE GANANCIAS — PDF
   ===================================================== */

async function exportarGananciasPDF() {
  const btn = document.querySelector('button[onclick="exportarGananciasPDF()"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const now  = new Date();
    const fecha = now.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
    const hora  = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

    // Paleta
    const DARK  = [10,31,31];  const GREEN = [46,125,50];
    const LGREE = [232,245,233]; const WHITE = [255,255,255];
    const GRAY  = [100,100,100]; const GOLD  = [245,127,23];

    // ── Encabezado ──
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFillColor(0,95,95);
    doc.circle(18, 21, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('AC', 18, 24, { align:'center' });
    doc.setFontSize(18); doc.text('AcaConnect', 32, 18);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(180,220,210);
    doc.text('Reporte de Ganancias — AcaPoints', 32, 25);
    doc.setTextColor(...WHITE); doc.setFontSize(8);
    doc.text(`Generado: ${fecha}  ${hora}`, W-14, 18, { align:'right' });
    doc.text(`Admin: ${currentUser?.nombre||'—'}`, W-14, 24, { align:'right' });

    // Leer datos desde Supabase
    const [txsDB, pagosDB] = await Promise.all([
      supaFetch('/rest/v1/transacciones_acapoints?select=tipo,puntos,monto_mxn,creado_en'),
      supaFetch('/rest/v1/pagos?select=metodo_pago,monto&order=creado_en.desc').catch(()=>[]),
    ]);
    let totalVentaAca=0, totalGananciaAca=0, totalTransacciones=0;
    let totalRetirosAca=0, totalGananciaRetiros=0;
    const ventasPorPaquete = {50:0,100:0,200:0,500:0};
    (txsDB||[]).forEach(tx => {
      if (tx.tipo==='compra' && tx.monto_mxn) {
        const mxn = Number(tx.monto_mxn);
        const pkg = ACA_PACKAGES.find(p=>p.mxn===mxn);
        if (pkg) { totalVentaAca+=pkg.mxn; totalGananciaAca+=pkg.ganancia; totalTransacciones++; ventasPorPaquete[pkg.mxn]=(ventasPorPaquete[pkg.mxn]||0)+1; }
      }
      if (tx.tipo==='reembolso' && tx.puntos) {
        totalRetirosAca+=Number(tx.puntos); totalGananciaRetiros+=Number(tx.puntos)*MARGEN_RETIRO_ACA;
      }
    });
    const COMISION_TARJETA = 0.05;
    const totalPagosTarjeta = (pagosDB||[]).filter(p=>p.metodo_pago==='tarjeta').reduce((s,p)=>s+Number(p.monto||0),0);
    const gananciaTarjeta   = totalPagosTarjeta * COMISION_TARJETA;
    const totalGananciaBruta = totalGananciaAca + totalGananciaRetiros + gananciaTarjeta;
    const margenProm = totalVentaAca>0 ? ((totalGananciaAca/totalVentaAca)*100).toFixed(1) : '15.0';

    // ── KPI boxes ──
    const kpis = [
      { label:'Ganancia bruta',      val:'$'+totalGananciaBruta.toFixed(2)+' MXN', color:GREEN },
      { label:'Ventas AcaPoints',    val:'$'+totalVentaAca+' MXN',                color:[21,101,192] },
      { label:'Margen promedio',     val:margenProm+'%',                           color:GOLD },
      { label:'Transacciones',       val:String(totalTransacciones),               color:[106,27,154] },
    ];
    const kpiW = (W-28)/4;
    kpis.forEach((k,i) => {
      const x = 14 + i*(kpiW+2);
      doc.setFillColor(...LGREE);
      doc.roundedRect(x, 48, kpiW, 20, 3,3,'F');
      doc.setFillColor(...k.color);
      doc.roundedRect(x, 48, 4, 20, 2,2,'F');
      doc.setTextColor(...k.color);
      doc.setFontSize(12); doc.setFont('helvetica','bold');
      doc.text(k.val, x+kpiW/2+2, 57, { align:'center' });
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica','normal');
      doc.text(k.label, x+kpiW/2+2, 64, { align:'center' });
    });

    // ── Tabla de desglose por paquete ──
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Desglose por paquete', 14, 78);

    const rowsPaq = ACA_PACKAGES.map(p => [
      '$'+p.mxn+' MXN → '+p.pts+' pts',
      String(ventasPorPaquete[p.mxn]||0),
      '$'+((ventasPorPaquete[p.mxn]||0)*p.mxn).toLocaleString('es-MX'),
      '$'+((ventasPorPaquete[p.mxn]||0)*p.pts).toLocaleString('es-MX'),
      '+$'+((ventasPorPaquete[p.mxn]||0)*p.ganancia).toLocaleString('es-MX'),
      p.margen+'%'
    ]);
    rowsPaq.push([
      'Retiros AcaPoints',
      totalRetirosAca.toFixed(0)+' pts',
      '—', '—',
      '+$'+totalGananciaRetiros.toFixed(2),
      '20%'
    ]);
    rowsPaq.push([
      'TOTAL', String(totalTransacciones),
      '$'+totalVentaAca.toLocaleString('es-MX'),
      '$'+(totalVentaAca-totalGananciaAca).toLocaleString('es-MX'),
      '+$'+totalGananciaBruta.toFixed(2),
      margenProm+'%'
    ]);

    doc.autoTable({
      startY: 82,
      head: [['Paquete','Ventas','Ingresos','Costo','Ganancia','Margen']],
      body: rowsPaq,
      theme: 'grid',
      styles: { font:'helvetica', fontSize:8, cellPadding:3, textColor:[40,40,40], lineColor:[220,220,220], lineWidth:0.2 },
      headStyles: { fillColor:DARK, textColor:WHITE, fontSize:8, fontStyle:'bold', cellPadding:4 },
      columnStyles: { 4:{textColor:GREEN,fontStyle:'bold'}, 5:{halign:'center'} },
      alternateRowStyles: { fillColor:[248,252,250] },
      didDrawPage: () => {
        doc.setFillColor(...DARK); doc.rect(0,H-10,W,10,'F');
        doc.setTextColor(...WHITE); doc.setFontSize(7);
        doc.text('AcaConnect — Reporte Confidencial',14,H-4);
        doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`,W-14,H-4,{align:'right'});
      }
    });

    // ── Política de precios ──
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Política de precios vigente', 14, finalY);
    doc.autoTable({
      startY: finalY+4,
      head: [['Concepto','Valor']],
      body: [
        ['Valor de compra (1 AcaPoint)','$1.00 MXN'],
        ['Tasa de retiro (1 AcaPoint)','$0.80 MXN'],
        ['Ganancia por retiro / punto','$0.20 MXN'],
        ['Margen mínimo garantizado','15%'],
      ],
      theme: 'grid',
      styles: { font:'helvetica', fontSize:8, cellPadding:3, lineColor:[220,220,220], lineWidth:0.2 },
      headStyles: { fillColor:GREEN, textColor:WHITE, fontSize:8, fontStyle:'bold' },
      columnStyles: { 1:{fontStyle:'bold', textColor:GREEN} },
    });

    const fname = `AcaConnect_Ganancias_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(fname);
    showToast('✅ Reporte generado: ' + fname);
  } catch(e) {
    showToast('❌ Error: ' + e.message); console.error(e);
  } finally {
    if (btn) { btn.textContent = '📄 Exportar reporte PDF'; btn.disabled = false; }
  }
}

/* =====================================================
   EXPORTAR REPORTE DE ANALYTICS — PDF
   ===================================================== */

async function exportarAnalyticsPDF() {
  const btn = document.querySelector('button[onclick="exportarAnalyticsPDF()"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit:'mm', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const now   = new Date();
    const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
    const hora  = now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});

    const DARK=[10,31,31]; const WHITE=[255,255,255]; const GRAY=[100,100,100];
    const PURP=[106,27,154]; const LPURP=[243,229,245]; const TEAL=[0,95,95];

    // Cargar datos
    const [usuarios, servicios, pagos, eventos] = await Promise.all([
      supaFetch('/rest/v1/usuarios?select=id,rol,tipo,creado_en'),
      supaFetch('/rest/v1/servicios?select=id,categoria,estado,creado_en'),
      supaFetch('/rest/v1/pagos?select=id,metodo_pago,monto,creado_en'),
      supaFetch('/rest/v1/eventos_analytics?select=tipo,pagina,dispositivo,creado_en&limit=2000').catch(()=>[]),
    ]);

    const totalU   = (usuarios||[]).length;
    const totalS   = (servicios||[]).length;
    const activosS = (servicios||[]).filter(s=>s.estado==='activo').length;
    const totalP   = (pagos||[]).length;
    const totalMxn = (pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    const totalEv  = (eventos||[]).length;
    const sesiones = new Set((eventos||[]).map(e=>e.sesion_id)).size;

    const dispCount={mobile:0,desktop:0,tablet:0};
    (eventos||[]).forEach(e=>{ if(dispCount[e.dispositivo]!==undefined) dispCount[e.dispositivo]++; });
    const dispTotal = Object.values(dispCount).reduce((a,b)=>a+b,0)||1;

    const paginasC={};
    (eventos||[]).filter(e=>e.tipo==='vista_pagina').forEach(e=>{ paginasC[e.pagina||'home']=(paginasC[e.pagina||'home']||0)+1; });
    const topPag = Object.entries(paginasC).sort((a,b)=>b[1]-a[1]).slice(0,8);

    const tiposC={};
    (eventos||[]).forEach(e=>{ tiposC[e.tipo]=(tiposC[e.tipo]||0)+1; });

    const metC={efectivo:0,tarjeta:0,acapoints:0};
    (pagos||[]).forEach(p=>{ if(metC[p.metodo_pago]!==undefined) metC[p.metodo_pago]++; });

    const rolesC={};
    (usuarios||[]).forEach(u=>{ const r=u.rol||u.tipo||'cliente'; rolesC[r]=(rolesC[r]||0)+1; });

    // ── Encabezado ──
    doc.setFillColor(...DARK); doc.rect(0,0,W,42,'F');
    doc.setFillColor(...TEAL); doc.circle(18,21,9,'F');
    doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('AC',18,24,{align:'center'});
    doc.setFontSize(18); doc.text('AcaConnect',32,18);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.setTextColor(180,220,210); doc.text('Reporte de Analytics y Tráfico',32,25);
    doc.setTextColor(...WHITE); doc.setFontSize(8);
    doc.text(`Generado: ${fecha}  ${hora}`,W-14,18,{align:'right'});
    doc.text(`Admin: ${currentUser?.nombre||'—'}`,W-14,24,{align:'right'});

    // ── KPI boxes ──
    const kpis2=[
      {l:'Usuarios',v:String(totalU),c:PURP},
      {l:'Sesiones',v:String(sesiones),c:[21,101,192]},
      {l:'Eventos',v:String(totalEv),c:[0,95,95]},
      {l:'Ingresos',v:'$'+Math.round(totalMxn).toLocaleString('es-MX'),c:[46,125,50]},
      {l:'Servicios',v:activosS+'/'+totalS,c:[230,81,0]},
      {l:'Pagos',v:String(totalP),c:[198,40,40]},
    ];
    const kW=(W-28)/3;
    kpis2.forEach((k,i)=>{
      const row=Math.floor(i/3), col=i%3;
      const x=14+col*(kW+2), y=48+row*22;
      doc.setFillColor(...LPURP); doc.roundedRect(x,y,kW,18,3,3,'F');
      doc.setFillColor(...k.c); doc.roundedRect(x,y,4,18,2,2,'F');
      doc.setTextColor(...k.c); doc.setFontSize(13); doc.setFont('helvetica','bold');
      doc.text(k.v,x+kW/2+2,y+10,{align:'center'});
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica','normal');
      doc.text(k.l,x+kW/2+2,y+15,{align:'center'});
    });

    let curY = 94;

    // ── Tabla: Páginas más visitadas ──
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Páginas más visitadas', 14, curY); curY += 4;
    const pagLabels={home:'Inicio',marketplace:'Marketplace',publish:'Publicar',
      about:'Nosotros',contact:'Contacto',acapoints:'AcaPoints'};
    doc.autoTable({
      startY: curY,
      head:[['Página','Visitas','% del total']],
      body: topPag.map(([p,n])=>[
        pagLabels[p]||p, String(n),
        totalEv>0 ? ((n/totalEv)*100).toFixed(1)+'%' : '0%'
      ]),
      theme:'grid',
      styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:[220,220,220],lineWidth:0.2,textColor:[40,40,40]},
      headStyles:{fillColor:PURP,textColor:WHITE,fontSize:8,fontStyle:'bold',cellPadding:4},
      alternateRowStyles:{fillColor:[248,245,252]},
      didDrawPage: () => {
        doc.setFillColor(...DARK); doc.rect(0,H-10,W,10,'F');
        doc.setTextColor(...WHITE); doc.setFontSize(7);
        doc.text('AcaConnect — Reporte Analytics Confidencial',14,H-4);
        doc.text(`Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`,W-14,H-4,{align:'right'});
      }
    });
    curY = doc.lastAutoTable.finalY + 8;

    // ── Tabla: Dispositivos ──
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Tráfico por dispositivo', 14, curY); curY += 4;
    doc.autoTable({
      startY: curY,
      head:[['Dispositivo','Sesiones','Porcentaje']],
      body:[
        ['📱 Móvil',    String(dispCount.mobile),  ((dispCount.mobile/dispTotal)*100).toFixed(1)+'%'],
        ['🖥️ Escritorio',String(dispCount.desktop), ((dispCount.desktop/dispTotal)*100).toFixed(1)+'%'],
        ['📟 Tablet',   String(dispCount.tablet),  ((dispCount.tablet/dispTotal)*100).toFixed(1)+'%'],
      ],
      theme:'grid',
      styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:[220,220,220],lineWidth:0.2,textColor:[40,40,40]},
      headStyles:{fillColor:[21,101,192],textColor:WHITE,fontSize:8,fontStyle:'bold',cellPadding:4},
      columnStyles:{2:{fontStyle:'bold',textColor:[21,101,192]}},
    });
    curY = doc.lastAutoTable.finalY + 8;

    // ── Tabla: Tipos de evento ──
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Actividad por tipo de evento', 14, curY); curY += 4;
    const evLabels={vista_pagina:'Vista de página',vista_servicio:'Vista de servicio',
      login:'Inicio de sesión',registro:'Registro',pago:'Pago realizado',click_contacto:'Click contacto'};
    doc.autoTable({
      startY: curY,
      head:[['Tipo de evento','Cantidad','% del total']],
      body: Object.entries(tiposC).map(([t,n])=>[
        evLabels[t]||t, String(n),
        totalEv>0 ? ((n/totalEv)*100).toFixed(1)+'%' : '0%'
      ]).sort((a,b)=>Number(b[1])-Number(a[1])),
      theme:'grid',
      styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:[220,220,220],lineWidth:0.2,textColor:[40,40,40]},
      headStyles:{fillColor:TEAL,textColor:WHITE,fontSize:8,fontStyle:'bold',cellPadding:4},
      alternateRowStyles:{fillColor:[240,250,248]},
      columnStyles:{2:{fontStyle:'bold',textColor:[0,95,95]}},
    });
    curY = doc.lastAutoTable.finalY + 8;

    // ── Tabla: Roles y métodos de pago ──
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...DARK);
    doc.text('Distribución de usuarios y métodos de pago', 14, curY); curY += 4;
    const rolLbl={admin:'👑 Administrador',supervisor:'🔍 Supervisor',vendedor:'🏪 Vendedor',cliente:'👤 Cliente'};
    doc.autoTable({
      startY: curY,
      head:[['Categoría','Descripción','Cantidad','%']],
      body:[
        ...Object.entries(rolesC).map(([r,n])=>['Rol', rolLbl[r]||r, String(n), ((n/totalU)*100).toFixed(1)+'%']),
        ['—','—','—','—'],
        ['Pago','💵 Efectivo',   String(metC.efectivo),   totalP>0?((metC.efectivo/totalP)*100).toFixed(1)+'%':'0%'],
        ['Pago','💳 Tarjeta',    String(metC.tarjeta),    totalP>0?((metC.tarjeta/totalP)*100).toFixed(1)+'%':'0%'],
        ['Pago','🪙 AcaPoints',  String(metC.acapoints),  totalP>0?((metC.acapoints/totalP)*100).toFixed(1)+'%':'0%'],
      ],
      theme:'grid',
      styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:[220,220,220],lineWidth:0.2,textColor:[40,40,40]},
      headStyles:{fillColor:[46,125,50],textColor:WHITE,fontSize:8,fontStyle:'bold',cellPadding:4},
      alternateRowStyles:{fillColor:[248,252,250]},
      columnStyles:{3:{fontStyle:'bold',textColor:[46,125,50]}},
    });

    const fname = `AcaConnect_Analytics_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(fname);
    showToast('✅ Reporte generado: ' + fname);
  } catch(e) {
    showToast('❌ Error: ' + e.message); console.error(e);
  } finally {
    if (btn) { btn.textContent = '📄 Exportar reporte PDF'; btn.disabled = false; }
  }
}


/* =====================================================
   HORARIOS Y DISPONIBILIDAD — PUBLICACIÓN
   ===================================================== */

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const DIAS_SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
let _dispTipo = 'ilimitado';

// ── Inicializar horario grid al cargar la página ─────────
function initHorarioGrid() {
  const grid = document.getElementById('horario-grid');
  if (!grid) return;
  grid.innerHTML = DIAS.map((dia, i) => `
    <div class="horario-row" id="hrow-${i}">
      <label class="toggle-switch" style="flex-shrink:0;">
        <input type="checkbox" id="h-activo-${i}" checked onchange="toggleDiaHorario(${i})"/>
        <span class="toggle-slider"></span>
      </label>
      <span class="horario-dia">${dia}</span>
      <div class="horario-horas" id="h-horas-${i}">
        <input class="horario-input" type="time" id="h-open-${i}" value="09:00"/>
        <span class="horario-sep">—</span>
        <input class="horario-input" type="time" id="h-close-${i}" value="18:00"/>
      </div>
    </div>`).join('');
}

function toggleHorario(checkbox) {
  const panel = document.getElementById('horario-panel');
  const label = document.getElementById('horario-toggle-label');
  if (checkbox.checked) {
    panel.style.display = 'none';
    label.textContent = 'Disponible siempre / sin horario fijo';
  } else {
    panel.style.display = 'block';
    label.textContent = 'Horario personalizado por día';
    initHorarioGrid();
  }
}

function toggleDiaHorario(idx) {
  const activo = document.getElementById('h-activo-' + idx).checked;
  const horas  = document.getElementById('h-horas-' + idx);
  const row    = document.getElementById('hrow-' + idx);
  horas.style.opacity = activo ? '1' : '0.35';
  horas.style.pointerEvents = activo ? 'auto' : 'none';
  row.style.opacity = activo ? '1' : '0.5';
}

function selectDispTipo(btn) {
  document.querySelectorAll('.disp-tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _dispTipo = btn.dataset.tipo;
  const panel = document.getElementById('disp-panel');
  panel.style.display = _dispTipo === 'ilimitado' ? 'none' : 'block';
  // Actualizar placeholder según tipo
  const input = document.getElementById('pub-disp-cantidad');
  if (input) {
    const placeholders = { diario:'Ej: 20 por día', semanal:'Ej: 100 por semana', total:'Ej: 50 en total', por_turno:'Ej: 8 por turno' };
    input.placeholder = placeholders[_dispTipo] || 'Cantidad';
  }
}

// ── Guardar horarios en Supabase ─────────────────────────
async function guardarHorariosServicio(servicioId) {
  const siempreAbierto = document.getElementById('pub-siempre-abierto')?.checked;
  if (siempreAbierto) return; // No guardar horarios si es "siempre abierto"

  const rows = [];
  for (let i = 0; i < 7; i++) {
    const activo = document.getElementById('h-activo-' + i)?.checked ?? true;
    const apertura = document.getElementById('h-open-'  + i)?.value || '09:00';
    const cierre   = document.getElementById('h-close-' + i)?.value || '18:00';
    rows.push({ servicio_id: servicioId, dia: i, abierto: activo,
                hora_apertura: activo ? apertura : null,
                hora_cierre:   activo ? cierre   : null });
  }
  try {
    await supaFetch('/rest/v1/horarios_servicio', {
      method: 'POST',
      body: JSON.stringify(rows)
    });
    // Marcar que tiene horario
    supaFetch('/rest/v1/servicios?id=eq.' + servicioId, {
      method: 'PATCH',
      body: JSON.stringify({ tiene_horario: true, siempre_abierto: false })
    }).catch(()=>{});
  } catch(e) { console.warn('Error guardando horarios:', e.message); }
}

// ── Guardar disponibilidad en Supabase ───────────────────
async function guardarDisponibilidadServicio(servicioId) {
  if (_dispTipo === 'ilimitado') return;
  const cantidad = parseInt(document.getElementById('pub-disp-cantidad')?.value) || null;
  const unidad   = document.getElementById('pub-disp-unidad')?.value?.trim() || 'lugares';
  const anticipo = parseInt(document.getElementById('pub-disp-anticipo')?.value) || 0;
  if (!cantidad) return;
  try {
    await supaFetch('/rest/v1/disponibilidad_servicio', {
      method: 'POST',
      body: JSON.stringify({
        servicio_id: servicioId, tipo_limite: _dispTipo,
        limite_cantidad: cantidad, unidad_label: unidad,
        anticipo_minimo_hrs: anticipo
      })
    });
    supaFetch('/rest/v1/servicios?id=eq.' + servicioId, {
      method: 'PATCH',
      body: JSON.stringify({ tiene_disponibilidad: true })
    }).catch(()=>{});
  } catch(e) { console.warn('Error guardando disponibilidad:', e.message); }
}

// ── Cargar y mostrar horarios en detalle del servicio ────
async function cargarHorarioDetalle(servicioId) {
  const container = document.getElementById('detail-horario-disp');
  if (!container) return;

  try {
    const [horarios, disp] = await Promise.all([
      supaFetch('/rest/v1/horarios_servicio?servicio_id=eq.' + servicioId + '&order=dia.asc').catch(()=>[]),
      supaFetch('/rest/v1/disponibilidad_servicio?servicio_id=eq.' + servicioId).catch(()=>[]),
    ]);

    let html = '';

    // ── Horario ──
    if (horarios && horarios.length > 0) {
      const hoy = (new Date().getDay() + 6) % 7; // JS: 0=Dom → convertir a 0=Lun
      const diaHoy = horarios.find(h => h.dia === hoy);
      const ahoraMin = new Date().getHours()*60 + new Date().getMinutes();

      let estadoHoy = '';
      if (diaHoy) {
        if (!diaHoy.abierto) {
          estadoHoy = `<span class="hd-badge cerrado">🔴 Cerrado hoy</span>`;
        } else {
          const [oh, om] = (diaHoy.hora_apertura||'00:00').split(':').map(Number);
          const [ch, cm] = (diaHoy.hora_cierre  ||'23:59').split(':').map(Number);
          const abierto = ahoraMin >= oh*60+om && ahoraMin <= ch*60+cm;
          estadoHoy = abierto
            ? `<span class="hd-badge abierto">🟢 Abierto ahora · cierra ${diaHoy.hora_cierre}</span>`
            : `<span class="hd-badge proximo">🟡 Abre hoy a las ${diaHoy.hora_apertura}</span>`;
        }
      }

      html += `
      <div class="hd-horario">
        <div class="hd-horario-header">
          <span style="font-weight:700;font-size:13px;">🕐 Horario</span>
          ${estadoHoy}
          <button class="hd-toggle-btn" onclick="toggleHorarioCompleto(this)">Ver todo ▾</button>
        </div>
        <div class="hd-semana" id="hd-semana-${servicioId}" style="display:none;">
          ${horarios.map(h => {
            const esHoy = h.dia === hoy;
            return `<div class="hd-dia-row ${esHoy?'hoy':''}">
              <span class="hd-dia-nombre">${DIAS_SHORT[h.dia]}</span>
              ${h.abierto
                ? `<span class="hd-dia-hrs">${h.hora_apertura||'—'} — ${h.hora_cierre||'—'}</span>`
                : `<span class="hd-dia-cerrado">Cerrado</span>`}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    } else {
      html += `<span class="hd-badge abierto" style="width:fit-content;">🟢 Disponible siempre</span>`;
    }

    // ── Disponibilidad ──
    if (disp && disp.length > 0) {
      const d = disp[0];
      const tipoLabel = { diario:'al día', semanal:'a la semana', total:'en total', por_turno:'por turno' };
      html += `
      <div class="hd-disp">
        <span class="hd-disp-icon">📦</span>
        <div>
          <span style="font-size:13px;font-weight:600;color:var(--text);">Disponibilidad: </span>
          <span style="font-size:13px;color:var(--text-mid);">${d.limite_cantidad} ${d.unidad_label||'lugares'} ${tipoLabel[d.tipo_limite]||d.tipo_limite}</span>
          ${d.anticipo_minimo_hrs > 0
            ? `<br><span style="font-size:11px;color:#888;">⏰ Reserva con ${d.anticipo_minimo_hrs < 24 ? d.anticipo_minimo_hrs+'h' : (d.anticipo_minimo_hrs/24)+'d'} de anticipación</span>`
            : ''}
        </div>
      </div>`;
    }

    container.innerHTML = html;
  } catch(e) { console.warn('cargarHorarioDetalle:', e.message); }
}

function toggleHorarioCompleto(btn) {
  const semana = btn.closest('.hd-horario').querySelector('.hd-semana');
  const abierta = semana.style.display !== 'none';
  semana.style.display = abierta ? 'none' : 'block';
  btn.textContent = abierta ? 'Ver todo ▾' : 'Ocultar ▴';
}

// ── Patch openDetail to load horario ────────────────────
const _origOpenDetailHD = openDetail;
openDetail = function(s) {
  _origOpenDetailHD(s);
  cargarHorarioDetalle(s.id);
};


/* =====================================================
   TÉRMINOS Y CONDICIONES
   ===================================================== */

function toggleTyC(checkbox) {
  const btn   = document.getElementById('btn-publicar');
  const hint  = document.getElementById('tyc-promo-hint');
  const box   = document.getElementById('tyc-box');
  if (checkbox.checked) {
    btn.disabled = false;
    btn.style.opacity = '1'; btn.style.cursor = 'pointer';
    hint.style.display = 'block';
    box.style.borderColor = 'var(--teal)';
    box.style.background  = 'rgba(0,128,128,.04)';
  } else {
    btn.disabled = true;
    btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed';
    hint.style.display = 'none';
    box.style.borderColor = ''; box.style.background = '';
  }
}

function openTyC() {
  generarTyCPDF();
}
function closeTyC() {
  // Solo por compatibilidad con el botón × del modal (ya no se usa)
  const ovl = document.getElementById('tyc-overlay');
  if (ovl) ovl.style.display = 'none';
}
function aceptarTyC() {
  const chk = document.getElementById('pub-tyc');
  if (chk) { chk.checked = true; toggleTyC(chk); }
  showToast('✅ Términos aceptados');
}

function generarTyCPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});

  // Paleta
  const DARK  = [10,31,31];
  const TEAL  = [0,95,95];
  const WHITE = [255,255,255];
  const GRAY  = [100,100,100];
  const LGRAY = [245,245,245];
  const LTEAL = [232,245,244];

  // ── Encabezado ──────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 46, 'F');
  // Logo círculo
  doc.setFillColor(...TEAL);
  doc.circle(20, 23, 11, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('AC', 20, 27, { align:'center' });
  // Título
  doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text('AcaConnect', 36, 20);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.setTextColor(180,220,210);
  doc.text('Términos y Condiciones de Uso', 36, 29);
  doc.setFontSize(8); doc.setTextColor(160,200,190);
  doc.text('Versión 1.0  ·  Vigente desde enero 2025', 36, 36);
  // Fecha a la derecha
  doc.setTextColor(...WHITE); doc.setFontSize(8);
  doc.text('Generado: ' + fecha, W-14, 20, { align:'right' });

  // ── Banda de aviso ──────────────────────────────────
  doc.setFillColor(...LTEAL);
  doc.rect(0, 46, W, 14, 'F');
  doc.setTextColor(...TEAL); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
  doc.text(
    '  Al publicar un servicio en AcaConnect aceptas todos los términos descritos en este documento.',
    0, 55
  );

  let y = 68;
  const margenL = 14, margenR = W - 14;
  const lineaW  = margenR - margenL;

  // Helper: dibujar sección
  function seccion(titulo, puntos) {
    // Verificar espacio
    if (y + 8 + puntos.length * 6 > H - 18) {
      doc.addPage();
      y = 20;
    }
    // Cintillo del título
    doc.setFillColor(...TEAL);
    doc.roundedRect(margenL, y - 4, lineaW, 9, 2, 2, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text(titulo, margenL + 4, y + 2);
    y += 10;

    // Párrafos / bullets
    puntos.forEach(p => {
      const esBullet = p.startsWith('•');
      const texto    = esBullet ? p.slice(1).trim() : p;
      const xBase    = esBullet ? margenL + 8 : margenL + 2;
      const maxW     = lineaW - (esBullet ? 8 : 2);

      if (esBullet) {
        doc.setFillColor(...TEAL);
        doc.circle(margenL + 4, y - 1, 1.2, 'F');
      }

      doc.setTextColor(60, 60, 60); doc.setFontSize(8.5); doc.setFont('helvetica', esBullet ? 'normal' : 'normal');
      const lines = doc.splitTextToSize(texto, maxW);
      lines.forEach(line => {
        if (y > H - 18) { doc.addPage(); y = 20; }
        doc.text(line, xBase, y);
        y += 5;
      });
      y += 1;
    });
    y += 4;
  }

  // Helper: cuadro highlight
  function cuadroInfo(texto, colorFondo, colorBorde, colorTexto) {
    if (y + 16 > H - 18) { doc.addPage(); y = 20; }
    doc.setFillColor(...colorFondo);
    doc.setDrawColor(...colorBorde);
    doc.roundedRect(margenL, y, lineaW, 14, 3, 3, 'FD');
    doc.setTextColor(...colorTexto); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
    const lines = doc.splitTextToSize(texto, lineaW - 8);
    lines.forEach((l, i) => { doc.text(l, margenL + 4, y + 6 + i * 5); });
    y += 18;
  }

  // ── CONTENIDO ───────────────────────────────────────

  seccion('1. Quiénes Somos', [
    'AcaConnect es una plataforma digital de marketplace de servicios locales con sede en Acapulco de Juárez, Guerrero, México. Conectamos a proveedores de servicios verificados con clientes locales y turistas.',
    'Operamos bajo las leyes comerciales y de protección al consumidor vigentes en el Estado de Guerrero y la República Mexicana.',
  ]);

  seccion('2. Condiciones para Vendedores', [
    '• Debes ser mayor de 18 años y contar con identificación oficial vigente (INE/IFE).',
    '• Tu servicio debe cumplir con la legislación vigente en el municipio de Acapulco de Juárez.',
    '• La información publicada (precios, disponibilidad, descripción) debe ser veraz y actualizada.',
    '• AcaConnect se reserva el derecho de rechazar o retirar publicaciones que no cumplan los estándares de calidad.',
    '• Queda prohibida la publicación de servicios ilegales, engañosos o que atenten contra la dignidad de las personas.',
  ]);

  seccion('3. Comisiones de la Plataforma', [
    '• Pagos con AcaPoints: margen del 15%–16% según el paquete adquirido.',
    '• Pagos con tarjeta bancaria (simulada): comisión del 5% sobre el monto de la transacción.',
    '• Pagos en efectivo: sin comisión de plataforma. El pago se coordina directamente con el proveedor.',
    '• Retiro de AcaPoints: tasa de $0.80 MXN por punto (el valor de compra es $1.00 MXN por punto).',
    '• Las comisiones pueden actualizarse con previo aviso de 15 días naturales.',
  ]);

  cuadroInfo(
    '💡 Ejemplo: Si vendes un servicio de $500 MXN con tarjeta, AcaConnect retiene $25 MXN (5%). El vendedor recibe $475 MXN en su billetera virtual.',
    [240,250,245], [0,95,95], [0,60,60]
  );

  seccion('4. AcaPoints — Moneda Virtual', [
    '• AcaPoints es la moneda virtual de AcaConnect. 1 AcaPoint equivale a $1.00 MXN para realizar compras.',
    '• La tasa de retiro a cuenta bancaria es de $0.80 MXN por AcaPoint.',
    '• Los AcaPoints no caducan mientras la cuenta esté activa.',
    '• AcaConnect no está obligada a convertir AcaPoints a efectivo fuera de la plataforma.',
    '• Los AcaPoints no son transferibles entre cuentas de usuario.',
  ]);

  seccion('5. Promos y Descuentos', [
    '• Al aceptar estos términos, el vendedor queda habilitado para crear promos entre semana (Lunes a Viernes).',
    '• Las promos se desactivan automáticamente los sábados y domingos.',
    '• AcaConnect no garantiza un número mínimo de ventas por promo publicada.',
    '• El vendedor es responsable de cumplir con la oferta publicada en su promo.',
    '• AcaConnect puede suspender una promo si recibe reportes de incumplimiento.',
  ]);

  seccion('6. Privacidad y Protección de Datos', [
    '• Los documentos de identidad (INE, CURP, Acta de Nacimiento) se usan exclusivamente para verificación.',
    '• No compartimos datos personales con terceros sin tu consentimiento expreso.',
    '• Almacenamos la información de forma segura siguiendo estándares internacionales.',
    '• Puedes solicitar la eliminación de tus datos enviando un correo a: privacidad@acaconnect.mx',
    '• Cumplimos con la Ley Federal de Protección de Datos Personales en Posesión de Particulares (LFPDPPP).',
  ]);

  seccion('7. Responsabilidades y Límites', [
    '• AcaConnect actúa como intermediario y no es responsable de la calidad final del servicio prestado.',
    '• En caso de disputa entre comprador y vendedor, AcaConnect puede intervenir como mediador.',
    '• La plataforma no se responsabiliza por daños ocasionados por información incorrecta del proveedor.',
    '• Los pagos simulados con tarjeta son únicamente para demostración del sistema.',
  ]);

  seccion('8. Modificaciones a los Términos', [
    '• AcaConnect puede actualizar estos términos con un aviso previo de 15 días naturales.',
    '• El uso continuo de la plataforma después del aviso implica la aceptación de los nuevos términos.',
    '• La versión más reciente siempre estará disponible en la plataforma.',
  ]);

  // ── Cuadro de firma / aceptación ────────────────────
  if (y + 40 > H - 18) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFillColor(...LGRAY);
  doc.setDrawColor(200,200,200);
  doc.roundedRect(margenL, y, lineaW, 34, 4, 4, 'FD');

  doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica','bold');
  doc.text('✅  Declaración de Aceptación', margenL + 6, y + 8);
  doc.setFont('helvetica','normal'); doc.setTextColor(...GRAY); doc.setFontSize(8);
  const decl = 'Al marcar la casilla "Acepto los Términos y Condiciones" en la plataforma AcaConnect, el usuario declara haber leído, entendido y aceptado en su totalidad las condiciones descritas en este documento.';
  const declLines = doc.splitTextToSize(decl, lineaW - 12);
  declLines.forEach((l, i) => { doc.text(l, margenL + 6, y + 15 + i * 5); });
  y += 38;

  // ── Pie de página en todas las páginas ──────────────
  const totalPags = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFillColor(...DARK);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('AcaConnect © 2025 · hola@acaconnect.mx · Acapulco de Juárez, Guerrero, México', 14, H - 4);
    doc.text(`Página ${p} de ${totalPags}`, W - 14, H - 4, { align:'right' });
  }

  doc.save('AcaConnect_Terminos_y_Condiciones_v1.0.pdf');
  showToast('📄 PDF descargado — léelo y marca la casilla para aceptar');
}

/* =====================================================
   PÁGINA PROMOS Y DESCUENTOS
   ===================================================== */

let _promoTipo  = 'porcentaje';
let _todasPromos = [];

// Mostrar si hoy es entre semana
function initPromosSemana() {
  const badge = document.getElementById('promos-semana-badge');
  if (!badge) return;
  const dia = new Date().getDay(); // 0=Dom,1=Lun,...,6=Sáb
  const esEntreSemana = dia >= 1 && dia <= 5;
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  badge.innerHTML = esEntreSemana
    ? `<span class="promos-activo-badge">🟢 Promos activas hoy (${dias[dia]})</span>`
    : `<span class="promos-inactivo-badge">🔴 Promos disponibles Lun–Vie · Hoy es ${dias[dia]}</span>`;
}

async function cargarPromos() {
  const grid = document.getElementById('promos-grid');
  const cta  = document.getElementById('promos-cta-vendedor');
  if (!grid) return;

  // Mostrar CTA de vendedor si aplica
  if (currentUser && tieneRol(['vendedor','admin','supervisor'])) {
    cta.style.display = 'block';
  }

  try {
    const data = await supaFetch(
      '/rest/v1/promos_descuentos?activa=eq.true&order=creado_en.desc&select=*'
    );
    _todasPromos = data || [];
    renderPromos(_todasPromos);
  } catch(e) {
    grid.innerHTML = `<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">Sin promos disponibles aún.</p>`;
  }
}

function renderPromos(promos) {
  const grid = document.getElementById('promos-grid');
  const dia  = new Date().getDay();
  const esEntreSemana = dia >= 1 && dia <= 5;

  if (!promos || promos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:12px;">🏷️</div>
        <h3 style="color:#1a1a1a;margin:0 0 8px;">Sin promos por ahora</h3>
        <p style="color:#888;font-size:14px;">Los vendedores verificados pueden crear promos entre semana.</p>
      </div>`;
    return;
  }

  const tipoLabel = { porcentaje:'% OFF', monto_fijo:'MXN OFF', '2x1':'2×1', '3x2':'3×2' };
  const tipoBg    = { porcentaje:'#E53935', monto_fijo:'#1565C0', '2x1':'#2E7D32', '3x2':'#6A1B9A' };

  grid.innerHTML = promos.map(p => {
    const disponible = !p.solo_entre_semana || esEntreSemana;
    const badge = disponible
      ? `<span class="promo-disp-badge activa">🟢 Disponible ahora</span>`
      : `<span class="promo-disp-badge inactiva">🔴 Solo Lun–Vie</span>`;
    const imgSrc = p.imagen_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=60';
    const descLabel = p.descuento_tipo === 'porcentaje' ? p.descuento_valor + '% OFF'
                    : p.descuento_tipo === 'monto_fijo' ? '$' + p.descuento_valor + ' OFF'
                    : p.descuento_tipo;
    const vigencia = p.fecha_fin
      ? `Válido hasta ${new Date(p.fecha_fin).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}`
      : 'Sin fecha límite';
    const usos = p.limite_usos
      ? `${p.usos_actuales||0}/${p.limite_usos} usados`
      : '';

    return `
    <div class="promo-card ${disponible?'':'inactiva'}" onclick="${disponible?`openPromoDetalle(${p.id})`:''}">
      <div class="promo-img-wrap">
        <img src="${imgSrc}" alt="${p.titulo}" onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'"/>
        <div class="promo-desc-badge" style="background:${tipoBg[p.descuento_tipo]||'#E53935'};">
          ${descLabel}
        </div>
        ${badge}
      </div>
      <div class="promo-card-body">
        <h4 class="promo-titulo">${p.titulo}</h4>
        <p class="promo-desc">${p.descripcion||''}</p>
        <div class="promo-precios">
          ${p.precio_original ? `<span class="promo-precio-old">$${Number(p.precio_original).toLocaleString('es-MX')}</span>` : ''}
          ${p.precio_promo    ? `<span class="promo-precio-new">$${Number(p.precio_promo).toLocaleString('es-MX')}</span>` : ''}
        </div>
        <div class="promo-meta">
          <span>📅 ${vigencia}</span>
          ${usos ? `<span>🔢 ${usos}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filtrarPromos(btn) {
  document.querySelectorAll('.promo-filtro').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.cat;
  if (cat === 'todos') { renderPromos(_todasPromos); return; }
  // Filtrar por categoría del servicio (necesitaría join, usamos título como aproximación)
  renderPromos(_todasPromos.filter(p =>
    (p.titulo||'').toLowerCase().includes(cat) ||
    (p.descripcion||'').toLowerCase().includes(cat)
  ));
}

function openPromoDetalle(id) {
  const p = _todasPromos.find(x => x.id === id);
  if (!p) return;
  // Abrir el servicio en el marketplace si tenemos servicio_id
  if (p.servicio_id) {
    showPage('marketplace');
    setTimeout(() => {
      const s = allServices?.find(x => x.id === p.servicio_id);
      if (s) openDetail(s);
    }, 300);
  }
}

// Hook showPage para cargar promos
const _origShowPagePromos = showPage;
showPage = function(name) {
  _origShowPagePromos(name);
  if (name === 'promos') {
    initPromosSemana();
    cargarPromos();
  }
  if (name === 'about') {
    // Esperar a que la página sea visible y Leaflet esté cargado
    const tryInitMapa = (attempts) => {
      if (typeof L === 'undefined') {
        if (attempts > 0) setTimeout(() => tryInitMapa(attempts - 1), 300);
        return;
      }
      initMapaNegocios().then(() => {
        setTimeout(() => { if (_mapaInstance) _mapaInstance.invalidateSize(); }, 200);
        setTimeout(() => { if (_mapaInstance) _mapaInstance.invalidateSize(); }, 800);
      });
    };
    requestAnimationFrame(() => tryInitMapa(10));
  }
};

/* =====================================================
   CREAR PROMO (vendedores)
   ===================================================== */

async function openCrearPromo() {
  if (!currentUser) { openModal('login'); return; }

  // Verificar T&C aceptados
  try {
    const tyc = await supaFetch('/rest/v1/terminos_aceptados?usuario_id=eq.' + currentUser.id + '&select=id');
    if (!tyc || tyc.length === 0) {
      showToast('⚠️ Primero acepta los Términos y Condiciones al publicar un servicio');
      return;
    }
  } catch(e) {}

  // Cargar servicios del vendedor
  try {
    const servicios = await supaFetch(
      '/rest/v1/servicios?usuario_id=eq.' + currentUser.id +
      '&estado=eq.activo&select=id,titulo&order=titulo.asc'
    );
    const sel = document.getElementById('promo-servicio-select');
    sel.innerHTML = '<option value="">— Selecciona un servicio —</option>' +
      (servicios||[]).map(s => `<option value="${s.id}" data-titulo="${s.titulo}">${s.titulo}</option>`).join('');
  } catch(e) {}

  // Fecha mínima = hoy
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('promo-fecha-fin').min = hoy;

  _promoTipo = 'porcentaje';
  document.getElementById('crear-promo-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeCrearPromo() {
  document.getElementById('crear-promo-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function selectPromoTipo(btn) {
  document.querySelectorAll('.promo-tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _promoTipo = btn.dataset.tipo;
  const panel = document.getElementById('promo-valor-panel');
  const hint  = document.getElementById('promo-valor-hint');
  const input = document.getElementById('promo-valor');
  if (_promoTipo === '2x1' || _promoTipo === '3x2') {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'flex';
    hint.textContent = _promoTipo === 'porcentaje' ? '% de descuento' : 'MXN de descuento';
    input.placeholder = _promoTipo === 'porcentaje' ? 'Ej: 20' : 'Ej: 100';
  }
}

async function guardarPromo() {
  const servicioId = document.getElementById('promo-servicio-select').value;
  const titulo     = document.getElementById('promo-titulo').value.trim();
  const desc       = document.getElementById('promo-desc').value.trim();
  const valor      = parseFloat(document.getElementById('promo-valor')?.value) || null;
  const fechaFin   = document.getElementById('promo-fecha-fin').value || null;
  const limite     = parseInt(document.getElementById('promo-limite').value) || null;

  if (!servicioId) { showToast('⚠️ Selecciona un servicio'); return; }
  if (!titulo)     { showToast('⚠️ Escribe un título para la promo'); return; }
  if ((_promoTipo === 'porcentaje' || _promoTipo === 'monto_fijo') && !valor) {
    showToast('⚠️ Ingresa el valor del descuento'); return;
  }

  const btn = document.getElementById('btn-guardar-promo');
  btn.textContent = '⏳ Guardando...'; btn.disabled = true;

  try {
    // Obtener precio del servicio para calcular precio_promo
    const servData = await supaFetch('/rest/v1/servicios?id=eq.' + servicioId + '&select=precio,imagen_url').catch(()=>[]);
    const precioOrig = servData?.[0]?.precio ? Number(servData[0].precio) : null;
    let precioPromo  = null;
    if (precioOrig) {
      if (_promoTipo === 'porcentaje')  precioPromo = precioOrig * (1 - valor/100);
      if (_promoTipo === 'monto_fijo')  precioPromo = precioOrig - valor;
      if (_promoTipo === '2x1')         precioPromo = precioOrig / 2;
      if (_promoTipo === '3x2')         precioPromo = (precioOrig * 2) / 3;
    }

    await supaFetch('/rest/v1/promos_descuentos', {
      method: 'POST',
      body: JSON.stringify({
        servicio_id: parseInt(servicioId),
        usuario_id:  currentUser.id,
        titulo, descripcion: desc,
        descuento_tipo: _promoTipo,
        descuento_valor: valor,
        precio_original: precioOrig,
        precio_promo: precioPromo ? Math.round(precioPromo*100)/100 : null,
        imagen_url: servData?.[0]?.imagen_url || null,
        solo_entre_semana: true,
        dias_activos: [1,2,3,4,5],
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: fechaFin,
        limite_usos: limite,
        activa: true
      })
    });

    closeCrearPromo();
    showToast('🎉 ¡Promo publicada! Se mostrará Lun–Vie');
    cargarPromos();
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    btn.textContent = '🚀 Publicar promo'; btn.disabled = false;
  }
}


/* =====================================================
   MAPA DE NEGOCIOS — SOBRE ACAPULCO
   ===================================================== */

let _mapaInstance   = null;
let _mapaInicializado = false;

// Colores y config por categoría
const MAPA_CATS = {
  experiencias: { color: '#1565C0', emoji: '⛵', label: 'Experiencias' },
  gastronomia:  { color: '#2E7D32', emoji: '🍴', label: 'Gastronomía'  },
  servicios:    { color: '#E65100', emoji: '💼', label: 'Servicios'     },
  hospedaje:    { color: '#6A1B9A', emoji: '🏨', label: 'Hospedaje'     },
};

function crearIconoMapa(categoria, count) {
  const cfg   = MAPA_CATS[categoria] || { color:'#607D8B', emoji:'📍' };
  const size  = count > 1 ? 36 : 30;
  const html  = count > 1
    ? `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${cfg.color};color:white;
        display:flex;align-items:center;justify-content:center;
        font-size:${count>9?10:12}px;font-weight:800;
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        font-family:'DM Sans',sans-serif;">${count}</div>`
    : `<div style="
        width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${cfg.color};
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:13px;">${cfg.emoji}</span>
       </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size]
  });
}

async function initMapaNegocios() {
  const el = document.getElementById('mapa-acapulco');
  if (!el) return;

  // Si ya existe el mapa, solo refrescar datos
  if (_mapaInicializado && _mapaInstance) {
    await cargarPuntosEnMapa();
    return;
  }

  // Inicializar Leaflet
  _mapaInstance = L.map('mapa-acapulco', {
    center: [16.853, -99.903],
    zoom: 13,
    zoomControl: true,
    scrollWheelZoom: false,
  });

  // Tile layer OpenStreetMap (100% gratuito)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(_mapaInstance);

  // Capa de marcadores con clustering manual
  _mapaInstance.markersLayer = L.layerGroup().addTo(_mapaInstance);

  _mapaInicializado = true;
  await cargarPuntosEnMapa();
  // Forzar repaint del mapa (necesario cuando el div no tenía tamaño al init)
  setTimeout(() => { _mapaInstance.invalidateSize(); }, 100);
}

async function cargarPuntosEnMapa() {
  if (!_mapaInstance) return;

  try {
    // Cargar servicios activos con coordenadas
    const servicios = await supaFetch(
      '/rest/v1/servicios?estado=eq.activo&select=id,titulo,categoria,ubicacion,precio,precio_tipo,lat,lng,imagen_url,maps_url&order=categoria.asc'
    );

    if (!servicios || servicios.length === 0) {
      mostrarMapaVacio();
      return;
    }

    // Limpiar marcadores anteriores
    _mapaInstance.markersLayer.clearLayers();

    // Solo mostrar servicios con maps_url (coords precisas)
    // Servicios sin link no aparecen en el mapa pero sí en el marketplace

    // Estadísticas
    const stats = { total:0, experiencias:0, gastronomia:0, servicios:0, hospedaje:0 };
    // Agrupar por posición cercana para no apilar marcadores
    const posGroups = {};

    // Resolver coords del maps_url para TODOS los servicios que tienen link
    // (prioridad: maps_url > lat/lng existente > zona)
    const conURL = servicios.filter(s => s.maps_url);
    const resolvedCoords = {};
    if (conURL.length > 0) {
      // Mostrar indicador de carga
      const statsEl = document.getElementById('mapa-stats');
      if (statsEl) statsEl.innerHTML += '<div style="grid-column:1/-1;text-align:center;font-size:12px;color:#888;padding:4px 0;">🔍 Resolviendo ubicaciones precisas...</div>';

      await Promise.all(conURL.map(async s => {
        const coords = await extraerCoordsDeURL(s.maps_url).catch(()=>null);
        if (coords) {
          resolvedCoords[s.id] = coords;
          // Solo actualizar en DB si las coords son diferentes (mejora precisión)
          if (!s.lat || !s.lng || Math.abs(s.lat - coords.lat) > 0.001) {
            supaFetch('/rest/v1/servicios?id=eq.' + s.id, {
              method: 'PATCH',
              body: JSON.stringify({ lat: coords.lat, lng: coords.lng })
            }).catch(()=>{});
          }
        }
      }));
      // Limpiar indicador
      if (statsEl) {
        const hint = statsEl.querySelector('div[style*="grid-column"]');
        if (hint) hint.remove();
      }
    }

    servicios.forEach(s => {
      let lat = s.lat, lng = s.lng;

      // Prioridad 1: coords del maps_url (más precisas que las de zona)
      if (resolvedCoords[s.id]) {
        lat = resolvedCoords[s.id].lat;
        lng = resolvedCoords[s.id].lng;
      }

      if (!lat) return; // Sin coords del maps_url → no mostrar en mapa

      const cat = s.categoria || 'servicios';
      const key = `${Math.round(lat*1000)}_${Math.round(lng*1000)}_${cat}`;
      if (!posGroups[key]) posGroups[key] = { lat, lng, cat, items:[] };
      posGroups[key].items.push(s);

      stats.total++;
      if (stats[cat] !== undefined) stats[cat]++;
    });

    // Crear marcadores
    Object.values(posGroups).forEach(group => {
      const { lat, lng, cat, items } = group;
      const cfg = MAPA_CATS[cat] || { color:'#607D8B', emoji:'📍', label: cat };
      const icono = crearIconoMapa(cat, items.length);

      // Popup con info del/los servicio(s)
      const popupContent = items.length === 1
        ? crearPopupSingle(items[0], cfg)
        : crearPopupCluster(items, cfg);

      const marker = L.marker([lat, lng], { icon: icono })
        .bindPopup(popupContent, { maxWidth: 260, className: 'mapa-popup' });

      // Click: abrir servicio en marketplace
      if (items.length === 1) {
        marker.on('popupopen', () => {
          // Botón ver servicio
          const btn = document.getElementById('mapa-ver-' + items[0].id);
          if (btn) btn.addEventListener('click', () => {
            _mapaInstance.closePopup();
            showPage('marketplace');
            setTimeout(() => {
              const s = allServices?.find(x => x.id === items[0].id);
              if (s) openDetail(s);
            }, 400);
          });
        });
      }

      _mapaInstance.markersLayer.addLayer(marker);
    });

    // Actualizar estadísticas
    document.getElementById('mapa-total').textContent = stats.total;
    document.getElementById('mapa-exp').textContent   = stats.experiencias;
    document.getElementById('mapa-gastro').textContent= stats.gastronomia;
    document.getElementById('mapa-serv').textContent  = stats.servicios;
    document.getElementById('mapa-hosp').textContent  = stats.hospedaje;

  } catch(e) {
    console.warn('Error cargando mapa:', e.message);
    mostrarMapaVacio();
  }
}

function crearPopupSingle(s, cfg) {
  const precio = s.precio_tipo && esRangoPrecio(s.precio_tipo) ? s.precio_tipo : (s.precio ? '$' + Number(s.precio).toLocaleString('es-MX') + ' / ' + (s.precio_tipo||'') : '');
  const img    = s.imagen_url
    ? `<img src="${s.imagen_url}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" onerror="this.style.display='none'"/>`
    : '';
  return `
    <div style="font-family:'DM Sans',sans-serif;min-width:200px;">
      ${img}
      <div style="font-size:10px;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">${cfg.emoji} ${cfg.label}</div>
      <div style="font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3;margin-bottom:4px;">${s.titulo}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px;">📍 ${s.ubicacion||'Acapulco'}</div>
      ${precio ? `<div style="font-size:14px;font-weight:700;color:${cfg.color};">${precio}</div>` : ''}
      <button id="mapa-ver-${s.id}"
        style="margin-top:10px;width:100%;padding:8px;background:${cfg.color};color:white;border:none;
               border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        Ver servicio →
      </button>
    </div>`;
}

function crearPopupCluster(items, cfg) {
  const lista = items.slice(0,4).map(s =>
    `<div style="padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">${cfg.emoji} ${s.titulo}</div>`
  ).join('');
  const extra = items.length > 4 ? `<div style="font-size:11px;color:#aaa;padding-top:4px;">+${items.length-4} más en esta zona</div>` : '';
  return `
    <div style="font-family:'DM Sans',sans-serif;min-width:200px;">
      <div style="font-size:11px;font-weight:700;color:${cfg.color};margin-bottom:8px;">${cfg.emoji} ${items.length} ${cfg.label} aquí</div>
      ${lista}${extra}
      <button onclick="showPage('marketplace')" style="margin-top:8px;width:100%;padding:7px;background:${cfg.color};color:white;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">Ver en Marketplace</button>
    </div>`;
}

function mostrarMapaVacio() {
  ['mapa-total','mapa-exp','mapa-gastro','mapa-serv','mapa-hosp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
}

// ── Extraer coordenadas de URL de Google Maps ─────────────
async function extraerCoordsDeURL(mapsUrl) {
  if (!mapsUrl) return null;

  // 1. Intentar extraer coords directamente de URLs expandidas
  const patterns = [
    /@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,     // @lat,lng (Google Maps place)
    /[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/, // ?q=lat,lng
    /[?&]ll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/, // ?ll=lat,lng
    /\/(-?\d{1,3}\.\d{6,}),(-?\d{1,3}\.\d{6,})/,      // /lat,lng en path
  ];
  for (const re of patterns) {
    const m = mapsUrl.match(re);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      // Validar que estén en zona México (aprox)
      if (lat > 14 && lat < 33 && lng > -120 && lng < -86) {
        return { lat, lng, source: 'direct' };
      }
    }
  }

  // 2. Para links cortos (maps.app.goo.gl, goo.gl/maps): resolver con proxy
  const isShort = /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(mapsUrl);
  if (isShort) {
    try {
      // allorigins.win es un proxy CORS gratuito que sigue redirects
      const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(mapsUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const finalUrl = data.status?.url || '';
        const contents = data.contents || '';

        // Buscar coords en la URL final o en el contenido HTML
        const searchIn = finalUrl + ' ' + contents.slice(0, 2000);
        for (const re of patterns) {
          const m = searchIn.match(re);
          if (m) {
            const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
            if (lat > 14 && lat < 33 && lng > -120 && lng < -86) {
              return { lat, lng, source: 'proxy' };
            }
          }
        }
        // Buscar patrón alternativo en HTML (data-lat/data-lng o meta tags)
        const metaMatch = contents.match(/"(-1[0-9]\.\d{6}),\s*(-9[0-9]\.\d{6})"/);
        if (metaMatch) {
          return { lat: parseFloat(metaMatch[1]), lng: parseFloat(metaMatch[2]), source: 'html' };
        }
      }
    } catch(e) { console.warn('Proxy resolve failed:', e.message); }
  }

  return null; // No se pudo extraer
}

// Al guardar coordenadas al publicar un servicio
async function guardarCoordsServicio(servicioId, ubicacion, mapsUrl) {
  if (!mapsUrl) return; // Sin link → no guardar coords, no aparece en mapa
  try {
    const coords = await extraerCoordsDeURL(mapsUrl);
    if (!coords) { console.warn('No se pudieron extraer coords de:', mapsUrl); return; }
    supaFetch('/rest/v1/servicios?id=eq.' + servicioId, {
      method: 'PATCH',
      body: JSON.stringify({ lat: coords.lat, lng: coords.lng })
    }).catch(()=>{});
    console.log('Coords guardadas:', coords.lat, coords.lng);
  } catch(e) { console.warn('guardarCoordsServicio error:', e.message); }
}


/* =====================================================
   TICKET PDF — MIS COMPRAS
   ===================================================== */

function imprimirTicketPDF(folio) {
  const compras = comprasGetAll();
  const comp = compras.find(x => x.folio === folio);
  if (!comp) { showToast('⚠️ No se encontró la compra'); return; }

  const { jsPDF } = window.jspdf;
  // Usar A4 estándar — siempre funciona en todas las versiones de jsPDF
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const PW  = 210;  // ancho A4
  const TW  = 90;   // ancho del ticket
  const TX  = (PW - TW) / 2; // centrado
  let y     = 20;

  const DARK  = [10,31,31];
  const TEAL  = [0,95,95];
  const OTEAL = [0,128,128];
  const WHITE = [255,255,255];
  const GRAY  = [130,130,130];
  const LGRAY = [240,240,240];
  const GREEN = [46,125,50];

  // ── Fondo del ticket ──────────────────────────────
  doc.setFillColor(250,250,250);
  doc.setDrawColor(220,220,220);
  doc.roundedRect(TX - 2, y - 4, TW + 4, 230, 4, 4, 'FD');

  // ── Encabezado ────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.roundedRect(TX - 2, y - 4, TW + 4, 28, 4, 4, 'F');
  // Círculo logo
  doc.setFillColor(...TEAL);
  doc.circle(TX + TW/2, y + 6, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('AC', TX + TW/2, y + 8.5, { align:'center' });
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('AcaConnect', TX + TW/2, y + 18, { align:'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.setTextColor(180,220,210);
  doc.text('Comprobante de compra', TX + TW/2, y + 23, { align:'center' });
  y += 30;

  // ── Folio destacado ───────────────────────────────
  doc.setFillColor(232,245,244);
  doc.setDrawColor(...OTEAL);
  doc.roundedRect(TX + 2, y, TW - 4, 14, 3, 3, 'FD');
  doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
  doc.text('FOLIO DE COMPRA', TX + TW/2, y + 5, { align:'center' });
  doc.setTextColor(...OTEAL); doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(comp.folio, TX + TW/2, y + 11.5, { align:'center' });
  y += 18;

  // Helpers
  const punteada = () => {
    doc.setDrawColor(...LGRAY);
    const dash = doc.setLineDashPattern || doc.setLineDash;
    try { doc.setLineDashPattern([1.5,1.5], 0); } catch(e) {}
    doc.line(TX + 2, y, TX + TW - 2, y);
    try { doc.setLineDashPattern([], 0); } catch(e) {}
    y += 5;
  };
  const fila = (label, valor, negrita, colorVal) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(label, TX + 4, y);
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setTextColor(...(colorVal || [40,40,40]));
    const valStr = String(valor);
    const lines = doc.splitTextToSize(valStr, TW/2);
    doc.text(lines[0], TX + TW - 4, y, { align:'right' });
    y += 5.5;
  };
  const secTitle = (texto, colorFondo) => {
    doc.setFillColor(...(colorFondo || DARK));
    doc.roundedRect(TX + 2, y, 28, 5, 1, 1, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text(texto, TX + 16, y + 3.5, { align:'center' });
    y += 8;
  };

  punteada();

  // ── Servicio ──────────────────────────────────────
  secTitle('SERVICIO', TEAL);
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(20,20,20);
  const tituloLines = doc.splitTextToSize(comp.servicio_titulo || '—', TW - 8);
  tituloLines.forEach(l => { doc.text(l, TX + 4, y); y += 5; });
  y += 1;
  fila('Categoría', catLabel(comp.servicio_cat) || '—');
  fila('Ubicación', comp.servicio_ubicacion || '—');
  fila('Proveedor', comp.proveedor_nombre   || '—');

  punteada();

  // ── Pago ──────────────────────────────────────────
  secTitle('DETALLE DEL PAGO', [230,81,0]);
  const metLabels = { efectivo:'💵 Efectivo', tarjeta:'💳 Tarjeta', acapoints:'🪙 AcaPoints' };
  fila('Método', metLabels[comp.metodo_pago] || comp.metodo_pago);
  if (comp.metodo_pago === 'tarjeta' && comp.tarjeta_ultimos4)
    fila('Tarjeta', '•••• •••• •••• ' + comp.tarjeta_ultimos4);
  if (comp.metodo_pago === 'tarjeta' && comp.tarjeta_titular)
    fila('Titular', comp.tarjeta_titular);
  if (comp.acapoints_usados > 0)
    fila('AcaPoints usados', comp.acapoints_usados + ' pts');
  fila('Tipo de precio', comp.precio_tipo || '—');

  y += 2;
  // Total
  doc.setFillColor(...DARK);
  doc.roundedRect(TX + 2, y, TW - 4, 13, 2, 2, 'F');
  doc.setTextColor(180,220,210); doc.setFontSize(7); doc.setFont('helvetica','normal');
  doc.text('TOTAL PAGADO', TX + TW/2, y + 5, { align:'center' });
  doc.setTextColor(...WHITE); doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text('$' + Number(comp.monto).toLocaleString('es-MX') + ' MXN', TX + TW/2, y + 11, { align:'center' });
  y += 17;

  punteada();

  // ── Fecha ─────────────────────────────────────────
  const fecha = new Date(comp.creado_en).toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const hora  = new Date(comp.creado_en).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  fila('Fecha',  fecha);
  fila('Hora',   hora);
  fila('Estado', '✅ Completado', true, GREEN);

  punteada();

  // ── Verificado ────────────────────────────────────
  doc.setFillColor(232,245,233);
  doc.setDrawColor(...GREEN);
  doc.roundedRect(TX + 2, y, TW - 4, 10, 2, 2, 'FD');
  doc.setTextColor(...GREEN); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
  doc.text('✅  Compra verificada por AcaConnect', TX + TW/2, y + 6.5, { align:'center' });
  y += 14;

  // ── Pie ───────────────────────────────────────────
  doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
  doc.text('hola@acaconnect.mx  ·  Acapulco de Juárez, Guerrero', TX + TW/2, y, { align:'center' }); y += 4;
  doc.text('Guarda este ticket como comprobante de tu compra', TX + TW/2, y, { align:'center' });

  doc.save('Ticket_' + comp.folio + '.pdf');
  showToast('🎫 Ticket descargado: Ticket_' + comp.folio + '.pdf');
}


/* =====================================================
   PREVIEW DE COORDENADAS EN FORMULARIO DE PUBLICACIÓN
   ===================================================== */

let _mapsPreviewTimer = null;

async function previewMapsCoords(url) {
  const preview = document.getElementById('maps-coords-preview');
  if (!preview) return;

  if (!url || url.length < 10) { preview.style.display = 'none'; return; }

  // Debounce: esperar 800ms antes de resolver
  clearTimeout(_mapsPreviewTimer);
  preview.style.display = 'block';
  preview.innerHTML = `<span style="font-size:12px;color:#888;">🔍 Verificando coordenadas...</span>`;

  _mapsPreviewTimer = setTimeout(async () => {
    try {
      const coords = await extraerCoordsDeURL(url);
      if (coords) {
        preview.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;background:#f0faf8;border:1.5px solid #b2dfdb;
                      border-radius:10px;padding:8px 12px;font-size:12px;">
            <span style="font-size:16px;">📍</span>
            <div>
              <strong style="color:#007a7a;">✅ Coordenadas detectadas</strong><br>
              <span style="color:#555;font-family:monospace;">Lat: ${coords.lat.toFixed(6)}  ·  Lng: ${coords.lng.toFixed(6)}</span>
              <span style="color:#888;font-size:11px;margin-left:6px;">(${coords.source === 'proxy' ? 'link corto resuelto' : 'directo'})</span>
            </div>
          </div>`;
      } else {
        // Coords no extraíbles directamente — se usará zona como fallback
        preview.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;background:#fff8e1;border:1.5px solid #ffe082;
                      border-radius:10px;padding:8px 12px;font-size:12px;">
            <span style="font-size:16px;">🗺️</span>
            <div>
              <strong style="color:#f57f17;">Link válido</strong> — se usará la zona seleccionada como referencia.<br>
              <span style="color:#888;font-size:11px;">Para mayor precisión, copia el link expandido desde Google Maps (contiene @lat,lng).</span>
            </div>
          </div>`;
      }
    } catch(e) {
      preview.style.display = 'none';
    }
  }, 800);
}


/* =====================================================
   RANGO DE PRECIOS — GASTRONOMÍA
   ===================================================== */

function actualizarPreviewRango() {
  const min  = parseFloat(document.getElementById('pub-price-min')?.value) || 0;
  const max  = parseFloat(document.getElementById('pub-price-max')?.value) || 0;
  const prev = document.getElementById('rango-preview');
  if (!prev) return;
  if (min > 0 && max > 0) {
    const valido = max >= min;
    prev.style.display = 'block';
    prev.innerHTML = valido
      ? `<div class="rango-preview-ok">
           <span>👁️ Así verán el precio los clientes:</span>
           <strong>$${min.toLocaleString('es-MX')} – $${max.toLocaleString('es-MX')} <span style="font-weight:400;font-size:13px;">por persona</span></strong>
         </div>`
      : `<div class="rango-preview-err">⚠️ El precio máximo debe ser mayor al mínimo</div>`;
  } else {
    prev.style.display = 'none';
  }
}

