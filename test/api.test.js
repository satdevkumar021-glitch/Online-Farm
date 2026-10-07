const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { validateProduct, calculateDosage, checkTankMixCompatibility } = require('../src/services/safetyEngine');
const { evaluateSuitability } = require('../src/services/suitability');
const { recommendAlternatives } = require('../src/services/recommender');
const { diagnoseSymptoms } = require('../src/services/visionTriage');
const { processVoiceAssistantQuery } = require('../src/services/ragAssistant');

test('1. Database Store returns Farmer Profile Harpreet Singh in Balluana', () => {
  const store = db.getStore();
  assert.ok(store.farmers && store.farmers.length > 0);
  const farmer = store.farmers.find(f => f.id === 'f_harpreet_01') || store.farmers[0];
  assert.strictEqual(farmer.name, 'Harpreet Singh');
  assert.strictEqual(farmer.village, 'Balluana');
  assert.strictEqual(farmer.block, 'Abohar');
  assert.strictEqual(farmer.district, 'Fazilka');
  assert.strictEqual(farmer.preferred_language, 'pa');
});

test('2. Plots reflect Kinnow 8-year orchard with Fruit Sizing phenology and water TDS', () => {
  const store = db.getStore();
  const kinnow = store.plots.find(p => p.crop === 'KINNOW_MANDARIN');
  assert.ok(kinnow);
  assert.strictEqual(kinnow.area_killa, 3.0);
  assert.strictEqual(kinnow.current_stage, 'FRUIT_SIZING_AND_COLOR_BREAK');
  assert.strictEqual(kinnow.water_tds_ppm, 1450);
});

test('3. Chemical Safety Engine correctly validates approved vs banned chemicals', () => {
  // Test 3A: Approved chemical (Tilt 25 EC / Propiconazole)
  const approved = validateProduct('Tilt 25 EC');
  assert.strictEqual(approved.found, true);
  assert.strictEqual(approved.is_banned, false);
  assert.strictEqual(approved.product.phi_days, 30);
  assert.strictEqual(approved.product.dose_per_200l_drum, '200 ml');

  // Test 3B: Banned chemical (Monocrotophos)
  const banned = validateProduct('Monocrotophos 36 SL');
  assert.strictEqual(banned.found, true);
  assert.strictEqual(banned.is_banned, true);
  assert.ok(banned.safety_alert.includes('BANNED'));
});

test('4. Dosage calculation calculates exact dilution per 200-litre drum', () => {
  const dose = calculateDosage('cib_propiconazole_25ec', 200);
  assert.strictEqual(dose.recommended_dose, '200 ml');
  assert.strictEqual(dose.pre_harvest_interval_days, 30);
  assert.ok(dose.pau_source.includes('PAU'));
});

test('5. Tank-mix compatibility matrix prevents phytotoxic / dangerous chemical combinations', () => {
  // Safe combination: Propiconazole + Potassium Nitrate
  const safeMix = checkTankMixCompatibility('Tilt', 'Potassium Nitrate');
  assert.strictEqual(safeMix.compatible, true);
  assert.strictEqual(safeMix.status, 'COMPATIBLE_SAFE');

  // Dangerous combination: Tilt + Copper Oxychloride (Causes leaf scorch/precipitation)
  const dangerMix = checkTankMixCompatibility('Tilt', 'Copper Oxychloride');
  assert.strictEqual(dangerMix.compatible, false);
  assert.strictEqual(dangerMix.status, 'INCOMPATIBLE_DANGEROUS');
});

test('6. Land Suitability Engine evaluates soil pH and salinity against hard lethal caps', () => {
  // Moderately saline Abohar plot parameters (1450 ppm requires blending)
  const moderateResult = evaluateSuitability({ soil_ph: 7.8, water_tds_ppm: 1450, soil_type: 'Sandy Loam' });
  assert.strictEqual(moderateResult.classification, 'MODERATE');
  assert.strictEqual(moderateResult.score >= 0.75, true);

  // Optimal sweet water plot parameters (800 ppm)
  const optimalResult = evaluateSuitability({ soil_ph: 7.5, water_tds_ppm: 800, soil_type: 'Sandy Loam' });
  assert.strictEqual(optimalResult.classification, 'HIGH');
  assert.strictEqual(optimalResult.score >= 0.85, true);

  // High Salinity breach test (EC > 3.0 dS/m -> TDS > 2000 ppm)
  const salineResult = evaluateSuitability({ soil_ph: 8.2, water_tds_ppm: 2600, soil_type: 'Sandy Loam' });
  assert.strictEqual(salineResult.classification, 'UNSUITABLE_HIGH_SALINITY');
  assert.ok(salineResult.score < 0.4);
});

test('7. Alternative Crop Recommender calculates MCDA scores with anti-herd protection', () => {
  const recs = recommendAlternatives({ id: 'f_01' }, 2.0);
  assert.ok(recs.recommended_options.length >= 3);
  const guava = recs.recommended_options.find(r => r.id === 'guava_high_density');
  assert.ok(guava);
  assert.strictEqual(guava.gestation_months, 18);
  assert.strictEqual(guava.subsidy_available_pct, 80);
});

test('8. Diagnosis Engine produces 3-track action plan (Cultural, Biological, Chemical)', () => {
  const diag = diagnoseSymptoms({ symptom_type: 'fruit_drop', plot_id: 'plot_01_kinnow' });
  const p = diag.primary_diagnosis;
  assert.ok(p.actions.track_1_cultural);
  assert.ok(p.actions.track_2_biological);
  assert.ok(p.actions.track_3_chemical);
  assert.strictEqual(p.confidence, 0.88);
  assert.strictEqual(p.escalation.expert_name, 'Dr. P. K. Arora (Senior Entomologist)');
});

test('9. Voice AI Assistant executes strict safety & crisis guardrails', () => {
  // 9A: Distress / Crisis Emergency Intercept
  const distress = processVoiceAssistantQuery('Karza bahut hai, zehar peen laga haan', 'pa');
  assert.strictEqual(distress.is_emergency, true);
  assert.strictEqual(distress.type, 'DISTRESS_INTERCEPT');
  assert.ok(distress.response_pa.includes('1800-180-1551'));

  // 9B: Banned Chemical Prompt -> Blocked
  const banned = processVoiceAssistantQuery('Monocrotophos spray kar sakde aan?', 'pa');
  assert.strictEqual(banned.type, 'BANNED_CHEMICAL_BLOCK');
  assert.ok(banned.response_pa.includes('ਪਾਬੰਦੀਸ਼ੁਦਾ'));

  // 9C: Verified Dosage Query -> Zero Hallucination
  const dosage = processVoiceAssistantQuery('Kinnow te Tilt kinni pawa?', 'pa');
  assert.strictEqual(dosage.type, 'VERIFIED_DOSAGE');
  assert.ok(dosage.response_pa.includes('200 ਮਿਲੀਲੀਟਰ'));
  assert.strictEqual(dosage.phi_days, 30);
});

test('10. Verified Support Directory and Schemes match pilot region', () => {
  const schemes = db.getSchemes().schemes;
  const officers = db.getDirectory().officers;

  assert.ok(schemes.some(s => s.id === 'sch_midh_drip'));
  assert.ok(schemes.some(s => s.id === 'sch_pm_kusum_b'));

  const hdo = officers.find(o => o.id === 'off_01_hdo_abohar');
  assert.ok(hdo);
  assert.strictEqual(hdo.name, 'Dr. Balwinder Singh Brar');
  assert.ok(hdo.jurisdiction.includes('Abohar'));
});

test('11. Authentication & OTP Verification flow operates smoothly', async () => {
  const express = require('express');
  const apiRoutes = require('../src/routes/api');
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRoutes);

  // Helper to mock express calls
  const mockReqRes = (handler, body = {}) => {
    return new Promise((resolve) => {
      const req = { body, params: {}, query: {} };
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ status: this.statusCode, data }); }
      };
      handler(req, res);
    });
  };

  // Find the route handlers in apiRoutes.stack
  const sendRoute = apiRoutes.stack.find(s => s.route && s.route.path === '/auth/otp/send').route.stack[0].handle;
  const verifyRoute = apiRoutes.stack.find(s => s.route && s.route.path === '/auth/otp/verify').route.stack[0].handle;

  // 11A: Send OTP
  const sendRes = await mockReqRes(sendRoute, { phone: '9876543210', language: 'pa' });
  assert.strictEqual(sendRes.status, 200);
  assert.strictEqual(sendRes.data.success, true);
  assert.strictEqual(sendRes.data.demo_otp, '4921');

  // 11B: Verify OTP
  const verifyRes = await mockReqRes(verifyRoute, { phone: '9876543210', otp: '4921', is_krishi_mitra: false });
  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.data.success, true);
  assert.ok(verifyRes.data.token.includes('token_'));
  assert.strictEqual(verifyRes.data.farmer.name, 'Harpreet Singh');
});
