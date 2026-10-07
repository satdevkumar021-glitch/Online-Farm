function recommendAlternatives(farmerProfile, areaKilla = 2.0) {
  // Models catalog for South-Western Punjab (Fazilka / Abohar)
  const models = [
    {
      id: "guava_high_density",
      title_en: "High-Density Guava (VNR Bihi / Shweta) with Drip",
      title_pa: "ਹਾਈ ਡੈਂਸਿਟੀ ਅਮਰੂਦ (ਸ਼ਵੇਤਾ / VNR ਬਿਹੀ) ਤੁਪਕਾ ਸਿੰਚਾਈ ਸਮੇਤ",
      title_hi: "सघन अमरूद बागवानी (श्वेता/वीएनआर) ड्रिप सिंचाई के साथ",
      gestation_months: 18,
      setup_cost_per_killa: 55000,
      subsidy_available_pct: 80,
      net_capex_per_killa: 27500,
      expected_net_annual_inr: 72500,
      water_need: "MEDIUM_LOW",
      risk_rating: "LOW",
      herd_adoption_pct: 4.2, // Low risk of market glut
      pilot_plan_1_kanal: "Try on 1 kanal (55 trees) along boundary; setup cost ₹3,500 after MIDH subsidy."
    },
    {
      id: "low_tunnel_vegetables_mushrooms",
      title_en: "Low-Tunnel Vegetables (Capsicum/Cucumber) + Oyster Mushroom Room",
      title_pa: "ਲੋਅ-ਟਨਲ ਬੇਮੌਸਮੀ ਸਬਜ਼ੀਆਂ + ਢੀਂਗਰੀ ਖੁੰਬ (Oyster Mushroom) ਯੂਨਿਟ",
      title_hi: "लो-टनल सब्जियां (शिमला मिर्च/खीरा) + ढींगरी मशरूम कमरा",
      gestation_months: 2,
      setup_cost_per_killa: 47500,
      subsidy_available_pct: 50,
      net_capex_per_killa: 28500,
      expected_net_annual_inr: 90000,
      water_need: "LOW",
      risk_rating: "MEDIUM",
      herd_adoption_pct: 6.8,
      pilot_plan_1_kanal: "Start 2 tunnels (100 ft length) + 200 bags mushroom shed in courtyard. First income in 45 days."
    },
    {
      id: "rehabilitate_kinnow_ipm",
      title_en: "Rejuvenate Existing Kinnow (PAU Soil & Basin Protocol)",
      title_pa: "ਮੌਜੂਦਾ ਕਿੰਨੂ ਬਾਗ਼ ਦਾ ਸੁਧਾਰ (ਪੀ.ਏ.ਯੂ. ਰਿੰਗ-ਬੇਸਿਨ ਵਿਧੀ + ਫਲ ਮੱਖੀ ਟਰੈਪ)",
      title_hi: "मौजूदा किन्नू बाग सुधार (पीएयू बेसिन तकनीक + फेरोमोन ट्रैप)",
      gestation_months: 3,
      setup_cost_per_killa: 6000,
      subsidy_available_pct: 0,
      net_capex_per_killa: 6000,
      expected_net_annual_inr: 45000,
      water_need: "HIGH",
      risk_rating: "MEDIUM",
      herd_adoption_pct: 0.0,
      pilot_plan_1_kanal: "Implement ring-basin isolation on 16 trees; install 4 pheromone traps and record drop reduction."
    }
  ];

  return {
    farmer_land_killa: areaKilla,
    analysis_date: "2026-10-07",
    advisory_strategy: "Staged Transition (Never switch 100% of the farm at once; maintain cash flow from existing land while piloting high-value models on 1 to 2 kanals).",
    recommended_options: models.map(m => {
      const antiHerdFactor = Math.max(0, 1 - (m.herd_adoption_pct / 20.0));
      const totalCapex = m.net_capex_per_killa * areaKilla;
      const expectedAnnualNet = m.expected_net_annual_inr * areaKilla;
      return {
        ...m,
        score: parseFloat((antiHerdFactor * 0.95).toFixed(2)),
        total_investment_for_farm: totalCapex,
        expected_annual_net_income: expectedAnnualNet
      };
    })
  };
}

module.exports = { recommendAlternatives };
