# 🌾 Kisan Sathi (ਕਿਸਾਨ ਸਾਥੀ) — Farm Manage System

> **A Mobile-First, Voice-Enabled, Offline-Capable Farm Companion for Small & Marginal Indian Farmers**
> **Pilot Cluster:** Abohar / Fazilka District, South-Western Punjab (Citrus & Field Crops Belt)

---

## 📖 Overview

**Kisan Sathi** is built specifically for smallholders (typically 1 to 5 acres) who operate under harsh outdoor conditions (bright sunlight, dusty hands, low-end 2GB RAM phones, patchy 2G/4G connectivity). 

It empowers farmers to **earn more, spend less, lose less, and take fewer risks** by:
1. **Unbiased Chemical Protection:** Eliminating dealer exploitation via instant camera/text lookup against the **CIB&RC master registry**, exact dosage calculators per 200L drum, and tank-mix compatibility checks.
2. **Local Problem Radar:** Warning farmers of verified pest/disease outbreaks (e.g., *Kinnow Fruit Drop & Fruit Fly*) within a 15 km geofence before they hit their orchards.
3. **Voice-First ("Mitti" Design System):** Full audio narration (TTS) and speech recognition (ASR) in **colloquial Malwai Punjabi**, **Hindi**, and **English**, coupled with high-contrast sunlight-glare-proof screens and minimum 56dp touch targets.
4. **Actionable Subsidies & Support:** Directly matching verified government subsidies (MIDH 80% Drip, PM-KUSUM 60% Solar Pump, Punjab Diversification ₹7,000/acre) and connecting farmers with designated local officers (HDO, ADO, KVK scientists).

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended; tested on v26)
- npm

### 1. Install & Run
```bash
# Navigate to the project directory
cd "/Users/satdevkumar/Desktop/Online Farm"

# Start the server (e.g. on port 5050)
PORT=5050 npm start
```
The application is live on:
👉 **`http://localhost:5050`**

### 2. Run Automated Test Suite
```bash
npm test
```
Runs 10 comprehensive in-memory unit and integration tests verifying agronomic safety, dosage math, suitability formulas, and crisis guardrails.

---

## 📱 Core Features & User Journeys (Abohar Pilot Demo)

The system is pre-seeded with the flagship profile of **Harpreet Singh** (Balluana Village, Abohar, Fazilka):
- **Orchard:** 3 Killas (24 Kanals) Kinnow Mandarin (8 years old, bearing stage on Jatti Khatti rootstock).
- **Water Source:** Canal water turn (*Warabandi*) scheduled for tonight at 2:40 AM + brackish tubewell (TDS 1,450 ppm).

### 0. "Login & Onboarding" (Authentication & Krishi Mitra Mode - F1)
- **Language Selection:** Voice-first prompts in **ਪੰਜਾਬੀ (Punjabi)**, **हिन्दी (Hindi)**, and **English**.
- **Mobile OTP Verification:** 10-digit mobile login with automatic OTP generation and demo verification code (`4921`).
- **1-Tap Instant Demo Login:** Immediate login as Harpreet Singh (3-acre Kinnow grower).
- **Assisted User (Krishi Mitra) Switch:** Toggle between individual farmer mode and village kiosk/operator mode.
- **Account Management & Logout:** Dedicated user profile sheet displaying farmer landholding, village details, language switcher, and logout functionality.

### 1. "Ajj da Kaam" (Today's Command Center)
- **Hourly Agromet Nowcast:** Real-time spray window evaluation ("Spray window open until 4:30 PM — Wind speed 7.2 km/h is below drift limit").
- **Canal Water Countdown:** Reminds farmer of tonight's 2:40 AM canal turn at Moga #22-R.
- **Regional Problem Radar:** Alerts that 38 neighboring orchards in Balluana reported Fruit Drop this week, with verified PAU action items.
- **Daily 3 Tasks:** Interactive checklist with cost and time estimates.
- **Mandi Rates Ticker:** Live prices from Abohar APMC (Grade-A Waxed ₹32–₹34.50/kg) and Sri Ganganagar APMC.

### 2. "Mera Khet" (Digital Twin of the Farm)
- **Lifecycle Tracker:** Visual stage stepper (Fruit Sizing & Color Break $\rightarrow$ Harvest Window in 34 days).
- **Soil & Water Health:** pH 7.8 (Optimal) and Water TDS 1,450 ppm (Moderately saline — blending guidance).
- **Land Suitability:** Evaluates plot against hard lethal caps.
- **Alternative Crops Explorer:** 7-factor MCDA engine recommending staged diversification (e.g. 1-kanal high-density guava or oyster mushroom pilot) with anti-herd saturation protection.

### 3. "Samasya / Ilaj" (Guided Diagnosis & Help)
- **3-Photo Guided Camera Viewfinder:** Real-time feedback for lighting and blur prevention.
- **3-Track Action Plan:**
  1. *Cultural / Sanitation:* Bury fallen fruit 2 feet deep (Cost: ₹50).
  2. *Biological / IPM:* Install 16 PAU pheromone traps per acre (Cost: ₹220).
  3. *Chemical (Strict PAU Label):* Decamethrin 2.8 EC @ 200 ml / 200L drum or Propiconazole 25 EC (Tilt) @ 200 ml / 200L drum (Cost: ₹580).
- **Direct Escalation:** 1-tap call to Dr. P.K. Arora (Senior Entomologist, KVK Abohar).

### 4. "Yojana" (Schemes & Subsidies)
- **Profile-Matched Benefits:**
  - *MIDH / PMKSY:* 80% Drip Irrigation Subsidy (Saves up to ₹48,000).
  - *PM-KUSUM Component-B:* 60% Solar Pump Subsidy (Saves up to ₹1,15,000).
  - *Punjab Crop Diversification:* ₹7,000/acre direct DBT.
- **Document Checklist:** Jamabandi/Fard, Aadhaar, Bank Passbook.

### 5. "Hor" (Input Vault, Directory, Ledger & Admin Workbench)
- **Input Vault (Chemical Bottle Scanner):**
  - Instant CIB&RC status lookup.
  - Banned chemical shield: Blocks toxic chemicals like *Monocrotophos* and *Furadan*.
  - Tank-mix checker: Prevents dangerous cocktails (e.g., Tilt + Copper Oxychloride = Severe phytotoxicity).
- **Verified Directory:** Contact info, office visiting hours, and "What to carry" for local officers.
- **Farm Ledger (Khata):** Tracks plot-wise expenses and net income per killa.
- **Admin Curation Workbench (F22):** Tool for agronomists to review alerts and sign off before publishing.

### 6. Persistent Omni-Mic (Kisan Sathi Voice AI)
- Floating microphone supporting natural spoken queries.
- **Multi-Tier Safety Guardrails:**
  - *Zero Chemical Hallucination:* Refuses to invent unverified dosages.
  - *Crisis Intercept:* Detects severe distress or debt panic and immediately serves the **National Kisan Helpline (1800-180-1551)** and crisis support numbers.

---

## 🛠️ Architecture & Tech Stack

```
Online Farm/
├── server.js              # Express REST API & static web server
├── package.json           # Dependencies and test runner
├── data/
│   ├── store.json         # File-backed database (Farmers, Plots, Activities, Ledger)
│   ├── catalog.json       # Curated CIB&RC chemical registry & PAU recommendations
│   ├── schemes.json       # Government subsidy rules & document checklists
│   ├── directory.json     # Verified officer directory for Fazilka district
│   └── radar.json         # Active regional alerts and daily APMC prices
├── src/
│   ├── routes/
│   │   └── api.js         # Unified REST API router (/api/v1/*)
│   ├── services/
│   │   ├── safetyEngine.js # CIB&RC validation, drum dosage, tank-mix checker
│   │   ├── suitability.js  # Land suitability scoring with lethal caps
│   │   ├── recommender.js  # Alternative crop MCDA with anti-herd penalty
│   │   ├── visionTriage.js # Symptom triage & 3-track action plan
│   │   └── ragAssistant.js # Voice AI with crisis & safety guardrails
│   └── db.js              # Thread-safe JSON data access helpers
├── public/
│   ├── index.html         # Mitti Design System mobile interface
│   ├── css/
│   │   └── style.css      # Outdoor contrast CSS, 56dp hitboxes, typography
│   └── js/
│       ├── i18n.js        # Punjabi (Gurmukhi), Hindi, English dictionary
│       ├── voice.js       # Web Speech API (ASR speech & TTS synthesis)
│       └── app.js         # State machine, navigation, modals, and event handlers
└── test/
    └── api.test.js        # Node.js built-in automated test suite
```

---

## 📜 Compliance & Agronomic Standards

- **Agronomic Verification:** Chemical dosages and package of practices conform to *Punjab Agricultural University (PAU), Ludhiana* and *ICAR-Central Citrus Research Institute (CCRI), Nagpur*.
- **Regulatory Adherence:** Registered active ingredients adhere to *Central Insecticides Board & Registration Committee (CIB&RC)* gazettes.
- **Data Protection:** Engineered to comply with India's *Digital Personal Data Protection (DPDP) Act, 2023* with zero Aadhaar storage and granular consent.
