# Quran Pulse 📖🕌

[![GitHub Release](https://img.shields.io/github/v/release/abujaber44/quran-pulse?color=27ae60&label=Latest%20Release)](https://github.com/abujaber44/quran-pulse/releases)

**Feel the Pulse of the Quran – Memorize • Recite • Understand**

Quran Pulse is a peaceful, modern companion app to help you connect deeply with the Word of Allah — through recitation, reflection, memorization, and understanding — all in one serene place.

### ✨ Features

- **Complete Quran** with beautiful Uthmani script
- **Clear English translation** (Abdel Haleem)
- **On-demand Tafseer** (التفسير الميسر – simple Arabic explanation)
- **High-quality audio recitations** with multiple renowned reciters:
  - Mishary Rashid Alafasy
  - Mahmoud Khalil Al-Husary
  - Muhammad Siddiq Al-Minshawi
  - And more
- **Auto-scroll** during playback
- **Repeat mode** (single ayah or custom range) for memorization
- **Memorization mode** support
- **Deep Quran search** in Memorize & Understand — search by surah name or any Arabic/English Quran word across all ayahs, then jump directly to the matching surah/ayah
- **Athkar Screen** – morning/evening athkar, Tasbeeh 33x, and 99 Names of Allah (Asma Al-Husna)
- **Prayer Times, Athan & Qibla Compass** – accurate timings, full Athan audio alerts, and live Qibla direction guidance
- **Quran Miracles** – curated reflection cards across real miracle categories with ayah references and source links
- **Islamic Calendar** – full Hijri month view with corresponding Gregorian dates
- **Bookmarks** – save and revisit your favorite ayahs anytime
- **Smart bookmark folders** – tag ayahs as **Memorize** or **Read/Recite** and filter quickly with chips
- **Clean, spiritual UI** with focus on Arabic typography

### 📱 Screenshots
<!-- Your screenshots code here -->

<div align="center">
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Landing.png" width="30%" alt="Landing Screen" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Memorize%26Understand.png" width="30%" alt="Memorize & Understand" style="margin: 0 10px;" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/IslamicCalendar.png" width="30%" alt="Islamic Calendar" />
</div>

<div align="center" style="margin-top: 16px;">
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/PrayerTimes.png" width="30%" alt="Prayer Times & Athan" />
  <img src="https://github.com/abujaber44/quran-pulse/blob/main/screenshots/Asma'aAlhusna.png" width="30%" alt="Athkar Screen" style="margin: 0 10px;" />
</div>

<p align="center">
  <em>Beautiful, peaceful UI designed for reflection and connection with the Quran.</em>
</p>

### 🕌 Prayer Times & Athan
- Accurate prayer times via Aladhan API
- Full Athan audio played at prayer time (even when app is closed or phone is locked)
- Toggle individual prayer alerts on/off
- Auto-detect location or manually set city
- Next prayer highlighted
- Live Qibla compass with turn-by-turn direction to the Kaaba
- Calibration guidance when compass accuracy is low
- Haptic confirmation when Qibla alignment is achieved

### 🧠 Quran Miracles (CMS + Fallback)
- New dedicated page for Quran miracle/reflection themes with **real categories** (examples):
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
- Tasbeeh 33x tracker with daily local progress persistence
- Full 99 Beautiful Names of Allah tab with Arabic, transliteration, and English meaning

### 🎨 Design Philosophy
- Inspired by tranquility, light, and closeness to Allah
- Calming greens and deep blues with golden accents
- Amiri Quran font for authentic Arabic beauty
- Smooth animations and thoughtful, heart-centered UX

### 🛠 Tech Stack
- React Native + Expo (managed workflow)
- Context API for state management
- Expo Notifications for Athan alerts
- Expo Audio for recitation playback
- Expo Location for city detection and Qibla compass heading
- Aladhan API for prayer times and Islamic calendar
- Quran.com & open tafseer sources

### 🙏 Dua
May Allah accept this effort as sincere for His sake, make it a means of guidance and closeness to Him for all who use it, and grant us all the ability to live by the Quran. Ameen.

**Made with ❤️ for the Ummah**

---
**Quran Pulse** – Let the Quran touch your heart, one pulse at a time.
