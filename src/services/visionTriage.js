function diagnoseSymptoms(inputPayload) {
  const { symptom_type = 'fruit_drop', plot_id = 'plot_01_kinnow', photo_count = 3 } = inputPayload;

  // Real-world knowledge base for citrus disorders in Abohar
  const issues = {
    fruit_drop_fruit_fly: {
      name_en: "Citrus Fruit Fly Attack & Secondary Rot",
      name_pa: "ਫ਼ਲ ਦੀ ਮੱਖੀ ਦਾ ਹਮਲਾ ਅਤੇ ਕਿੰਨੂ ਦਾ ਕੇਰਾ",
      name_hi: "फल मक्खी का हमला एवं किन्नू फल झड़न",
      scientific_name: "Bactrocera dorsalis (Hendel)",
      confidence: 0.88,
      symptoms_confirmed: [
        "Tiny puncture hole on lower fruit surface with water-soaked yellow halo",
        "Premature fruit yellowing and dropping around basin",
        "Soft rot inside dropped fruit upon splitting"
      ],
      actions: {
        track_1_cultural: {
          title: "Desi / Cultural Sanitation (Zero / Low Cost)",
          cost_inr: 50,
          steps: [
            "Collect all dropped fruit from tree basins every 2 days.",
            "Bury collected fruit in a 2-foot deep pit with lime powder. Do NOT throw in canal or manure pit."
          ]
        },
        track_2_biological: {
          title: "Biological / IPM Control",
          cost_inr: 220,
          steps: [
            "Install 16 PAU Fruit Fly Traps (Methyl Eugenol lure) per acre.",
            "Hang traps at 5 feet height inside shaded tree canopy facing east."
          ]
        },
        track_3_chemical: {
          title: "Official PAU Chemical Recommendation",
          cost_inr: 580,
          steps: [
            "Spray Decamethrin 2.8 EC @ 200 ml in 200 Litres water per acre OR",
            "Spray Bait: Malathion 50 EC @ 400 ml + 2 kg Jaggery (Gur) dissolved in 200 Litres water.",
            "Pre-Harvest Interval (PHI): 7 Days. Cease spray 1 week before fruit picking."
          ]
        }
      },
      escalation: {
        expert_name: "Dr. P. K. Arora (Senior Entomologist)",
        institution: "KVK Abohar / PAU Fruit Research Station",
        phone: "+911634222450"
      }
    },
    colletotrichum_fungal_drop: {
      name_en: "Anthracnose / Pathological Fruit Drop",
      name_pa: "ਉੱਲੀ ਰੋਗ ਕਾਰਨ ਫਲ ਕੇਰਾ (ਕੋਲੇਟੋਟ੍ਰਾਈਕਮ)",
      name_hi: "एंथ्रेक्नोज फफूंद जनित फल सड़न",
      scientific_name: "Colletotrichum gloeosporioides",
      confidence: 0.82,
      symptoms_confirmed: [
        "Dark brown or black necrotic ring around button (fruit calyx)",
        "Fruit drops leaving stalk attached to twig",
        "Twig dieback in upper canopy"
      ],
      actions: {
        track_1_cultural: {
          title: "Pruning & Sunlight Sanitation",
          cost_inr: 200,
          steps: [
            "Prune dried and infected twigs 2 inches below infection zone.",
            "Avoid excessive water ponding around root collar."
          ]
        },
        track_2_biological: {
          title: "Bio-Protection",
          cost_inr: 350,
          steps: ["Soil application of Trichoderma viride enriched with well-rotted FYM."]
        },
        track_3_chemical: {
          title: "PAU Approved Systemic Fungicide",
          cost_inr: 640,
          steps: [
            "Spray Propiconazole 25 EC (Tilt) @ 200 ml in 200 Litres water drum per acre.",
            "PHI Lock: 30 Days before harvest."
          ]
        }
      },
      escalation: {
        expert_name: "Dr. Balwinder Singh (Horticulture Officer)",
        institution: "Dept of Horticulture, Abohar",
        phone: "+919814233211"
      }
    }
  };

  const selectedKey = symptom_type === 'fruit_drop' ? 'fruit_drop_fruit_fly' : 'colletotrichum_fungal_drop';
  return {
    case_id: `diag_${Date.now()}`,
    plot_id,
    photo_count,
    processed_at: new Date().toISOString(),
    primary_diagnosis: issues[selectedKey],
    secondary_candidate: issues.colletotrichum_fungal_drop,
    requires_human_triage: false
  };
}

module.exports = { diagnoseSymptoms };
