import { MiracleItem } from '../types';

export const MIRACLES_FALLBACK: MiracleItem[] = [
  {
    id: 'lang-oaths-openings',
    category: 'Language & Eloquence',
    title: 'Oath Openings and Surah Focus',
    summary: 'Several surahs open with oaths that introduce the main moral and theological focus of the chapter.',
    detail:
      'These openings can be studied as a rhetorical structure where oath elements guide attention to the message that follows.',
    ayahRefs: ['91:1-10', '95:1-8', '103:1-3'],
    tags: ['rhetoric', 'structure', 'balaghah'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com' }],
  },
  {
    id: 'lang-repetition-variation',
    category: 'Language & Eloquence',
    title: 'Repetition with Variation',
    summary: 'Core narratives are repeated with meaningful variation in wording and emphasis.',
    detail:
      'Comparing repeated passages helps reveal contextual teaching: same truth, different framing for different audiences and lessons.',
    ayahRefs: ['20:9-99', '26:10-191', '54:17'],
    tags: ['narrative', 'comparison', 'tadabbur'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com' }],
  },
  {
    id: 'num-paired-concepts',
    category: 'Numerical Patterns',
    title: 'Paired Concept Counting',
    summary: 'Researchers often examine frequency pairs (for example dunya/akhirah) in Quranic vocabulary.',
    detail:
      'Reliable counting requires clear methodology for roots, derivatives, and orthographic normalization.',
    ayahRefs: ['2:201', '28:77', '87:16-17'],
    tags: ['frequency', 'methodology', 'lexical'],
    sources: [{ label: 'Quranic Arabic Corpus', url: 'https://corpus.quran.com/searchhelp.jsp' }],
    caution: 'Numeric outcomes vary by counting method; treat as an analytical reflection tool.',
  },
  {
    id: 'num-theme-19',
    category: 'Numerical Patterns',
    title: 'Theme of Nineteen Discussions',
    summary: 'Some studies analyze numerical structure around the mention of nineteen in Surah Al-Muddaththir.',
    detail:
      'The app presents this as a study theme with references rather than a doctrinal proof claim.',
    ayahRefs: ['74:30-31'],
    tags: ['historical-studies', 'number-themes'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/74/30-31' }],
    caution: 'Interpretive area; verify with trusted scholarly commentary.',
  },
  {
    id: 'cosmo-night-day-signs',
    category: 'Cosmology & Natural World',
    title: 'Alternation of Night and Day',
    summary: 'Night/day alternation is repeatedly presented as a sign for reflection and reason.',
    detail:
      'The Quran links observable natural order with spiritual reflection and gratitude.',
    ayahRefs: ['3:190', '10:6', '24:44'],
    tags: ['night-day', 'signs', 'reflection'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/3/190' }],
  },
  {
    id: 'cosmo-expanding-heavens',
    category: 'Cosmology & Natural World',
    title: 'Heavens and Vastness',
    summary: 'Classical and modern readers discuss verses about the heavens, power, and vast creation.',
    detail:
      'This card encourages reading tafsir context first, then comparative reflection with modern cosmology discussions.',
    ayahRefs: ['51:47', '21:30', '67:3-4'],
    tags: ['heavens', 'creation', 'tafseer-context'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/51/47' }],
    caution: 'Use this as reflective study, not as isolated scientific argument.',
  },
  {
    id: 'human-embryo-stages',
    category: 'Human Development',
    title: 'Stages of Human Development',
    summary: 'Verses describing development stages are frequently studied in relation to embryological language.',
    detail:
      'Interpretations differ among scholars; compare multiple tafsir sources and translations for balanced understanding.',
    ayahRefs: ['23:12-14', '22:5', '75:37-39'],
    tags: ['development', 'biology', 'tafsir'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/23/12-14' }],
  },
  {
    id: 'human-hearing-vision-heart',
    category: 'Human Development',
    title: 'Hearing, Vision, and Hearts',
    summary: 'The Quran repeatedly links hearing, sight, and inner understanding in a cognitive sequence.',
    detail:
      'This pattern is useful for reflection on moral perception and accountability.',
    ayahRefs: ['16:78', '67:23', '23:78'],
    tags: ['cognition', 'moral-perception', 'fitrah'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/16/78' }],
  },
  {
    id: 'water-life-origin',
    category: 'Water & Seas',
    title: 'Life Connected to Water',
    summary: 'The Quran repeatedly connects life with water as a foundational sign of creation.',
    detail:
      'This theme is a major reflection bridge between spiritual reading and natural observation.',
    ayahRefs: ['21:30', '24:45', '25:54'],
    tags: ['water', 'life', 'creation'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/21/30' }],
  },
  {
    id: 'water-two-seas-barrier',
    category: 'Water & Seas',
    title: 'Two Seas and Barrier Passages',
    summary: 'Verses describing two bodies of water and a barrier are often discussed in marine reflection studies.',
    detail:
      'Reading should combine linguistic tafsir and scientific humility, since terms can be interpreted in multiple ways.',
    ayahRefs: ['55:19-20', '25:53'],
    tags: ['marine', 'barrier', 'reflection'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/55/19-20' }],
    caution: 'Interpretive domain; avoid overstatement beyond the verse context.',
  },
  {
    id: 'earth-mountains-stability',
    category: 'Earth & Geology',
    title: 'Mountains and Stability Imagery',
    summary: 'Mountains are described as stabilizing features in several passages.',
    detail:
      'Scholars discuss literal and metaphorical dimensions; use tafsir references before modern geological mapping.',
    ayahRefs: ['16:15', '21:31', '78:6-7'],
    tags: ['mountains', 'earth', 'imagery'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/16/15' }],
  },
  {
    id: 'earth-rain-cycle',
    category: 'Earth & Geology',
    title: 'Rain Cycle and Reviving the Earth',
    summary: 'Rain, winds, clouds, and land revival appear as recurring ecological signs.',
    detail:
      'These verses connect natural cycles with resurrection symbolism and gratitude ethics.',
    ayahRefs: ['30:48-50', '7:57', '35:9'],
    tags: ['rain-cycle', 'ecology', 'resurrection-signs'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/30/48-50' }],
  },
  {
    id: 'history-rome-prophecy',
    category: 'History & Prophecy',
    title: 'Byzantine-Persian Conflict Passage',
    summary: 'A passage in Surah Ar-Rum is frequently cited in discussions of future historical reversal.',
    detail:
      'This card highlights the interpretive and historical reading tradition rather than presenting a simplified claim.',
    ayahRefs: ['30:2-4'],
    tags: ['history', 'prophetic-reading', 'ar-rum'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/30/2-4' }],
  },
  {
    id: 'history-preservation-pharaoh',
    category: 'History & Prophecy',
    title: 'Pharaoh as a Sign for Later Generations',
    summary: 'The verse about preserving Pharaoh as a sign is widely discussed in historical reflection circles.',
    detail:
      'Interpretations vary on details; the central message is moral warning and historical remembrance.',
    ayahRefs: ['10:92'],
    tags: ['pharaoh', 'historical-sign', 'warning'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/10/92' }],
  },
  {
    id: 'society-prohibition-intoxicants-gradual',
    category: 'Law, Society & Civilization',
    title: 'Gradual Legal Pedagogy (Intoxicants)',
    summary: 'The prohibition of intoxicants is revealed in stages, showing social reform methodology.',
    detail:
      'This staged approach is often studied as a model for behavioral change and community readiness.',
    ayahRefs: ['2:219', '4:43', '5:90-91'],
    tags: ['law', 'social-reform', 'gradualism'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/5/90-91' }],
  },
  {
    id: 'society-finance-zakat-riba',
    category: 'Law, Society & Civilization',
    title: 'Ethical Economic Framework',
    summary: 'The Quran contrasts charitable circulation of wealth with exploitative financial behavior.',
    detail:
      'Verses on zakat, charity, and riba form a coherent social justice framework in Islamic civilization discourse.',
    ayahRefs: ['2:275-279', '9:60', '59:7'],
    tags: ['economics', 'social-justice', 'zakat'],
    sources: [{ label: 'Quran.com', url: 'https://quran.com/2/275-279' }],
  },
];
