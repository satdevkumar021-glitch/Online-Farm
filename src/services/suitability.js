function evaluateSuitability(plotParams, targetCrop = 'KINNOW_MANDARIN') {
  const { soil_ph = 7.8, water_tds_ppm = 1450, soil_type = 'Sandy Loam', waterlogging_risk = 'LOW' } = plotParams;

  // Convert TDS to approximate ECw (dS/m) -> TDS / 640
  const ec_w = water_tds_ppm / 640;

  // Lethal Hard Caps for Citrus
  if (soil_ph > 9.0 || soil_ph < 5.5) {
    return {
      crop: targetCrop,
      score: 0.20,
      classification: 'UNSUITABLE',
      limiting_factor: 'Soil pH is extreme. High alkalinity/acidity leads to severe micronutrient lockout.',
      amendments: ['Apply elemental sulphur or gypsum based on laboratory ESP test.']
    };
  }

  if (ec_w > 3.0) {
    return {
      crop: targetCrop,
      score: 0.30,
      classification: 'UNSUITABLE_HIGH_SALINITY',
      limiting_factor: `Water TDS (${water_tds_ppm} ppm / ${ec_w.toFixed(2)} dS/m) exceeds the safe threshold of 2.0 dS/m for citrus. Causes leaf margin scorch and fruit drop.`,
      amendments: ['Do not use tubewell water alone. Must blend canal water in at least 2:1 ratio.']
    };
  }

  // Parameter scoring
  let phScore = 1.0;
  if (soil_ph > 8.2) phScore = 0.6;
  else if (soil_ph > 7.8) phScore = 0.85;

  let waterScore = 1.0;
  if (ec_w > 2.0) waterScore = 0.55;
  else if (ec_w > 1.4) waterScore = 0.75;

  let soilScore = 0.9;
  if (soil_type.toLowerCase().includes('sandy loam')) soilScore = 1.0;
  else if (soil_type.toLowerCase().includes('clay')) soilScore = 0.5;

  const compositeScore = (0.35 * phScore) + (0.35 * waterScore) + (0.30 * soilScore);

  let classification = 'MODERATE';
  if (compositeScore >= 0.85) classification = 'HIGH';
  else if (compositeScore < 0.60) classification = 'MARGINAL';

  return {
    crop: targetCrop,
    score: parseFloat(compositeScore.toFixed(2)),
    classification,
    parameters_analyzed: {
      soil_ph: { value: soil_ph, status: soil_ph <= 8.0 ? 'Optimal' : 'Slightly Alkaline' },
      water_tds: { value: `${water_tds_ppm} ppm`, status: ec_w <= 1.5 ? 'Good' : 'Moderately Saline' },
      soil_type: { value: soil_type, status: 'Favorable for Drainage' }
    },
    recommendations: [
      'Blend canal water with tubewell water when irrigating during hot summer months.',
      'Add 10-15 tonnes of farmyard manure (Desi Roodi) per acre annually to buffer soil alkalinity.',
      'Use drip irrigation with fertigation to avoid salt accumulation near tree trunks.'
    ]
  };
}

module.exports = { evaluateSuitability };
