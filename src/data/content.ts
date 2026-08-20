export const COLORS = {
  saffron: '#C8622A',
  gold: '#A0730A',
  cream: '#FFF8EF',
  light: '#FDE8C8',
  muted: '#8B6914',
  dark: '#3B2010',
  border: '#D2691E30',
  green: '#2E7D32',
  red: '#C62828',
};

export const BG_IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Om_symbol.svg/480px-Om_symbol.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Rigveda_MS2097.jpg/480px-Rigveda_MS2097.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Bhagavatgita-as-it-is.jpg/480px-Bhagavatgita-as-it-is.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Ganesha_Basohli_miniature_circa_1730_Dubost_p73.jpg/480px-Ganesha_Basohli_miniature_circa_1730_Dubost_p73.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Rig_Veda_manuscript_page.jpg/480px-Rig_Veda_manuscript_page.jpg',
];

export const BADGE_ICONS = ['🌱', '🔍', '🧘', '⚖️', '📖', '🌿', '🕉️'];

export const LEVELS = [
  { name: 'Ārambhaka', san: 'आरंभक', days: 7, color: COLORS.saffron, bg: COLORS.light, desc: 'The Beginner — taking the first sacred step', emoji: '🌱', active: true },
  { name: 'Jijnāsu', san: 'जिज्ञासु', days: 10, color: '#2E86AB', bg: '#E3F4FB', desc: 'The Curious Seeker — questioning with an open heart', emoji: '🔍' },
  { name: 'Sādhaka', san: 'साधक', days: 15, color: '#6B4226', bg: '#F5EAE0', desc: 'The Practitioner — walking the path with discipline', emoji: '🧘' },
  { name: 'Viveka', san: 'विवेक', days: 20, color: '#5C4B8A', bg: '#EDE8F8', desc: 'The Discerning — separating truth from illusion', emoji: '⚖️' },
  { name: 'Jnāni', san: 'ज्ञानी', days: 25, color: '#1B6B3A', bg: '#E2F4EB', desc: 'The Knower — who has realized the Self', emoji: '📖' },
  { name: 'Rishi', san: 'ऋषि', days: 30, color: '#8B1A1A', bg: '#FAEAEA', desc: 'The Sage — a seer of eternal truths', emoji: '🌿' },
  { name: 'Jīvanmukta', san: 'जीवनमुक्त', days: 35, color: COLORS.gold, bg: '#FDF6DC', desc: 'The Liberated — free while still living', emoji: '🕉️' },
];

export const LEVEL_START_DAYS = [1, 8, 18, 33, 53, 78, 108];

export const DAY_DIFFICULTY = ['Very Easy', 'Easy', 'Easy-Medium', 'Medium', 'Medium', 'Medium-Hard', 'Moderate-Hard'];

export type Language = 'en' | 'hi' | 'mr';

export interface Translation {
  appTitle: string;
  appSub: string;
  choose: string;
  name: string;
  age: string;
  start: string;
  fill: string;
  question: string;
  of: string;
  next: string;
  results: string;
  correct: string;
  wrong: string;
  review: string;
  retry: string;
  nextDay: string;
  profile: string;
  home: string;
  levels: string;
  dayUnlock: string;
  createdBy: string;
  levelLabel: string;
  welcome: (name: string) => string;
  ageNote: (age: number) => string;
  scoreNote: (pct: number) => string;
  days: string[];
}

export const LANGS: Record<Language, Translation> = {
  en: {
    appTitle: 'Path of Dharma', appSub: 'Ārambhaka Level · 7 Days',
    choose: 'Choose Language', name: 'Your Name', age: 'Age', start: 'Begin Journey', fill: 'Please fill all fields',
    question: 'Question', of: 'of', next: 'Next Question', results: 'See Results', correct: '✓ Correct! Did you know?',
    wrong: "✗ Not quite — here's the insight:", review: 'Answer Review', retry: 'Retry This Day', nextDay: 'Next Day →',
    profile: 'Profile', home: 'Home', levels: 'Journey', dayUnlock: 'Unlocks at sunrise (6:00 AM IST)',
    createdBy: 'Guided by dharma, built by Ashutosh Pandey', levelLabel: 'Ārambhaka', welcome: (n) => `Welcome, ${n}!`,
    ageNote: (a) => a < 15 ? 'Young seeker! Your curiosity about Dharma at this age is truly inspiring. You are planting seeds that will shape your whole life.' : a < 25 ? 'The perfect time to explore Dharma. These roots will guide your decisions, relationships, and purpose for decades to come.' : a < 45 ? 'With the wisdom of experience, every concept will resonate deeply. Your journey enriches not just you but everyone around you.' : 'A lifetime of living makes every teaching profound. You bring rare depth to this journey. Namaste. 🙏',
    scoreNote: (p) => p >= 90 ? 'Outstanding! Your foundations are exceptionally strong.' : p >= 70 ? 'Well done. The seeds of knowledge are taking root.' : p >= 50 ? 'A good beginning. Every great seeker starts here.' : 'The path begins with a first step. Keep going — knowledge grows with each attempt.',
    days: ['Day 1 — The First Step', 'Day 2 — Deities & Symbols', 'Day 3 — Sacred Texts', 'Day 4 — Core Philosophy', 'Day 5 — Ethics & Dharma', 'Day 6 — Cosmology', 'Day 7 — Deep Dharma'],
  },
  hi: {
    appTitle: 'धर्म का मार्ग', appSub: 'आरंभक स्तर · 7 दिन',
    choose: 'भाषा चुनें', name: 'आपका नाम', age: 'आयु', start: 'यात्रा शुरू करें', fill: 'कृपया सभी जानकारी भरें',
    question: 'प्रश्न', of: 'में से', next: 'अगला प्रश्न', results: 'परिणाम देखें', correct: '✓ सही! क्या आप जानते हैं?',
    wrong: '✗ गलत — यह जानें:', review: 'उत्तर समीक्षा', retry: 'पुनः प्रयास', nextDay: 'अगला दिन →',
    profile: 'प्रोफ़ाइल', home: 'होम', levels: 'यात्रा', dayUnlock: 'सूर्योदय पर खुलेगा (सुबह 6:00 IST)',
    createdBy: 'विचार एवं निर्माण: अशुतोष पांडेय', levelLabel: 'आरंभक', welcome: (n) => `स्वागत है, ${n}!`,
    ageNote: (a) => a < 15 ? 'युवा साधक! इस उम्र में धर्म के प्रति आपकी जिज्ञासा वास्तव में प्रेरणादायक है।' : a < 25 ? 'धर्म को जानने का सबसे सही समय। ये जड़ें आपके जीवन को दिशा देंगी।' : a < 45 ? 'अनुभव की बुद्धि के साथ हर अवधारणा गहराई से गूंजेगी। आपकी यात्रा सबको समृद्ध करती है।' : 'जीवन भर का अनुभव हर शिक्षा को गहन बनाता है। नमस्ते। 🙏',
    scoreNote: (p) => p >= 90 ? 'अद्भुत! आपकी नींव बेहद मजबूत है।' : p >= 70 ? 'शाबाश! ज्ञान के बीज अंकुरित हो रहे हैं।' : p >= 50 ? 'अच्छी शुरुआत। हर महान साधक यहीं से शुरू करता है।' : 'मार्ग पहले कदम से शुरू होता है। आगे बढ़ते रहें।',
    days: ['दिन 1 — पहला कदम', 'दिन 2 — देवता और प्रतीक', 'दिन 3 — पवित्र ग्रंथ', 'दिन 4 — मूल दर्शन', 'दिन 5 — नैतिकता और धर्म', 'दिन 6 — ब्रह्मांड विज्ञान', 'दिन 7 — गहन धर्म'],
  },
  mr: {
    appTitle: 'धर्माचा मार्ग', appSub: 'आरंभक स्तर · ७ दिवस',
    choose: 'भाषा निवडा', name: 'तुमचे नाव', age: 'वय', start: 'यात्रा सुरू करा', fill: 'कृपया सर्व माहिती भरा',
    question: 'प्रश्न', of: 'पैकी', next: 'पुढील प्रश्न', results: 'निकाल पहा', correct: '✓ बरोबर! हे माहित आहे का?',
    wrong: '✗ चुकीचे — हे जाणून घ्या:', review: 'उत्तर आढावा', retry: 'पुन्हा प्रयत्न', nextDay: 'पुढील दिवस →',
    profile: 'प्रोफाइल', home: 'होम', levels: 'यात्रा', dayUnlock: 'सूर्योदयावर उघडेल (सकाळी 6:00 IST)',
    createdBy: 'संकल्पना आणि निर्मिती: अशुतोष पांडेय', levelLabel: 'आरंभक', welcome: (n) => `स्वागत आहे, ${n}!`,
    ageNote: (a) => a < 15 ? 'तरुण साधक! या वयात धर्माबद्दलची जिज्ञासा खरोखरच प्रेरणादायी आहे.' : a < 25 ? 'धर्म जाणण्याची योग्य वेळ. या मुळ्या तुमचे जीवन समृद्ध करतील.' : a < 45 ? 'अनुभवाच्या शहाणपणाने प्रत्येक संकल्पना खोलवर जाणवेल.' : 'जीवनाचा अनुभव प्रत्येक शिकवण गहन बनवतो. नमस्कार. 🙏',
    scoreNote: (p) => p >= 90 ? 'अप्रतिम! तुमचा पाया अतिशय भक्कम आहे.' : p >= 70 ? 'शाबास! ज्ञानाचे बीज रुजत आहे.' : p >= 50 ? 'चांगली सुरुवात. प्रत्येक महान साधक इथूनच सुरू करतो.' : 'मार्ग पहिल्या पावलाने सुरू होतो. पुढे चालत राहा.',
    days: ['दिवस 1 — पहिले पाऊल', 'दिवस 2 — देवता आणि प्रतीके', 'दिवस 3 — पवित्र ग्रंथ', 'दिवस 4 — मूळ तत्त्वज्ञान', 'दिवस 5 — नैतिकता आणि धर्म', 'दिवस 6 — विश्वविज्ञान', 'दिवस 7 — गहन धर्म'],
  },
};
