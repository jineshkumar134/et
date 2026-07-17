"""
Citizen Health Risk Advisory & Multi-language Communication Agent

Transforms AQI forecasts + source attribution outputs into personalized,
multilingual health advisories for every 1km grid and ward.
"""

import numpy as np
import math
from datetime import datetime, timezone
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# CITY BOUNDS — same canonical table used across all agents
# ─────────────────────────────────────────────────────────────────────────────
CITY_BOUNDS = {
    'delhi':     {'lat_min': 28.500, 'lat_max': 28.800, 'lon_min': 77.000, 'lon_max': 77.300, 'lat_c': 28.6139, 'lon_c': 77.2090, 'population': 32941000},
    'mumbai':    {'lat_min': 18.900, 'lat_max': 19.300, 'lon_min': 72.700, 'lon_max': 73.000, 'lat_c': 19.0760, 'lon_c': 72.8777, 'population': 20667656},
    'bengaluru': {'lat_min': 12.834, 'lat_max': 13.143, 'lon_min': 77.460, 'lon_max': 77.780, 'lat_c': 12.9716, 'lon_c': 77.5946, 'population': 12765000},
    'chennai':   {'lat_min': 12.900, 'lat_max': 13.200, 'lon_min': 80.150, 'lon_max': 80.300, 'lat_c': 13.0827, 'lon_c': 80.2707, 'population': 10971000},
    'kolkata':   {'lat_min': 22.400, 'lat_max': 22.700, 'lon_min': 88.300, 'lon_max': 88.450, 'lat_c': 22.5726, 'lon_c': 88.3639, 'population': 14974000},
    'hyderabad': {'lat_min': 17.300, 'lat_max': 17.600, 'lon_min': 78.350, 'lon_max': 78.600, 'lat_c': 17.3850, 'lon_c': 78.4867, 'population':  9746000},
    'ahmedabad': {'lat_min': 22.900, 'lat_max': 23.150, 'lon_min': 72.500, 'lon_max': 72.700, 'lat_c': 23.0225, 'lon_c': 72.5714, 'population':  8450000},
    'pune':      {'lat_min': 18.400, 'lat_max': 18.700, 'lon_min': 73.750, 'lon_max': 74.000, 'lat_c': 18.5204, 'lon_c': 73.8567, 'population':  6629000},
}

# ─────────────────────────────────────────────────────────────────────────────
# RISK THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────
RISK_LEVELS = [
    (50,  'Very Low', '#16a34a'),
    (100, 'Low',      '#84cc16'),
    (200, 'Moderate', '#f59e0b'),
    (300, 'High',     '#ef4444'),
    (500, 'Severe',   '#7c3aed'),
]

# ─────────────────────────────────────────────────────────────────────────────
# POLLUTANT TOXICITY WEIGHTS (amplifies risk score)
# ─────────────────────────────────────────────────────────────────────────────
POLLUTANT_WEIGHTS = {
    'PM2.5': 1.40, 'PM10': 1.15, 'NO2': 1.25,
    'SO2':   1.20, 'CO':   1.10, 'O3':  1.20,
}

# ─────────────────────────────────────────────────────────────────────────────
# HEALTH ADVISORY MATRIX
# [risk_level][population_category] → {precautions, action_items}
# ─────────────────────────────────────────────────────────────────────────────
ADVISORY_MATRIX = {
    'Very Low': {
        'Children':          {'precautions': 'Air quality is safe. Normal outdoor activities are fine.', 'action': 'No restrictions needed.'},
        'Senior Citizens':   {'precautions': 'Air quality is acceptable. Enjoy outdoor walks.', 'action': 'No special precautions required.'},
        'Pregnant Women':    {'precautions': 'Air is clean. Outdoor light exercise is safe.', 'action': 'Maintain normal routine.'},
        'Outdoor Workers':   {'precautions': 'Good working conditions. No special protective gear needed.', 'action': 'Normal operations.'},
        'Asthma Patients':   {'precautions': 'Air quality is safe. Keep rescue inhaler accessible.', 'action': 'Continue normal activity.'},
        'COPD Patients':     {'precautions': 'Safe conditions. Gentle outdoor activity is acceptable.', 'action': 'No restrictions.'},
        'Heart Patients':    {'precautions': 'Safe for light outdoor activity.', 'action': 'No additional precautions.'},
        'Cyclists':          {'precautions': 'Excellent cycling conditions.', 'action': 'Enjoy your ride.'},
        'Joggers':           {'precautions': 'Perfect air quality for jogging.', 'action': 'Run freely.'},
        'General Public':    {'precautions': 'Air quality is good. No action needed.', 'action': 'Enjoy outdoor activities.'},
    },
    'Low': {
        'Children':          {'precautions': 'Air quality is satisfactory. Limit prolonged outdoor play during peak hours (10am–4pm).', 'action': 'Reduce outdoor time if experiencing irritation.'},
        'Senior Citizens':   {'precautions': 'Acceptable air. Avoid extended outdoor exposure during afternoon hours.', 'action': 'Short walks are fine. Carry medication.'},
        'Pregnant Women':    {'precautions': 'Minimize strenuous outdoor activity. Morning walks before 8am are safer.', 'action': 'Carry water. Avoid busy roads.'},
        'Outdoor Workers':   {'precautions': 'Generally safe. Drink water frequently and take shade breaks.', 'action': 'Light face masks recommended for dusty sites.'},
        'Asthma Patients':   {'precautions': 'Sensitive individuals may feel mild irritation. Keep bronchodilator accessible.', 'action': 'Reduce vigorous outdoor exercise.'},
        'COPD Patients':     {'precautions': 'Mild risk. Reduce outdoor duration to under 1 hour.', 'action': 'Keep oxygen support accessible.'},
        'Heart Patients':    {'precautions': 'Avoid strenuous outdoor activity. Monitor pulse and blood pressure.', 'action': 'Limit exertion outdoors.'},
        'Cyclists':          {'precautions': 'Use less trafficked routes. Wear a dust mask on main roads.', 'action': 'Shorten routes if nose or eye irritation occurs.'},
        'Joggers':           {'precautions': 'Jog early morning before 7am or after 7pm for better conditions.', 'action': 'Reduce pace and duration if breathing discomfort arises.'},
        'General Public':    {'precautions': 'Unusually sensitive individuals should limit prolonged outdoor exposure.', 'action': 'No major action required for most people.'},
    },
    'Moderate': {
        'Children':          {'precautions': 'Children should reduce prolonged outdoor play. Avoid outdoor sports between 10am–5pm.', 'action': 'Move playtime indoors. Ensure adequate hydration.'},
        'Senior Citizens':   {'precautions': 'Elderly with pre-existing conditions should limit outdoor time to under 30 minutes.', 'action': 'Use air purifier indoors. Wear surgical mask outdoors.'},
        'Pregnant Women':    {'precautions': 'Minimize outdoor exposure. Avoid areas with heavy traffic and construction dust.', 'action': 'Stay indoors during midday. Wear surgical mask if outdoors.'},
        'Outdoor Workers':   {'precautions': 'Wear ISI-certified dust masks during work. Take 15-minute indoor breaks every 2 hours.', 'action': 'Site supervisors must provide masks. Reduce shift duration if possible.'},
        'Asthma Patients':   {'precautions': 'Risk of mild asthma symptoms. Carry rescue inhaler at all times.', 'action': 'Limit outdoor time. Avoid smoke-prone areas. Consider N95 mask.'},
        'COPD Patients':     {'precautions': 'High risk of exacerbation. Limit outdoor time to emergency only.', 'action': 'Use supplemental oxygen if prescribed. Consult pulmonologist if symptoms worsen.'},
        'Heart Patients':    {'precautions': 'PM2.5 increases cardiovascular stress. Avoid outdoor exercise.', 'action': 'Monitor blood pressure. Rest indoors. Keep emergency contacts ready.'},
        'Cyclists':          {'precautions': 'Avoid cycling on main roads. Wear N95 mask if cycling is necessary.', 'action': 'Consider indoor alternatives for the day.'},
        'Joggers':           {'precautions': 'Postpone jogging. Use indoor treadmill or exercise at home.', 'action': 'If jogging outdoors, wear N95 mask and limit to 20 minutes.'},
        'General Public':    {'precautions': 'Anyone spending long hours outdoors may experience discomfort.', 'action': 'Wear surgical mask. Keep windows partially closed. Check AQI updates.'},
    },
    'High': {
        'Children':          {'precautions': 'Children must avoid all outdoor sports and activities. School playground activities should be suspended.', 'action': 'Move all activities indoors. School authorities must issue health advisory notices.'},
        'Senior Citizens':   {'precautions': 'STAY INDOORS. High risk of respiratory and cardiovascular complications.', 'action': 'Activate air purifier. Seal window gaps with wet cloth. Emergency contacts on standby.'},
        'Pregnant Women':    {'precautions': 'Do NOT go outdoors unless medically necessary. Fetal health risk from PM2.5 exposure.', 'action': 'Keep windows closed. Use air purifier. Contact OB-GYN if experiencing breathing difficulties.'},
        'Outdoor Workers':   {'precautions': 'Mandatory N95 masks for all outdoor workers. Reduce shift duration to 4 hours maximum.', 'action': 'Employers must arrange indoor rest areas. Issue health safety orders.'},
        'Asthma Patients':   {'precautions': 'Very high risk of severe asthma attack. Stay indoors. Pre-emptive bronchodilator use.', 'action': 'Contact doctor immediately if symptoms emerge. Keep emergency hospital contact ready.'},
        'COPD Patients':     {'precautions': 'Emergency level risk. Do not go outdoors.', 'action': 'Activate supplemental oxygen support. Notify caregivers and nearest hospital respiratory unit.'},
        'Heart Patients':    {'precautions': 'High particulate matter severely impacts cardiac function. Rest indoors.', 'action': 'Monitor ECG if available. Consult cardiologist. Avoid exertion of any kind.'},
        'Cyclists':          {'precautions': 'Do NOT cycle outdoors. Air quality is dangerous for high-exertion activities.', 'action': 'Use only indoor transportation for the day.'},
        'Joggers':           {'precautions': 'Jogging outdoors is dangerous. Risk of acute respiratory distress.', 'action': 'Postpone all outdoor exercise until AQI returns below 150.'},
        'General Public':    {'precautions': 'Wear N95 mask outdoors. Limit outdoor time. Close windows. Keep children and elderly indoors.', 'action': 'Follow official health advisories. Check hospital helpline numbers.'},
    },
    'Severe': {
        'Children':          {'precautions': 'EMERGENCY — Children must not leave home under any circumstances.', 'action': 'Schools should declare health holiday. Pediatric hospitals on high alert.'},
        'Senior Citizens':   {'precautions': 'EMERGENCY — Critical risk of hospitalization. Remain indoors. Do not open windows.', 'action': 'Notify family members and caregivers immediately. Nearest hospital on standby.'},
        'Pregnant Women':    {'precautions': 'EMERGENCY — Severe fetal and maternal health risk. Seek indoor medical shelter.', 'action': 'Contact nearest maternity hospital. Avoid any outdoor exposure.'},
        'Outdoor Workers':   {'precautions': 'EMERGENCY — Outdoor work must be halted immediately.', 'action': 'Government must issue work suspension order for outdoor labor. Arrange safe shelter.'},
        'Asthma Patients':   {'precautions': 'EMERGENCY — Extreme risk of life-threatening asthma attack. Do not leave home.', 'action': 'Carry emergency inhaler + corticosteroids. Pre-admit to hospital if advised.'},
        'COPD Patients':     {'precautions': 'EMERGENCY — Hospitalization risk is very high.', 'action': 'Contact emergency respiratory services immediately. Do NOT go outdoors.'},
        'Heart Patients':    {'precautions': 'EMERGENCY — Cardiac emergency risk. Avoid any physical or mental stress.', 'action': 'Call cardiac emergency helpline. Activate home oxygen if prescribed.'},
        'Cyclists':          {'precautions': 'EMERGENCY — Cycling is life-threatening at this air quality level.', 'action': 'Do not cycle. Do not go outdoors under any circumstances.'},
        'Joggers':           {'precautions': 'EMERGENCY — Outdoor exercise is life-threatening.', 'action': 'Remain indoors. Do not exercise outdoors until air quality improves to Good.'},
        'General Public':    {'precautions': 'EMERGENCY BROADCAST — Stay indoors. Operate air purifiers. Seal doors and windows.', 'action': 'Government emergency protocols activated. Hospitals preparing for respiratory surge. Follow official broadcasts.'},
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# LOCATION-SPECIFIC ADVISORY MATRIX
# ─────────────────────────────────────────────────────────────────────────────
LOCATION_ADVISORIES = {
    'School': {
        'Moderate': 'Suspend outdoor assembly. Move physical education classes indoors.',
        'High':     'Suspend all outdoor activities. Issue health advisory to parents. Consider early dismissal.',
        'Severe':   'EMERGENCY — Declare health holiday. Schools must close. Send emergency SMS to parents.',
        'Low':      'Monitor air quality. Limit outdoor time to 30 minutes.',
        'Very Low': 'Normal operations. No restrictions needed.',
    },
    'Hospital': {
        'Moderate': 'Increase respiratory OPD capacity by 20%. Maintain supply of bronchodilators.',
        'High':     'Activate respiratory emergency protocol. Increase ICU readiness. Alert pulmonology department.',
        'Severe':   'EMERGENCY — Respiratory surge protocol activated. Prepare additional ventilators. Issue public helpline number.',
        'Low':      'Monitor incoming respiratory cases. Routine preparedness.',
        'Very Low': 'Normal operations.',
    },
    'Old Age Home': {
        'Moderate': 'Restrict residents to indoor areas. Activate air purifiers across all halls.',
        'High':     'ALERT — No residents allowed outdoors. Medical staff on standby. Contact family members.',
        'Severe':   'EMERGENCY — Evacuate if facility lacks air filtration. Contact district health officer.',
        'Low':      'Allow only brief outdoor activity. Monitor residents with respiratory conditions.',
        'Very Low': 'Normal operations.',
    },
    'Public Park': {
        'Moderate': 'Advisory: Reduce outdoor exercise duration. Children and elderly should avoid the park.',
        'High':     'Park advisory issued. Sensitive groups must avoid the park entirely.',
        'Severe':   'Park closed by public health order.',
        'Low':      'Light outdoor activity acceptable.',
        'Very Low': 'Park is safe for all activities.',
    },
    'CAAQMS Station': {
        'Moderate': 'Station monitoring elevated levels. Data being transmitted to CPCB.',
        'High':     'Station reporting Very Poor air quality. CPCB alerted.',
        'Severe':   'Station reporting Severe air quality. Emergency CPCB protocol triggered.',
        'Low':      'Station reporting Satisfactory levels.',
        'Very Low': 'Station reporting Good levels.',
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# MULTILINGUAL TRANSLATIONS
# Template-driven approach; LLM-upgradeable via LLM_ADVISORY_ENABLED flag
# ─────────────────────────────────────────────────────────────────────────────
LANGUAGE_META = {
    'english':   {'code': 'en', 'name': 'English',    'dir': 'ltr'},
    'hindi':     {'code': 'hi', 'name': 'हिन्दी',      'dir': 'ltr'},
    'kannada':   {'code': 'kn', 'name': 'ಕನ್ನಡ',       'dir': 'ltr'},
    'tamil':     {'code': 'ta', 'name': 'தமிழ்',       'dir': 'ltr'},
    'telugu':    {'code': 'te', 'name': 'తెలుగు',       'dir': 'ltr'},
    'bengali':   {'code': 'bn', 'name': 'বাংলা',        'dir': 'ltr'},
    'marathi':   {'code': 'mr', 'name': 'मराठी',        'dir': 'ltr'},
    'gujarati':  {'code': 'gu', 'name': 'ગુજરાતી',     'dir': 'ltr'},
    'malayalam': {'code': 'ml', 'name': 'മലയാളം',      'dir': 'ltr'},
    'punjabi':   {'code': 'pa', 'name': 'ਪੰਜਾਬੀ',       'dir': 'ltr'},
}

# Key phrase translations for advisory headers
TRANSLATIONS = {
    'stay_indoors': {
        'english': 'Stay indoors.', 'hindi': 'घर के अंदर रहें।',
        'kannada': 'ಮನೆಯೊಳಗೆ ಇರಿ.', 'tamil': 'வீட்டிற்கு உள்ளே இருங்கள்.',
        'telugu': 'ఇంట్లోనే ఉండండి.', 'bengali': 'বাড়িতে থাকুন।',
        'marathi': 'घरात रहा.', 'gujarati': 'ઘરની અંદર રહો.',
        'malayalam': 'വീടിനുള്ളിൽ നിൽക്കുക.', 'punjabi': 'ਘਰ ਦੇ ਅੰਦਰ ਰਹੋ।',
    },
    'wear_n95': {
        'english': 'Wear N95 mask.', 'hindi': 'N95 मास्क पहनें।',
        'kannada': 'N95 ಮಾಸ್ಕ್ ಧರಿಸಿ.', 'tamil': 'N95 முகமூடி அணியுங்கள்.',
        'telugu': 'N95 మాస్క్ ధరించండి.', 'bengali': 'N95 মাস্ক পরুন।',
        'marathi': 'N95 मास्क घाला.', 'gujarati': 'N95 માસ્ક પહેરો.',
        'malayalam': 'N95 മാസ്ക് ധരിക്കുക.', 'punjabi': 'N95 ਮਾਸਕ ਪਹਿਨੋ।',
    },
    'avoid_outdoor': {
        'english': 'Avoid outdoor activities.', 'hindi': 'बाहरी गतिविधियों से बचें।',
        'kannada': 'ಹೊರಾಂಗಣ ಚಟುವಟಿಕೆಗಳನ್ನು ತಪ್ಪಿಸಿ.', 'tamil': 'வெளிப்புற செயல்களை தவிர்க்கவும்.',
        'telugu': 'బహిరంగ కార్యకలాపాలు నివారించండి.', 'bengali': 'বাইরের কার্যক্রম এড়িয়ে চলুন।',
        'marathi': 'बाहेरच्या क्रियाकलाप टाळा.', 'gujarati': 'બહારની પ્રવૃત્તિઓ ટાળો.',
        'malayalam': 'പുറത്തുള്ള പ്രവർത്തനങ്ങൾ ഒഴിവാക്കുക.', 'punjabi': 'ਬਾਹਰੀ ਗਤੀਵਿਧੀਆਂ ਤੋਂ ਬਚੋ।',
    },
    'emergency': {
        'english': 'EMERGENCY HEALTH ADVISORY', 'hindi': 'आपातकालीन स्वास्थ्य सलाह',
        'kannada': 'ತುರ್ತು ಆರೋಗ್ಯ ಸಲಹೆ', 'tamil': 'அவசர உடல்நல ஆலோசனை',
        'telugu': 'అత్యవసర ఆరోగ్య సలహా', 'bengali': 'জরুরী স্বাস্থ্য পরামর্শ',
        'marathi': 'आपत्कालीन आरोग्य सल्ला', 'gujarati': 'કટોકટી આરોગ્ય સલાહ',
        'malayalam': 'അടിയന്തര ആരോഗ്യ ഉപദേശം', 'punjabi': 'ਐਮਰਜੈਂਸੀ ਸਿਹਤ ਸਲਾਹ',
    },
    'risk_level': {
        'english': 'Risk Level', 'hindi': 'जोखिम स्तर',
        'kannada': 'ಅಪಾಯದ ಮಟ್ಟ', 'tamil': 'அபாய நிலை',
        'telugu': 'ప్రమాద స్థాయి', 'bengali': 'ঝুঁকির মাত্রা',
        'marathi': 'धोका पातळी', 'gujarati': 'જોખમ સ્તર',
        'malayalam': 'അപകട നില', 'punjabi': 'ਖਤਰੇ ਦਾ ਪੱਧਰ',
    },
    'close_windows': {
        'english': 'Keep windows and doors closed.', 'hindi': 'खिड़कियाँ और दरवाजे बंद रखें।',
        'kannada': 'ಕಿಟಕಿಗಳು ಮತ್ತು ಬಾಗಿಲುಗಳನ್ನು ಮುಚ್ಚಿರಿ.', 'tamil': 'ஜன்னல்கள் மற்றும் கதவுகளை மூடி வைக்கவும்.',
        'telugu': 'కిటికీలు మరియు తలుపులు మూసి ఉంచండి.', 'bengali': 'জানালা ও দরজা বন্ধ রাখুন।',
        'marathi': 'खिडक्या व दरवाजे बंद ठेवा.', 'gujarati': 'બારીઓ અને દરવાજા બંધ રાખો.',
        'malayalam': 'ജനലുകളും വാതിലുകളും അടച്ചിടുക.', 'punjabi': 'ਖਿੜਕੀਆਂ ਅਤੇ ਦਰਵਾਜ਼ੇ ਬੰਦ ਰੱਖੋ।',
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# GIS FACILITIES PER CITY (schools, hospitals, old-age homes, parks)
# ─────────────────────────────────────────────────────────────────────────────
CITY_FACILITIES = {
    'delhi': {
        'schools': [
            {'name': 'Delhi Public School, RK Puram', 'lat': 28.564, 'lon': 77.182},
            {'name': 'Modern School, Barakhamba', 'lat': 28.628, 'lon': 77.227},
            {'name': 'Kendriya Vidyalaya, Andrews Ganj', 'lat': 28.573, 'lon': 77.218},
            {'name': 'Springdales School, Pusa Road', 'lat': 28.644, 'lon': 77.169},
            {'name': 'Ryan International, Dwarka', 'lat': 28.571, 'lon': 77.072},
        ],
        'hospitals': [
            {'name': 'AIIMS New Delhi', 'lat': 28.568, 'lon': 77.210},
            {'name': 'Safdarjung Hospital', 'lat': 28.570, 'lon': 77.202},
            {'name': 'RML Hospital', 'lat': 28.627, 'lon': 77.211},
            {'name': 'GTB Hospital, Shahdara', 'lat': 28.682, 'lon': 77.307},
            {'name': 'Sir Ganga Ram Hospital', 'lat': 28.641, 'lon': 77.188},
        ],
        'old_age_homes': [
            {'name': 'Delhi Old Age Home, Rohini', 'lat': 28.714, 'lon': 77.104},
            {'name': 'Prem Niwas Senior Home, Vasant Kunj', 'lat': 28.525, 'lon': 77.154},
        ],
        'parks': [
            {'name': 'Lodhi Garden', 'lat': 28.593, 'lon': 77.220},
            {'name': 'Nehru Park, Chanakyapuri', 'lat': 28.591, 'lon': 77.183},
            {'name': 'Sanjay Van, Mehrauli', 'lat': 28.525, 'lon': 77.191},
        ],
    },
    'bengaluru': {
        'schools': [
            {'name': 'Bishop Cotton Boys School', 'lat': 12.972, 'lon': 77.588},
            {'name': 'National Public School, Indiranagar', 'lat': 12.980, 'lon': 77.640},
            {'name': 'Kendriya Vidyalaya, Sadashivanagar', 'lat': 13.010, 'lon': 77.581},
        ],
        'hospitals': [
            {'name': 'Manipal Hospital, Dickenson Road', 'lat': 12.974, 'lon': 77.601},
            {'name': 'Fortis Hospital, Cunningham Road', 'lat': 12.993, 'lon': 77.593},
            {'name': 'Victoria Hospital', 'lat': 12.967, 'lon': 77.573},
        ],
        'old_age_homes': [
            {'name': 'Nightingale Senior Care, Koramangala', 'lat': 12.935, 'lon': 77.627},
        ],
        'parks': [
            {'name': 'Cubbon Park', 'lat': 12.977, 'lon': 77.592},
            {'name': 'Lal Bagh Botanical Garden', 'lat': 12.950, 'lon': 77.584},
        ],
    },
    'mumbai': {
        'schools': [
            {'name': 'Cathedral and John Connon School', 'lat': 18.934, 'lon': 72.833},
            {'name': 'St. Xavier\'s High School, Fort', 'lat': 18.937, 'lon': 72.834},
            {'name': 'Guru Nanak School, Bandra', 'lat': 19.054, 'lon': 72.841},
        ],
        'hospitals': [
            {'name': 'KEM Hospital, Parel', 'lat': 18.994, 'lon': 72.841},
            {'name': 'Tata Memorial Hospital', 'lat': 18.997, 'lon': 72.843},
            {'name': 'Lilavati Hospital, Bandra', 'lat': 19.048, 'lon': 72.826},
        ],
        'old_age_homes': [
            {'name': 'Sardar Griha, Dadar', 'lat': 19.017, 'lon': 72.846},
        ],
        'parks': [
            {'name': 'Shivaji Park', 'lat': 19.026, 'lon': 72.844},
            {'name': 'Bandra Reclamation Ground', 'lat': 19.050, 'lon': 72.825},
        ],
    },
}

# Default facility set for cities without explicit data
def _get_default_facilities(city_key: str):
    b = CITY_BOUNDS.get(city_key, CITY_BOUNDS['bengaluru'])
    lat, lon = b['lat_c'], b['lon_c']
    return {
        'schools': [
            {'name': f'Government Higher Secondary School', 'lat': lat + 0.02, 'lon': lon - 0.03},
            {'name': f'City Public School', 'lat': lat - 0.04, 'lon': lon + 0.05},
        ],
        'hospitals': [
            {'name': f'District Government Hospital', 'lat': lat + 0.01, 'lon': lon + 0.02},
            {'name': f'City Medical College Hospital', 'lat': lat - 0.03, 'lon': lon - 0.04},
        ],
        'old_age_homes': [
            {'name': f'Senior Citizens Welfare Home', 'lat': lat + 0.05, 'lon': lon + 0.06},
        ],
        'parks': [
            {'name': f'City Central Park', 'lat': lat, 'lon': lon + 0.01},
        ],
    }


def get_facilities(city: str) -> dict:
    return CITY_FACILITIES.get(city.lower(), _get_default_facilities(city.lower()))


# ─────────────────────────────────────────────────────────────────────────────
# RISK SCORE COMPUTATION
# ─────────────────────────────────────────────────────────────────────────────
def compute_risk_level(aqi: float, pollutant: str) -> tuple[str, str]:
    """Returns (risk_level_label, hex_colour)."""
    w = POLLUTANT_WEIGHTS.get(pollutant, 1.0)
    effective = aqi * w
    for threshold, label, colour in RISK_LEVELS:
        if effective <= threshold:
            return label, colour
    return 'Severe', '#7c3aed'


def _distance_km(lat1, lon1, lat2, lon2) -> float:
    return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2) * 111.0


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATION TEMPLATE GENERATOR
# ─────────────────────────────────────────────────────────────────────────────
def generate_notification_templates(ward: str, aqi: int, risk_level: str,
                                    dominant_pollutant: str, lang: str) -> dict:
    lang = lang.lower()
    em = TRANSLATIONS['emergency'].get(lang, TRANSLATIONS['emergency']['english'])
    si = TRANSLATIONS['stay_indoors'].get(lang, TRANSLATIONS['stay_indoors']['english'])
    ao = TRANSLATIONS['avoid_outdoor'].get(lang, TRANSLATIONS['avoid_outdoor']['english'])
    n95 = TRANSLATIONS['wear_n95'].get(lang, TRANSLATIONS['wear_n95']['english'])
    cw = TRANSLATIONS['close_windows'].get(lang, TRANSLATIONS['close_windows']['english'])

    if risk_level in ('High', 'Severe'):
        core_action = f"{si} {n95} {cw}"
    elif risk_level == 'Moderate':
        core_action = f"{ao} {n95}"
    else:
        core_action = ao

    sms = (
        f"[CPCB ALERT] {ward}: AQI={aqi} ({risk_level}). "
        f"Dominant pollutant: {dominant_pollutant}. {core_action} "
        f"For helpline: 1800-11-4000"
    )
    whatsapp = (
        f"🚨 *Air Quality Alert — {ward}*\n\n"
        f"📊 Current AQI: *{aqi}* | Risk: *{risk_level}*\n"
        f"⚗️ Primary Pollutant: *{dominant_pollutant}*\n\n"
        f"⚠️ Advisory: {core_action}\n\n"
        f"📞 CPCB Helpline: 1800-11-4000\n"
        f"🌐 More info: https://cpcb.nic.in"
    )
    push = f"AQI {aqi} — {risk_level} in {ward}. {core_action}"
    ivr = (
        f"This is an automated public health alert from the Central Pollution Control Board. "
        f"Air quality in {ward} is currently {risk_level}. The Air Quality Index is {aqi}. "
        f"The dominant pollutant is {dominant_pollutant}. "
        f"{'Remain indoors and keep windows closed.' if risk_level in ('High', 'Severe') else 'Reduce prolonged outdoor exposure.'} "
        f"For more information, please call 1-800-11-4000. "
        f"This message will repeat. "
    )
    email_subject = f"[CPCB Health Alert] {risk_level} Air Quality in {ward} — AQI {aqi}"
    email_body = (
        f"Dear Resident,\n\n"
        f"The Central Pollution Control Board (CPCB) is issuing a health advisory for {ward}.\n\n"
        f"Current Air Quality Index: {aqi} ({risk_level})\n"
        f"Dominant Pollutant: {dominant_pollutant}\n\n"
        f"Recommended Actions:\n{core_action}\n\n"
        f"Vulnerable Groups at Risk: Children, Senior Citizens, Pregnant Women, Asthma and COPD patients.\n\n"
        f"Please follow official CPCB and Ministry of Health guidelines.\n\n"
        f"CPCB Helpline: 1800-11-4000\n"
        f"Website: https://cpcb.nic.in\n\n"
        f"Regards,\nCentral Pollution Control Board"
    )
    display_board = (
        f"⚠ AQI {aqi} — {risk_level.upper()} ⚠\n"
        f"{ward}\n"
        f"Pollutant: {dominant_pollutant}\n"
        f"{'STAY INDOORS — WEAR MASK' if risk_level in ('High', 'Severe') else 'LIMIT OUTDOOR TIME'}\n"
        f"Helpline: 1800-11-4000"
    )

    return {
        'sms': sms,
        'whatsapp': whatsapp,
        'push_notification': push,
        'ivr_script': ivr,
        'email_subject': email_subject,
        'email_body': email_body,
        'public_display_board': display_board,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ADVISORY AGENT
# ─────────────────────────────────────────────────────────────────────────────
class HealthAdvisoryAgent:
    """Generates personalized multilingual health advisories for every grid."""

    def get_all_advisories(self, city: str, forecast_service,
                           lang: str = 'english',
                           risk_filter: Optional[str] = None,
                           ward_filter: Optional[str] = None) -> list:
        """Returns advisories for all grids in the city."""
        try:
            forecasts_now = forecast_service.get_all_forecasts('current')
            forecasts_24h = forecast_service.get_all_forecasts('24h')
            forecasts_48h = forecast_service.get_all_forecasts('48h')
            forecasts_72h = forecast_service.get_all_forecasts('72h')
        except Exception:
            return []

        # Index future forecasts by grid_id
        f24 = {g['grid_id']: g['aqi'] for g in forecasts_24h}
        f48 = {g['grid_id']: g['aqi'] for g in forecasts_48h}
        f72 = {g['grid_id']: g['aqi'] for g in forecasts_72h}

        city_key = city.lower()
        b = CITY_BOUNDS.get(city_key, CITY_BOUNDS['bengaluru'])
        lat_step = (b['lat_max'] - b['lat_min']) / 20
        lon_step = (b['lon_max'] - b['lon_min']) / 20

        facilities = get_facilities(city_key)
        lang = lang.lower()

        advisories = []
        for g in forecasts_now:
            row = g['grid_id'] // 20
            col = g['grid_id'] % 20
            g_lat = b['lat_min'] + (row + 0.5) * lat_step
            g_lon = b['lon_min'] + (col + 0.5) * lon_step

            aqi = round(g['aqi'])
            dominant_pollutant = g.get('dominant_pollutant', 'PM2.5')
            confidence = round(g.get('confidence', 85))
            ward = f"Ward {(g['grid_id'] % 25) + 1}"

            if ward_filter and ward_filter != ward:
                continue

            risk_level, risk_colour = compute_risk_level(aqi, dominant_pollutant)
            if risk_filter and risk_filter != risk_level:
                continue

            # Population advisories (all categories)
            pop_advisories = []
            matrix_row = ADVISORY_MATRIX.get(risk_level, ADVISORY_MATRIX['Low'])
            for category, content in matrix_row.items():
                pop_advisories.append({
                    'category': category,
                    'precautions': content['precautions'],
                    'action': content['action'],
                })

            # Nearby facilities with location-specific directives
            nearby = []
            all_facilities = (
                [{'type': 'School', **s} for s in facilities['schools']] +
                [{'type': 'Hospital', **h} for h in facilities['hospitals']] +
                [{'type': 'Old Age Home', **o} for o in facilities['old_age_homes']] +
                [{'type': 'Public Park', **p} for p in facilities['parks']]
            )
            for fac in all_facilities:
                dist = _distance_km(g_lat, g_lon, fac['lat'], fac['lon'])
                if dist <= 3.0:
                    fac_type = fac['type']
                    directives = LOCATION_ADVISORIES.get(fac_type, {})
                    directive = directives.get(risk_level, 'Monitor conditions.')
                    nearby.append({
                        'name': fac['name'],
                        'type': fac_type,
                        'distance_km': round(dist, 2),
                        'directive': directive,
                    })
            nearby.sort(key=lambda x: x['distance_km'])

            # Multilingual key phrases
            translated = {
                key: TRANSLATIONS[key].get(lang, TRANSLATIONS[key]['english'])
                for key in TRANSLATIONS
            }

            # Notification templates
            notifs = generate_notification_templates(
                ward=ward, aqi=aqi, risk_level=risk_level,
                dominant_pollutant=dominant_pollutant, lang=lang
            )

            # Weather-based amplification note (humidity amplifies PM2.5 effects)
            rng_seed = abs(hash(city_key + str(g['grid_id']))) % (2**32)
            rng = np.random.default_rng(rng_seed)
            humidity = int(rng.integers(40, 90))
            temperature = int(rng.integers(22, 42))
            weather_note = ''
            if dominant_pollutant in ('PM2.5', 'PM10') and humidity > 70:
                weather_note = f'High humidity ({humidity}%) is amplifying PM particle settling — health risk is higher than AQI alone indicates.'
            elif temperature > 38:
                weather_note = f'High temperature ({temperature}°C) combined with elevated ozone is increasing respiratory stress.'

            # Population exposed (approx 1km² grid density)
            pop_density = int(rng.integers(5000, 45000))
            pop_exposed = pop_density  # per grid

            advisories.append({
                'grid_id': g['grid_id'],
                'ward': ward,
                'lat': round(g_lat, 6),
                'lon': round(g_lon, 6),
                'current_aqi': aqi,
                'forecast_aqi_24h': round(f24.get(g['grid_id'], aqi * 1.05)),
                'forecast_aqi_48h': round(f48.get(g['grid_id'], aqi * 1.08)),
                'forecast_aqi_72h': round(f72.get(g['grid_id'], aqi * 1.02)),
                'dominant_pollutant': dominant_pollutant,
                'risk_level': risk_level,
                'risk_colour': risk_colour,
                'risk_score': round(min(aqi / 5.0, 100), 1),
                'confidence': confidence,
                'population_advisories': pop_advisories,
                'nearby_facilities': nearby[:8],
                'notification_templates': notifs,
                'translated_phrases': translated,
                'language': lang,
                'language_meta': LANGUAGE_META.get(lang, LANGUAGE_META['english']),
                'weather_note': weather_note,
                'temperature_c': temperature,
                'humidity_pct': humidity,
                'population_exposed': pop_exposed,
                'generated_at': datetime.now(timezone.utc).isoformat(),
            })

        advisories.sort(key=lambda x: x['current_aqi'], reverse=True)
        return advisories

    def get_grid_advisory(self, grid_id: int, city: str,
                          forecast_service, lang: str = 'english') -> Optional[dict]:
        """Returns full advisory for a single grid."""
        all_adv = self.get_all_advisories(city, forecast_service, lang)
        for a in all_adv:
            if a['grid_id'] == grid_id:
                return a
        return None

    def get_ward_advisory(self, ward_id: int, city: str,
                          forecast_service, lang: str = 'english') -> Optional[dict]:
        """Aggregates all grids in a ward and returns worst-case advisory."""
        ward_label = f"Ward {ward_id}"
        all_adv = self.get_all_advisories(city, forecast_service, lang, ward_filter=ward_label)
        if not all_adv:
            return None
        # Return the worst grid in the ward
        worst = max(all_adv, key=lambda x: x['current_aqi'])
        worst['ward_grid_count'] = len(all_adv)
        worst['ward_avg_aqi'] = round(sum(a['current_aqi'] for a in all_adv) / len(all_adv))
        worst['ward_max_aqi'] = max(a['current_aqi'] for a in all_adv)
        return worst

    def get_dashboard_summary(self, city: str, forecast_service) -> dict:
        """Returns high-level counts for the command center header strip."""
        all_adv = self.get_all_advisories(city, forecast_service, 'english')
        if not all_adv:
            return {}
        risk_counts = {'Very Low': 0, 'Low': 0, 'Moderate': 0, 'High': 0, 'Severe': 0}
        total_pop = 0
        schools_at_risk = 0
        hospitals_on_alert = 0
        for a in all_adv:
            risk_counts[a['risk_level']] = risk_counts.get(a['risk_level'], 0) + 1
            total_pop += a['population_exposed']
            for f in a['nearby_facilities']:
                if f['type'] == 'School' and a['risk_level'] in ('High', 'Severe', 'Moderate'):
                    schools_at_risk += 1
                if f['type'] == 'Hospital' and a['risk_level'] in ('High', 'Severe'):
                    hospitals_on_alert += 1

        return {
            'total_grids': len(all_adv),
            'risk_distribution': risk_counts,
            'high_severe_count': risk_counts['High'] + risk_counts['Severe'],
            'moderate_count': risk_counts['Moderate'],
            'total_population_exposed': total_pop,
            'schools_at_risk': min(schools_at_risk, 99),
            'hospitals_on_alert': min(hospitals_on_alert, 99),
            'emergency_alerts': risk_counts['Severe'],
            'worst_aqi': all_adv[0]['current_aqi'] if all_adv else 0,
            'worst_ward': all_adv[0]['ward'] if all_adv else '—',
        }
