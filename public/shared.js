/* Miqat — shared core: defaults, languages, prayer calculation, time zones, sync store.
 * Used by both the TV display (index.html) and the phone control panel (admin.html). */
(function (g) {
  'use strict';
  const M = {};
  M.VERSION = '1.3.0';
  /* API base: '' = same server (Pi / Railway). Set window.MIQAT_API in config.js when the
     pages are hosted separately (e.g. Netlify front-end + Railway API). */
  M.API = String(g.MIQAT_API || '').trim().replace(/\/+$/, '');
  M.PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  M.SALAH = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  /* ------------------------------------------------------------------ defaults */
  M.DEFAULTS = {
    general: {
      masjidName: 'Masjid', subtitle: '', lang: 'en', showArabic: true,
      clock24: true, showSeconds: true, timezone: '', arabicDigits: false
    },
    location: { countryCode: 'IN', country: 'India', region: 'Kerala', city: 'Kozhikode', area: '', lat: 11.2588, lng: 75.7804, preset: '' },
    calc: {
      method: 'Karachi', madhab: 'shafi', highLat: 'auto', fajrAngle: 18, ishaAngle: 18, ishaInterval: 0,
      adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      hijriOffset: 0, hijriAtMaghrib: false
    },
    features: {
      shuruq: true, iqamah: true, jumuah: true, announcements: true, ayah: true,
      adhanOverlay: true, adhanSound: false, iqamahCountdown: true, salahScreen: true,
      ramadan: 'auto', sunnahTimes: false, qr: true, burnIn: true, nightDim: false,
      tomorrowAfterIsha: true, lite: false
    },
    iqamah: {
      roundTo: 0,
      fajr: { mode: 'offset', offset: 20, time: '05:45' },
      dhuhr: { mode: 'offset', offset: 15, time: '13:00' },
      asr: { mode: 'offset', offset: 15, time: '16:15' },
      maghrib: { mode: 'offset', offset: 5, time: '18:15' },
      isha: { mode: 'offset', offset: 15, time: '20:00' }
    },
    jumuah: { khutbah: '12:45', iqamah: '13:15', note: '' },
    adhan: { overlayMinutes: 3, volume: 0.9, beepBeforeIqamah: true, prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } },
    salah: { countdownSeconds: 60, minutes: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 8, isha: 12, jumuah: 15 } },
    ramadan: { taraweeh: '20:30', imsakMinutes: 10 },
    display: {
      theme: 'dynamic', accent: 'gold', orientation: 'auto', layout: 'cards',
      nightFrom: '23:00', nightTo: '04:30', nightLevel: 0.45, ayahSeconds: 45, tickerSpeed: 90
    },
    clock: { followServer: false, offsetMs: 0, adjustMin: 0 },
    live: { urgent: '', urgentUntil: 0, blank: false },
    announcements: [
      { id: 'a1', text: 'Welcome to the masjid. Please keep the prayer hall clean and silent.', from: '', to: '', on: true }
    ],
    ayahs: [
      { ar: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا', tr: 'Indeed, prayer has been prescribed for the believers at fixed times.', ref: 'An-Nisa 4:103', on: true },
      { ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', tr: 'Surely, in the remembrance of Allah do hearts find rest.', ref: "Ar-Ra'd 13:28", on: true },
      { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', tr: 'So remember Me, and I will remember you.', ref: 'Al-Baqarah 2:152', on: true },
      { ar: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', tr: 'And seek help through patience and prayer.', ref: 'Al-Baqarah 2:45', on: true },
      { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', tr: 'Indeed, with hardship comes ease.', ref: 'Ash-Sharh 94:6', on: true },
      { ar: 'حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ', tr: 'Guard your prayers, and especially the middle prayer.', ref: 'Al-Baqarah 2:238', on: true },
      { ar: 'وَأَقِمِ الصَّلَاةَ لِذِكْرِي', tr: 'And establish prayer for My remembrance.', ref: 'Ta-Ha 20:14', on: true }
    ]
  };

  /* Quick presets — "Home" and "Masjid" just flip feature switches. */
  M.PRESETS = {
    home: { iqamah: false, jumuah: false, announcements: false, iqamahCountdown: false, salahScreen: false, qr: false, adhanOverlay: true, adhanSound: true },
    masjid: { iqamah: true, jumuah: true, announcements: true, iqamahCountdown: true, salahScreen: true, qr: true, adhanOverlay: true }
  };

  M.METHODS = [
    ['Karachi', 'Karachi — Univ. of Islamic Sciences (18°/18°) · India, Pakistan'],
    ['MuslimWorldLeague', 'Muslim World League (18°/17°)'],
    ['Dubai', 'Dubai / UAE (18.2°/18.2°)'],
    ['UmmAlQura', 'Umm al-Qura, Makkah (18.5° / 90 min)'],
    ['Egyptian', 'Egyptian General Authority (19.5°/17.5°)'],
    ['Kuwait', 'Kuwait (18°/17.5°)'],
    ['Qatar', 'Qatar (18° / 90 min)'],
    ['Singapore', 'Singapore / Malaysia / Indonesia (20°/18°)'],
    ['Turkey', 'Turkey — Diyanet'],
    ['Tehran', 'Tehran — Institute of Geophysics'],
    ['NorthAmerica', 'ISNA — North America (15°/15°)'],
    ['MoonsightingCommittee', 'Moonsighting Committee'],
    ['Custom', 'Custom angles']
  ];

  M.CITIES = [
    // id, name, lat, lng, tz, method
    ['kozhikode', 'Kozhikode (Calicut), Kerala', 11.2588, 75.7804, 'Asia/Kolkata', 'Karachi'],
    ['malappuram', 'Malappuram, Kerala', 11.0510, 76.0711, 'Asia/Kolkata', 'Karachi'],
    ['kannur', 'Kannur, Kerala', 11.8745, 75.3704, 'Asia/Kolkata', 'Karachi'],
    ['kasaragod', 'Kasaragod, Kerala', 12.4996, 74.9869, 'Asia/Kolkata', 'Karachi'],
    ['thrissur', 'Thrissur, Kerala', 10.5276, 76.2144, 'Asia/Kolkata', 'Karachi'],
    ['kochi', 'Kochi, Kerala', 9.9312, 76.2673, 'Asia/Kolkata', 'Karachi'],
    ['kollam', 'Kollam, Kerala', 8.8932, 76.6141, 'Asia/Kolkata', 'Karachi'],
    ['trivandrum', 'Thiruvananthapuram, Kerala', 8.5241, 76.9366, 'Asia/Kolkata', 'Karachi'],
    ['wayanad', 'Kalpetta, Wayanad', 11.6085, 76.0830, 'Asia/Kolkata', 'Karachi'],
    ['palakkad', 'Palakkad, Kerala', 10.7867, 76.6548, 'Asia/Kolkata', 'Karachi'],
    ['mangalore', 'Mangaluru, Karnataka', 12.9141, 74.8560, 'Asia/Kolkata', 'Karachi'],
    ['bangalore', 'Bengaluru', 12.9716, 77.5946, 'Asia/Kolkata', 'Karachi'],
    ['chennai', 'Chennai', 13.0827, 80.2707, 'Asia/Kolkata', 'Karachi'],
    ['hyderabad', 'Hyderabad', 17.3850, 78.4867, 'Asia/Kolkata', 'Karachi'],
    ['mumbai', 'Mumbai', 19.0760, 72.8777, 'Asia/Kolkata', 'Karachi'],
    ['delhi', 'New Delhi', 28.6139, 77.2090, 'Asia/Kolkata', 'Karachi'],
    ['sharjah', 'Sharjah, UAE', 25.3463, 55.4209, 'Asia/Dubai', 'Dubai'],
    ['dubai', 'Dubai, UAE', 25.2048, 55.2708, 'Asia/Dubai', 'Dubai'],
    ['abudhabi', 'Abu Dhabi, UAE', 24.4539, 54.3773, 'Asia/Dubai', 'Dubai'],
    ['ajman', 'Ajman, UAE', 25.4052, 55.5136, 'Asia/Dubai', 'Dubai'],
    ['alain', 'Al Ain, UAE', 24.2075, 55.7447, 'Asia/Dubai', 'Dubai'],
    ['muscat', 'Muscat, Oman', 23.5880, 58.3829, 'Asia/Muscat', 'MuslimWorldLeague'],
    ['doha', 'Doha, Qatar', 25.2854, 51.5310, 'Asia/Qatar', 'Qatar'],
    ['kuwait', 'Kuwait City', 29.3759, 47.9774, 'Asia/Kuwait', 'Kuwait'],
    ['manama', 'Manama, Bahrain', 26.2285, 50.5860, 'Asia/Bahrain', 'UmmAlQura'],
    ['riyadh', 'Riyadh, Saudi Arabia', 24.7136, 46.6753, 'Asia/Riyadh', 'UmmAlQura'],
    ['jeddah', 'Jeddah, Saudi Arabia', 21.4858, 39.1925, 'Asia/Riyadh', 'UmmAlQura'],
    ['makkah', 'Makkah', 21.4225, 39.8262, 'Asia/Riyadh', 'UmmAlQura'],
    ['madinah', 'Madinah', 24.4672, 39.6111, 'Asia/Riyadh', 'UmmAlQura'],
    ['karachi', 'Karachi, Pakistan', 24.8607, 67.0011, 'Asia/Karachi', 'Karachi'],
    ['dhaka', 'Dhaka, Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka', 'Karachi'],
    ['colombo', 'Colombo, Sri Lanka', 6.9271, 79.8612, 'Asia/Colombo', 'Karachi'],
    ['male', 'Malé, Maldives', 4.1755, 73.5093, 'Indian/Maldives', 'MuslimWorldLeague'],
    ['kualalumpur', 'Kuala Lumpur, Malaysia', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 'Singapore'],
    ['jakarta', 'Jakarta, Indonesia', -6.2088, 106.8456, 'Asia/Jakarta', 'Singapore'],
    ['singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore', 'Singapore'],
    ['istanbul', 'Istanbul, Türkiye', 41.0082, 28.9784, 'Europe/Istanbul', 'Turkey'],
    ['cairo', 'Cairo, Egypt', 30.0444, 31.2357, 'Africa/Cairo', 'Egyptian'],
    ['london', 'London, UK', 51.5074, -0.1278, 'Europe/London', 'MoonsightingCommittee'],
    ['paris', 'Paris, France', 48.8566, 2.3522, 'Europe/Paris', 'MuslimWorldLeague'],
    ['amsterdam', 'Amsterdam, Netherlands', 52.3676, 4.9041, 'Europe/Amsterdam', 'MuslimWorldLeague'],
    ['newyork', 'New York, USA', 40.7128, -74.0060, 'America/New_York', 'NorthAmerica'],
    ['toronto', 'Toronto, Canada', 43.6532, -79.3832, 'America/Toronto', 'NorthAmerica'],
    ['sydney', 'Sydney, Australia', -33.8688, 151.2093, 'Australia/Sydney', 'MuslimWorldLeague'],
    ['lusaka', 'Lusaka, Zambia', -15.3875, 28.3228, 'Africa/Lusaka', 'MuslimWorldLeague'],
    ['nairobi', 'Nairobi, Kenya', -1.2921, 36.8219, 'Africa/Nairobi', 'MuslimWorldLeague']
  ];

  M.THEMES = {
    // [bg1, bg2, bg3, orb1, orb2, orb3]
    night:    ['#050a1c', '#0c1436', '#1a1147', '#3b2a8f', '#123a7a', '#5b2a86'],
    fajr:     ['#0c1230', '#251f55', '#5a2f5f', '#d4697a', '#5a4bb5', '#2a5fa8'],
    morning:  ['#04212f', '#0a4256', '#11707a', '#2bb3a3', '#3a7bd5', '#e0b45c'],
    noon:     ['#032a33', '#084a52', '#16695c', '#e8c37a', '#1fa38a', '#2f6fb3'],
    asr:      ['#211006', '#4d250c', '#7d4213', '#f0a040', '#c2562a', '#7a3b8f'],
    maghrib:  ['#170a20', '#431633', '#702638', '#e2604a', '#8a2f6f', '#3a2a8f'],
    midnight: ['#050a1c', '#0c1436', '#1a1147', '#3b2a8f', '#123a7a', '#5b2a86'],
    emerald:  ['#021b16', '#04362b', '#0a5242', '#1fae84', '#d9b45a', '#0f6b5a'],
    maroon:   ['#170a05', '#33180d', '#552914', '#c8873a', '#7a3a1c', '#e3b66a'],
    royal:    ['#0b0822', '#211046', '#3a1868', '#8a5cf6', '#d9b45a', '#3b5bdb'],
    ocean:    ['#021426', '#052b48', '#094566', '#1ea7d4', '#2bd4b0', '#3b5bdb'],
    graphite: ['#0b0c0f', '#16181d', '#23262d', '#4b5563', '#9ca3af', '#d9b45a']
  };
  M.ACCENTS = { gold: '#f3c96b', white: '#ffffff', emerald: '#5fe3b0', sky: '#7cc8ff', rose: '#ff9fb2', amber: '#ffb35c' };

  /* ------------------------------------------------------------------ languages */
  const P = (fajr, sunrise, dhuhr, asr, maghrib, isha, jumuah) => ({ fajr, sunrise, dhuhr, asr, maghrib, isha, jumuah });
  M.LANGS = {
    en: { name: 'English', dir: 'ltr', locale: 'en-GB', imsak: 'Imsak',
      p: P('Fajr', 'Shuruq', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', "Jumu'ah"),
      next: 'Next prayer', remaining: 'Time remaining', adhan: 'Adhan', iqamah: 'Iqamah', iqamahIn: 'Iqamah in', now: 'Now',
      khutbah: 'Khutbah', sunrise: 'Sunrise', timeFor: "It's time for", salahInProgress: 'Salah in progress',
      silencePhones: 'Please switch off your mobile phone', straightenRows: 'Straighten your rows',
      khutbahInProgress: 'Khutbah in progress', listenSilently: 'Please listen in silence', suhoorEnds: 'Suhoor ends',
      iftar: 'Iftar', taraweeh: 'Taraweeh', ramadan: 'Ramadan Kareem', day: 'Day', scan: 'Scan to control',
      offline: 'Offline · using saved settings', tomorrow: 'Tomorrow', notice: 'Notice', midnight: 'Midnight', lastThird: 'Last third', tapSound: 'Press OK to enable adhan sound' },
    ar: { name: 'العربية', dir: 'rtl', locale: 'ar', imsak: 'الإمساك',
      p: P('الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء', 'الجمعة'),
      next: 'الصلاة القادمة', remaining: 'الوقت المتبقي', adhan: 'الأذان', iqamah: 'الإقامة', iqamahIn: 'الإقامة بعد', now: 'الآن',
      khutbah: 'الخطبة', sunrise: 'شروق الشمس', timeFor: 'حان الآن موعد', salahInProgress: 'الصلاة قائمة',
      silencePhones: 'الرجاء إغلاق الهاتف المحمول', straightenRows: 'استووا واعتدلوا',
      khutbahInProgress: 'الخطبة قائمة', listenSilently: 'الرجاء الإنصات', suhoorEnds: 'نهاية السحور',
      iftar: 'الإفطار', taraweeh: 'التراويح', ramadan: 'رمضان كريم', day: 'اليوم', scan: 'امسح للتحكم',
      offline: 'غير متصل · الإعدادات المحفوظة', tomorrow: 'غداً', notice: 'إعلان', midnight: 'منتصف الليل', lastThird: 'الثلث الأخير', tapSound: 'اضغط موافق لتفعيل صوت الأذان' },
    ml: { name: 'മലയാളം', dir: 'ltr', locale: 'ml-IN', imsak: 'ഇംസാക്',
      p: P('സുബ്ഹ്', 'ഉദയം', 'ളുഹ്ർ', 'അസ്ർ', 'മഗ്‌രിബ്', 'ഇശാ', 'ജുമുഅ'),
      next: 'അടുത്ത നമസ്കാരം', remaining: 'ബാക്കി സമയം', adhan: 'ബാങ്ക്', iqamah: 'ഇഖാമത്ത്', iqamahIn: 'ഇഖാമത്തിന്', now: 'ഇപ്പോൾ',
      khutbah: 'ഖുതുബ', sunrise: 'സൂര്യോദയം', timeFor: 'ബാങ്ക് സമയം', salahInProgress: 'നമസ്കാരം നടക്കുന്നു',
      silencePhones: 'ദയവായി മൊബൈൽ ഫോൺ ഓഫ് ചെയ്യുക', straightenRows: 'സ്വഫ്ഫുകൾ നേരെയാക്കുക',
      khutbahInProgress: 'ഖുതുബ നടക്കുന്നു', listenSilently: 'ദയവായി നിശബ്ദമായി ശ്രദ്ധിക്കുക', suhoorEnds: 'അത്താഴം അവസാനം',
      iftar: 'നോമ്പുതുറ', taraweeh: 'തറാവീഹ്', ramadan: 'റമദാൻ കരീം', day: 'ദിവസം', scan: 'നിയന്ത്രിക്കാൻ സ്കാൻ ചെയ്യുക',
      offline: 'ഓഫ്‌ലൈൻ · സേവ് ചെയ്ത ക്രമീകരണങ്ങൾ', tomorrow: 'നാളെ', notice: 'അറിയിപ്പ്', midnight: 'അർദ്ധരാത്രി', lastThird: 'അവസാന മൂന്നിലൊന്ന്', tapSound: 'ബാങ്ക് ശബ്ദത്തിന് OK അമർത്തുക' },
    ur: { name: 'اردو', dir: 'rtl', locale: 'ur', imsak: 'امساک',
      p: P('فجر', 'طلوع آفتاب', 'ظہر', 'عصر', 'مغرب', 'عشاء', 'جمعہ'),
      next: 'اگلی نماز', remaining: 'باقی وقت', adhan: 'اذان', iqamah: 'اقامت', iqamahIn: 'اقامت میں', now: 'ابھی',
      khutbah: 'خطبہ', sunrise: 'طلوع آفتاب', timeFor: 'وقتِ اذان', salahInProgress: 'نماز جاری ہے',
      silencePhones: 'براہ کرم اپنا موبائل فون بند کر دیں', straightenRows: 'صفیں سیدھی کر لیں',
      khutbahInProgress: 'خطبہ جاری ہے', listenSilently: 'براہ کرم خاموشی سے سنیں', suhoorEnds: 'سحری کا اختتام',
      iftar: 'افطار', taraweeh: 'تراویح', ramadan: 'رمضان کریم', day: 'دن', scan: 'کنٹرول کے لیے اسکین کریں',
      offline: 'آف لائن · محفوظ ترتیبات', tomorrow: 'کل', notice: 'اعلان', midnight: 'نصف شب', lastThird: 'آخری تہائی', tapSound: 'اذان کی آواز کے لیے OK دبائیں' },
    hi: { name: 'हिन्दी', dir: 'ltr', locale: 'hi-IN', imsak: 'इम्साक',
      p: P('फ़ज्र', 'सूर्योदय', 'ज़ुहर', 'अस्र', 'मग़रिब', 'इशा', 'जुमा'),
      next: 'अगली नमाज़', remaining: 'शेष समय', adhan: 'अज़ान', iqamah: 'इक़ामत', iqamahIn: 'इक़ामत में', now: 'अभी',
      khutbah: 'ख़ुत्बा', sunrise: 'सूर्योदय', timeFor: 'अज़ान का समय', salahInProgress: 'नमाज़ जारी है',
      silencePhones: 'कृपया अपना मोबाइल फ़ोन बंद करें', straightenRows: 'सफ़ें सीधी कर लें',
      khutbahInProgress: 'ख़ुत्बा जारी है', listenSilently: 'कृपया ख़ामोशी से सुनें', suhoorEnds: 'सहरी समाप्त',
      iftar: 'इफ़्तार', taraweeh: 'तरावीह', ramadan: 'रमज़ान करीम', day: 'दिन', scan: 'नियंत्रण के लिए स्कैन करें',
      offline: 'ऑफ़लाइन · सहेजी गई सेटिंग्स', tomorrow: 'कल', notice: 'सूचना', midnight: 'आधी रात', lastThird: 'अंतिम तिहाई', tapSound: 'अज़ान की आवाज़ के लिए OK दबाएँ' },
    ta: { name: 'தமிழ்', dir: 'ltr', locale: 'ta-IN', imsak: 'இம்ஸாக்',
      p: P('ஃபஜ்ர்', 'சூரிய உதயம்', 'லுஹர்', 'அஸர்', 'மஃரிப்', 'இஷா', 'ஜும்ஆ'),
      next: 'அடுத்த தொழுகை', remaining: 'மீதமுள்ள நேரம்', adhan: 'பாங்கு', iqamah: 'இகாமத்', iqamahIn: 'இகாமத்துக்கு', now: 'இப்போது',
      khutbah: 'குத்பா', sunrise: 'சூரிய உதயம்', timeFor: 'பாங்கு நேரம்', salahInProgress: 'தொழுகை நடைபெறுகிறது',
      silencePhones: 'தயவுசெய்து கைபேசியை அணைக்கவும்', straightenRows: 'வரிசைகளை நேராக்குங்கள்',
      khutbahInProgress: 'குத்பா நடைபெறுகிறது', listenSilently: 'தயவுசெய்து அமைதியாகக் கேளுங்கள்', suhoorEnds: 'ஸஹர் முடிவு',
      iftar: 'இஃப்தார்', taraweeh: 'தராவீஹ்', ramadan: 'ரமளான் கரீம்', day: 'நாள்', scan: 'கட்டுப்படுத்த ஸ்கேன் செய்யவும்',
      offline: 'ஆஃப்லைன் · சேமித்த அமைப்புகள்', tomorrow: 'நாளை', notice: 'அறிவிப்பு', midnight: 'நள்ளிரவு', lastThird: 'கடைசி மூன்றில் ஒன்று', tapSound: 'பாங்கு ஒலிக்கு OK அழுத்தவும்' },
    bn: { name: 'বাংলা', dir: 'ltr', locale: 'bn-BD', imsak: 'ইমসাক',
      p: P('ফজর', 'সূর্যোদয়', 'যোহর', 'আসর', 'মাগরিব', 'এশা', 'জুমা'),
      next: 'পরবর্তী নামাজ', remaining: 'বাকি সময়', adhan: 'আযান', iqamah: 'ইকামত', iqamahIn: 'ইকামত', now: 'এখন',
      khutbah: 'খুতবা', sunrise: 'সূর্যোদয়', timeFor: 'আযানের সময়', salahInProgress: 'নামাজ চলছে',
      silencePhones: 'অনুগ্রহ করে মোবাইল ফোন বন্ধ করুন', straightenRows: 'কাতার সোজা করুন',
      khutbahInProgress: 'খুতবা চলছে', listenSilently: 'অনুগ্রহ করে নীরবে শুনুন', suhoorEnds: 'সেহরির শেষ',
      iftar: 'ইফতার', taraweeh: 'তারাবীহ', ramadan: 'রমজান কারীম', day: 'দিন', scan: 'নিয়ন্ত্রণ করতে স্ক্যান করুন',
      offline: 'অফলাইন · সংরক্ষিত সেটিংস', tomorrow: 'আগামীকাল', notice: 'ঘোষণা', midnight: 'মধ্যরাত', lastThird: 'শেষ তৃতীয়াংশ', tapSound: 'আযানের শব্দের জন্য OK চাপুন' },
    id: { name: 'Bahasa Indonesia', dir: 'ltr', locale: 'id-ID', imsak: 'Imsak',
      p: P('Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya', "Jum'at"),
      next: 'Salat berikutnya', remaining: 'Waktu tersisa', adhan: 'Azan', iqamah: 'Iqamah', iqamahIn: 'Iqamah dalam', now: 'Sekarang',
      khutbah: 'Khutbah', sunrise: 'Matahari terbit', timeFor: 'Waktunya azan', salahInProgress: 'Salat sedang berlangsung',
      silencePhones: 'Mohon matikan telepon genggam Anda', straightenRows: 'Luruskan dan rapatkan saf',
      khutbahInProgress: 'Khutbah sedang berlangsung', listenSilently: 'Mohon dengarkan dengan tenang', suhoorEnds: 'Imsak',
      iftar: 'Berbuka', taraweeh: 'Tarawih', ramadan: 'Ramadan Kareem', day: 'Hari', scan: 'Pindai untuk mengatur',
      offline: 'Luring · pengaturan tersimpan', tomorrow: 'Besok', notice: 'Pengumuman', midnight: 'Tengah malam', lastThird: 'Sepertiga akhir', tapSound: 'Tekan OK untuk suara azan' },
    tr: { name: 'Türkçe', dir: 'ltr', locale: 'tr-TR', imsak: 'İmsak',
      p: P('Sabah', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı', 'Cuma'),
      next: 'Sonraki namaz', remaining: 'Kalan süre', adhan: 'Ezan', iqamah: 'Kamet', iqamahIn: 'Kamete', now: 'Şimdi',
      khutbah: 'Hutbe', sunrise: 'Güneş doğuşu', timeFor: 'Ezan vakti', salahInProgress: 'Namaz kılınıyor',
      silencePhones: 'Lütfen cep telefonunuzu kapatınız', straightenRows: 'Safları düzeltiniz',
      khutbahInProgress: 'Hutbe okunuyor', listenSilently: 'Lütfen sessizce dinleyiniz', suhoorEnds: 'İmsak',
      iftar: 'İftar', taraweeh: 'Teravih', ramadan: 'Hayırlı Ramazanlar', day: 'Gün', scan: 'Yönetmek için tarayın',
      offline: 'Çevrimdışı · kayıtlı ayarlar', tomorrow: 'Yarın', notice: 'Duyuru', midnight: 'Gece yarısı', lastThird: 'Son üçte bir', tapSound: 'Ezan sesi için OK tuşuna basın' },
    fr: { name: 'Français', dir: 'ltr', locale: 'fr-FR', imsak: 'Imsak',
      p: P('Fajr', 'Chourouk', 'Dhohr', 'Asr', 'Maghrib', 'Icha', "Joumou'a"),
      next: 'Prochaine prière', remaining: 'Temps restant', adhan: 'Adhan', iqamah: 'Iqama', iqamahIn: 'Iqama dans', now: 'Maintenant',
      khutbah: 'Khotba', sunrise: 'Lever du soleil', timeFor: "C'est l'heure de", salahInProgress: 'Prière en cours',
      silencePhones: 'Merci d’éteindre votre téléphone', straightenRows: 'Alignez les rangs',
      khutbahInProgress: 'Khotba en cours', listenSilently: 'Merci d’écouter en silence', suhoorEnds: 'Fin du sahour',
      iftar: 'Iftar', taraweeh: 'Tarawih', ramadan: 'Ramadan Moubarak', day: 'Jour', scan: 'Scannez pour gérer',
      offline: 'Hors ligne · réglages enregistrés', tomorrow: 'Demain', notice: 'Annonce', midnight: 'Minuit', lastThird: 'Dernier tiers', tapSound: 'Appuyez sur OK pour le son de l’adhan' }
  };
  M.HIJRI_MONTHS = {
    en: ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah'],
    ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
    ml: ['മുഹർറം', 'സഫർ', 'റബീഉൽ അവ്വൽ', 'റബീഉൽ ആഖിർ', 'ജമാദുൽ ഊലാ', 'ജമാദുൽ ആഖിർ', 'റജബ്', 'ശഅ്ബാൻ', 'റമദാൻ', 'ശവ്വാൽ', 'ദുൽ ഖഅ്ദ', 'ദുൽ ഹിജ്ജ'],
    ur: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول', 'جمادی الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذوالقعدہ', 'ذوالحجہ']
  };
  M.AR_PRAYER = M.LANGS.ar.p;
  M.t = (lang) => M.LANGS[lang] || M.LANGS.en;

  /* ------------------------------------------------------------------ utils */
  M.clone = (o) => JSON.parse(JSON.stringify(o));
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  M.merge = function merge(base, over) {
    const out = M.clone(base);
    if (!isObj(over)) return out;
    for (const k of Object.keys(over)) {
      if (isObj(out[k]) && isObj(over[k])) out[k] = merge(out[k], over[k]);
      else if (over[k] !== undefined) out[k] = over[k];
    }
    return out;
  };
  M.withDefaults = (s) => M.merge(M.DEFAULTS, s || {});
  M.pad = (n) => String(n).padStart(2, '0');
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  M.digits = (str, s) => (s && s.general.arabicDigits ? String(str).replace(/\d/g, (d) => AR_DIGITS[d]) : String(str));
  M.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------------ time zones */
  const fmtCache = {};
  function partsFmt(tz) {
    if (!fmtCache[tz]) fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' });
    return fmtCache[tz];
  }
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  M.validTz = (tz) => { if (!tz) return true; try { partsFmt(tz); return true; } catch (e) { return false; } };
  /** Wall-clock parts of an instant in a time zone ('' = device). */
  M.zoned = function (date, tz) {
    if (!tz || !M.validTz(tz)) {
      return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds(), dow: date.getDay() };
    }
    const o = {};
    for (const p of partsFmt(tz).formatToParts(date)) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, dow: WD[o.weekday] };
  };
  /** Instant for a wall-clock time "HH:MM" on a given y/m/d in a time zone. */
  M.atWall = function (p, hhmm, tz) {
    const [h, mi] = String(hhmm || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
    if (!tz || !M.validTz(tz)) return new Date(p.y, p.m - 1, p.d, h, mi, 0, 0);
    const guess = Date.UTC(p.y, p.m - 1, p.d, h, mi);
    let off = tzOffset(new Date(guess), tz);
    let t = guess - off;
    const off2 = tzOffset(new Date(t), tz);
    if (off2 !== off) t = guess - off2;
    return new Date(t);
  };
  function tzOffset(date, tz) {
    const z = M.zoned(date, tz);
    return Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s) - Math.floor(date.getTime() / 1000) * 1000;
  }
  M.addDays = (p, n) => { const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; };
  M.dayKey = (p) => `${p.y}-${M.pad(p.m)}-${M.pad(p.d)}`;
  M.inWindow = (hm, from, to) => {
    const v = (x) => { const [a, b] = String(x).split(':').map(Number); return a * 60 + (b || 0); };
    const n = v(hm), f = v(from), t = v(to);
    return f <= t ? n >= f && n < t : n >= f || n < t;
  };

  /** Format an instant as HH:MM in the screen's zone/clock style. Returns {hm, ampm}. */
  M.fmtTime = function (date, s) {
    if (!date) return { hm: '--:--', ampm: '' };
    const z = M.zoned(date, s.general.timezone);
    if (s.general.clock24) return { hm: M.digits(`${M.pad(z.h)}:${M.pad(z.mi)}`, s), ampm: '' };
    const h = z.h % 12 || 12;
    return { hm: M.digits(`${h}:${M.pad(z.mi)}`, s), ampm: z.h < 12 ? 'AM' : 'PM' };
  };
  M.fmtHM = (date, s) => { const f = M.fmtTime(date, s); return f.ampm ? `${f.hm} ${f.ampm}` : f.hm; };
  M.fmtDuration = function (ms, s) {
    if (ms < 0) ms = 0;
    const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return M.digits(h > 0 ? `${h}:${M.pad(m)}:${M.pad(sec)}` : `${m}:${M.pad(sec)}`, s);
  };

  /* ------------------------------------------------------------------ Hijri */
  let hijriFmt = null, hijriFmtTried = false;
  function islamicTabular(y, m, d) { // fallback: arithmetic (Kuwaiti) algorithm
    const jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) + Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) + d - 32075;
    let l = jd - 1948440 + 10632; const n = Math.floor((l - 1) / 10631); l = l - 10631 * n + 354;
    const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const hm = Math.floor((24 * l) / 709), hd = l - Math.floor((709 * hm) / 24), hy = 30 * n + j - 30;
    return { y: hy, m: hm, d: hd };
  }
  /** Hijri date for a Gregorian civil date p {y,m,d} (+ offset days). */
  M.hijri = function (p, offset) {
    const base = M.addDays(p, offset || 0);
    if (!hijriFmtTried) {
      hijriFmtTried = true;
      for (const cal of ['islamic-umalqura', 'islamic-civil', 'islamic']) {
        try {
          const f = new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
          const test = f.formatToParts(new Date(Date.UTC(2026, 10, 3)));
          if (test.find((x) => x.type === 'month') && +test.find((x) => x.type === 'month').value <= 12) { hijriFmt = f; break; }
        } catch (e) { /* next */ }
      }
    }
    if (hijriFmt) {
      const o = {};
      for (const x of hijriFmt.formatToParts(new Date(Date.UTC(base.y, base.m - 1, base.d, 12)))) o[x.type] = x.value;
      const y = parseInt(o.year || o.relatedYear, 10), m = parseInt(o.month, 10), d = parseInt(o.day, 10);
      if (y && m && d) return { y, m, d };
    }
    return islamicTabular(base.y, base.m, base.d);
  };
  M.hijriText = function (h, s) {
    const lang = s.general.lang;
    const names = M.HIJRI_MONTHS[lang] || M.HIJRI_MONTHS.en;
    const ah = lang === 'ar' ? 'هـ' : lang === 'ur' ? 'ھ' : 'AH';
    return M.digits(`${h.d} ${names[h.m - 1]} ${h.y} ${ah}`, s);
  };

  /* ------------------------------------------------------------------ prayer calculation */
  function params(s, coords) {
    const A = g.adhan, c = s.calc;
    let pr;
    if (c.method === 'Custom' || !A.CalculationMethod[c.method]) {
      pr = A.CalculationMethod.Other();
      pr.fajrAngle = +c.fajrAngle || 18;
      pr.ishaAngle = +c.ishaAngle || 18;
      pr.ishaInterval = +c.ishaInterval || 0;
    } else pr = A.CalculationMethod[c.method]();
    pr.madhab = c.madhab === 'hanafi' ? A.Madhab.Hanafi : A.Madhab.Shafi;
    if (c.highLat && c.highLat !== 'auto') pr.highLatitudeRule = c.highLat;
    else if (A.HighLatitudeRule.recommended) pr.highLatitudeRule = A.HighLatitudeRule.recommended(coords);
    for (const k of M.PRAYERS) pr.adjustments[k] = +(c.adjust && c.adjust[k]) || 0;
    return pr;
  }
  function iqamahTime(key, adhanAt, s, p) {
    const q = s.iqamah[key];
    if (!q || !adhanAt) return null;
    let t;
    if (q.mode === 'fixed' && /^\d{1,2}:\d{2}$/.test(q.time || '')) {
      t = M.atWall(p, q.time, s.general.timezone).getTime();
    } else {
      t = adhanAt.getTime() + (parseInt(q.offset, 10) || 0) * 60000;
      const r = parseInt(s.iqamah.roundTo, 10) || 0;
      if (r > 0) t = Math.ceil(t / (r * 60000)) * r * 60000;
    }
    if (t < adhanAt.getTime()) t = adhanAt.getTime();
    return new Date(t);
  }
  /** Full model of one civil day: times, iqamah, Jumu'ah and event list. */
  M.computeDay = function (s, p) {
    const A = g.adhan;
    const coords = new A.Coordinates(+s.location.lat, +s.location.lng);
    const pt = new A.PrayerTimes(coords, new Date(p.y, p.m - 1, p.d), params(s, coords));
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    const tz = s.general.timezone;
    const times = { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
    const friday = dow === 5 && !!s.features.jumuah;
    const iq = {};
    for (const k of M.SALAH) iq[k] = iqamahTime(k, times[k], s, p);
    let jumuah = null;
    if (friday) {
      const kh = M.atWall(p, s.jumuah.khutbah, tz), ji = M.atWall(p, s.jumuah.iqamah, tz);
      jumuah = { khutbah: kh, iqamah: ji < kh ? kh : ji };
    }
    let sunnah = null;
    try { const st = new A.SunnahTimes(pt); sunnah = { midnight: st.middleOfTheNight, lastThird: st.lastThirdOfTheNight }; } catch (e) { /* optional */ }
    const events = [];
    for (const k of M.PRAYERS) {
      if (k === 'sunrise') { events.push({ key: k, start: times.sunrise, iqamah: null, end: null, sun: true }); continue; }
      const isJ = friday && k === 'dhuhr';
      const start = isJ ? jumuah.khutbah : times[k];
      const iqa = isJ ? jumuah.iqamah : (s.features.iqamah ? iq[k] : null);
      const mins = (s.salah.minutes && (isJ ? s.salah.minutes.jumuah : s.salah.minutes[k])) || 10;
      events.push({ key: k, jumuah: isJ, start, adhanAt: times[k], iqamah: iqa, end: new Date((iqa || start).getTime() + mins * 60000) });
    }
    return { p, dow, friday, times, iqamah: iq, jumuah, sunnah, events };
  };

  /* ------------------------------------------------------------------ clock */
  M._serverDrift = 0;
  M.now = function (s) {
    let t = Date.now();
    if (s && s.clock) {
      if (s.clock.followServer) t += M._serverDrift;
      t += (+s.clock.offsetMs || 0) + (+s.clock.adjustMin || 0) * 60000;
    }
    return new Date(t);
  };
  M.syncServerClock = async function () {
    try {
      const t0 = Date.now();
      const r = await fetch(M.API + '/api/time', { cache: 'no-store' });
      const j = await r.json();
      const t1 = Date.now();
      M._serverDrift = j.now + (t1 - t0) / 2 - t1;
      return true;
    } catch (e) { return false; }
  };

  /* ------------------------------------------------------------------ screen id + store */
  M.screenId = function () {
    const q = new URLSearchParams(location.search).get('s');
    if (q && /^[a-z0-9][a-z0-9-]{0,39}$/.test(q)) { try { localStorage.setItem('miqat:screen', q); } catch (e) { /* */ } return q; }
    try { return localStorage.getItem('miqat:screen') || 'main'; } catch (e) { return 'main'; }
  };
  /** Screen ID only if the URL or this device names one (no 'main' fallback). */
  M.explicitScreenId = function () {
    const q = new URLSearchParams(location.search).get('s');
    if (q && /^[a-z0-9][a-z0-9-]{0,39}$/.test(q)) return q;
    try { return localStorage.getItem('miqat:screen') || null; } catch (e) { return null; }
  };
  M.post = async function (path, body, headers) {
    const r = await fetch(M.API + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body || {}) });
    let j = {}; try { j = await r.json(); } catch (e) { /* */ }
    if (!r.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { status: r.status, data: j });
    return j;
  };
  M.info = async function () { try { return await (await fetch(M.API + '/api/info', { cache: 'no-store' })).json(); } catch (e) { return {}; } };
  M.cacheKey = (id) => 'miqat:settings:' + id;
  M.readCache = (id) => { try { return JSON.parse(localStorage.getItem(M.cacheKey(id)) || 'null'); } catch (e) { return null; } };
  M.writeCache = (id, obj) => { try { localStorage.setItem(M.cacheKey(id), JSON.stringify(obj)); } catch (e) { /* */ } };
  M.serverAvailable = () => location.protocol === 'http:' || location.protocol === 'https:';

  /** Is a Miqat server behind this page? 'yes' | 'no' (static hosting / file) | 'unreachable' (offline). */
  M._probe = null;
  M.probe = async function () {
    if (!M.serverAvailable()) return 'no';
    if (M._probe) return M._probe;
    try {
      const r = await fetch(M.API + '/api/info', { cache: 'no-store' });
      let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
      M._probe = j && j.app === 'Miqat' ? 'yes' : 'no';
      return M._probe;
    } catch (e) { return 'unreachable'; }
  };

  /** Display-side store: server (live, SSE) → cache (offline) → defaults. */
  M.createDisplayStore = function (id) {
    const L = { change: [], command: [], status: [] };
    let rev = -1, status = 'starting', es = null, timer = null, first = true;
    const on = (ev, f) => L[ev].push(f);
    const setStatus = (st) => { if (st !== status) { status = st; L.status.forEach((f) => f(st)); } };
    const emit = (raw, meta) => { const s = M.withDefaults(raw); s._meta = meta || {}; L.change.forEach((f) => f(s)); };
    function useCache() {
      const c = M.readCache(id);
      if (first || (c && c.rev !== rev)) { first = false; rev = c ? c.rev : 0; emit(c && c.settings, c ? c.meta : {}); }
    }
    async function refresh() {
      const pr = await M.probe();
      if (pr === 'no') { setStatus('local'); useCache(); return; }
      if (pr === 'yes' && !es) connect();
      try {
        const r = await fetch(M.API + '/api/screens/' + id, { cache: 'no-store' });
        if (r.status === 404) { setStatus('notfound'); useCache(); return; }
        if (r.status === 403) { let j = {}; try { j = await r.json(); } catch (e) { /* */ } L.disabled = j; setStatus('disabled'); useCache(); return; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        setStatus('online');
        const metaSig = JSON.stringify(j.media || {});
        const c = M.readCache(id);
        if (first || j.rev !== rev || !c || JSON.stringify((c.meta || {}).media || {}) !== metaSig || !!(c.meta || {}).pending !== !!j.pending) {
          first = false; rev = j.rev;
          const meta = { name: j.name, media: j.media || {}, id, pending: !!j.pending };
          M.writeCache(id, { rev, settings: j.settings, meta });
          emit(j.settings, meta);
        }
      } catch (e) {
        setStatus(status === 'online' || status === 'offline' ? 'offline' : 'local');
        useCache();
      }
    }
    function connect() {
      if (es || M._probe !== 'yes' || !g.EventSource) return;
      try {
        es = new EventSource(M.API + '/api/screens/' + id + '/events');
        es.addEventListener('hello', () => { setStatus('online'); refresh(); });
        es.addEventListener('settings', () => refresh());
        es.addEventListener('command', (e) => { try { const c = JSON.parse(e.data); L.command.forEach((f) => f(c)); } catch (x) { /* */ } });
        es.onerror = () => { if (status === 'online') setStatus('offline'); };
      } catch (e) { /* */ }
    }
    g.addEventListener('storage', (e) => { if (e.key === M.cacheKey(id) && status !== 'online') useCache(); });
    return {
      on,
      get status() { return status; },
      get disabledInfo() { return L.disabled || {}; },
      start() { refresh(); timer = setInterval(refresh, 60000); }
    };
  };

  /** Admin-side store: talks to server with PIN, or saves on this device (local mode). */
  M.createAdminStore = function (id) {
    let pin = '';
    const api = async (method, path, body, raw) => {
      const headers = { 'X-Pin': pin };
      let payload;
      if (raw) { payload = body; headers['Content-Type'] = raw; }
      else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
      const r = await fetch(M.API + path, { method, headers, body: payload, cache: 'no-store' });
      let j = {}; try { j = await r.json(); } catch (e) { /* */ }
      if (!r.ok) throw Object.assign(new Error(j.error || 'HTTP ' + r.status), { status: r.status });
      return j;
    };
    return {
      id,
      setPin(p) { pin = p; },
      async login(p) { pin = p; return api('POST', `/api/screens/${id}/login`, { pin: p }); },
      async fetch() { const r = await fetch(M.API + `/api/screens/${id}`, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
      async save(settings, name, owner) { return api('PUT', `/api/screens/${id}/settings`, { settings, name, owner }); },
      async command(type, extra) { return api('POST', `/api/screens/${id}/command`, Object.assign({ type }, extra || {})); },
      async changePin(newPin) { return api('POST', `/api/screens/${id}/pin`, { newPin }); },
      async upload(name, file) { return api('PUT', `/api/screens/${id}/media/${name}`, file, file.type || 'audio/mpeg'); },
      async removeMedia(name) { return api('DELETE', `/api/screens/${id}/media/${name}`); },
      async createScreen(name, newPin, settings) {
        const r = await fetch(M.API + '/api/screens', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Screen': id, 'X-Pin': pin }, body: JSON.stringify({ name, pin: newPin, settings }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed'); return j;
      },
      saveLocal(settings, name) {
        const c = M.readCache(id) || { rev: 0 };
        M.writeCache(id, { rev: (c.rev || 0) + 1, settings, meta: Object.assign({}, c.meta, { name }) });
      }
    };
  };

  /* ------------------------------------------------------------------ QR helper */
  M.qrSvg = function (text) {
    if (!g.qrcode) return '';
    const q = g.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0b0f1a"/></svg>`;
  };
  M.adminUrl = async function (id) {
    let origin = location.origin;
    if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
      try { const j = await (await fetch(M.API + '/api/info', { cache: 'no-store' })).json(); if (j.lan && j.lan[0]) origin = `http://${j.lan[0]}:${j.port}`; } catch (e) { /* */ }
    }
    return `${origin}/admin?s=${encodeURIComponent(id)}`;
  };

  g.Miqat = M;
})(window);
