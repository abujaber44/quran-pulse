# Quran Pulse 📖🕌

[![GitHub Release](https://img.shields.io/github/v/release/abujaber44/quran-pulse?color=27ae60&label=Latest%20Release)](https://github.com/abujaber44/quran-pulse/releases)

**Feel the Pulse of the Quran – Memorize • Recite • Understand**

Quran Pulse is a peaceful, modern companion app to help you connect deeply with the Word of Allah — through recitation, reflection, memorization, and understanding — all in one serene place.

### ✨ Features

- **Complete Quran** with beautiful Uthmani script and multiple Arabic font choices (Scheherazade New default, Amiri Quran, Uthmanic Hafs, Noto Naskh, and more)
- **Clear English translation** (Abdel Haleem)
- **On-demand Tafseer** (التفسير الميسر – simple Arabic explanation)
- **Tajweed color-coded display** with 16 rules, tappable for instant explanations (no AI tokens — all built-in with bilingual descriptions and examples)
- **Word-by-word breakdown** for any ayah with translation and transliteration
- **High-quality audio recitations** with multiple renowned reciters:
  - Mishary Rashid Alafasy
  - Mahmoud Khalil Al-Husary
  - Muhammad Siddiq Al-Minshawi
  - And more
- **Auto-scroll** during playback
- **Repeat mode** (single ayah or custom range) for memorization
- **Memorization mode** support
- **Tap-to-reveal ayah actions** — tap any ayah to access Translation, Tafseer, Word-by-word, Tajweed, Ask AI, and Share
- **Bookmarks** – save and revisit your favorite ayahs with green flash highlight on navigation
- **Smart bookmark folders** – tag ayahs as **Memorize** or **Read/Recite** and filter quickly with chips
- **Daily personalized ayah** on the landing screen — AI-selected based on your reading history, cached per day
- **Bilingual UI** — full Arabic and English interface with language toggle in Settings
- **Dark emerald theme** — consistent glassmorphic design across all screens with translucent cards and gradient backgrounds

### 🤖 AI-Powered Features

Quran Pulse integrates AI (Claude by Anthropic) to provide intelligent, bilingual (English + Arabic) Islamic scholarship — grounded in classical tafsir sources.

- **Ask AI about any Ayah** – tap "Ask AI ✦" on any verse in the Surah reader to get tafsir-grounded explanations, ask follow-up questions, and explore context, grammar, and related verses
- **AI Semantic Search** – search the Quran by concept (e.g. "patience", "gratitude", "story of Moses") instead of exact text matching. AI finds the most relevant verses and explains why each is relevant
- **AI Memorization Coach** – generates personalized quizzes from your bookmarked "Memorize" ayahs in the app's current language (Arabic or English). Tracks your quiz history and weights questions toward verses you've gotten wrong
- **AI Miracle Insights** – tap "Ask AI ✦" on any Quran miracle card for a deep scholarly explanation with follow-up questions. References scientific evidence and classical/modern scholarship
- **AI Hadith Reflection** – tap "✦ AI Reflection" on the daily hadith for a personal reflection connecting the hadith to daily life with a practical action to take
- **AI Athkar Explanation** – tap "AI ✦" on any dhikr to get the meaning of the Arabic words, spiritual significance, and when/why to recite it

All AI responses follow the app's selected language. AI responses for search and insights are cached locally for 7 days to save tokens and provide instant results on repeat queries.

### 📱 Screenshots
<!-- Your screenshots code here -->

<div align="center">
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Landing.png" width="30%" alt="Landing Screen" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Memorize%26Understand.png" width="30%" alt="Memorize & Understand" style="margin: 0 10px;" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/IslamicCalendar.png" width="30%" alt="Islamic Calendar" />
</div>

<div align="center" style="margin-top: 16px;">
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/PrayerTimes.png" width="30%" alt="Prayer Times & Athan" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Athkar.png" width="30%" alt="Athkar Screen" style="margin: 0 10px;" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Miracles.png" width="30%" alt="Miracles Screen" style="margin: 0 10px;" />
</div>

<p align="center">
  <em>Beautiful, peaceful UI designed for reflection and connection with the Quran.</em>
</p>

### 🕌 Prayer Times & Athan
- Accurate prayer times via Aladhan API
- Full Athan audio played at prayer time (even when app is closed or phone is locked)
- Toggle individual prayer alerts on/off
- Smart city search with autocomplete and one-tap location detection
- Next prayer highlighted with inline countdown and prayer-specific icons
- Past prayers dimmed for visual clarity
- Qibla summary with bearing and distance displayed above the prayer list
- Live Qibla compass (300px dial) with smooth animated rotation, custom arrow, tick marks, and green glow effect when aligned
- Calibration guidance when compass accuracy is low
- Haptic confirmation when Qibla alignment is achieved

### 🧠 Quran Miracles (CMS + Fallback + AI)
- Dedicated page for Quran miracle/reflection themes with **real categories** (examples):
- **Ask AI ✦** button on every miracle card for deep scholarly explanations with follow-up questions
  - `Language & Eloquence`
  - `Numerical Patterns`
  - `Cosmology & Natural World`
  - `History & Prophecy`
  - `Law, Society & Civilization`
- Dynamic category chips are generated from your dataset automatically (no hardcoded 4-category model)
- Each card includes:
  - concise claim summary
  - ayah references
  - source links
  - examples (when available)
  - caution note (when needed)
- Content loading strategy:
  - Uses CMS JSON endpoint if configured
  - Falls back automatically to bundled local dataset if CMS is unavailable

Set CMS endpoint in environment variables:

```bash
EXPO_PUBLIC_MIRACLES_CMS_URL=https://your-domain.com/quran-miracles.json
```

Starter dataset (ready to host): [`cms/quran-miracles.json`](cms/quran-miracles.json)

Expected CMS JSON shape:

```json
{
  "updatedAt": "2026-03-09",
  "items": [
    {
      "id": "words-paired-concepts",
      "category": "Language & Eloquence",
      "title": "Paired Concept Patterns",
      "summary": "Short summary",
      "detail": "Detailed explanation",
      "ayahRefs": ["2:201", "87:16-17"],
      "tags": ["word-frequency", "reflection"],
      "examples": [
        {
          "title": "Primary reference",
          "description": "Begin with this verse in tafsir context.",
          "ayahRef": "2:201",
          "sourceUrl": "https://quran.com/2/201"
        }
      ],
      "sources": [
        { "label": "Quranic Arabic Corpus", "url": "https://corpus.quran.com" }
      ],
      "caution": "Optional caution note"
    }
  ]
}
```

### 📿 Athkar Screen
- Morning and evening athkar in one dedicated flow
- Online athkar content loading via JSON endpoint, with automatic fallback to local content
- On-demand **Show Fadl** per dhikr card
- **AI Explain ✦** per dhikr — get the meaning, spiritual significance, and hadith references (cached per item)
- If Fadl is missing, the app shows Hadith text; if both are missing, a smart guidance fallback is shown
- Tasbeeh 33x tracker with daily local progress persistence
- Full 99 Beautiful Names of Allah tab with Arabic, transliteration, and English meaning

Set Athkar endpoint in environment variables:

```bash
EXPO_PUBLIC_ATHKAR_API_URL=https://your-domain.com/athkar.json
```

Starter dataset (ready to host): [`cms/athkar.json`](cms/athkar.json)

Expected Athkar JSON shape:

```json
{
  "morning": [
    {
      "title": "Ayat Al-Kursi",
      "text": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ...",
      "count": 1,
      "fadl": "Optional fadl text",
      "hadith_text": "Optional hadith text",
      "source": "Optional source",
      "audio": "Optional audio URL"
    }
  ],
  "evening": [
    {
      "title": "Ayat Al-Kursi",
      "text": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ...",
      "count": 1
    }
  ]
}
```

### 🎨 Design Philosophy
- **Dark emerald glassmorphic theme** — deep gradient backgrounds (`#123b36` → `#17384d` → `#1a4a60`) with translucent cards and subtle borders
- Consistent design language across all screens — no jarring transitions
- Scheherazade New font for authentic Quranic Arabic beauty (user-selectable from 8+ fonts)
- Decorative screen headers with gradient accent lines
- Platform-specific tajweed rendering (colored text on iOS, colored underlines on Android to preserve Arabic ligatures)
- Centered layout on landing screen for visual symmetry in both Arabic and English
- Smooth animations: pulsing daily ayah loader with rotating inspirational messages, green flash on bookmark navigation
- Thoughtful, heart-centered UX designed for reflection and connection

### 🛠 Tech Stack
- React Native + Expo (managed workflow)
- Context API for state management
- Expo Notifications for Athan alerts and 30-minute pre-prayer countdowns
- Expo Audio for recitation playback
- Expo Location for city detection and Qibla compass heading
- Expo Linear Gradient for background theming
- AsyncStorage for offline caching (daily ayah, AI responses, settings, reading progress)
- Aladhan API for prayer times and Islamic calendar
- Quran.com API for verses, translations, word-by-word, surah info, and tajweed data
- Open tafseer sources (Tafsir Muyassar via CDN)
- **Claude AI (Haiku 4.5)** via Vercel serverless backend for all AI features
- Vercel serverless functions for secure API proxying (API keys never in the app)
- i18n system with full Arabic/English support via LanguageContext

### 🙏 Dua
May Allah accept this effort as sincere for His sake, make it a means of guidance and closeness to Him for all who use it, and grant us all the ability to live by the Quran. Ameen.

**Made with ❤️ for the Ummah**

---
**Quran Pulse** – Let the Quran touch your heart, one pulse at a time.
