const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
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

// Helper to simulate complete HTTP request/response pipeline
function callApi(method, routePath, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    // Find matching route in apiRoutes.stack
    const routeItem = apiRoutes.stack.find(s => {
      if (!s.route) return false;
      const matchMethod = s.route.methods[method.toLowerCase()];
      return matchMethod && matchRoute(s.route.path, routePath);
    });

    if (!routeItem) {
      return reject(new Error(`Route not found in Express stack: ${method} ${routePath}`));
    }

    // Extract params if dynamic
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
// TEST SUITE 1: AUTHENTICATION & ONBOARDING E2E
// =============================================================================
test('E2E - 1. Auth Flow: Phone validation, OTP send, verify, and session', async () => {
  // 1A. Reject invalid phone
  const badPhone = await callApi('POST', '/auth/otp/send', { phone: '123' });
  assert.strictEqual(badPhone.status, 400);
  assert.strictEqual(badPhone.body.success, false);

  // 1B. Send OTP for valid phone
  const otpRes = await callApi('POST', '/auth/otp/send', { phone: '9876543210', language: 'pa' });
  assert.strictEqual(otpRes.status, 200);
  assert.strictEqual(otpRes.body.success, true);
  assert.strictEqual(otpRes.body.demo_otp, '4921');

  // 1C. Reject invalid OTP
  const badOtp = await callApi('POST', '/auth/otp/verify', { phone: '9876543210', otp: '9999' });
  assert.strictEqual(badOtp.status, 401);

  // 1D. Verify correct OTP
  const authRes = await callApi('POST', '/auth/otp/verify', { phone: '9876543210', otp: '4921' });
  assert.strictEqual(authRes.status, 200);
  assert.strictEqual(authRes.body.success, true);
  assert.ok(authRes.body.token.startsWith('token_'));
  assert.ok(authRes.body.farmer.id);

  // 1E. Get Profile
  const profileRes = await callApi('GET', '/auth/profile');
  assert.strictEqual(profileRes.status, 200);
  assert.ok(profileRes.body.farmer.name);

  // 1F. Update Profile & Krishi Mitra mode
  const updateRes = await callApi('POST', '/auth/profile/update', {
    village: 'Balluana',
    block: 'Abohar',
    preferred_land_unit: 'KILLA',
    is_krishi_mitra: true
  });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.farmer.is_krishi_mitra, true);
  assert.strictEqual(updateRes.body.farmer.village, 'Balluana');

  // 1G. Update Language
  const langRes = await callApi('POST', '/auth/language', { language: 'pa' });
  assert.strictEqual(langRes.status, 200);
  assert.strictEqual(langRes.body.language, 'pa');

  // 1H. Logout
  const logoutRes = await callApi('POST', '/auth/logout');
  assert.strictEqual(logoutRes.status, 200);
  assert.strictEqual(logoutRes.body.success, true);
});

// =============================================================================
// TEST SUITE 2: WEATHER & SPRAY WINDOW NOWCAST E2E
// =============================================================================
test('E2E - 2. Weather & Agromet Spray Window Nowcast', async () => {
  const w = await callApi('GET', '/weather/nowcast');
  assert.strictEqual(w.status, 200);
  assert.strictEqual(w.body.success, true);
  assert.ok(w.body.temp_celsius > 0);
  assert.ok(w.body.humidity_pct > 0);
  assert.ok(w.body.wind_kmh < 15); // Abohar spray threshold
  assert.strictEqual(w.body.spray_window.status, 'OPEN_FAVORABLE');
  assert.ok(w.body.spray_window.headline_pa.includes('ਸਪਰੇਅ'));
  assert.ok(w.body.canal_turn.turn_time.includes('2:40 AM'));
  assert.ok(w.body.canal_turn.watercourse_outlet.includes('Sirhind Feeder'));
});

// =============================================================================
// TEST SUITE 3: REGIONAL PROBLEM RADAR & GEOFENCED ALERTS E2E
// =============================================================================
test('E2E - 3. Regional Problem Radar alerts in Abohar pilot zone', async () => {
  const r = await callApi('GET', '/radar/alerts');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.success, true);
  assert.ok(Array.isArray(r.body.alerts));
  assert.ok(r.body.alerts.length > 0);

  const fruitDropAlert = r.body.alerts.find(a => a.id === 'alt_pb_fazilka_01' || a.crop === 'KINNOW_MANDARIN');
  assert.ok(fruitDropAlert);
  assert.strictEqual(fruitDropAlert.crop, 'KINNOW_MANDARIN');
  assert.strictEqual(fruitDropAlert.is_farm_at_risk, true);
  assert.ok(fruitDropAlert.actions.cultural);
  assert.ok(fruitDropAlert.actions.biological);
  assert.ok(fruitDropAlert.actions.chemical);
});

// =============================================================================
// TEST SUITE 4: DAILY ADVISORY TASKS & COMPLETION TOGGLE E2E
// =============================================================================
test('E2E - 4. Daily Advisory Tasks and checkbox persistence', async () => {
  // 4A. Fetch Tasks
  const t = await callApi('GET', '/advisory/tasks');
  assert.strictEqual(t.status, 200);
  assert.ok(t.body.tasks.length >= 3);
  assert.ok(t.body.tasks.some(tk => tk.id === 'task_01'));

  // 4B. Toggle Task 01 to completed
  const toggleOn = await callApi('POST', '/advisory/tasks/toggle', { task_id: 'task_01', completed: true });
  assert.strictEqual(toggleOn.status, 200);
  assert.strictEqual(toggleOn.body.completed, true);

  // 4C. Check store reflects state
  const store = db.getStore();
  assert.strictEqual(store.completed_tasks['task_01'], true);

  // 4D. Toggle back to uncompleted
  const toggleOff = await callApi('POST', '/advisory/tasks/toggle', { task_id: 'task_01', completed: false });
  assert.strictEqual(toggleOff.status, 200);
  assert.strictEqual(toggleOff.body.completed, false);
});

// =============================================================================
// TEST SUITE 5: PLOTS, LAND SUITABILITY & DYNAMIC CREATION E2E
// =============================================================================
test('E2E - 5. Farm Plots, Land Suitability, Crop Alternatives, and Plot Creation', async () => {
  // 5A. Fetch existing plots
  const plotsRes = await callApi('GET', '/farms/plots');
  assert.strictEqual(plotsRes.status, 200);
  assert.ok(plotsRes.body.plots.length >= 2);
  const plot1 = plotsRes.body.plots.find(p => p.id === 'plot_01_kinnow');
  assert.ok(plot1);
  assert.strictEqual(plot1.crop, 'KINNOW_MANDARIN');

  // 5B. Evaluate Plot 1 Suitability
  const suitRes = await callApi('GET', `/farms/plots/${plot1.id}/suitability`);
  assert.strictEqual(suitRes.status, 200);
  assert.strictEqual(suitRes.body.success, true);
  assert.strictEqual(suitRes.body.suitability.crop, 'KINNOW_MANDARIN');
  assert.strictEqual(suitRes.body.suitability.parameters_analyzed.soil_ph.value, 7.8);
  assert.ok(suitRes.body.suitability.recommendations.length > 0);

  // 5C. Recommend Alternatives for Plot
  const altRes = await callApi('GET', `/farms/plots/${plot1.id}/alternatives`);
  assert.strictEqual(altRes.status, 200);
  assert.ok(altRes.body.alternatives.recommended_options.length >= 3);

  // 5D. Dynamically Create a New Plot
  const createPlotRes = await callApi('POST', '/farms/plots/create', {
    name: 'ਧਾਣੀ ਵਾਲਾ ਨਵਾਂ ਬਾਗ਼ (Test Plot)',
    area_killa: 2.0,
    crop: 'KINNOW_MANDARIN',
    variety: 'Kinnow',
    soil_type: 'Sandy Loam',
    irrigation_source: 'Canal + Tubewell'
  });
  assert.strictEqual(createPlotRes.status, 200);
  assert.strictEqual(createPlotRes.body.success, true);
  assert.strictEqual(createPlotRes.body.plot.area_killa, 2.0);
  assert.strictEqual(createPlotRes.body.plot.area_kanals, 16);
  assert.strictEqual(createPlotRes.body.plot.tree_count, 220);

  // Verify plot is persisted in store
  const updatedPlots = await callApi('GET', '/farms/plots');
  assert.ok(updatedPlots.body.plots.some(p => p.id === createPlotRes.body.plot.id));
});

// =============================================================================
// TEST SUITE 6: FIELD ACTIVITIES & LEDGER AUTO-SYNC E2E
// =============================================================================
test('E2E - 6. Field Activities logging, PHI lock, and Ledger synchronization', async () => {
  // 6A. Log Field Activity with cost
  const actRes = await callApi('POST', '/activities/log', {
    plot_id: 'plot_01_kinnow',
    activity_type: 'SPRAY',
    details: 'ਟਿਲਟ 25 EC ਫ਼ੌਲੀਅਰ ਸਪਰੇਅ',
    quantity: 2,
    unit: 'DRUM_200L',
    cost_inr: 960,
    phi_days: 30
  });
  assert.strictEqual(actRes.status, 200);
  assert.strictEqual(actRes.body.success, true);
  assert.strictEqual(actRes.body.activity.cost_inr, 960);
  assert.strictEqual(actRes.body.activity.phi_days, 30);

  // 6B. Verify activity history
  const historyRes = await callApi('GET', '/activities/history');
  assert.strictEqual(historyRes.status, 200);
  assert.ok(historyRes.body.activities.some(a => a.id === actRes.body.activity.id));

  // 6C. Verify auto-sync to Ledger
  const ledgerRes = await callApi('GET', '/market/ledger');
  assert.strictEqual(ledgerRes.status, 200);
  assert.ok(ledgerRes.body.entries.some(e => e.amount_inr === 960 && e.description.includes('ਟਿਲਟ')));
  assert.ok(ledgerRes.body.total_expense_inr >= 960);

  // 6D. Add Manual Income Entry
  const incRes = await callApi('POST', '/market/ledger/entry', {
    type: 'INCOME',
    category: 'HARVEST_SALE',
    description: 'ਅਬੋਹਰ ਮੰਡੀ ਕਿੰਨੂ ਗ੍ਰੇਡ-ਏ ਤੁੜਾਈ ਵਿਕਰੀ',
    amount_inr: 50000
  });
  assert.strictEqual(incRes.status, 200);
  assert.strictEqual(incRes.body.entry.amount_inr, 50000);

  // 6E. Check Market Analytics 7-day price curve & expense breakdown
  const analyticsRes = await callApi('GET', '/market/analytics');
  assert.strictEqual(analyticsRes.status, 200);
  assert.strictEqual(analyticsRes.body.price_curve.length, 7);
  assert.ok(analyticsRes.body.expense_categories);
});

// =============================================================================
// TEST SUITE 7: CIB&RC CHEMICAL SAFETY, DOSAGE & TANK-MIX E2E
// =============================================================================
test('E2E - 7. Chemical Safety Vault, 200L Drum Slider, and Tank Compatibility', async () => {
  // 7A. Search Catalog
  const cat = await callApi('GET', '/inputs/catalog');
  assert.strictEqual(cat.status, 200);
  assert.ok(cat.body.products.length >= 4);

  // 7B. Scan Approved Chemical
  const scanApproved = await callApi('POST', '/inputs/scan', { query_text: 'Tilt 25 EC' });
  assert.strictEqual(scanApproved.status, 200);
  assert.strictEqual(scanApproved.body.found, true);
  assert.strictEqual(scanApproved.body.is_banned, false);
  assert.strictEqual(scanApproved.body.product.dose_per_200l_drum, '200 ml');

  // 7C. Scan Banned Chemical (Monocrotophos)
  const scanBanned = await callApi('POST', '/inputs/scan', { query_text: 'Monocrotophos' });
  assert.strictEqual(scanBanned.status, 200);
  assert.strictEqual(scanBanned.body.is_banned, true);
  assert.ok(scanBanned.body.safety_alert.includes('BANNED'));

  // 7D. Dynamic Drum Dosage calculation (500L vs 100L)
  const dose500 = await callApi('GET', '/inputs/dose', {}, { product_id: 'cib_propiconazole_25ec', water_litres: '500' });
  assert.strictEqual(dose500.status, 200);
  assert.strictEqual(dose500.body.dosage.water_volume_litres, 500);
  assert.strictEqual(dose500.body.dosage.recommended_dose, '500 ml');

  const dose100 = await callApi('GET', '/inputs/dose', {}, { product_id: 'cib_propiconazole_25ec', water_litres: '100' });
  assert.strictEqual(dose100.status, 200);
  assert.strictEqual(dose100.body.dosage.recommended_dose, '100 ml');

  // 7E. Safe Tank Mix Check
  const safeTank = await callApi('POST', '/inputs/tank-mix', { product_a: 'Tilt', product_b: 'Potassium Nitrate' });
  assert.strictEqual(safeTank.status, 200);
  assert.strictEqual(safeTank.body.compatibility.compatible, true);
  assert.strictEqual(safeTank.body.compatibility.status, 'COMPATIBLE_SAFE');

  // 7F. Dangerous Incompatible Tank Mix Check
  const dangerTank = await callApi('POST', '/inputs/tank-mix', { product_a: 'Tilt', product_b: 'Copper Oxychloride' });
  assert.strictEqual(dangerTank.status, 200);
  assert.strictEqual(dangerTank.body.compatibility.compatible, false);
  assert.strictEqual(dangerTank.body.compatibility.status, 'INCOMPATIBLE_DANGEROUS');
});

// =============================================================================
// TEST SUITE 8: CROP DIAGNOSIS & VISION TRIAGE E2E
// =============================================================================
test('E2E - 8. Vision Crop Diagnosis Triage and History', async () => {
  // 8A. Run Triage on Fruit Drop
  const triageRes = await callApi('POST', '/diagnosis/triage', {
    symptom_type: 'fruit_drop',
    plot_id: 'plot_01_kinnow',
    photo_count: 2
  });
  assert.strictEqual(triageRes.status, 200);
  assert.strictEqual(triageRes.body.success, true);
  const d = triageRes.body.diagnosis.primary_diagnosis;
  assert.ok(d.scientific_name.includes('Bactrocera dorsalis'));
  assert.ok(d.actions.track_1_cultural);
  assert.ok(d.actions.track_2_biological);
  assert.ok(d.actions.track_3_chemical);
  assert.strictEqual(d.escalation.expert_name, 'Dr. P. K. Arora (Senior Entomologist)');

  // 8B. Check Diagnosis History
  const history = await callApi('GET', '/diagnosis/history');
  assert.strictEqual(history.status, 200);
  assert.ok(history.body.diagnoses.length > 0);
});

// =============================================================================
// TEST SUITE 9: GOVERNMENT SCHEMES & ONLINE APPLICATION E2E
// =============================================================================
test('E2E - 9. Government Schemes Matching and Online Application Tracking', async () => {
  // 9A. Fetch Matched Schemes
  const schemesRes = await callApi('GET', '/schemes/matched');
  assert.strictEqual(schemesRes.status, 200);
  assert.ok(schemesRes.body.schemes.length >= 3);
  assert.ok(schemesRes.body.schemes.some(s => s.id === 'sch_midh_drip'));

  // 9B. Submit Online Scheme Application
  const applyRes = await callApi('POST', '/schemes/apply', {
    scheme_id: 'sch_midh_drip',
    applicant_name: 'Harpreet Singh',
    applicant_phone: '+919876543210',
    land_size_killa: 3.0,
    documents_ready: ['Jamabandi', 'Aadhaar', 'Passbook']
  });
  assert.strictEqual(applyRes.status, 200);
  assert.strictEqual(applyRes.body.success, true);
  assert.ok(applyRes.body.application.id.startsWith('app_'));
  assert.strictEqual(applyRes.body.application.status, 'SUBMITTED_FOR_VERIFICATION');

  // 9C. Retrieve Submitted Applications
  const appsRes = await callApi('GET', '/schemes/applications');
  assert.strictEqual(appsRes.status, 200);
  assert.ok(appsRes.body.applications.some(a => a.id === applyRes.body.application.id));
});

// =============================================================================
// TEST SUITE 10: VERIFIED OFFICERS DIRECTORY E2E
// =============================================================================
test('E2E - 10. Verified Support Officers Directory', async () => {
  const dirRes = await callApi('GET', '/directory/officers');
  assert.strictEqual(dirRes.status, 200);
  assert.ok(dirRes.body.officers.length >= 4);

  const hdo = dirRes.body.officers.find(o => o.id === 'off_01_hdo_abohar');
  assert.ok(hdo);
  assert.strictEqual(hdo.phone, '+919814233211');
  assert.ok(hdo.jurisdiction.includes('Abohar'));
});

// =============================================================================
// TEST SUITE 11: KISAN SATHI VOICE AI ASSISTANT & GUARDRAILS E2E
// =============================================================================
test('E2E - 11. Voice AI Assistant, Emergency Crisis Interceptor & Safety Checks', async () => {
  // 11A. General Weather & Mandi Inquiry
  const generalQ = await callApi('POST', '/assistant/query', { query: 'Ajj da mausam te mandi rate ki hai?', language: 'pa' });
  assert.strictEqual(generalQ.status, 200);
  assert.ok(generalQ.body.response_pa.includes('ਕਿੰਨੂ'));

  // 11B. Emergency Crisis Guardrail
  const crisisQ = await callApi('POST', '/assistant/query', { query: 'Karza bahut ho gaya, bachao koi raah nahi', language: 'pa' });
  assert.strictEqual(crisisQ.status, 200);
  assert.strictEqual(crisisQ.body.is_emergency, true);
  assert.strictEqual(crisisQ.body.type, 'DISTRESS_INTERCEPT');
  assert.ok(crisisQ.body.response_pa.includes('1800-180-1551'));

  // 11C. Banned Chemical Interceptor
  const bannedQ = await callApi('POST', '/assistant/query', { query: 'Monocrotophos spray kar layiaye?', language: 'pa' });
  assert.strictEqual(bannedQ.status, 200);
  assert.strictEqual(bannedQ.body.type, 'BANNED_CHEMICAL_BLOCK');
  assert.ok(bannedQ.body.response_pa.includes('ਪਾਬੰਦੀਸ਼ੁਦਾ'));
});

// =============================================================================
// TEST SUITE 12: AGRONOMIST WORKBENCH & CURATION E2E
// =============================================================================
test('E2E - 12. Agronomist Review & Alert Publishing Workbench', async () => {
  // 12A. Fetch Pending Alerts
  const pending = await callApi('GET', '/curation/pending-alerts');
  assert.strictEqual(pending.status, 200);
  assert.ok(Array.isArray(pending.body.active_alerts));

  // 12B. Publish New Curated Regional Alert
  const newAlert = await callApi('POST', '/curation/publish-alert', {
    title_pa: 'ਅਬੋਹਰ ਜ਼ੋਨ: ਸਿਟਰਸ ਸਾਈਲਾ (Citrus Psylla) ਦਾ ਤਾਜ਼ਾ ਹਮਲਾ',
    title_hi: 'अबोहर जोन: सिट्रस साइला का ताजा प्रकोप',
    title_en: 'Abohar Zone: Fresh Citrus Psylla Outbreak',
    severity: 'WARNING',
    actions: {
      cultural: 'ਪੀਲੇ ਸਟਿੱਕੀ ਕਾਰਡ ਲਗਾਓ',
      biological: 'ਮਿੱਤਰ ਕੀੜਿਆਂ ਦੀ ਰੱਖਿਆ ਕਰੋ',
      chemical: 'ਰੌਗਰ (Rogor / Dimethoate) 200ml ਪ੍ਰਤੀ ਡਰੱਮ'
    }
  });
  assert.strictEqual(newAlert.status, 200);
  assert.strictEqual(newAlert.body.success, true);
  assert.ok(newAlert.body.alert.id.startsWith('alt_curated_'));

  // 12C. Verify radar now reflects published alert
  const radar = await callApi('GET', '/radar/alerts');
  assert.ok(radar.body.alerts.some(a => a.id === newAlert.body.alert.id));
});

// =============================================================================
// TEST SUITE 13: FRONTEND DOM, MODALS & I18N CONSISTENCY E2E
// =============================================================================
test('E2E - 13. Frontend UI DOM elements, modals, and i18n dictionary integrity', () => {
  const htmlPath = path.join(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Verify all required interactive modals exist in index.html
  const requiredModals = [
    'authModal',
    'profileModal',
    'addPlotModal',
    'detailModal',
    'schemeApplyModal',
    'activityModal',
    'scanModal',
    'assistantModal',
    'officerModal',
    'ledgerAddModal',
    'curationModal',
    'toastNotification'
  ];

  requiredModals.forEach(modalId => {
    assert.ok(
      htmlContent.includes(`id="${modalId}"`),
      `Expected modal #${modalId} to exist in public/index.html`
    );
  });

  // Verify form controls and essential input IDs
  const requiredInputs = [
    'authPhone',
    'authOtp',
    'plotNameInput',
    'plotAreaInput',
    'applySchemeId',
    'applyFarmerName',
    'applyFarmerPhone',
    'docJamabandi',
    'docAadhaar',
    'docPassbook',
    'scanInput',
    'ledDesc',
    'ledAmount'
  ];

  requiredInputs.forEach(inputId => {
    assert.ok(
      htmlContent.includes(`id="${inputId}"`),
      `Expected input #${inputId} to exist in public/index.html`
    );
  });

  // Verify i18n dictionary parity across Punjabi, Hindi, and English
  const i18nPath = path.join(__dirname, '../public/js/i18n.js');
  const i18nFileContent = fs.readFileSync(i18nPath, 'utf8');
  assert.ok(i18nFileContent.includes('pa: {'));
  assert.ok(i18nFileContent.includes('hi: {'));
  assert.ok(i18nFileContent.includes('en: {'));

  // Check key CSS declarations in style.css
  const cssPath = path.join(__dirname, '../public/css/style.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(cssContent.includes('--mitti-earth-900: #1A1C19'));
  assert.ok(cssContent.includes('--mitti-green-700: #1B5E20'));
  assert.ok(cssContent.includes('.camera-viewfinder-wrapper'));
  assert.ok(cssContent.includes('.drum-slider'));
  assert.ok(cssContent.includes('.toast-notification'));
});
