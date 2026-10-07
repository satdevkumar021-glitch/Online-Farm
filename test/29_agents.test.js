const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const apiRoutes = require('../src/routes/api');
const { validateProduct, calculateDosage, checkTankMixCompatibility } = require('../src/services/safetyEngine');
const { evaluateSuitability } = require('../src/services/suitability');
const { recommendAlternatives } = require('../src/services/recommender');
const { diagnoseSymptoms } = require('../src/services/visionTriage');
const { processVoiceAssistantQuery } = require('../src/services/ragAssistant');

// Segment-aware route matching for Express router testing
function matchRoute(routePattern, actualPath) {
  const patternParts = routePattern.split('/');
  const actualParts = actualPath.split('/');
  if (patternParts.length !== actualParts.length) return false;
  return patternParts.every((p, i) => p.startsWith(':') || p === actualParts[i]);
}

function callApi(method, routePath, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const routeItem = apiRoutes.stack.find(s => {
      if (!s.route) return false;
      const matchMethod = s.route.methods[method.toLowerCase()];
      return matchMethod && matchRoute(s.route.path, routePath);
    });

    if (!routeItem) {
      return reject(new Error(`Route not found: ${method} ${routePath}`));
    }

    const extractedParams = {};
    const patternParts = routeItem.route.path.split('/');
    const actualParts = routePath.split('/');
    patternParts.forEach((part, idx) => {
      if (part.startsWith(':')) {
        extractedParams[part.slice(1)] = actualParts[idx];
      }
    });

    const req = {
      method: method.toUpperCase(),
      url: routePath,
      body,
      query,
      params: extractedParams,
      headers: { 'content-type': 'application/json' }
    };

    let statusCode = 200;
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, body: data });
      },
      send(data) {
        resolve({ status: statusCode, body: data });
      }
    };

    const handler = routeItem.route.stack[0].handle;
    try {
      handler(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// 🤖 29 SPECIALIZED QA & BUG-FIXING AGENTS SUITE
// =============================================================================

test('Agent 01: Auth & OTP Validation Agent', async () => {
  // Test numeric OTP, string OTP, invalid length, and demo OTP
  const badPhone = await callApi('POST', '/auth/otp/send', { phone: '987' });
  assert.strictEqual(badPhone.status, 400);

  const send = await callApi('POST', '/auth/otp/send', { phone: '9876543210' });
  assert.strictEqual(send.status, 200);
  assert.strictEqual(send.body.demo_otp, '4921');

  // String OTP
  const verifyStr = await callApi('POST', '/auth/otp/verify', { phone: '9876543210', otp: '4921' });
  assert.strictEqual(verifyStr.status, 200);

  // Numeric OTP edge case (Bug Fix verification)
  const verifyNum = await callApi('POST', '/auth/otp/verify', { phone: '9876543210', otp: 4921 });
  assert.strictEqual(verifyNum.status, 200);
});

test('Agent 02: Session Token & Security Agent', async () => {
  const auth = await callApi('POST', '/auth/otp/verify', { phone: '9876543210', otp: '4921' });
  assert.strictEqual(auth.status, 200);
  assert.ok(auth.body.token.startsWith('token_'));
  assert.ok(auth.body.token.includes(auth.body.farmer.id));
});

test('Agent 03: Krishi Mitra Assisted Mode Agent', async () => {
  const toggle = await callApi('POST', '/auth/profile/update', { is_krishi_mitra: true });
  assert.strictEqual(toggle.status, 200);
  assert.strictEqual(toggle.body.farmer.is_krishi_mitra, true);

  const toggleBack = await callApi('POST', '/auth/profile/update', { is_krishi_mitra: false });
  assert.strictEqual(toggleBack.status, 200);
  assert.strictEqual(toggleBack.body.farmer.is_krishi_mitra, false);
});

test('Agent 04: Profile Persistence & Mutation Agent', async () => {
  const profile = await callApi('POST', '/auth/profile/update', {
    name: 'ਹਰਪ੍ਰੀਤ ਸਿੰਘ (Harpreet Singh)',
    village: 'Balluana',
    block: 'Abohar',
    preferred_land_unit: 'KILLA'
  });
  assert.strictEqual(profile.status, 200);
  assert.strictEqual(profile.body.farmer.village, 'Balluana');

  const check = await callApi('GET', '/auth/profile');
  assert.strictEqual(check.body.farmer.village, 'Balluana');
});

test('Agent 05: Agromet Weather Nowcast Agent', async () => {
  const w = await callApi('GET', '/weather/nowcast');
  assert.strictEqual(w.status, 200);
  assert.ok(w.body.location.includes('Abohar'));
  assert.ok(w.body.temp_celsius >= 10 && w.body.temp_celsius <= 50);
  assert.ok(w.body.humidity_pct >= 10 && w.body.humidity_pct <= 100);
});

test('Agent 06: Spray Window Wind Drift Guard Agent', async () => {
  const w = await callApi('GET', '/weather/nowcast');
  assert.strictEqual(w.status, 200);
  assert.ok(w.body.wind_kmh < 15, 'Wind must be under 15 km/h for spray safety');
  assert.strictEqual(w.body.spray_window.status, 'OPEN_FAVORABLE');
  assert.ok(w.body.spray_window.reason.includes('drift limit'));
});

test('Agent 07: Warabandi Canal Schedule Agent', async () => {
  const w = await callApi('GET', '/weather/nowcast');
  assert.strictEqual(w.status, 200);
  assert.ok(w.body.canal_turn.turn_time.includes('2:40 AM'));
  assert.ok(w.body.canal_turn.watercourse_outlet.includes('Sirhind Feeder'));
  assert.strictEqual(w.body.canal_turn.duration_hours, 2.5);
});

test('Agent 08: Regional Problem Radar Agent', async () => {
  const r = await callApi('GET', '/radar/alerts');
  assert.strictEqual(r.status, 200);
  const kinnowAlert = r.body.alerts.find(a => a.crop === 'KINNOW_MANDARIN');
  assert.ok(kinnowAlert);
  assert.ok(kinnowAlert.distance_km <= 15, 'Alert must be within 15 km geofence');
  assert.strictEqual(kinnowAlert.is_farm_at_risk, true);
});

test('Agent 09: Daily Advisory Task Dispatcher Agent', async () => {
  const t = await callApi('GET', '/advisory/tasks');
  assert.strictEqual(t.status, 200);
  assert.ok(t.body.tasks.length >= 3);
  const ipm = t.body.tasks.find(tk => tk.category === 'IPM');
  assert.ok(ipm);
  assert.strictEqual(ipm.priority, 'HIGH');
});

test('Agent 10: Task State Synchronization Agent', async () => {
  const res1 = await callApi('POST', '/advisory/tasks/toggle', { task_id: 'task_02', completed: true });
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.completed, true);

  const res2 = await callApi('POST', '/advisory/tasks/toggle', { task_id: 'task_02', completed: false });
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.completed, false);
});

test('Agent 11: Farm Digital Twin & Plot Registry Agent', async () => {
  const plots = await callApi('GET', '/farms/plots');
  assert.strictEqual(plots.status, 200);
  const p1 = plots.body.plots.find(p => p.id === 'plot_01_kinnow');
  assert.ok(p1);
  assert.strictEqual(p1.area_killa, 3.0);
  assert.strictEqual(p1.area_kanals, 24); // 3 killa * 8 kanals
  assert.ok(p1.rootstock.includes('Jatti Khatti'));
});

test('Agent 12: Phenology & Harvest Window Agent', async () => {
  const plots = await callApi('GET', '/farms/plots');
  const p1 = plots.body.plots.find(p => p.id === 'plot_01_kinnow');
  assert.strictEqual(p1.current_stage, 'FRUIT_SIZING_AND_COLOR_BREAK');
  assert.ok(p1.days_to_next > 0);
});

test('Agent 13: Soil Chemistry & pH Evaluator Agent', async () => {
  const plot = { soil_ph: 7.8, water_tds_ppm: 1450, soil_type: 'Sandy Loam' };
  const suit = evaluateSuitability(plot, 'KINNOW_MANDARIN');
  assert.strictEqual(suit.parameters_analyzed.soil_ph.value, 7.8);
  assert.strictEqual(suit.parameters_analyzed.soil_ph.status.toUpperCase(), 'OPTIMAL');
});

test('Agent 14: Water Salinity & Lethal TDS Cap Agent', async () => {
  // Safe / Moderately saline test
  const mod = evaluateSuitability({ soil_ph: 7.8, water_tds_ppm: 1450, soil_type: 'Sandy Loam' }, 'KINNOW_MANDARIN');
  assert.strictEqual(mod.classification, 'MODERATE');

  // Hard Lethal Salinity Breach (> 2000 ppm)
  const lethal = evaluateSuitability({ soil_ph: 8.2, water_tds_ppm: 2600, soil_type: 'Sandy Loam' }, 'KINNOW_MANDARIN');
  assert.strictEqual(lethal.classification, 'UNSUITABLE_HIGH_SALINITY');
  assert.ok(lethal.score < 0.4);
});

test('Agent 15: Land Suitability Multi-Factor Agent', async () => {
  const p1 = (await callApi('GET', '/farms/plots')).body.plots[0];
  const suit = await callApi('GET', `/farms/plots/${p1.id}/suitability`);
  assert.strictEqual(suit.status, 200);
  assert.ok(suit.body.suitability.score >= 0.7);
  assert.ok(suit.body.suitability.recommendations.length >= 2);
});

test('Agent 16: Alternative Crop Diversification Agent', async () => {
  const p1 = (await callApi('GET', '/farms/plots')).body.plots[0];
  const alt = await callApi('GET', `/farms/plots/${p1.id}/alternatives`);
  assert.strictEqual(alt.status, 200);
  const guava = alt.body.alternatives.recommended_options.find(o => o.id === 'guava_high_density');
  assert.ok(guava);
  assert.strictEqual(guava.subsidy_available_pct, 80);
  assert.ok(guava.pilot_plan_1_kanal.toLowerCase().includes('1 kanal'));
});

test('Agent 17: CIB&RC Chemical Catalog Integrity Agent', async () => {
  const cat = await callApi('GET', '/inputs/catalog');
  assert.strictEqual(cat.status, 200);
  const prop = cat.body.products.find(p => p.id === 'cib_propiconazole_25ec');
  assert.ok(prop);
  assert.strictEqual(prop.phi_days, 30);
  assert.strictEqual(prop.dose_per_200l_drum, '200 ml');
});

test('Agent 18: Banned Chemical Interceptor Agent', async () => {
  const scan = await callApi('POST', '/inputs/scan', { query_text: 'Furadan 3G (Carbofuran)' });
  assert.strictEqual(scan.status, 200);
  assert.strictEqual(scan.body.is_banned, true);
  assert.ok(scan.body.safety_alert.includes('prohibited') || scan.body.product.cibrc_status.includes('BANNED'));

  const dose = calculateDosage('cib_monocrotophos_36sl', 200);
  assert.strictEqual(dose.is_banned, true);
});

test('Agent 19: 200L Drum Dilution Calculator Agent', async () => {
  // 50L, 100L, 200L, 500L dosage calculations
  const d50 = calculateDosage('cib_propiconazole_25ec', 50);
  assert.strictEqual(d50.recommended_dose, '50 ml');

  const d200 = calculateDosage('cib_propiconazole_25ec', 200);
  assert.strictEqual(d200.recommended_dose, '200 ml');

  const d500 = calculateDosage('cib_propiconazole_25ec', 500);
  assert.strictEqual(d500.recommended_dose, '500 ml');
});

test('Agent 20: Tank-Mix Compatibility Matrix Agent', async () => {
  const safe = checkTankMixCompatibility('Tilt', 'Potassium Nitrate');
  assert.strictEqual(safe.compatible, true);
  assert.strictEqual(safe.status, 'COMPATIBLE_SAFE');

  const dangerous = checkTankMixCompatibility('Tilt', 'Copper Oxychloride');
  assert.strictEqual(dangerous.compatible, false);
  assert.strictEqual(dangerous.status, 'INCOMPATIBLE_DANGEROUS');
});

test('Agent 21: Pre-Harvest Interval (PHI) Lock Agent', async () => {
  const scan = await callApi('POST', '/inputs/scan', { query_text: 'Tilt' });
  assert.strictEqual(scan.body.product.phi_days, 30);

  const act = await callApi('POST', '/activities/log', {
    plot_id: 'plot_01_kinnow',
    activity_type: 'SPRAY',
    phi_days: 30
  });
  assert.strictEqual(act.body.activity.phi_days, 30);
});

test('Agent 22: Field Activity Logger & Syncer Agent', async () => {
  const initialLedger = await callApi('GET', '/market/ledger');
  const countBefore = initialLedger.body.entries.length;

  const act = await callApi('POST', '/activities/log', {
    plot_id: 'plot_01_kinnow',
    activity_type: 'FERTILIZER',
    details: 'ਜ਼ਿੰਕ ਸਲਫੇਟ ਤੇ ਚੂਨਾ ਛਿੜਕਾਅ',
    quantity: 1,
    unit: 'DRUM_200L',
    cost_inr: 520,
    phi_days: 0
  });
  assert.strictEqual(act.status, 200);

  const updatedLedger = await callApi('GET', '/market/ledger');
  assert.strictEqual(updatedLedger.body.entries.length, countBefore + 1);
  assert.ok(updatedLedger.body.entries.some(e => e.amount_inr === 520));
});

test('Agent 23: APMC Mandi Rates & Trends Agent', async () => {
  const m = await callApi('GET', '/market/prices');
  assert.strictEqual(m.status, 200);
  const abohar = m.body.mandi_prices.find(mp => mp.market_name.includes('Abohar'));
  assert.ok(abohar);
  assert.ok(abohar.grade_a_waxed.includes('₹'));

  const analytics = await callApi('GET', '/market/analytics');
  assert.strictEqual(analytics.body.price_curve.length, 7);
});

test('Agent 24: Farm Ledger (Khata) & Profitability Agent', async () => {
  const led = await callApi('GET', '/market/ledger');
  assert.strictEqual(led.status, 200);
  assert.ok(led.body.total_expense_inr > 0);
  assert.ok(led.body.cost_per_killa_inr);

  // Negative amount protection (Bug Fix verification)
  const addNeg = await callApi('POST', '/market/ledger/entry', {
    amount_inr: -500,
    type: 'EXPENSE',
    description: 'Negative test'
  });
  assert.strictEqual(addNeg.body.entry.amount_inr, 0);
});

test('Agent 25: Vision Crop Diagnosis Triage Agent', async () => {
  const diag = await callApi('POST', '/diagnosis/triage', {
    symptom_type: 'fruit_drop',
    plot_id: 'plot_01_kinnow',
    photo_count: 3
  });
  assert.strictEqual(diag.status, 200);
  const p = diag.body.diagnosis.primary_diagnosis;
  assert.ok(p.name_pa.includes('ਕੇਰਾ'));
  assert.ok(p.actions.track_1_cultural);
  assert.ok(p.actions.track_2_biological);
  assert.ok(p.actions.track_3_chemical);
});

test('Agent 26: Government Subsidies Matcher Agent', async () => {
  const sch = await callApi('GET', '/schemes/matched');
  assert.strictEqual(sch.status, 200);
  assert.ok(sch.body.schemes.some(s => s.id === 'sch_midh_drip' && s.subsidy_pct === 80));
  assert.ok(sch.body.schemes.some(s => s.id === 'sch_pm_kusum_b' && s.subsidy_pct === 60));
});

test('Agent 27: Scheme Online Application & Tracker Agent', async () => {
  const app = await callApi('POST', '/schemes/apply', {
    scheme_id: 'sch_pm_kusum_b',
    applicant_name: 'Harpreet Singh',
    applicant_phone: '+919876543210',
    documents_ready: ['Jamabandi', 'Aadhaar', 'Passbook']
  });
  assert.strictEqual(app.status, 200);
  assert.ok(app.body.application.id.startsWith('app_'));
  assert.strictEqual(app.body.application.status, 'SUBMITTED_FOR_VERIFICATION');

  const list = await callApi('GET', '/schemes/applications');
  assert.ok(list.body.applications.some(a => a.id === app.body.application.id));
});

test('Agent 28: Voice AI Crisis & Helpline Guard Agent', async () => {
  // Crisis phrase
  const crisis = await callApi('POST', '/assistant/query', {
    query: 'Karza bahut ho gaya, mar jana chauna haan',
    language: 'pa'
  });
  assert.strictEqual(crisis.status, 200);
  assert.strictEqual(crisis.body.is_emergency, true);
  assert.strictEqual(crisis.body.type, 'DISTRESS_INTERCEPT');
  assert.ok(crisis.body.emergency_contacts.some(c => c.number === '1800-180-1551'));
});

test('Agent 29: Trilingual Localization & UI Accessibility Agent', () => {
  const i18n = require('../public/js/i18n.js');
  // Read raw i18n
  const rawI18n = fs.readFileSync(path.join(__dirname, '../public/js/i18n.js'), 'utf8');
  assert.ok(rawI18n.includes('pa: {'));
  assert.ok(rawI18n.includes('hi: {'));
  assert.ok(rawI18n.includes('en: {'));

  // Verify all 12 interactive modals exist in index.html
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const modals = [
    'authModal', 'profileModal', 'addPlotModal', 'detailModal',
    'schemeApplyModal', 'activityModal', 'scanModal', 'assistantModal',
    'officerModal', 'ledgerAddModal', 'curationModal', 'toastNotification'
  ];
  modals.forEach(m => assert.ok(html.includes(`id="${m}"`)));

  // Verify CSS touch target >= 56dp
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  assert.ok(css.includes('min-height: 56px') || css.includes('min-height:56px') || css.includes('56px'));
});
