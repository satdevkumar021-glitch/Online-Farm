const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateProduct, calculateDosage, checkTankMixCompatibility } = require('../services/safetyEngine');
const { evaluateSuitability } = require('../services/suitability');
const { recommendAlternatives } = require('../services/recommender');
const { diagnoseSymptoms } = require('../services/visionTriage');
const { processVoiceAssistantQuery } = require('../services/ragAssistant');

// In-memory OTP storage for validation
const activeOtps = new Map();

// ==========================================
// 1. AUTH & PROFILE (F1)
// ==========================================
router.post('/auth/otp/send', (req, res) => {
  const { phone, language = 'pa' } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' });
  }

  // Clean phone number
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const otp = '4921'; // Fixed demo OTP for instant friction-free testing
  activeOtps.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  res.json({
    success: true,
    status: 'OTP_SENT',
    message: language === 'pa' ? 'ਓ.ਟੀ.ਪੀ. ਭੇਜਿਆ ਗਿਆ ਹੈ' : language === 'hi' ? 'ओटीपी भेजा गया है' : 'OTP Sent successfully',
    demo_otp: otp,
    phone: cleanPhone,
    timeout_seconds: 60
  });
});

router.post('/auth/otp/verify', (req, res) => {
  const { phone, otp, is_krishi_mitra = false } = req.body;
  const cleanPhone = (phone || '').replace(/[^\d+]/g, '');

  if (!otp) {
    return res.status(400).json({ success: false, error: 'Please provide OTP' });
  }

  const otpStr = String(otp || '').trim();
  const record = activeOtps.get(cleanPhone);
  const isValid = otpStr === '4921' || (record && record.otp === otpStr && Date.now() < record.expiresAt);

  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid or expired OTP. Please try again with 4921.' });
  }

  const store = db.getStore();
  if (!store.farmers) store.farmers = [];

  // Check if farmer exists
  let farmer = store.farmers.find(f => f.phone.includes(cleanPhone.slice(-10)));
  let isNew = false;

  if (!farmer) {
    isNew = true;
    farmer = {
      id: `f_${Date.now()}`,
      name: is_krishi_mitra ? "Surjit Kumar (ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ)" : "Harpreet Singh",
      phone: cleanPhone.startsWith('+91') ? cleanPhone : `+91${cleanPhone}`,
      village: "Balluana",
      block: "Abohar",
      district: "Fazilka",
      state: "Punjab",
      preferred_language: "pa",
      preferred_land_unit: "KILLA",
      is_krishi_mitra: !!is_krishi_mitra,
      created_at: new Date().toISOString()
    };
    store.farmers.unshift(farmer);
    db.saveStore(store);
  }

  res.json({
    success: true,
    token: `token_${farmer.id}_${Date.now()}`,
    farmer,
    is_new: isNew
  });
});

router.get('/auth/profile', (req, res) => {
  const store = db.getStore();
  const farmer = (store.farmers || [])[0] || {
    id: "f_harpreet_01",
    name: "Harpreet Singh",
    village: "Balluana",
    block: "Abohar",
    district: "Fazilka",
    preferred_language: "pa",
    preferred_land_unit: "KILLA",
    is_krishi_mitra: false
  };
  res.json({ success: true, farmer });
});

router.post('/auth/profile/update', (req, res) => {
  const { name, village, block, preferred_language, preferred_land_unit, is_krishi_mitra } = req.body;
  const store = db.getStore();
  if (!store.farmers) store.farmers = [];

  let farmer = store.farmers[0];
  if (!farmer) {
    farmer = { id: `f_${Date.now()}`, phone: "+919876543210" };
    store.farmers.push(farmer);
  }

  if (name) farmer.name = name;
  if (village) farmer.village = village;
  if (block) farmer.block = block;
  if (preferred_language) farmer.preferred_language = preferred_language;
  if (preferred_land_unit) farmer.preferred_land_unit = preferred_land_unit;
  if (typeof is_krishi_mitra !== 'undefined') farmer.is_krishi_mitra = !!is_krishi_mitra;

  db.saveStore(store);
  res.json({ success: true, farmer });
});

router.post('/auth/language', (req, res) => {
  const { language } = req.body;
  const store = db.getStore();
  if (store.farmers && store.farmers[0]) {
    store.farmers[0].preferred_language = language || 'pa';
    db.saveStore(store);
  }
  res.json({ success: true, language: language || 'pa' });
});

router.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// 2. PLOTS & LAND INTELLIGENCE (F2, F3, F4)
// ==========================================
router.get('/farms/plots', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, plots: store.plots || [] });
});

router.get('/farms/plots/:id', (req, res) => {
  const store = db.getStore();
  const plot = (store.plots || []).find(p => p.id === req.params.id);
  if (!plot) return res.status(404).json({ error: 'Plot not found' });
  res.json({ success: true, plot });
});

router.get('/farms/plots/:id/suitability', (req, res) => {
  const store = db.getStore();
  const plot = (store.plots || []).find(p => p.id === req.params.id);
  if (!plot) return res.status(404).json({ error: 'Plot not found' });
  const result = evaluateSuitability(plot, plot.crop);
  res.json({ success: true, plot_id: plot.id, suitability: result });
});

router.get('/farms/plots/:id/alternatives', (req, res) => {
  const store = db.getStore();
  const plot = (store.plots || []).find(p => p.id === req.params.id);
  const area = plot ? plot.area_killa : 2.0;
  const alternatives = recommendAlternatives(store.farmers[0], area);
  res.json({ success: true, alternatives });
});

// ==========================================
// 3. WEATHER & SPRAY WINDOW (F18)
// ==========================================
router.get('/weather/nowcast', (req, res) => {
  res.json({
    success: true,
    location: "Balluana, Fazilka (Abohar Grid 74.2E, 30.1N)",
    temp_celsius: 28.5,
    humidity_pct: 54,
    wind_kmh: 7.2,
    wind_direction: "NW",
    rain_prob_next_6h: 5,
    canal_turn: {
      plot_name: "Vadda Bagicha (Plot 1)",
      turn_time: "Tonight at 2:40 AM",
      duration_hours: 2.5,
      watercourse_outlet: "Moga #22-R Sirhind Feeder"
    },
    spray_window: {
      status: "OPEN_FAVORABLE",
      badge_color: "GREEN",
      headline_pa: "ਸਪਰੇਅ ਦਾ ਵੇਲਾ ਖੁੱਲ੍ਹਾ ਹੈ (ਸ਼ਾਮ 4:30 ਵਜੇ ਤੱਕ ਢੁਕਵਾਂ)",
      headline_hi: "स्प्रे का समय अनुकूल है (शाम 4:30 बजे तक करें)",
      headline_en: "Spray Window Open (Safe until 4:30 PM)",
      reason: "Wind speed 7.2 km/h is below drift limit (15 km/h); zero rain risk for next 24 hours."
    }
  });
});

// ==========================================
// 4. REGIONAL PROBLEM RADAR (F9)
// ==========================================
router.get('/radar/alerts', (req, res) => {
  const radar = db.getRadar();
  res.json({ success: true, alerts: radar.alerts || [] });
});

// ==========================================
// 5. ADVISORY & ACTIVITIES (F7, F10)
// ==========================================
router.get('/advisory/tasks', (req, res) => {
  res.json({
    success: true,
    date: "2026-10-07",
    tasks: [
      {
        id: "task_01",
        title_pa: "ਬਾਗ਼ ਵਿੱਚ ਫ਼ਰੂਟ ਫ਼ਲਾਈ ਟਰੈਪ ਚੈੱਕ ਕਰੋ",
        title_hi: "बाग में फल मक्खी फेरोमोन ट्रैप की जांच करें",
        title_en: "Check 16 Pheromone Traps for Fruit Fly Catch",
        plot_name: "Vadda Bagicha (Plot 1)",
        cost_inr: 0,
        time_minutes: 20,
        priority: "HIGH",
        category: "IPM",
        completed: false
      },
      {
        id: "task_02",
        title_pa: "ਪੋਟਾਸ਼ੀਅਮ ਨਾਈਟ੍ਰੇਟ (13-0-45) ਸਪਰੇਅ ਦੀ ਤਿਆਰੀ",
        title_hi: "पोटेशियम नाइट्रेट (13-0-45) स्प्रे तैयार करें",
        title_en: "Prepare Potassium Nitrate (13-0-45) Foliar Spray",
        plot_name: "Vadda Bagicha (Plot 1)",
        cost_inr: 450,
        time_minutes: 45,
        priority: "MEDIUM",
        category: "NUTRITION",
        completed: false
      },
      {
        id: "task_03",
        title_pa: "ਰਾਤ ਦੀ ਨਹਿਰੀ ਵਾਰੀ (2:40 AM) ਲਈ ਮੋਘਾ ਸਾਫ਼ ਕਰੋ",
        title_hi: "रात की नहरी बारी (2:40 AM) हेतु मोघे की सफाई",
        title_en: "Clear Canal Watercourse Outlet before 2:40 AM Turn",
        plot_name: "Vadda Bagicha (Plot 1)",
        cost_inr: 0,
        time_minutes: 30,
        priority: "HIGH",
        category: "IRRIGATION",
        completed: true
      }
    ]
  });
});

router.post('/activities/log', (req, res) => {
  const { plot_id, activity_type, details, quantity, unit, cost_inr, phi_days } = req.body;
  const store = db.getStore();
  const newActivity = {
    id: `act_${Date.now()}`,
    plot_id: plot_id || 'plot_01_kinnow',
    activity_type: activity_type || 'SPRAY',
    details: details || 'Field spray recorded',
    quantity: parseFloat(quantity) || 1,
    unit: unit || 'DRUM_200L',
    cost_inr: parseFloat(cost_inr) || 0,
    date: new Date().toISOString(),
    weather_snapshot: 'Temp 28.5C, Wind 7km/h',
    phi_days: parseInt(phi_days) || 0,
    outcome_feedback: null
  };

  if (!store.activities) store.activities = [];
  store.activities.unshift(newActivity);

  // If cost > 0, also log into ledger
  if (newActivity.cost_inr > 0) {
    if (!store.ledger) store.ledger = [];
    store.ledger.unshift({
      id: `led_${Date.now()}`,
      plot_id: newActivity.plot_id,
      type: "EXPENSE",
      category: newActivity.activity_type,
      description: newActivity.details,
      amount_inr: newActivity.cost_inr,
      date: new Date().toISOString().split('T')[0]
    });
  }

  db.saveStore(store);
  res.json({ success: true, activity: newActivity });
});

router.get('/activities/history', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, activities: store.activities || [] });
});

// ==========================================
// 6. INPUT VAULT & SAFETY ENGINE (F6)
// ==========================================
router.get('/inputs/catalog', (req, res) => {
  const catalog = db.getCatalog();
  res.json({ success: true, products: catalog.products || [] });
});

router.post('/inputs/scan', (req, res) => {
  const { query_text } = req.body;
  const result = validateProduct(query_text || '');
  res.json({ success: true, ...result });
});

router.get('/inputs/dose', (req, res) => {
  const { product_id, water_litres } = req.query;
  const litres = parseFloat(water_litres) || 200;
  const result = calculateDosage(product_id, litres);
  res.json({ success: true, dosage: result });
});

router.post('/inputs/tank-mix', (req, res) => {
  const { product_a, product_b } = req.body;
  const result = checkTankMixCompatibility(product_a, product_b);
  res.json({ success: true, compatibility: result });
});

// ==========================================
// 7. DIAGNOSIS & PROBLEM SOLVER (F8)
// ==========================================
router.post('/diagnosis/triage', (req, res) => {
  const result = diagnoseSymptoms(req.body);
  const store = db.getStore();
  if (!store.diagnoses) store.diagnoses = [];
  store.diagnoses.unshift(result);
  db.saveStore(store);
  res.json({ success: true, diagnosis: result });
});

// ==========================================
// 8. GOVERNMENT SCHEMES (F14)
// ==========================================
router.get('/schemes/matched', (req, res) => {
  const schemesData = db.getSchemes();
  res.json({ success: true, schemes: schemesData.schemes || [] });
});

// ==========================================
// 9. OFFICERS DIRECTORY (F15)
// ==========================================
router.get('/directory/officers', (req, res) => {
  const directory = db.getDirectory();
  res.json({ success: true, officers: directory.officers || [] });
});

// ==========================================
// 10. MARKET & MANDI BHAV & LEDGER (F17)
// ==========================================
router.get('/market/prices', (req, res) => {
  const radar = db.getRadar();
  res.json({ success: true, mandi_prices: radar.mandi_prices || [] });
});

router.get('/market/ledger', (req, res) => {
  const store = db.getStore();
  const ledger = store.ledger || [];
  const totalExpense = ledger.filter(l => l.type === 'EXPENSE').reduce((acc, curr) => acc + (curr.amount_inr || 0), 0);
  const totalIncome = ledger.filter(l => l.type === 'INCOME').reduce((acc, curr) => acc + (curr.amount_inr || 0), 0);
  const netInHand = totalIncome - totalExpense;

  res.json({
    success: true,
    total_expense_inr: totalExpense,
    total_income_inr: totalIncome,
    net_inr: netInHand,
    cost_per_killa_inr: (totalExpense / 3.0).toFixed(0),
    entries: ledger
  });
});

router.post('/market/ledger/entry', (req, res) => {
  const { plot_id, type, category, description, amount_inr, date } = req.body;
  const store = db.getStore();
  if (!store.ledger) store.ledger = [];

  const newEntry = {
    id: `led_${Date.now()}`,
    plot_id: plot_id || 'plot_01_kinnow',
    type: type || 'EXPENSE',
    category: category || 'GENERAL',
    description: description || 'Field operation',
    amount_inr: Math.max(0, parseFloat(amount_inr) || 0),
    date: date || new Date().toISOString().split('T')[0]
  };

  store.ledger.unshift(newEntry);
  db.saveStore(store);
  res.json({ success: true, entry: newEntry });
});

// ==========================================
// 11. KISAN SATHI VOICE AI ASSISTANT (F20)
// ==========================================
router.post('/assistant/query', (req, res) => {
  const { query, language } = req.body;
  const result = processVoiceAssistantQuery(query, language || 'pa');
  res.json({ success: true, ...result });
});

// ==========================================
// 12. ADMIN & CURATION BENCH (F22)
// ==========================================
router.get('/curation/pending-alerts', (req, res) => {
  const radar = db.getRadar();
  res.json({ success: true, active_alerts: radar.alerts || [] });
});

router.post('/curation/publish-alert', (req, res) => {
  const { title_en, title_pa, title_hi, severity, actions } = req.body;
  const radar = db.getRadar();
  const newAlert = {
    id: `alt_curated_${Date.now()}`,
    severity: severity || 'WARNING',
    crop: 'KINNOW_MANDARIN',
    stage: 'FRUIT_SIZING_AND_COLOR_BREAK',
    title_en: title_en || 'Regional Alert',
    title_pa: title_pa || 'ਖੇਤਰੀ ਚੇਤਾਵਨੀ',
    title_hi: title_hi || 'क्षेत्रीय चेतावनी',
    reported_count: 24,
    distance_km: 2.5,
    location_text: 'Balluana, Fazilka',
    source: 'Agronomist Signed Review',
    issued_date: new Date().toISOString().split('T')[0],
    is_farm_at_risk: true,
    risk_reason_pa: 'ਤੁਹਾਡਾ ਬਾਗ਼ ਪ੍ਰਭਾਵਿਤ ਜ਼ੋਨ ਦੇ ਅੰਦਰ ਹੈ।',
    risk_reason_hi: 'आपका बाग प्रभावित क्षेत्र में है।',
    actions: actions || {
      cultural: 'ਨਿਰੀਖਣ ਕਰੋ।',
      biological: 'ਟਰੈਪ ਲਗਾਓ।',
      chemical: 'ਸਿਫ਼ਾਰਸ਼ ਅਨੁਸਾਰ ਹੀ ਛਿੜਕਾਅ ਕਰੋ।'
    }
  };

  if (!radar.alerts) radar.alerts = [];
  radar.alerts.unshift(newAlert);
  db.saveRadar(radar);
  res.json({ success: true, alert: newAlert });
});

// Dynamic Plot Creation
router.post('/farms/plots/create', (req, res) => {
  const { name, area_killa, crop, variety, soil_type, irrigation_source, tenure_type } = req.body;
  const store = db.getStore();
  if (!store.plots) store.plots = [];

  const killa = Math.max(0.1, parseFloat(area_killa) || 1.0);
  const newPlot = {
    id: `plot_${Date.now()}`,
    farmer_id: store.farmers && store.farmers[0] ? store.farmers[0].id : "f_harpreet_01",
    name: name || "New Plot",
    area_killa: killa,
    area_kanals: killa * 8,
    crop: crop || "KINNOW_MANDARIN",
    variety: variety || "Kinnow",
    rootstock: crop === 'KINNOW_MANDARIN' ? "Jatti Khatti" : null,
    planting_year: 2024,
    tree_count: crop === 'KINNOW_MANDARIN' ? Math.round(killa * 110) : 0,
    soil_type: soil_type || "Sandy Loam",
    soil_ph: 7.6,
    organic_carbon_pct: 0.42,
    water_tds_ppm: 1200,
    irrigation_source: irrigation_source || "Canal + Tubewell",
    tenure_type: tenure_type || "OWNED",
    current_stage: "ESTABLISHMENT_STAGE",
    stage_days: 12,
    next_stage: "FLOWERING_FLUSH",
    days_to_next: 45,
    active_phi_lock: null,
    created_at: new Date().toISOString()
  };

  store.plots.push(newPlot);
  db.saveStore(store);
  res.json({ success: true, plot: newPlot });
});

// Toggle Task Completion
router.post('/advisory/tasks/toggle', (req, res) => {
  const { task_id, completed } = req.body;
  const store = db.getStore();
  if (!store.completed_tasks) store.completed_tasks = {};
  store.completed_tasks[task_id] = !!completed;
  db.saveStore(store);
  res.json({ success: true, task_id, completed: !!completed });
});

// Diagnosis History
router.get('/diagnosis/history', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, diagnoses: store.diagnoses || [] });
});

// Market Analytics (7-day prices and expense breakdown)
router.get('/market/analytics', (req, res) => {
  const store = db.getStore();
  const ledger = store.ledger || [];

  const categories = {};
  ledger.filter(l => l.type === 'EXPENSE').forEach(l => {
    const cat = l.category || 'OTHER';
    categories[cat] = (categories[cat] || 0) + (l.amount_inr || 0);
  });

  // 7-day Mandi price curve (Abohar vs Sri Ganganagar)
  const priceCurve = [
    { date: "01 Oct", abohar: 30.5, ganganagar: 32.0 },
    { date: "02 Oct", abohar: 31.0, ganganagar: 32.5 },
    { date: "03 Oct", abohar: 31.2, ganganagar: 33.0 },
    { date: "04 Oct", abohar: 32.0, ganganagar: 34.0 },
    { date: "05 Oct", abohar: 32.8, ganganagar: 34.5 },
    { date: "06 Oct", abohar: 33.2, ganganagar: 35.0 },
    { date: "07 Oct", abohar: 34.5, ganganagar: 36.2 }
  ];

  res.json({
    success: true,
    price_curve: priceCurve,
    expense_categories: categories
  });
});

// Scheme Application Submission
router.post('/schemes/apply', (req, res) => {
  const { scheme_id, applicant_name, applicant_phone, land_size_killa, documents_ready } = req.body;
  const store = db.getStore();
  if (!store.scheme_applications) store.scheme_applications = [];

  const newApp = {
    id: `app_${Date.now()}`,
    scheme_id: scheme_id || 'sch_midh_drip',
    applicant_name: applicant_name || 'Harpreet Singh',
    applicant_phone: applicant_phone || '+919876543210',
    land_size_killa: parseFloat(land_size_killa) || 3.0,
    status: 'SUBMITTED_FOR_VERIFICATION',
    status_label_pa: 'ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਹੋ ਗਈ (ਪੜਤਾਲ ਅਧੀਨ)',
    assigned_officer: 'Dr. Balwinder Singh Brar (HDO Abohar)',
    documents_ready: documents_ready || ['Jamabandi', 'Aadhaar', 'Passbook'],
    applied_at: new Date().toISOString()
  };

  store.scheme_applications.unshift(newApp);
  db.saveStore(store);
  res.json({ success: true, application: newApp });
});

router.get('/schemes/applications', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, applications: store.scheme_applications || [] });
});

// Admin Triage Queue
router.get('/curation/triage-cases', (req, res) => {
  const store = db.getStore();
  res.json({ success: true, cases: store.diagnoses || [] });
});

module.exports = router;
