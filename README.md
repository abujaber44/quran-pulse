# Quran Pulse 📖🕌

[![GitHub Release](https://img.shields.io/github/v/release/abujaber44/quran-pulse?color=27ae60&label=Latest%20Release)](https://github.com/abujaber44/quran-pulse/releases)

**Feel the Pulse of the Quran – Learn • Read • Reflect**

Quran Pulse is a peaceful, modern companion app to help you connect deeply with the Word of Allah — through learning, reading, recitation, and reflection — all in one serene place.

### ✨ Features

#### 📖 Mushaf Reader
- **Full Quran mushaf** — all 604 pages of the Madani mushaf rendered as HD images with dark theme integration
- **Swipe navigation** — flip through pages right-to-left like a physical mushaf, with seamless reading across juz boundaries
- **Jump navigation** — go directly to any surah, juz, or page number from a quick picker
- **Page bookmarking** — bookmark your current page with optional ayah number to pick up where you left off
- **Bookmark history** — the last 3 replaced page bookmarks stay available as restorable chips in My Bookmarks
- **Auto-saved reading position** — your last viewed page is remembered automatically, even without an explicit bookmark
- **"Continue reading"** card in the Mushaf tab for one-tap access to your bookmarked or last-viewed page
- **Offline mushaf pages** — pages are cached to the device as you read, with the next few pages pre-fetched in the background for seamless offline reading
- **Khatmah planner** — set a goal to complete the Quran in 30/60/90 or a custom number of days; progress and daily quota tracked automatically as you read

#### 📚 Learn Mode
- **Complete Quran** with beautiful Uthmani script and multiple Arabic font choices (Scheherazade New default, Amiri Quran, Uthmanic Hafs, Noto Naskh, and more)
- **Multiple English translations** — Abdel Haleem, Saheeh International, and Mufti Taqi Usmani, selectable in Settings
- **Multiple Tafseer sources** — Al-Muyassar, Ibn Kathir, As-Saadi, and Al-Qurtubi, selectable in Settings
- **Tajweed color-coded display** with 16 uniquely colored rules, tappable for instant bilingual explanations (no AI tokens — all built-in)
- **Word-by-word breakdown** for any ayah with translation and transliteration
- **Tap-to-reveal ayah actions** — tap any ayah to access Translation, Tafseer, Word-by-word, Tajweed, Ask AI, and Share
- **Offline-first Quran data** — verses, translations, tafseer, tajweed, and word-by-word are cached locally after first load for instant, offline access
- **Memorization bookmarks** — bookmark ayahs for memorization with AI-powered quiz testing
- **Spaced-repetition review** — quiz results schedule each memorized verse for review (1 → 3 → 7 → 14 → 30 → 60 days); a "due for review" reminder appears on the home screen
- **Hide-and-reveal practice mode** — recite a memorized ayah from memory, reveal it to check, and self-grade — no AI needed
- Reading progress now counts both playing an ayah's audio **and** tapping to study it (translation, tafseer, word-by-word, etc.)

#### 🎧 Audio Recitation
- **High-quality audio recitations** with multiple renowned reciters:
  - Mishary Rashid Alafasy
  - Mahmoud Khalil Al-Husary
  - Muhammad Siddiq Al-Minshawi
  - And more
- **Offline audio downloads** — download any surah's recitation for offline playback, with progress indicator and one-tap removal
- **Automatic ayah caching** — any ayah played once is cached locally and replays offline afterward
- **Auto-scroll** during playback
- **Repeat mode** (single ayah or custom range) for memorization
- **Memorization mode** support

#### 🏠 Home Dashboard
- **Daily personalized ayah** — AI-selected based on your reading history, with animated loader and rotating inspirational messages
- **Reading progress** — streak tracking, ayahs studied count, surahs completed, tap through to a full Stats screen
- **Stats screen** — weekly reading activity chart, quiz accuracy, mastered verses, and khatmah progress in one place
- **Khatmah progress card** — day number, pages read, and today's remaining quota, one tap from reading to your next page
- **Ramadan mode** — during Ramadan, a live card shows the day of Ramadan with a suhoor/iftar countdown based on your saved city
- **Continue learning** — one-tap return to your last studied ayah
- **Smart daily reminder** — a rotating ayah-based notification in your app language, plus a streak-protection alert if your streak is about to end
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
- **Full-track audio recitation** of morning and evening athkar (Mishary Rashid Alafasy), with play/pause and seek
- **Background playback** — athkar audio keeps playing when the app is backgrounded or the screen is locked, with lock-screen controls
- **Offline audio download** — download the morning/evening track for offline listening, with progress indicator
- On-demand **Show Fadl** per dhikr card
- **AI Explain ✦** per dhikr — get the meaning, spiritual significance, and hadith references (cached per item)
- If Fadl is missing, the app shows Hadith text; if both are missing, a smart guidance fallback is shown
- Tasbeeh 33x tracker with daily local progress persistence
- Full 99 Beautiful Names of Allah tab with Arabic, transliteration, and English meaning

Set Athkar content endpoint in environment variables:

```bash
EXPO_PUBLIC_ATHKAR_API_URL=https://your-domain.com/athkar.json
```

Set Athkar audio endpoints (direct, hosted MP3 URLs — optional):

```bash
EXPO_PUBLIC_ATHKAR_MORNING_AUDIO_URL=https://your-domain.com/morning-athkar.mp3
EXPO_PUBLIC_ATHKAR_EVENING_AUDIO_URL=https://your-domain.com/evening-athkar.mp3
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
- **Bookmark history** — the last 3 replaced page bookmarks are kept as restorable chips, so an accidental overwrite never loses your place
- **AI Memorization Coach** generates quizzes from memorized ayahs
- **Practice mode** — hide-and-reveal recitation practice for memorized ayahs, prioritizing verses due for spaced-repetition review
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
- Expo Notifications for Athan alerts, pre-prayer countdowns, and rotating daily/streak-protection reminders
- Expo Audio for recitation and athkar playback, with background playback and lock-screen controls
- Expo File System for offline audio downloads (surah recitations, athkar tracks) and mushaf page caching
- Expo Location for city detection and Qibla compass heading
- Expo Image for optimized image loading and caching
- Expo Linear Gradient for background theming
- React Native WebView for mushaf page rendering and Android tajweed
- AsyncStorage for offline caching (Quran text/translations/tafseer/tajweed, daily ayah, AI responses, settings, reading progress, bookmarks, khatmah and review schedules)
- Aladhan API for prayer times, Islamic calendar, and Ramadan detection
- Quran.com API for verses, translations, word-by-word, surah info, and tajweed data
- HD mushaf page images via GitHub CDN (604 Madani mushaf pages), downloaded and cached locally with read-ahead prefetch
- Open tafseer sources (Al-Muyassar, Ibn Kathir, As-Saadi, Al-Qurtubi via CDN)
- Athkar audio hosted on the Internet Archive (Mishary Rashid Alafasy)
- **Claude AI (Haiku 4.5)** via Vercel serverless backend for all AI features
- Vercel serverless functions for secure API proxying (API keys never in the app)
- i18n system with full Arabic/English support via LanguageContext

### 🙏 Dua
May Allah accept this effort as sincere for His sake, make it a means of guidance and closeness to Him for all who use it, and grant us all the ability to live by the Quran. Ameen.

**Made with ❤️ for the Ummah**

---
**Quran Pulse** – Let the Quran touch your heart, one pulse at a time.
