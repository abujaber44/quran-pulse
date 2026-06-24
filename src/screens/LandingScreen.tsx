import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_COLORS, UI_RADII, UI_SHADOWS, UI_GRADIENTS } from '../theme/ui';
import { useLanguage } from '../i18n';

type RootStackParamList = {
  MemorizeUnderstand: undefined;
  Athkar: undefined;
  PrayerTimes: undefined;
  QuranMiracles: undefined;
  Bookmarks: undefined;
  QuranPlayer: undefined;
  Calendar: undefined;
  Settings: undefined;
};

const ICONS: Record<string, string> = {
  MemorizeUnderstand: '📖',
  QuranPlayer: '🎧',
  PrayerTimes: '🕌',
  Calendar: '📅',
  Athkar: '📿',
  QuranMiracles: '✨',
  Bookmarks: '🔖',
  Settings: '⚙️',
};

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={UI_GRADIENTS.heroLight} style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.eyebrow}>{t.bismillah}</Text>
          <Text style={styles.title}>{t.appName}</Text>
          <Text style={styles.subtitle}>{t.appTagline}</Text>
        </Animated.View>

        <Animated.View style={[styles.introCard, { opacity: fadeAnim }]}>
          <Text style={styles.description}>{t.appDescription}</Text>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.coreFeatures}</Text>
          <Text style={styles.sectionSubtitle}>{t.dailyJourney}</Text>
        </View>

        <View style={styles.primaryStack}>
          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('MemorizeUnderstand')} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(31,157,85,0.2)', 'rgba(31,157,85,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryCardGradient}>
              <Text style={styles.cardIcon}>{ICONS.MemorizeUnderstand}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>{t.memorizeUnderstand}</Text>
                <Text style={styles.primaryCardSubtitle}>{t.memorizeUnderstandDesc}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('QuranPlayer')} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(45,127,184,0.2)', 'rgba(45,127,184,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryCardGradient}>
              <Text style={styles.cardIcon}>{ICONS.QuranPlayer}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>{t.listenToQuran}</Text>
                <Text style={styles.primaryCardSubtitle}>{t.listenToQuranDesc}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryGrid}>
          {([
            { route: 'PrayerTimes' as const, title: t.prayerTimes, sub: t.prayerTimesDesc },
            { route: 'Calendar' as const, title: t.islamicCalendar, sub: t.islamicCalendarDesc },
            { route: 'Athkar' as const, title: t.athkar, sub: t.athkarDesc },
            { route: 'QuranMiracles' as const, title: t.quranMiracles, sub: t.quranMiraclesDesc },
          ]).map((item) => (
            <TouchableOpacity key={item.route} style={styles.secondaryCard} onPress={() => navigation.navigate(item.route)} activeOpacity={0.8}>
              <Text style={styles.secondaryIcon}>{ICONS[item.route]}</Text>
              <Text style={styles.secondaryCardTitle}>{item.title}</Text>
              <Text style={styles.secondaryCardSubtitle}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.utilitySection}>
          <Text style={styles.utilityTitle}>{t.quickAccess}</Text>
          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.8}>
              <Text style={styles.utilityIcon}>{ICONS.Bookmarks}</Text>
              <Text style={styles.utilityButtonTitle}>{t.myBookmarks}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
              <Text style={styles.utilityIcon}>{ICONS.Settings}</Text>
              <Text style={styles.utilityButtonTitle}>{t.settings}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgOrbTop: {
    position: 'absolute',
    top: -100,
    right: -70,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(31,157,85,0.18)',
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(45,127,184,0.15)',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 44,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 13,
    color: UI_COLORS.primarySoft,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10,
    opacity: 0.9,
  },
  title: {
    fontSize: 52,
    fontWeight: 'bold',
    color: UI_COLORS.white,
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(214,228,238,0.9)',
    letterSpacing: 1,
  },
  introCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: UI_RADII.xl,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: 'rgba(234,242,248,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.white,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: 'rgba(198,211,222,0.8)',
  },
  primaryStack: {
    marginBottom: 16,
    gap: 12,
  },
  primaryCard: {
    borderRadius: UI_RADII.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.card),
  },
  primaryCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  primaryCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  primaryCardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(208,221,232,0.85)',
    lineHeight: 18,
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 10,
  },
  secondaryCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 16,
    paddingHorizontal: 14,
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.input),
  },
  secondaryIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  secondaryCardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(208,221,232,0.75)',
    lineHeight: 17,
  },
  utilitySection: {
    backgroundColor: 'rgba(18,59,54,0.55)',
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.2)',
    padding: 16,
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.card),
  },
  utilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
    marginBottom: 12,
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  utilityButton: {
    flex: 1,
    backgroundColor: 'rgba(215,239,225,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.2)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  utilityIcon: {
    fontSize: 20,
  },
  utilityButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
});
