let currentTab = 'today';
let currentLang = 'pa';
let activeCameraStream = null;
let appState = {
  farmer: null,
  plots: [],
  weather: null,
  alerts: [],
  tasks: [],
  mandi: [],
  schemes: [],
  officers: [],
  ledger: null,
  analytics: null,
  schemeApplications: []
};

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  VoiceManager.init(currentLang);
  setupNavigation();
  setupModals();
  await loadAllData();
  renderCurrentTab();
  checkAuthSession();
});

function checkAuthSession() {
  const token = localStorage.getItem('kisan_sathi_token');
  if (!token) {
    openAuthModal();
  }
}

function showToast(message, icon = '✓') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');
  if (toast && msgEl) {
    msgEl.innerText = message;
    if (iconEl) iconEl.innerText = icon;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }
}

async function loadAllData() {
  try {
    const [profileRes, plotsRes, weatherRes, alertsRes, tasksRes, mandiRes, schemesRes, officersRes, ledgerRes, analyticsRes, appsRes] = await Promise.all([
      fetch('/api/v1/auth/profile').then(r => r.json()),
      fetch('/api/v1/farms/plots').then(r => r.json()),
      fetch('/api/v1/weather/nowcast').then(r => r.json()),
      fetch('/api/v1/radar/alerts').then(r => r.json()),
      fetch('/api/v1/advisory/tasks').then(r => r.json()),
      fetch('/api/v1/market/prices').then(r => r.json()),
      fetch('/api/v1/schemes/matched').then(r => r.json()),
      fetch('/api/v1/directory/officers').then(r => r.json()),
      fetch('/api/v1/market/ledger').then(r => r.json()),
      fetch('/api/v1/market/analytics').then(r => r.json()),
      fetch('/api/v1/schemes/applications').then(r => r.json())
    ]);

    appState.farmer = profileRes.farmer;
    appState.plots = plotsRes.plots;
    appState.weather = weatherRes;
    appState.alerts = alertsRes.alerts;
    appState.tasks = tasksRes.tasks;
    appState.mandi = mandiRes.mandi_prices;
    appState.schemes = schemesRes.schemes;
    appState.officers = officersRes.officers;
    appState.ledger = ledgerRes;
    appState.analytics = analyticsRes;
    appState.schemeApplications = appsRes.applications || [];

    if (appState.farmer) {
      if (appState.farmer.preferred_language) {
        currentLang = appState.farmer.preferred_language;
        VoiceManager.updateLang(currentLang);
        const sel = document.getElementById('langSelect');
        if (sel) sel.value = currentLang;
      }
      const headerName = document.getElementById('headerUserName');
      if (headerName) {
        headerName.innerText = appState.farmer.name || 'ਹਰਪ੍ਰੀਤ ਸਿੰਘ';
      }
    }
  } catch (err) {
    console.error("Failed loading initial data:", err);
  }
}

function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      stopCameraStream();
      renderCurrentTab();
    });
  });

  const langSel = document.getElementById('langSelect');
  if (langSel) {
    langSel.addEventListener('change', async (e) => {
      currentLang = e.target.value;
      VoiceManager.updateLang(currentLang);
      await fetch('/api/v1/auth/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: currentLang })
      });
      renderCurrentTab();
    });
  }

  const micBtn = document.getElementById('omniMicBtn');
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      VoiceManager.toggleListening();
    });
  }
}

// Global Voice Query Handler
window.handleVoiceQuery = async (queryText) => {
  if (!queryText) return;
  const assistantRes = await fetch('/api/v1/assistant/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText, language: currentLang })
  }).then(r => r.json());

  const responseText = currentLang === 'pa' ? assistantRes.response_pa :
                       currentLang === 'hi' ? assistantRes.response_hi :
                       assistantRes.response_en;

  showAssistantResponseModal(queryText, responseText, assistantRes);
  VoiceManager.speak(responseText);
};

function showAssistantResponseModal(query, response, data) {
  const modal = document.getElementById('assistantModal');
  const body = document.getElementById('assistantModalBody');

  let emergencyHtml = '';
  if (data.is_emergency && data.emergency_contacts) {
    emergencyHtml = `
      <div class="mitti-card urgent" style="margin-top: 14px;">
        <div class="card-title" style="color: var(--mitti-red-800);">🚨 ਤਤਕਾਲ ਮੁਫ਼ਤ ਹੈਲਪਲਾਈਨ</div>
        <div style="margin-top: 8px;">
          ${data.emergency_contacts.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid #FFCDD2;">
              <strong>${c.name}</strong>
              <a href="tel:${c.number}" class="mitti-btn primary" style="min-height:36px; padding:4px 12px; font-size:14px; text-decoration:none;">📞 ${c.number}</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div style="background:#F5F7F3; padding:10px 14px; border-radius:8px; font-size:14px; margin-bottom:12px;">
      <strong>ਤੁਸੀਂ ਪੁੱਛਿਆ:</strong> "${query}"
    </div>
    <div style="font-size:16px; font-weight:700; line-height:1.5; color:var(--mitti-earth-900);">
      ${response}
    </div>
    ${emergencyHtml}
    ${data.type === 'VERIFIED_DOSAGE' ? `
      <div style="margin-top:12px; font-size:12px; color:var(--mitti-earth-700);">
        ਸਰੋਤ: ${data.source} | ਤੁੜਾਈ ਰੋਕ (PHI): ${data.phi_days} ਦਿਨ
      </div>
    ` : ''}
  `;
  modal.classList.add('active');
}

function renderCurrentTab() {
  const container = document.getElementById('tabContent');
  updateStaticTexts();

  if (currentTab === 'today') renderTodayTab(container);
  else if (currentTab === 'farm') renderFarmTab(container);
  else if (currentTab === 'help') renderDiagnosisTab(container);
  else if (currentTab === 'schemes') renderSchemesTab(container);
  else if (currentTab === 'more') renderMoreTab(container);
}

function updateStaticTexts() {
  const t = I18N[currentLang];
  document.getElementById('navTodayText').innerText = t.tab_today;
  document.getElementById('navFarmText').innerText = t.tab_farm;
  document.getElementById('navHelpText').innerText = t.tab_help;
  document.getElementById('navSchemesText').innerText = t.tab_schemes;
  document.getElementById('navMoreText').innerText = t.tab_more;
}

// -----------------------------------------------------------------------------
// TAB 1: TODAY (Ajj da Kaam)
// -----------------------------------------------------------------------------
function renderTodayTab(container) {
  const t = I18N[currentLang];
  const w = appState.weather || {};
  const alert = (appState.alerts || [])[0];

  const weatherHeadline = currentLang === 'pa' ? w.spray_window.headline_pa :
                          currentLang === 'hi' ? w.spray_window.headline_hi :
                          w.spray_window.headline_en;

  // Build SVG Price Trend Chart (7 days)
  const priceCurve = appState.analytics ? appState.analytics.price_curve : [];
  let svgChart = '';
  if (priceCurve && priceCurve.length > 0) {
    const points = priceCurve.map((pt, idx) => {
      const x = 30 + (idx * 50);
      const y = 90 - ((pt.abohar - 30) * 12);
      return `${x},${y}`;
    }).join(' ');

    const labels = priceCurve.map((pt, idx) => `
      <text x="${30 + (idx * 50)}" y="115" font-size="10" text-anchor="middle" fill="#72796F">${pt.date.split(' ')[0]}</text>
      <text x="${30 + (idx * 50)}" y="${80 - ((pt.abohar - 30) * 12)}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1B5E20">₹${pt.abohar}</text>
    `).join('');

    svgChart = `
      <div class="svg-chart-container">
        <div style="font-size:12px; font-weight:800; margin-bottom:4px; display:flex; justify-content:space-between;">
          <span>7-ਦਿਨ ਮੰਡੀ ਭਾਅ ਰੁਝਾਨ (Abohar APMC)</span>
          <span style="color:var(--mitti-green-700);">ਵੱਧ ਰਿਹਾ ਹੈ (+13%)</span>
        </div>
        <svg viewBox="0 0 360 125" style="width:100%; height:auto;">
          <line x1="20" y1="90" x2="340" y2="90" stroke="#E0E0E0" stroke-width="1" />
          <line x1="20" y1="50" x2="340" y2="50" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="3,3" />
          <polyline fill="none" stroke="#1B5E20" stroke-width="3" points="${points}" />
          ${priceCurve.map((pt, idx) => `
            <circle cx="${30 + (idx * 50)}" cy="${90 - ((pt.abohar - 30) * 12)}" r="4" fill="#FFFFFF" stroke="#1B5E20" stroke-width="2" />
          `).join('')}
          ${labels}
        </svg>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- WEATHER & SPRAY WINDOW CARD -->
    <div class="mitti-card safe">
      <div class="card-header">
        <div class="card-title">
          <span>🌤️</span> ${t.weather_card_title}
        </div>
        <button class="audio-btn" onclick="playAudio('${weatherHeadline}. ${w.canal_turn.plot_name} di nehari vari ${w.canal_turn.turn_time}')" title="ਸੁਣੋ">
          🔊
        </button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:26px; font-weight:800;">${w.temp_celsius}°C</span>
        <span style="font-size:14px; font-weight:700; color:var(--mitti-earth-700);">
          ਹਵਾ: ${w.wind_kmh} km/h | ਨਮੀ: ${w.humidity_pct}%
        </span>
      </div>
      <div class="status-pill green">
        ✓ ${weatherHeadline}
      </div>
      <div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--mitti-green-700); font-size:13px; font-weight:700; color:var(--mitti-blue-800);">
        💧 <strong>${t.nehar_turn_label}:</strong> ${w.canal_turn.turn_time} (${w.canal_turn.watercourse_outlet})
      </div>
    </div>

    <!-- REGIONAL PROBLEM RADAR CARD -->
    ${alert ? `
      <div class="mitti-card urgent">
        <div class="card-header">
          <div class="card-title" style="color:var(--mitti-red-800);">
            <span>⚠️</span> ${currentLang === 'pa' ? alert.title_pa : currentLang === 'hi' ? alert.title_hi : alert.title_en}
          </div>
          <button class="audio-btn" onclick="playAudio('${alert.title_pa}. ${alert.reported_count} khetan vich samasya aayi hai. ${alert.actions.cultural}')" title="ਸੁਣੋ">
            🔊
          </button>
        </div>
        <div style="font-size:14px; font-weight:700; margin-bottom:6px;">
          📍 ${alert.location_text} (${alert.reported_count} ਬਾਗ਼ਾਂ ਵਿੱਚ ਕੇਰਾ ਰਿਪੋਰਟ)
        </div>
        <div style="font-size:13px; color:var(--mitti-earth-900); background:#FFFFFF; padding:8px 10px; border-radius:6px; border:1px solid #FFCDD2;">
          <strong>ਹੁਣੇ ਇਹ ਕੰਮ ਕਰੋ:</strong> ${alert.actions.cultural}
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="mitti-btn primary" style="flex:1; min-height:44px; font-size:14px;" onclick="switchToHelpTab()">
            ਫ਼ਸਲ ਚੈੱਕ ਕਰੋ
          </button>
          <button class="mitti-btn secondary" style="flex:1; min-height:44px; font-size:14px;" onclick="openOfficerModal()">
            ਅਫ਼ਸਰ ਨਾਲ ਗੱਲ ਕਰੋ
          </button>
        </div>
      </div>
    ` : ''}

    <!-- TODAY'S TOP TASKS -->
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>📋</span> ${t.today_tasks_title}
        </div>
        <button class="audio-btn" onclick="playAudio('Ajj de 3 mukh kaam: Number 1, Pheromone trap check karo. Number 2, Potassium nitrate spray tyari. Number 3, Nehar moga safai.')" title="ਸੁਣੋ">
          🔊
        </button>
      </div>
      <div id="taskList">
        ${(appState.tasks || []).map(task => `
          <div class="task-item">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}', this.checked)">
            <div class="task-label">
              <span style="${task.completed ? 'text-decoration:line-through; color:#72796F;' : ''}">
                ${currentLang === 'pa' ? task.title_pa : currentLang === 'hi' ? task.title_hi : task.title_en}
              </span>
              <div class="task-meta">
                ${task.plot_name} | ਖ਼ਰਚਾ: ₹${task.cost_inr} | ਸਮਾਂ: ${task.time_minutes} ਮਿੰਟ
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="mitti-btn secondary full-width" style="margin-top:12px;" onclick="openActivityModal()">
        ${t.log_activity_btn}
      </button>
    </div>

    <!-- MANDI PRICE MARQUEE & INTERACTIVE CHART -->
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>📈</span> ${t.mandi_title} (ਅੱਜ ਦਾ ਭਾਅ)
        </div>
        <button class="audio-btn" onclick="playAudio('Abohar mandi vich Grade A Kinnow da rate 32 ton 34 rupaye 50 paise prati kilo hai.')" title="ਸੁਣੋ">
          🔊
        </button>
      </div>
      ${(appState.mandi || []).map(m => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #EFEFE9;">
          <div>
            <div style="font-size:15px; font-weight:800;">${m.market_name}</div>
            <div style="font-size:12px; color:var(--mitti-earth-700);">${m.commodity} (Grade-A Waxed)</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px; font-weight:800; color:var(--mitti-green-700);">${m.grade_a_waxed}</div>
            <span class="status-pill green" style="font-size:10px; padding:2px 6px;">${m.trend_pct} ਵਧਿਆ</span>
          </div>
        </div>
      `).join('')}
      ${svgChart}
    </div>
  `;
}

function switchToHelpTab() {
  const helpBtn = document.querySelector('[data-tab="help"]');
  if (helpBtn) helpBtn.click();
}

// -----------------------------------------------------------------------------
// TAB 2: MY FARM (Mera Khet) with Interactive SVG Map
// -----------------------------------------------------------------------------
function renderFarmTab(container) {
  const plots = appState.plots || [];
  const totalArea = plots.reduce((acc, p) => acc + (p.area_killa || 0), 0);

  // SVG Visual Farm Map
  const svgFarmMap = `
    <div class="svg-chart-container" style="background:#F9FBE7; position:relative;">
      <div style="font-size:12px; font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between;">
        <span>🗺️ ਖੇਤ ਦਾ ਨਕਸ਼ਾ (Interactive Farm Twin)</span>
        <span style="color:var(--mitti-blue-800);">ਨਹਿਰੀ ਮੋਘਾ #22-R</span>
      </div>
      <svg viewBox="0 0 360 170" style="width:100%; height:auto; border:1px solid #C5E1A5; border-radius:8px;">
        <!-- Watercourse canal line -->
        <line x1="10" y1="15" x2="350" y2="15" stroke="#0D47A1" stroke-width="4" />
        <text x="180" y="11" font-size="9" fill="#0D47A1" font-weight="bold" text-anchor="middle">ਨਹਿਰੀ ਖਾਲ (Sirhind Feeder Watercourse)</text>

        <!-- Plot 1: Kinnow Orchard -->
        <rect x="20" y="30" width="200" height="125" fill="#E8F5E9" stroke="#1B5E20" stroke-width="2" rx="6" />
        <text x="120" y="55" font-size="12" font-weight="bold" fill="#1B5E20" text-anchor="middle">ਪਲਾਟ 1: ਵੱਡਾ ਬਗੀਚਾ</text>
        <text x="120" y="75" font-size="10" fill="#2E7D32" text-anchor="middle">3 ਕਿੱਲੇ (330 ਕਿੰਨੂ ਦੇ ਬੂਟੇ)</text>
        <!-- Tree dots inside Plot 1 -->
        <circle cx="50" cy="100" r="4" fill="#388E3C" /><circle cx="80" cy="100" r="4" fill="#388E3C" />
        <circle cx="110" cy="100" r="4" fill="#388E3C" /><circle cx="140" cy="100" r="4" fill="#388E3C" />
        <circle cx="170" cy="100" r="4" fill="#388E3C" />
        <circle cx="50" cy="130" r="4" fill="#388E3C" /><circle cx="80" cy="130" r="4" fill="#388E3C" />
        <circle cx="110" cy="130" r="4" fill="#388E3C" /><circle cx="140" cy="130" r="4" fill="#388E3C" />
        <circle cx="170" cy="130" r="4" fill="#388E3C" />

        <!-- Plot 2: Fodder / Berseem -->
        <rect x="230" y="30" width="110" height="85" fill="#FFFDE7" stroke="#FBC02D" stroke-width="2" rx="6" />
        <text x="285" y="65" font-size="11" font-weight="bold" fill="#F57F17" text-anchor="middle">ਪਲਾਟ 2: ਬਰਸੀਨ</text>
        <text x="285" y="85" font-size="10" fill="#F57F17" text-anchor="middle">1 ਕਿੱਲਾ (ਪੱਠੇ)</text>

        <!-- Tubewell Pump Shed -->
        <rect x="230" y="125" width="45" height="30" fill="#E3F2FD" stroke="#1976D2" stroke-width="1.5" rx="4" />
        <text x="252" y="143" font-size="9" fill="#0D47A1" text-anchor="middle">ਟਿਊਬਵੈੱਲ</text>
      </svg>
    </div>
  `;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <h2 style="font-size:20px; font-weight:800;">ਮੇਰੇ ਖੇਤ</h2>
        <div style="font-size:12px; color:var(--mitti-earth-700);">${plots.length} ਪਲਾਟ | ਕੁੱਲ ${totalArea} ਕਿੱਲੇ (ਏਕੜ)</div>
      </div>
      <button class="mitti-btn primary" style="min-height:38px; padding:6px 14px; font-size:13px;" onclick="openAddPlotModal()">
        + ਨਵਾਂ ਪਲਾਟ ਜੋੜੋ
      </button>
    </div>

    ${svgFarmMap}

    ${plots.map(p => `
      <div class="mitti-card">
        <div class="card-header">
          <div class="card-title">
            <span>🌳</span> ${p.name}
          </div>
          <span class="status-pill green">${p.area_killa} ਕਿੱਲੇ (${p.area_kanals} ਕਨਾਲ)</span>
        </div>
        <div style="font-size:14px; color:var(--mitti-earth-700); margin-bottom:8px;">
          ਫ਼ਸਲ: <strong>${p.variety}</strong> | ਉਮਰ: ${p.planting_year ? 2026 - p.planting_year + ' ਸਾਲ' : 'ਨਵੀਂ'} | ਬੂਟੇ: ${p.tree_count || 'ਨਹੀਂ'}
        </div>

        <!-- STAGE STEPPER -->
        <div style="background:#F4F6F0; padding:10px 12px; border-radius:8px; margin-bottom:10px; border:1px solid #D6D8D2;">
          <div style="font-size:12px; font-weight:700; color:var(--mitti-green-700);">ਮੌਜੂਦਾ ਸਟੇਜ:</div>
          <div style="font-size:16px; font-weight:800;">ਫ਼ਲ ਪੱਕਣ ਅਤੇ ਰੰਗ ਬਦਲਣ ਦਾ ਵੇਲਾ (Fruit Sizing)</div>
          <div style="font-size:12px; color:var(--mitti-earth-700); margin-top:2px;">
            ਅਗਲੀ ਸਟੇਜ: ਤੁੜਾਈ (Harvest Window) ਲਗਭਗ ${p.days_to_next} ਦਿਨਾਂ ਬਾਅਦ
          </div>
        </div>

        <!-- SOIL & WATER HEALTH -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
          <div style="background:#FFFFFF; border:1px solid var(--mitti-card-border); padding:8px; border-radius:6px;">
            <div style="font-size:11px; color:#72796F;">ਮਿੱਟੀ pH</div>
            <div style="font-size:16px; font-weight:800; color:var(--mitti-green-700);">${p.soil_ph} (ਠੀਕ)</div>
          </div>
          <div style="background:#FFFFFF; border:1px solid var(--mitti-card-border); padding:8px; border-radius:6px;">
            <div style="font-size:11px; color:#72796F;">ਪਾਣੀ TDS</div>
            <div style="font-size:16px; font-weight:800; color:var(--mitti-amber-800);">${p.water_tds_ppm} ppm (ਮੱਧਮ ਖ਼ਾਰਾ)</div>
          </div>
        </div>

        <!-- ACTION BUTTONS -->
        <div style="display:flex; gap:8px;">
          <button class="mitti-btn secondary" style="flex:1; min-height:44px; font-size:13px;" onclick="checkSuitabilityRich('${p.id}')">
            📊 ਜ਼ਮੀਨ ਦੀ ਪਰਖ
          </button>
          <button class="mitti-btn secondary" style="flex:1; min-height:44px; font-size:13px;" onclick="checkAlternativesRich('${p.id}')">
            🌱 ਬਦਲਵੀਆਂ ਫ਼ਸਲਾਂ
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

function openAddPlotModal() {
  document.getElementById('addPlotModal').classList.add('active');
}

async function submitNewPlotForm(e) {
  e.preventDefault();
  const name = document.getElementById('plotNameInput').value;
  const area = document.getElementById('plotAreaInput').value;
  const crop = document.getElementById('plotCropInput').value;
  const soil = document.getElementById('plotSoilInput').value;
  const water = document.getElementById('plotWaterInput').value;

  const res = await fetch('/api/v1/farms/plots/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      area_killa: area,
      crop,
      soil_type: soil,
      irrigation_source: water
    })
  }).then(r => r.json());

  if (res.success) {
    document.getElementById('addPlotModal').classList.remove('active');
    showToast(`ਪਲਾਟ "${name}" ਸਫ਼ਲਤਾਪੂਰਵਕ ਜੋੜਿਆ ਗਿਆ!`);
    await loadAllData();
    renderCurrentTab();
  }
}

async function checkSuitabilityRich(plotId) {
  const res = await fetch(`/api/v1/farms/plots/${plotId}/suitability`).then(r => r.json());
  const s = res.suitability;
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailModalTitle');
  const body = document.getElementById('detailModalBody');

  title.innerText = `📊 ਜ਼ਮੀਨ ਦੀ ਪਰਖ ਰਿਪੋਰਟ (${s.crop})`;
  body.innerHTML = `
    <div class="mitti-card ${s.classification === 'HIGH' ? 'safe' : 'warning'}" style="margin-bottom:12px;">
      <div style="font-size:18px; font-weight:800;">ਅਨੁਕੂਲਤਾ ਸ਼੍ਰੇਣੀ: ${s.classification} (ਸਕੋਰ: ${s.score}/1.0)</div>
      <div style="font-size:13px; margin-top:4px;">ਕਿੰਨੂ ਬਾਗ਼ਬਾਨੀ ਲਈ ਤੁਹਾਡੀ ਜ਼ਮੀਨ ਸੰਤੁਲਿਤ ਹੈ।</div>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-weight:700; font-size:14px; margin-bottom:6px;">ਜਾਂਚੇ ਗਏ ਤੱਤ:</div>
      <div style="background:#FFFFFF; border:1px solid #D6D8D2; border-radius:8px; padding:10px;">
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #F0F0F0;">
          <span>ਮਿੱਟੀ pH (${s.parameters_analyzed.soil_ph.value})</span>
          <strong style="color:var(--mitti-green-700);">${s.parameters_analyzed.soil_ph.status}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #F0F0F0;">
          <span>ਪਾਣੀ TDS (${s.parameters_analyzed.water_tds.value})</span>
          <strong style="color:var(--mitti-amber-800);">${s.parameters_analyzed.water_tds.status}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;">
          <span>ਮਿੱਟੀ ਬਣਤਰ</span>
          <strong style="color:var(--mitti-green-700);">${s.parameters_analyzed.soil_type.status}</strong>
        </div>
      </div>
    </div>
    <div style="background:#F5F7F3; padding:10px; border-radius:8px;">
      <div style="font-weight:700; font-size:13px; color:var(--mitti-green-700); margin-bottom:4px;">ਵਿਗਿਆਨਕ ਸਿਫ਼ਾਰਸ਼ਾਂ:</div>
      <ul style="padding-left:18px; font-size:13px; line-height:1.5;">
        ${s.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `;
  modal.classList.add('active');
}

async function checkAlternativesRich(plotId) {
  const res = await fetch(`/api/v1/farms/plots/${plotId}/alternatives`).then(r => r.json());
  const alt = res.alternatives;
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailModalTitle');
  const body = document.getElementById('detailModalBody');

  title.innerText = `🌱 ਬਦਲਵੀਆਂ ਫ਼ਸਲਾਂ ਦੇ ਵਿਕਲਪ (${alt.farmer_land_killa} ਕਿੱਲੇ)`;
  body.innerHTML = `
    <div style="font-size:13px; color:var(--mitti-earth-700); margin-bottom:10px;">
      <strong>ਰਣਨੀਤੀ:</strong> ${alt.advisory_strategy}
    </div>
    ${alt.recommended_options.map((opt, i) => `
      <div class="mitti-card" style="margin-bottom:10px; padding:12px;">
        <div style="font-weight:800; font-size:15px; color:var(--mitti-green-700);">
          ${i + 1}. ${opt.title_pa}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0; font-size:12px;">
          <div>ਕੁੱਲ ਖ਼ਰਚਾ (ਸਬਸਿਡੀ ਮਗਰੋਂ): <strong>₹${opt.total_investment_for_farm.toLocaleString()}</strong></div>
          <div>ਸਾਲਾਨਾ ਕਮਾਈ: <strong style="color:var(--mitti-green-700);">₹${opt.expected_annual_net_income.toLocaleString()}</strong></div>
          <div>ਪਹਿਲੀ ਕਮਾਈ: <strong>${opt.gestation_months} ਮਹੀਨੇ</strong></div>
          <div>ਸਬਸਿਡੀ: <strong>${opt.subsidy_available_pct}%</strong></div>
        </div>
        <div style="background:#F9FBE7; padding:6px 10px; border-radius:6px; font-size:12px; color:#33691E;">
          🎯 <strong>1-ਕਨਾਲ ਸੁਰੱਖਿਅਤ ਟਰਾਇਲ:</strong> ${opt.pilot_plan_1_kanal}
        </div>
      </div>
    `).join('')}
  `;
  modal.classList.add('active');
}

// -----------------------------------------------------------------------------
// TAB 3: DIAGNOSIS (Live HTML5 Camera + Real Photo Snapshot)
// -----------------------------------------------------------------------------
function renderDiagnosisTab(container) {
  container.innerHTML = `
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>📷</span> ਲਾਈਵ ਕੈਮਰਾ ਜਾਂਚ (Camera Diagnosis)
        </div>
        <button class="audio-btn" onclick="playAudio('Pattay ya phal di photo khicho. Apan tuhanu bimari da ilaj dassange.')">🔊</button>
      </div>
      <p style="font-size:13px; color:var(--mitti-earth-700); margin-bottom:12px;">
        ਕਿਸੇ ਵੀ ਬਿਮਾਰੀ ਜਾਂ ਕੀੜੇ ਵਾਲੇ ਪੱਤੇ/ਫ਼ਲ ਨੂੰ ਕੈਮਰੇ ਅੱਗੇ ਰੱਖੋ ਅਤੇ ਫ਼ੋਟੋ ਖਿੱਚੋ।
      </p>

      <!-- REAL LIVE CAMERA VIEWFINDER -->
      <div class="camera-viewfinder-wrapper">
        <video id="cameraStream" autoplay playsinline class="camera-video"></video>
        <canvas id="photoCanvas" style="display:none;"></canvas>
        <div id="cameraPlaceholder" style="color:#FFFFFF; text-align:center; padding:10px;">
          <div style="font-size:36px; margin-bottom:4px;">📷</div>
          <button class="mitti-btn primary" style="min-height:38px; font-size:13px;" onclick="startLiveCamera()">
            ਲਾਈਵ ਕੈਮਰਾ ਚਾਲੂ ਕਰੋ
          </button>
        </div>
        <div class="camera-overlay" id="cameraGuides" style="display:none;">
          <div class="camera-box-guide"></div>
          <span style="background:rgba(0,0,0,0.6); color:#00E676; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:10px; margin-top:8px;">
            ✓ ਰੌਸ਼ਨੀ ਸਾਫ਼ ਹੈ | Hold Steady
          </span>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button id="snapPhotoBtn" class="mitti-btn primary" style="flex:1; display:none;" onclick="captureAndDiagnose()">
          📸 ਫ਼ੋਟੋ ਖਿੱਚੋ ਅਤੇ ਜਾਂਚੋ
        </button>
        <label class="mitti-btn secondary" style="flex:1; cursor:pointer;">
          📁 ਗੈਲਰੀ 'ਚੋਂ ਫ਼ੋਟੋ ਚੁਣੋ
          <input type="file" accept="image/*" style="display:none;" onchange="handleFilePhotoUpload(this)">
        </label>
      </div>
    </div>

    <!-- RECENT DIAGNOSIS RESULT CONTAINER -->
    <div id="diagnosisResultContainer"></div>
  `;
}

async function startLiveCamera() {
  const video = document.getElementById('cameraStream');
  const placeholder = document.getElementById('cameraPlaceholder');
  const guides = document.getElementById('cameraGuides');
  const snapBtn = document.getElementById('snapPhotoBtn');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    activeCameraStream = stream;
    if (video) {
      video.srcObject = stream;
      video.play();
      if (placeholder) placeholder.style.display = 'none';
      if (guides) guides.style.display = 'flex';
      if (snapBtn) snapBtn.style.display = 'inline-flex';
    }
  } catch (err) {
    console.warn("Camera access denied or unavailable:", err);
    showToast("ਕੈਮਰਾ ਅਨੁਮਤੀ ਨਹੀਂ ਮਿਲੀ। ਗੈਲਰੀ 'ਚੋਂ ਫ਼ੋਟੋ ਅਪਲੋਡ ਕਰੋ।", "⚠️");
  }
}

function stopCameraStream() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
    activeCameraStream = null;
  }
}

function captureAndDiagnose() {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('photoCanvas');
  if (video && canvas) {
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    runDiagnosisWithImage(dataUrl);
  }
}

function handleFilePhotoUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      runDiagnosisWithImage(e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function runDiagnosisWithImage(imageDataUrl) {
  showToast("ਫ਼ੋਟੋ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...", "🔍");

  const res = await fetch('/api/v1/diagnosis/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptom_type: 'fruit_drop', plot_id: 'plot_01_kinnow', photo_count: 3 })
  }).then(r => r.json());

  const diag = res.diagnosis.primary_diagnosis;
  const container = document.getElementById('diagnosisResultContainer');
  container.innerHTML = `
    <div class="mitti-card urgent" style="margin-top:16px;">
      <div class="card-header">
        <div class="card-title" style="color:var(--mitti-red-800);">
          <span>🔍</span> ਜਾਂਚ ਨਤੀਜਾ: ${diag.name_pa}
        </div>
        <button class="audio-btn" onclick="playAudio('${diag.name_pa}. Vishvasniyata 88 percent. Trap lagao te Decamethrin spray karo.')">🔊</button>
      </div>

      <!-- PHOTO PREVIEW -->
      ${imageDataUrl ? `
        <div style="margin-bottom:10px; border-radius:8px; overflow:hidden; max-height:160px; border:1px solid #FFCDD2;">
          <img src="${imageDataUrl}" style="width:100%; height:auto; display:block;" alt="Crop symptom snapshot">
        </div>
      ` : ''}

      <div style="font-size:13px; font-weight:700; color:var(--mitti-earth-700); margin-bottom:8px;">
        ਵਿਗਿਆਨਕ ਨਾਮ: <em>${diag.scientific_name}</em> | ਭਰੋਸਾ: ${(diag.confidence * 100).toFixed(0)}%
      </div>

      <!-- 3-TRACK ACTION PLAN -->
      <div style="margin-top:10px;">
        <div style="background:#FFFFFF; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #D6D8D2;">
          <div style="font-weight:800; color:var(--mitti-green-700); font-size:14px;">1. ਦੇਸੀ / ਸਫ਼ਾਈ ਤਰੀਕਾ (ਖ਼ਰਚਾ: ₹${diag.actions.track_1_cultural.cost_inr})</div>
          <div style="font-size:13px; margin-top:4px;">${diag.actions.track_1_cultural.steps.join(' ')}</div>
        </div>

        <div style="background:#FFFFFF; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #D6D8D2;">
          <div style="font-weight:800; color:var(--mitti-blue-800); font-size:14px;">2. ਜੈਵਿਕ / ਟਰੈਪ ਵਿਧੀ (ਖ਼ਰਚਾ: ₹${diag.actions.track_2_biological.cost_inr})</div>
          <div style="font-size:13px; margin-top:4px;">${diag.actions.track_2_biological.steps.join(' ')}</div>
        </div>

        <div style="background:#FFFFFF; padding:10px; border-radius:6px; border:1px solid #D6D8D2;">
          <div style="font-weight:800; color:var(--mitti-red-800); font-size:14px;">3. ਪੀ.ਏ.ਯੂ. ਸਿਫ਼ਾਰਸ਼ ਸਪਰੇਅ (ਖ਼ਰਚਾ: ₹${diag.actions.track_3_chemical.cost_inr})</div>
          <div style="font-size:13px; margin-top:4px;">${diag.actions.track_3_chemical.steps.join(' ')}</div>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <a href="tel:${diag.escalation.phone}" class="mitti-btn primary" style="flex:1; text-decoration:none;">
          📞 ਵਿਗਿਆਨੀ ਨੂੰ ਕਾਲ ਕਰੋ (${diag.escalation.expert_name})
        </a>
      </div>
    </div>
  `;

  VoiceManager.speak(`ਜਾਂਚ ਮੁਕੰਮਲ ਹੋਈ: ${diag.name_pa} ਦੀ ਸ਼ਿਕਾਇਤ ਮਿਲੀ ਹੈ। ਹੇਠਾਂ ਦਿੱਤੇ ਤਰੀਕੇ ਅਪਣਾਓ।`);
}

// -----------------------------------------------------------------------------
// TAB 4: SCHEMES (Yojana) with Real Application Tracking
// -----------------------------------------------------------------------------
function renderSchemesTab(container) {
  const schemes = appState.schemes || [];
  const applications = appState.schemeApplications || [];

  container.innerHTML = `
    <h2 style="font-size:20px; font-weight:800; margin-bottom:12px;">ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਤੇ ਸਬਸਿਡੀਆਂ</h2>

    <!-- MY ACTIVE APPLICATIONS -->
    ${applications.length > 0 ? `
      <div class="mitti-card water" style="margin-bottom:14px;">
        <div class="card-title" style="color:var(--mitti-blue-800); margin-bottom:6px;">
          <span>📋</span> ਮੇਰੀਆਂ ਸਰਗਰਮ ਅਰਜ਼ੀਆਂ (Active Applications)
        </div>
        ${applications.map(app => `
          <div style="background:#FFFFFF; padding:8px 12px; border-radius:6px; margin-top:6px; border:1px solid #BBDEFB;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:14px;">${app.scheme_id.toUpperCase()}</strong>
              <span class="status-pill blue" style="font-size:10px; padding:2px 8px;">${app.status_label_pa || 'ਪੜਤਾਲ ਅਧੀਨ'}</span>
            </div>
            <div style="font-size:12px; color:var(--mitti-earth-700); margin-top:2px;">
              ਅਰਜ਼ੀ ਨੰਬਰ: ${app.id} | ਅਧਿਕਾਰੀ: ${app.assigned_officer}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${schemes.map(s => `
      <div class="mitti-card safe">
        <div class="card-header">
          <div class="card-title">
            <span>🏛️</span> ${currentLang === 'pa' ? s.name_pa : currentLang === 'hi' ? s.name_hi : s.name_en}
          </div>
          <button class="audio-btn" onclick="playAudio('${s.name_pa}. Is scheme vich ${s.subsidy_pct} percent subsidy mildi hai. ${s.summary_pa}')">🔊</button>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="status-pill green">${s.subsidy_pct}% ਸਬਸਿਡੀ (ਬਚਤ: ₹${s.max_benefit_inr.toLocaleString()})</span>
          <span style="font-size:12px; color:var(--mitti-earth-700);">ਆਖ਼ਰੀ ਮਿਤੀ: ${s.last_date}</span>
        </div>
        <p style="font-size:14px; margin-bottom:10px;">
          ${currentLang === 'pa' ? s.summary_pa : currentLang === 'hi' ? s.summary_hi : s.name_en}
        </p>
        <div style="font-size:12px; color:var(--mitti-earth-700); background:#FFFFFF; padding:8px; border-radius:6px; margin-bottom:10px;">
          <strong>ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼:</strong> ${s.documents_needed.join(', ')}
        </div>
        <button class="mitti-btn primary full-width" onclick="openSchemeApplyModal('${s.id}', '${s.name_pa}', '${s.max_benefit_inr}')">
          ਸਹਾਇਤਾ ਨਾਲ ਅਪਲਾਈ ਕਰੋ (Apply Online)
        </button>
      </div>
    `).join('')}
  `;
}

function openSchemeApplyModal(schemeId, schemeTitle, benefit) {
  document.getElementById('applySchemeId').value = schemeId;
  document.getElementById('applySchemeTitle').innerText = schemeTitle;
  document.getElementById('applySchemeBenefit').innerText = `ਅਨੁਮਾਨਿਤ ਲਾਭ: ₹${parseInt(benefit).toLocaleString()}`;
  document.getElementById('schemeApplyModal').classList.add('active');
}

async function submitSchemeApplication(e) {
  e.preventDefault();
  const schemeId = document.getElementById('applySchemeId').value;
  const name = document.getElementById('applyFarmerName').value;
  const phone = document.getElementById('applyFarmerPhone').value;

  const docs = [];
  if (document.getElementById('docJamabandi').checked) docs.push('Jamabandi');
  if (document.getElementById('docAadhaar').checked) docs.push('Aadhaar');
  if (document.getElementById('docPassbook').checked) docs.push('Passbook');

  const res = await fetch('/api/v1/schemes/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheme_id: schemeId,
      applicant_name: name,
      applicant_phone: phone,
      land_size_killa: 3.0,
      documents_ready: docs
    })
  }).then(r => r.json());

  if (res.success) {
    document.getElementById('schemeApplyModal').classList.remove('active');
    showToast(`ਅਰਜ਼ੀ ${res.application.id} ਜਮ੍ਹਾਂ ਹੋ ਗਈ!`, "🏛️");
    await loadAllData();
    renderCurrentTab();
  }
}

// -----------------------------------------------------------------------------
// TAB 5: MORE (Hor: Interactive Input Vault, Tank-Mixer, Ledger & Curation)
// -----------------------------------------------------------------------------
function renderMoreTab(container) {
  const ledger = appState.ledger || {};
  container.innerHTML = `
    <!-- INTERACTIVE INPUT VAULT & TANK MIXER -->
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>🧪</span> ਇਨਪੁਟ ਵਾਲਟ: ਦਵਾਈ ਜਾਂਚ ਤੇ ਟੈਂਕ-ਮਿਕਸ
        </div>
      </div>

      <!-- DRUM DOSAGE SLIDER -->
      <div style="background:#F4F6F0; padding:12px; border-radius:8px; margin-bottom:12px; border:1px solid #D6D8D2;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; font-size:13px;">ਡਰੱਮ ਪਾਣੀ ਮਾਤਰਾ:</span>
          <strong id="drumVolumeDisplay" style="color:var(--mitti-green-700); font-size:15px;">200 ਲੀਟਰ ਡਰੱਮ</strong>
        </div>
        <input type="range" class="drum-slider" min="50" max="500" step="50" value="200" oninput="updateDrumDosage(this.value)">
        <div id="sliderDosageOutput" style="font-size:13px; font-weight:700; margin-top:8px; color:var(--mitti-earth-900);">
          ਟਿਲਟ (Tilt 25 EC) ਦੀ ਲੋੜੀਂਦੀ ਮਾਤਰਾ: <strong>200 ml</strong>
        </div>
      </div>

      <!-- 2-CHEMICAL TANK MIX TESTER -->
      <div style="background:#FFFFFF; border:1px solid var(--mitti-card-border); padding:10px; border-radius:8px; margin-bottom:12px;">
        <div style="font-weight:800; font-size:13px; margin-bottom:8px;">ਦੋ ਦਵਾਈਆਂ ਦਾ ਘੋਲ ਟੈਸਟ (Tank-Mix Test):</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
          <select id="mixChemA" class="form-input" style="min-height:40px; font-size:13px;">
            <option value="Tilt">Tilt (Propiconazole)</option>
            <option value="Decis">Decis (Decamethrin)</option>
          </select>
          <select id="mixChemB" class="form-input" style="min-height:40px; font-size:13px;">
            <option value="Potassium Nitrate">Potassium Nitrate (13-0-45)</option>
            <option value="Copper Oxychloride">Copper Oxychloride (Blitox)</option>
          </select>
        </div>
        <button class="mitti-btn secondary full-width" style="min-height:38px; font-size:13px;" onclick="runInteractiveTankMix()">
          ਮਿਸ਼ਰਣ ਚੈੱਕ ਕਰੋ (Check Compatibility)
        </button>
        <div id="tankMixResult" style="margin-top:8px;"></div>
      </div>

      <button class="mitti-btn primary full-width" onclick="openScanModal()">
        🔍 ਹੋਰ ਦਵਾਈਆਂ ਦੀ CIB&RC ਰਜਿਸਟਰੀ ਦੇਖੋ
      </button>
    </div>

    <!-- VERIFIED OFFICERS CARD -->
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>👨‍🌾</span> ਸਰਕਾਰੀ ਅਫ਼ਸਰ ਤੇ ਵਿਗਿਆਨੀ ਡਾਇਰੈਕਟਰੀ
        </div>
      </div>
      <p style="font-size:13px; color:var(--mitti-earth-700); margin-bottom:8px;">
        ਫ਼ਾਜ਼ਿਲਕਾ ਜ਼ਿਲ੍ਹੇ ਦੇ ਤਸਦੀਕਸ਼ੁਦਾ ਖੇਤੀਬਾੜੀ ਅਤੇ ਬਾਗ਼ਬਾਨੀ ਅਫ਼ਸਰਾਂ ਦੇ ਨੰਬਰ।
      </p>
      <button class="mitti-btn secondary full-width" onclick="openOfficerModal()">
        ਡਾਇਰੈਕਟਰੀ ਖੋਲ੍ਹੋ (View Officers)
      </button>
    </div>

    <!-- LEDGER CARD -->
    <div class="mitti-card">
      <div class="card-header">
        <div class="card-title">
          <span>📒</span> ਖੇਤ ਦਾ ਖ਼ਾਤਾ (ਕੁੱਲ ਖ਼ਰਚਾ)
        </div>
        <button class="audio-btn" onclick="playAudio('Is season da kul kharcha 34 hazar 200 rupaye hoya hai.')">🔊</button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div>
          <div style="font-size:12px; color:var(--mitti-earth-700);">ਕੁੱਲ ਖ਼ਰਚਾ (ਇਸ ਸੀਜ਼ਨ)</div>
          <div style="font-size:22px; font-weight:800; color:var(--mitti-red-800);">₹${(ledger.total_expense_inr || 0).toLocaleString()}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:var(--mitti-earth-700);">ਪ੍ਰਤੀ ਕਿੱਲਾ ਖ਼ਰਚਾ</div>
          <div style="font-size:18px; font-weight:800;">₹${ledger.cost_per_killa_inr || 0} / ਕਿੱਲਾ</div>
        </div>
      </div>
      <button class="mitti-btn secondary full-width" onclick="openLedgerAddModal()">
        + ਖ਼ਰਚਾ / ਕਮਾਈ ਦਰਜ ਕਰੋ
      </button>
    </div>

    <!-- ADMIN CURATION WORKBENCH TOGGLE -->
    <div class="mitti-card" style="border:2px dashed var(--mitti-earth-900); background:#F4F6F0;">
      <div class="card-title" style="margin-bottom:6px;">
        <span>⚙️</span> ਵਿਗਿਆਨੀ / ਐਡਮਿਨ ਕੰਸੋਲ (F22 Workbench)
      </div>
      <p style="font-size:13px; color:var(--mitti-earth-700); margin-bottom:10px;">
        ਖੇਤਰੀ ਚੇਤਾਵਨੀਆਂ ਦੀ ਸਮੀਖਿਆ, ਨਵੀਆਂ ਦਵਾਈਆਂ ਦੀ ਪ੍ਰਵਾਨਗੀ ਅਤੇ ਕਿਸਾਨ ਸ਼ਿਕਾਇਤਾਂ ਦੇ ਹੱਲ ਲਈ ਪੋਰਟਲ।
      </p>
      <button class="mitti-btn secondary full-width" onclick="openCurationModal()">
        ਕੰਸੋਲ ਖੋਲ੍ਹੋ (Admin Workbench)
      </button>
    </div>
  `;
}

function updateDrumDosage(volume) {
  document.getElementById('drumVolumeDisplay').innerText = `${volume} ਲੀਟਰ ਡਰੱਮ`;
  const ratePerLitre = 1.0; // 1 ml per litre for Tilt
  const totalMl = volume * ratePerLitre;
  document.getElementById('sliderDosageOutput').innerHTML = `
    ਟਿਲਟ (Tilt 25 EC) ਦੀ ਲੋੜੀਂਦੀ ਮਾਤਰਾ: <strong>${totalMl} ml</strong> (0.4 ਗ੍ਰਾਮ ਪ੍ਰਤੀ ਲੀਟਰ)
  `;
}

async function runInteractiveTankMix() {
  const chemA = document.getElementById('mixChemA').value;
  const chemB = document.getElementById('mixChemB').value;

  const res = await fetch('/api/v1/inputs/tank-mix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_a: chemA, product_b: chemB })
  }).then(r => r.json());

  const comp = res.compatibility;
  const out = document.getElementById('tankMixResult');
  out.innerHTML = `
    <div class="mitti-card ${comp.compatible ? 'safe' : 'urgent'}" style="margin:0; padding:10px;">
      <div style="font-weight:800; font-size:13px;">${comp.status === 'COMPATIBLE_SAFE' ? '✓ ਸੁਰੱਖਿਅਤ ਮਿਸ਼ਰਣ (Safe Mix)' : '⚠️ ਖ਼ਤਰਨਾਕ ਮਿਸ਼ਰਣ (Do Not Mix)'}</div>
      <div style="font-size:12px; margin-top:4px;">${comp.message}</div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// MODALS LOGIC
// -----------------------------------------------------------------------------
function setupModals() {
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal-overlay').classList.remove('active');
    });
  });
}

function openActivityModal() {
  document.getElementById('activityModal').classList.add('active');
}

async function submitActivityForm(e) {
  e.preventDefault();
  const type = document.getElementById('actType').value;
  const details = document.getElementById('actDetails').value;
  const qty = document.getElementById('actQty').value;
  const cost = document.getElementById('actCost').value;
  const phi = document.getElementById('actPhi').value;

  await fetch('/api/v1/activities/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plot_id: 'plot_01_kinnow',
      activity_type: type,
      details,
      quantity: qty,
      cost_inr: cost,
      phi_days: phi
    })
  });

  document.getElementById('activityModal').classList.remove('active');
  showToast("ਖੇਤ ਦਾ ਕੰਮ ਸਫ਼ਲਤਾਪੂਰਵਕ ਦਰਜ ਕਰ ਲਿਆ ਗਿਆ!");
  await loadAllData();
  renderCurrentTab();
  VoiceManager.speak("ਕੰਮ ਸਫ਼ਲਤਾਪੂਰਵਕ ਦਰਜ ਕਰ ਲਿਆ ਗਿਆ ਹੈ।");
}

function openScanModal() {
  document.getElementById('scanModal').classList.add('active');
}

async function runChemicalScan() {
  const query = document.getElementById('scanInput').value;
  if (!query) return;

  const res = await fetch('/api/v1/inputs/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_text: query })
  }).then(r => r.json());

  const container = document.getElementById('scanResult');
  if (!res.found) {
    container.innerHTML = `
      <div class="mitti-card urgent" style="margin-top:12px;">
        <strong>ਧਿਆਨ ਦਿਓ:</strong> ਇਹ ਦਵਾਈ CIB&RC ਰਜਿਸਟਰੀ ਵਿੱਚ ਨਹੀਂ ਮਿਲੀ। ਬਿਨਾਂ ਪੱਕੇ ਬਿੱਲ ਤੋਂ ਨਾ ਖ਼ਰੀਦੋ।
      </div>
    `;
    return;
  }

  const p = res.product;
  container.innerHTML = `
    <div class="mitti-card ${res.is_banned ? 'urgent' : 'safe'}" style="margin-top:12px;">
      <div style="font-weight:800; font-size:16px;">${p.trade_names.join(' / ')}</div>
      <div style="font-size:13px; color:var(--mitti-earth-700);">ਐਕਟਿਵ: ${p.active_ingredient}</div>
      <div class="status-pill ${res.is_banned ? 'red' : 'green'}" style="margin:6px 0;">
        ${p.cibrc_status}
      </div>
      ${res.is_banned ? `
        <div style="color:var(--mitti-red-800); font-weight:700; font-size:13px; margin-top:6px;">
          ${res.safety_alert}
        </div>
      ` : `
        <div style="font-size:14px; margin-top:8px; background:#FFFFFF; padding:8px; border-radius:6px; border:1px solid #C8E6C9;">
          <div>💧 <strong>200 ਲੀਟਰ ਡਰੱਮ ਖ਼ੁਰਾਕ:</strong> ${p.dose_per_200l_drum} (${p.dose_per_litre})</div>
          <div>⏳ <strong>ਤੁੜਾਈ ਰੋਕ (PHI):</strong> ${p.phi_days} ਦਿਨ</div>
          <div>⚠️ <strong>ਇਨ੍ਹਾਂ ਨਾਲ ਨਾ ਮਿਲਾਓ:</strong> ${p.incompatible_mixes.join(', ')}</div>
        </div>
      `}
    </div>
  `;
}

function openOfficerModal() {
  const modal = document.getElementById('officerModal');
  const body = document.getElementById('officerModalBody');
  body.innerHTML = (appState.officers || []).map(o => `
    <div class="mitti-card" style="margin-bottom:10px;">
      <div style="font-weight:800; font-size:16px;">${o.name}</div>
      <div style="font-size:13px; color:var(--mitti-green-700); font-weight:700;">${o.role_pa}</div>
      <div style="font-size:12px; color:var(--mitti-earth-700); margin:4px 0;">📍 ${o.office_location}</div>
      <div style="font-size:12px; background:#F5F7F3; padding:6px; border-radius:4px; margin:6px 0;">
        ਮਦਦ: ${o.helps_with_pa}
      </div>
      <a href="tel:${o.phone}" class="mitti-btn primary full-width" style="min-height:40px; font-size:14px; text-decoration:none;">
        📞 ਕਾਲ ਕਰੋ (${o.phone})
      </a>
    </div>
  `).join('');
  modal.classList.add('active');
}

function openLedgerAddModal() {
  document.getElementById('ledgerAddModal').classList.add('active');
}

async function submitLedgerForm(e) {
  e.preventDefault();
  const desc = document.getElementById('ledDesc').value;
  const amount = document.getElementById('ledAmount').value;
  const type = document.getElementById('ledType').value;

  await fetch('/api/v1/market/ledger/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: desc, amount_inr: amount, type })
  });

  document.getElementById('ledgerAddModal').classList.remove('active');
  showToast("ਖ਼ਾਤੇ ਵਿੱਚ ਰਕਮ ਦਰਜ ਹੋ ਗਈ!");
  await loadAllData();
  renderCurrentTab();
}

function openCurationModal() {
  document.getElementById('curationModal').classList.add('active');
}

async function publishCuratedAlert(e) {
  e.preventDefault();
  const title = document.getElementById('alertTitlePa').value;
  const act = document.getElementById('alertActionPa').value;

  await fetch('/api/v1/curation/publish-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title_pa: title,
      title_en: title,
      title_hi: title,
      severity: 'WARNING',
      actions: { cultural: act, biological: 'ਟਰੈਪ ਲਗਾਓ', chemical: 'ਸਿਫ਼ਾਰਸ਼ ਅਨੁਸਾਰ ਸਪਰੇਅ' }
    })
  });

  document.getElementById('curationModal').classList.remove('active');
  showToast("ਚੇਤਾਵਨੀ ਸਫ਼ਲਤਾਪੂਰਵਕ ਜਾਰੀ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ!");
  await loadAllData();
  renderCurrentTab();
}

function playAudio(text) {
  VoiceManager.speak(text);
}

async function toggleTask(taskId, isCompleted) {
  await fetch('/api/v1/advisory/tasks/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, completed: isCompleted })
  });

  const task = (appState.tasks || []).find(t => t.id === taskId);
  if (task) task.completed = isCompleted;
  showToast(isCompleted ? "ਕੰਮ ਮੁਕੰਮਲ ਦਰਜ ਹੋਇਆ" : "ਕੰਮ ਬਾਕੀ ਹੈ");
  renderCurrentTab();
}

// -----------------------------------------------------------------------------
// AUTH & ONBOARDING (F1)
// -----------------------------------------------------------------------------
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('active');
  VoiceManager.speak(currentLang === 'pa' ? 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ ਜੀ।' : 'नमस्ते, अपना मोबाइल नंबर दर्ज करें।');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

async function requestOtp() {
  const phone = document.getElementById('authPhone').value.trim();
  if (!phone || phone.length < 10) {
    showToast('ਕਿਰਪਾ ਕਰਕੇ 10 ਅੰਕਾਂ ਵਾਲਾ ਫ਼ੋਨ ਨੰਬਰ ਭਰੋ।', '⚠️');
    return;
  }

  const res = await fetch('/api/v1/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, language: currentLang })
  }).then(r => r.json());

  if (res.success) {
    document.getElementById('otpGroup').style.display = 'block';
    document.getElementById('verifyOtpBtn').style.display = 'block';
    document.getElementById('sendOtpBtn').style.display = 'none';
    document.getElementById('authOtp').value = res.demo_otp || '4921';
    showToast('ਓ.ਟੀ.ਪੀ. ਭੇਜਿਆ ਗਿਆ! ਕੋਡ 4921 ਦਰਜ ਹੈ।');
    VoiceManager.speak(currentLang === 'pa' ? 'ਓ.ਟੀ.ਪੀ. ਭੇਜਿਆ ਗਿਆ ਹੈ। ਕੋਡ 4921 ਦਰਜ ਹੈ।' : 'ओटीपी भेजा गया है।');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('authPhone').value.trim();
  const otp = document.getElementById('authOtp').value.trim();
  const isKrishiMitra = document.getElementById('authKrishiMitra').checked;

  const res = await fetch('/api/v1/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, is_krishi_mitra: isKrishiMitra })
  }).then(r => r.json());

  if (res.success) {
    localStorage.setItem('kisan_sathi_token', res.token);
    appState.farmer = res.farmer;
    closeAuthModal();
    const headerName = document.getElementById('headerUserName');
    if (headerName) headerName.innerText = res.farmer.name;
    await loadAllData();
    renderCurrentTab();
    showToast(`ਸੁਆਗਤ ਹੈ, ${res.farmer.name} ਜੀ!`);

    const welcomeMsg = currentLang === 'pa' 
      ? `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${res.farmer.name} ਜੀ, ਕਿਸਾਨ ਸਾਥੀ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ!`
      : `नमस्ते ${res.farmer.name} जी, किसान साथी में आपका स्वागत है!`;
    VoiceManager.speak(welcomeMsg);
  } else {
    showToast(res.error || 'Invalid OTP', '⚠️');
  }
}

async function instantDemoLogin() {
  const res = await fetch('/api/v1/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', otp: '4921', is_krishi_mitra: false })
  }).then(r => r.json());

  if (res.success) {
    localStorage.setItem('kisan_sathi_token', res.token);
    appState.farmer = res.farmer;
    closeAuthModal();
    const headerName = document.getElementById('headerUserName');
    if (headerName) headerName.innerText = res.farmer.name;
    await loadAllData();
    renderCurrentTab();
    showToast("ਹਰਪ੍ਰੀਤ ਸਿੰਘ ਖ਼ਾਤੇ ਵਿੱਚ ਲੌਗਇਨ ਹੋਇਆ");
    VoiceManager.speak('ਲੌਗਇਨ ਸਫ਼ਲ ਰਿਹਾ। ਅੱਜ ਦਾ ਕੰਮ ਤਿਆਰ ਹੈ।');
  }
}

function openProfileModal() {
  const modal = document.getElementById('profileModal');
  const content = document.getElementById('profileModalContent');
  const f = appState.farmer || { name: 'Harpreet Singh', phone: '+919876543210', village: 'Balluana' };

  content.innerHTML = `
    <div class="mitti-card" style="margin-bottom:12px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:54px; height:54px; border-radius:50%; background:var(--mitti-green-100); border:2px solid var(--mitti-green-700); display:flex; align-items:center; justify-content:center; font-size:24px;">
          👨‍🌾
        </div>
        <div>
          <div style="font-size:18px; font-weight:800;">${f.name}</div>
          <div style="font-size:13px; color:var(--mitti-earth-700);">${f.phone}</div>
          <div style="font-size:12px; font-weight:700; color:var(--mitti-green-700); margin-top:2px;">
            📍 ਪਿੰਡ ${f.village}, ਬਲਾਕ ${f.block || 'ਅਬੋਹਰ'}, ਫ਼ਾਜ਼ਿਲਕਾ
          </div>
        </div>
      </div>
    </div>

    <div class="mitti-card" style="margin-bottom:14px;">
      <div style="font-weight:700; font-size:14px; margin-bottom:8px;">ਖੇਤੀ ਜਾਣਕਾਰੀ (Farm Profile):</div>
      <div style="font-size:13px; line-height:1.6;">
        <div>🌱 <strong>ਮੁੱਖ ਫ਼ਸਲ:</strong> ਕਿੰਨੂ ਬਾਗ਼ (3 ਕਿੱਲੇ / 24 ਕਨਾਲ)</div>
        <div>💧 <strong>ਪਾਣੀ ਸਾਧਨ:</strong> ਨਹਿਰੀ ਵਾਰੀ + ਟਿਊਬਵੈੱਲ</div>
        <div>📐 <strong>ਜ਼ਮੀਨ ਇਕਾਈ:</strong> ਕਿੱਲਾ / ਏਕੜ (Punjab Standard)</div>
        <div>🤝 <strong>ਮੋਡ:</strong> ${f.is_krishi_mitra ? 'ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ (ਸਹਾਇਕ ਆਪਰੇਟਰ)' : 'ਕਿਸਾਨ (ਸਿੱਧਾ ਖ਼ਾਤਾ)'}</div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      <button class="mitti-btn secondary full-width" onclick="toggleKrishiMitraMode()">
        🔄 ਮੋਡ ਬਦਲੋ: ${f.is_krishi_mitra ? 'ਆਮ ਕਿਸਾਨ ਮੋਡ' : 'ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ (ਸਹਾਇਕ ਮੋਡ)'}
      </button>
      <button class="mitti-btn secondary full-width" style="border-color:var(--mitti-red-800); color:var(--mitti-red-800);" onclick="logoutFarmer()">
        🚪 ਲੌਗ ਆਉਟ ਕਰੋ (Logout)
      </button>
    </div>
  `;
  modal.classList.add('active');
}

async function toggleKrishiMitraMode() {
  if (!appState.farmer) return;
  const newMode = !appState.farmer.is_krishi_mitra;
  await fetch('/api/v1/auth/profile/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_krishi_mitra: newMode })
  });
  await loadAllData();
  openProfileModal();
  showToast(newMode ? "ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ ਮੋਡ ਚਾਲੂ ਹੋਇਆ" : "ਆਮ ਕਿਸਾਨ ਮੋਡ ਚਾਲੂ ਹੋਇਆ");
}

function logoutFarmer() {
  localStorage.removeItem('kisan_sathi_token');
  document.getElementById('profileModal').classList.remove('active');
  const headerName = document.getElementById('headerUserName');
  if (headerName) headerName.innerText = 'ਲੌਗਇਨ';
  openAuthModal();
}
