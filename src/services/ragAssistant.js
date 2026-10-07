const { validateProduct, calculateDosage } = require('./safetyEngine');
const { getCatalog, getRadar, getSchemes, getDirectory } = require('../db');

function processVoiceAssistantQuery(userText, language = 'pa') {
  const query = (userText || '').toLowerCase().trim();

  // 1. TIER 1 SAFETY GUARDRAIL: Mental distress / poison / self-harm emergency
  const distressKeywords = ['karza', 'karz', 'zahar', 'mar jana', 'suicide', 'marna', 'poison', 'debt stress', 'zehar'];
  const isDistress = distressKeywords.some(k => query.includes(k));

  if (isDistress) {
    return {
      is_emergency: true,
      type: 'DISTRESS_INTERCEPT',
      response_pa: 'ਹਰਪ੍ਰੀਤ ਜੀ, ਕਿਰਪਾ ਕਰਕੇ ਹੌਸਲਾ ਰੱਖੋ। ਅਸੀਂ ਤੁਹਾਡੀ ਹਰ ਸੰਭਵ ਮਦਦ ਲਈ ਤਿਆਰ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਹੁਣੇ ਕਿਸਾਨ ਹੈਲਪਲਾਈਨ 1800-180-1551 ਜਾਂ ਮੁਫ਼ਤ ਮਾਨਸਿਕ ਸਹਾਇਤਾ ਲਈ 9152987821 \'ਤੇ ਗੱਲ ਕਰੋ। ਤੁਹਾਡੀ ਜ਼ਿੰਦਗੀ ਪਰਿਵਾਰ ਲਈ ਅਨਮੋਲ ਹੈ।',
      response_hi: 'किसान साथी, कृपया हौसला रखें। हम आपकी हर संभव सहायता के लिए तत्पर हैं। कृपया तुरंत किसान हेल्पलाइन 1800-180-1551 या मानसिक संबल हेल्पलाइन 9152987821 पर निःशुल्क कॉल करें। आपका जीवन अनमोल है।',
      response_en: 'We are here to support you. Please immediately reach out to the National Kisan Helpline at 1800-180-1551 or 9152987821 for compassionate, confidential assistance.',
      emergency_contacts: [
        { name: 'Kisan Call Centre (Toll Free)', number: '1800-180-1551' },
        { name: 'National Crisis Lifeline', number: '9152987821' },
        { name: 'National Poison Information Centre', number: '1800-116-117' }
      ]
    };
  }

  // 2. TIER 2 SAFETY GUARDRAIL: Banned chemicals check
  if (query.includes('monocrotophos') || query.includes('furadan') || query.includes('endosulfan') || query.includes('paraquat')) {
    return {
      is_emergency: false,
      type: 'BANNED_CHEMICAL_BLOCK',
      response_pa: 'ਸਾਵਧਾਨ! ਮੋਨੋਕ੍ਰੋਟੋਫੋਸ ਅਤੇ ਫਿਊਰਾਡਾਨ ਫ਼ਲਦਾਰ ਬਾਗ਼ਾਂ ਵਿੱਚ ਭਾਰਤ ਸਰਕਾਰ ਵੱਲੋਂ ਪੂਰੀ ਤਰ੍ਹਾਂ ਪਾਬੰਦੀਸ਼ੁਦਾ ਹਨ। ਇਹ ਦਵਾਈਆਂ ਮਨੁੱਖੀ ਸਿਹਤ ਅਤੇ ਵਾਤਾਵਰਨ ਲਈ ਖ਼ਤਰਨਾਕ ਹਨ। ਪੀ.ਏ.ਯੂ. ਵੱਲੋਂ ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀਆਂ ਸੁਰੱਖਿਅਤ ਦਵਾਈਆਂ ਹੀ ਵਰਤੋ।',
      response_hi: 'सावधान! मोनोक्रोटोफॉस और फ्युराडान फलदार फसलों पर भारत सरकार द्वारा पूर्णतः प्रतिबंधित हैं। यह स्वास्थ्य के लिए हानिकारक हैं। केवल अनुमोदित दवाओं का उपयोग करें।',
      response_en: 'Warning: Monocrotophos and Carbofuran/Furadan are legally banned on fruits in India. Do not purchase or spray them.',
      action: 'VIEW_SAFE_ALTERNATIVES'
    };
  }

  // 3. INTENT: Dosage calculation
  if (query.includes('dose') || query.includes('kinni pawa') || query.includes('matra') || query.includes('kitna dalein') || query.includes('tilt') || query.includes('propiconazole')) {
    const calc = calculateDosage('cib_propiconazole_25ec', 200);
    return {
      is_emergency: false,
      type: 'VERIFIED_DOSAGE',
      response_pa: `ਪੀ.ਏ.ਯੂ. ਦੀ ਸਿਫ਼ਾਰਸ਼: ਕਿੰਨੂ ਦੇ 200 ਲੀਟਰ ਵਾਲੇ ਡਰੱਮ ਵਿੱਚ ਟਿਲਟ (Propiconazole 25 EC) 200 ਮਿਲੀਲੀਟਰ (1 ਮਿਲੀਲੀਟਰ ਪ੍ਰਤੀ ਲੀਟਰ) ਪਾਓ। ਤੋੜਾਈ ਤੋਂ 30 ਦਿਨ ਪਹਿਲਾਂ ਸਪਰੇਅ ਬੰਦ ਰੱਖੋ।`,
      response_hi: `पीएयू सिफारिश: किन्नू के 200 लीटर ड्रम में टिल्ट (प्रोपिकोनाज़ोल 25 ईसी) 200 मिलीलीटर (1 मिली प्रति लीटर) मिलाएं। फल तुड़ाई से 30 दिन पहले तक ही छिड़कें।`,
      response_en: `Official PAU Recommendation: Mix 200 ml of Propiconazole 25% EC (Tilt) per 200-Litre water drum (1.0 ml/Litre). Pre-Harvest Interval (PHI) is 30 days.`,
      source: calc.pau_source,
      phi_days: calc.pre_harvest_interval_days
    };
  }

  // 4. INTENT: Mandi Bhav
  if (query.includes('mandi') || query.includes('bhav') || query.includes('price') || query.includes('rate') || query.includes('bha')) {
    return {
      is_emergency: false,
      type: 'MANDI_RATES',
      response_pa: 'ਅੱਜ ਅਬੋਹਰ ਮੰਡੀ ਵਿੱਚ ਵਧੀਆ ਕਿੰਨੂ (Grade-A Waxed) ਦਾ ਭਾਅ ₹32 ਤੋਂ ₹34.50 ਪ੍ਰਤੀ ਕਿੱਲੋ ਹੈ। ਗੰਗਾਨਗਰ ਮੰਡੀ ਵਿੱਚ ₹35 ਤੋਂ ₹36.20 ਪ੍ਰਤੀ ਕਿੱਲੋ ਚੱਲ ਰਿਹਾ ਹੈ।',
      response_hi: 'आज अबोहर मंडी में ग्रेड-ए किन्नू का भाव ₹32 से ₹34.50 प्रति किलो है। श्रीगंगानगर मंडी में ₹35 से ₹36.20 प्रति किलो चल रहा है।',
      response_en: 'Today in Abohar APMC, Grade-A Kinnow is trading between ₹32.00 to ₹34.50 per kg. In Sri Ganganagar, it is ₹35.00 to ₹36.20 per kg.'
    };
  }

  // 5. INTENT: Subsidies / Schemes
  if (query.includes('scheme') || query.includes('subsidy') || query.includes('yojana') || query.includes('drip') || query.includes('solar')) {
    return {
      is_emergency: false,
      type: 'SCHEMES_GUIDE',
      response_pa: 'ਤੁਹਾਡੇ ਲਈ 3 ਸਕੀਮਾਂ ਮੌਜੂਦ ਨੇ: 1. ਕਿੰਨੂ ਬਾਗ਼ ਲਈ ਤੁਪਕਾ ਸਿੰਚਾਈ (ਡਰਿੱਪ) ' + "'ਤੇ 80% ਸਬਸਿਡੀ। 2. ਸੋਲਰ ਪੰਪ (PM-KUSUM) 'ਤੇ 60% ਸਬਸਿਡੀ। 3. ਫ਼ਸਲੀ ਵਿਭਿੰਨਤਾ ਪ੍ਰੋਤਸਾਹਨ ₹7,000 ਪ੍ਰਤੀ ਏਕੜ।",
      response_hi: 'आपके लिए 3 योजनाएं उपलब्ध हैं: 1. किन्नू ड्रिप पर 80% सब्सिडी। 2. सोलर पंप पर 60% सब्सिडी। 3. फसल विविधीकरण ₹7,000 प्रति एकड़।',
      response_en: 'Top 3 matched schemes for your farm: 1. Drip irrigation 80% subsidy. 2. Solar pump (PM-KUSUM) 60% subsidy. 3. Crop diversification ₹7,000/acre.'
    };
  }

  // General fallback with helpful guidance
  return {
    is_emergency: false,
    type: 'GENERAL_ASSISTANCE',
    response_pa: 'ਮੈਂ ਕਿਸਾਨ ਸਾਥੀ ਹਾਂ। ਤੁਸੀਂ ਮੇਰੇ ਤੋਂ ਫ਼ਸਲ ਰੋਗ, ਸਪਰੇਅ ਦੀ ਸਹੀ ਮਾਤਰਾ, ਅੱਜ ਦਾ ਮੰਡੀ ਭਾਅ, ਮੌਸਮ ਜਾਂ ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਬਾਰੇ ਪੁੱਛ ਸਕਦੇ ਹੋ।',
    response_hi: 'मैं किसान साथी हूँ। आप मुझसे फसल रोग, स्प्रे की मात्रा, आज का मंडी भाव, मौसम या सरकारी योजनाओं के बारे में पूछ सकते हैं।',
    response_en: 'I am Kisan Sathi. You can ask me about crop diseases, verified spray dosages, mandi prices, weather forecast, or government subsidies.'
  };
}

module.exports = { processVoiceAssistantQuery };
