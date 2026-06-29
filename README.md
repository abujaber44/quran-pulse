# Quran Pulse 📖🕌

[![GitHub Release](https://img.shields.io/github/v/release/abujaber44/quran-pulse?color=27ae60&label=Latest%20Release)](https://github.com/abujaber44/quran-pulse/releases)

**Feel the Pulse of the Quran – Learn • Read • Reflect**

Quran Pulse is a peaceful, modern companion app to help you connect deeply with the Word of Allah — through learning, reading, recitation, and reflection — all in one serene place.

### ✨ Features

#### 📖 Mushaf Reader
- **Full Quran mushaf** — all 604 pages of the Madani mushaf rendered as HD images with dark theme integration
- **Swipe navigation** — flip through pages right-to-left like a physical mushaf, with seamless reading across juz boundaries
- **Page bookmarking** — bookmark your current page with optional ayah number to pick up where you left off
- **"Continue reading"** card in the Mushaf tab for one-tap access to your bookmarked page

#### 📚 Learn Mode
- **Complete Quran** with beautiful Uthmani script and multiple Arabic font choices (Scheherazade New default, Amiri Quran, Uthmanic Hafs, Noto Naskh, and more)
- **Clear English translation** (Abdel Haleem)
- **On-demand Tafseer** (التفسير الميسر – simple Arabic explanation)
- **Tajweed color-coded display** with 16 uniquely colored rules, tappable for instant bilingual explanations (no AI tokens — all built-in)
- **Word-by-word breakdown** for any ayah with translation and transliteration
- **Tap-to-reveal ayah actions** — tap any ayah to access Translation, Tafseer, Word-by-word, Tajweed, Ask AI, and Share
- **Memorization bookmarks** — bookmark ayahs for memorization with AI-powered quiz testing

#### 🎧 Audio Recitation
- **High-quality audio recitations** with multiple renowned reciters:
  - Mishary Rashid Alafasy
  - Mahmoud Khalil Al-Husary
  - Muhammad Siddiq Al-Minshawi
  - And more
- **Auto-scroll** during playback
- **Repeat mode** (single ayah or custom range) for memorization
- **Memorization mode** support

#### 🏠 Home Dashboard
- **Daily personalized ayah** — AI-selected based on your reading history, with animated loader and rotating inspirational messages
- **Reading progress** — streak tracking, ayahs read count, surahs completed
- **Continue learning** — one-tap return to your last studied ayah
- **Bilingual UI** — full Arabic and English interface with language toggle in Settings
- **Dark emerald theme** — consistent design across all screens

### 🤖 AI-Powered Features

Quran Pulse integrates AI (Claude by Anthropic) to provide intelligent Islamic scholarship — grounded in classical tafsir sources.

- **Ask AI about any Ayah** – tap "Ask AI ✦" on any verse for tafsir-grounded explanations, follow-up questions, context, grammar, and related verses
- **AI Semantic Search** – search the Quran by concept (e.g. "patience", "gratitude", "story of Moses") — AI finds the most relevant verses and explains why each is relevant
- **AI Memorization Coach** – generates personalized quizzes from your bookmarked ayahs in the app's current language (Arabic or English), weighted toward verses you've gotten wrong
- **AI Miracle Insights** – tap "Ask AI ✦" on any Quran miracle card for deep scholarly explanations with follow-up questions
- **AI Hadith Reflection** – tap "✦ AI Reflection" on the daily hadith for a personal reflection with practical action
- **AI Athkar Explanation** – tap "AI ✦" on any dhikr for meaning, spiritual significance, and hadith references

All AI responses follow the app's selected language. Responses for search and insights are cached locally for 7 days to reduce API usage and provide instant results on repeat queries.

### 📱 Screenshots

<div align="center">
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/Landing.png" width="30%" alt="Landing Screen" />
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/Memorize%26Understand.png" width="30%" alt="Learn & Read" style="margin: 0 10px;" />
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/IslamicCalendar.png" width="30%" alt="Islamic Calendar" />
</div>

<div align="center" style="margin-top: 16px;">
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/PrayerTimes.png" width="30%" alt="Prayer Times & Qibla" />
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/Athkar.png" width="30%" alt="Athkar & Remembrance" style="margin: 0 10px;" />
  <img src="https://raw.githubusercontent.com/abujaber44/quran-pulse/main/screenshots/Miracles.png" width="30%" alt="Quran Miracles" style="margin: 0 10px;" />
</div>

<p align="center">
  <em>Dark emerald theme with glassmorphic design — peaceful UI for reflection and connection.</em>
</p>

### 🕌 Prayer Times & Qibla
- Accurate prayer times via Aladhan API
- Full Athan audio played at prayer time (even when app is closed or phone is locked)
- 30-minute pre-prayer countdown notifications
- Toggle individual prayer alerts on/off
- Smart city search with autocomplete and one-tap location detection
- Next prayer highlighted with inline countdown and prayer-specific icons
- Past prayers dimmed for visual clarity
- Qibla summary with bearing and distance displayed above the prayer list
- Live Qibla compass with smooth animated rotation, custom arrow, tick marks, and green glow effect when aligned
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

### 📿 Athkar & Remembrance
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

### 📑 Bookmarks
- **Two bookmark categories**: Memorize (from Learn mode) and Read/Recite (from Mushaf reader)
- Ayah bookmarks save directly to Memorize for quick quiz access
- Mushaf page bookmark (single active bookmark) with optional ayah number
- AI Memorization Coach generates quizzes from memorized ayahs
- Filter by category, add personal notes, remove with one tap
- Navigate directly to bookmarked ayah or mushaf page

### 🎨 Design Philosophy
- **Dark emerald glassmorphic theme** — deep gradient backgrounds (`#123b36` → `#17384d` → `#1a4a60`) with translucent cards and subtle borders
- Consistent design language across all screens — no jarring transitions
- Scheherazade New font for authentic Quranic Arabic beauty (user-selectable from 8+ fonts)
- Decorative screen headers with gradient accent lines
- Platform-specific tajweed rendering (colored text on iOS, WebView on Android to preserve Arabic ligatures)
- Mushaf pages rendered with CSS inversion + screen blend mode for seamless dark theme integration
- Centered layout on landing screen for visual symmetry in both Arabic and English
- Smooth animations: pulsing daily ayah loader with rotating inspirational messages, green flash on bookmark navigation
- Thoughtful, heart-centered UX designed for reflection and connection

### 🛠 Tech Stack
- React Native + Expo (managed workflow)
- Context API for state management
- Expo Notifications for Athan alerts and pre-prayer countdowns
- Expo Audio for recitation playback
- Expo Location for city detection and Qibla compass heading
- Expo Image for optimized image loading and caching
- Expo Linear Gradient for background theming
- React Native WebView for mushaf page rendering and Android tajweed
- AsyncStorage for offline caching (daily ayah, AI responses, settings, reading progress, bookmarks)
- Aladhan API for prayer times and Islamic calendar
- Quran.com API for verses, translations, word-by-word, surah info, and tajweed data
- HD mushaf page images via GitHub CDN (604 Madani mushaf pages)
- Open tafseer sources (Tafsir Muyassar via CDN)
- **Claude AI (Haiku 4.5)** via Vercel serverless backend for all AI features
- Vercel serverless functions for secure API proxying (API keys never in the app)
- i18n system with full Arabic/English support via LanguageContext

### 🙏 Dua
May Allah accept this effort as sincere for His sake, make it a means of guidance and closeness to Him for all who use it, and grant us all the ability to live by the Quran. Ameen.

**Made with ❤️ for the Ummah**

---
**Quran Pulse** – Let the Quran touch your heart, one pulse at a time.
