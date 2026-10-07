const { getCatalog } = require('../db');

function validateProduct(queryText) {
  const catalog = getCatalog();
  const products = catalog.products || [];
  const normalizedQuery = queryText.toLowerCase().trim();

  // Search by trade name or active ingredient
  const match = products.find(p => {
    const tradeMatch = p.trade_names.some(t => normalizedQuery.includes(t.toLowerCase()) || t.toLowerCase().includes(normalizedQuery));
    const activeMatch = p.active_ingredient.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(p.active_ingredient.toLowerCase().split(' ')[0]);
    return tradeMatch || activeMatch;
  });

  if (!match) {
    return {
      found: false,
      message: 'Product not found in official CIB&RC regional registry. Consult local ADO before purchase.'
    };
  }

  const isBanned = match.cibrc_status.includes('BANNED') || match.cibrc_status.includes('RESTRICTED');

  return {
    found: true,
    product: match,
    is_banned: isBanned,
    safety_alert: isBanned ? match.warning : null
  };
}

function calculateDosage(productId, waterVolumeLitres = 200) {
  const catalog = getCatalog();
  const product = (catalog.products || []).find(p => p.id === productId);

  if (!product) {
    return { error: 'Unknown product' };
  }

  if (product.cibrc_status.includes('BANNED')) {
    return {
      error: 'CRITICAL: This product is BANNED. Dosage is ZERO. Do not apply.',
      is_banned: true
    };
  }

  // Parse numerical rate
  const ratePerLitreStr = product.dose_per_litre; // e.g. "1.0 ml" or "2.5 g" or "10.0 g"
  const match = ratePerLitreStr.match(/([\d.]+)\s*([a-zA-Z]+)/);

  let totalDose = 'Refer to label';
  let unit = 'units';
  if (match) {
    const num = parseFloat(match[1]);
    unit = match[2];
    const total = num * waterVolumeLitres;
    totalDose = total >= 1000 && unit === 'g' ? `${(total / 1000).toFixed(2)} kg` : `${total} ${unit}`;
  }

  return {
    product_name: product.trade_names[0],
    active_ingredient: product.active_ingredient,
    water_volume_litres: waterVolumeLitres,
    recommended_dose: totalDose,
    dose_per_litre: product.dose_per_litre,
    pre_harvest_interval_days: product.phi_days,
    toxicity_triangle: product.toxicity_triangle,
    pau_source: product.pau_source
  };
}

function checkTankMixCompatibility(productNameA, productNameB) {
  const prodA = validateProduct(productNameA);
  const prodB = validateProduct(productNameB);

  if (!prodA.found || !prodB.found) {
    return {
      compatible: false,
      status: 'UNKNOWN_PRODUCT',
      message: 'One or both chemicals could not be verified in the CIB&RC catalog. Mixing unverified chemicals is not advised.'
    };
  }

  if (prodA.is_banned || prodB.is_banned) {
    return {
      compatible: false,
      status: 'BANNED_CHEMICAL',
      message: 'Mixing refused: Contains legally banned substance.'
    };
  }

  const pA = prodA.product;
  const pB = prodB.product;

  // Check explicit incompatibilities
  const isIncompatible = pA.incompatible_mixes.some(item => 
    pB.trade_names.some(t => t.toLowerCase().includes(item.toLowerCase())) ||
    pB.active_ingredient.toLowerCase().includes(item.toLowerCase())
  ) || pB.incompatible_mixes.some(item => 
    pA.trade_names.some(t => t.toLowerCase().includes(item.toLowerCase())) ||
    pA.active_ingredient.toLowerCase().includes(item.toLowerCase())
  );

  if (isIncompatible) {
    return {
      compatible: false,
      status: 'INCOMPATIBLE_DANGEROUS',
      message: `DANGER: Do NOT mix ${pA.trade_names[0]} with ${pB.trade_names[0]}. This combination can cause severe leaf scorch (phytotoxicity) or precipitation in the spray tank.`,
      action: 'Apply these two sprays separately with at least 7 to 10 days gap.'
    };
  }

  return {
    compatible: true,
    status: 'COMPATIBLE_SAFE',
    message: `SAFE: ${pA.trade_names[0]} and ${pB.trade_names[0]} are compatible in a standard 200-litre drum. Dissolve each product separately in clean water buckets before combining in the spray drum.`
  };
}

module.exports = {
  validateProduct,
  calculateDosage,
  checkTankMixCompatibility
};
