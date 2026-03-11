import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

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

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, { opacity: fadeAnim }]}>
          <Text style={styles.eyebrow}>Bismillah</Text>
          <Text style={styles.title}>Quran Pulse</Text>
          <Text style={styles.subtitle}>Memorize • Recite • Understand</Text>
        </Animated.View>

        <Animated.View style={[styles.introCard, { opacity: fadeAnim }]}>
          <Text style={styles.description}>
            Quran Pulse is your peaceful companion to connect deeply with the Word of Allah. Read, listen, reflect,
            keep prayer rhythm, practice morning/evening athkar, use Tasbeeh, and return to your saved ayahs from one focused home screen.
          </Text>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core Features</Text>
          <Text style={styles.sectionSubtitle}>Your daily journey</Text>
        </View>

        <View style={styles.primaryStack}>
          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('MemorizeUnderstand')}>
            <View style={[styles.cardAccent, { backgroundColor: UI_COLORS.primary }]} />
            <View style={styles.cardContent}>
              <Text style={styles.primaryCardTitle}>Memorize & Understand</Text>
              <Text style={styles.primaryCardSubtitle}>Ayah-by-ayah learning and reflection</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('QuranPlayer')}>
            <View style={[styles.cardAccent, { backgroundColor: UI_COLORS.accent }]} />
            <View style={styles.cardContent}>
              <Text style={styles.primaryCardTitle}>Listen to Quran</Text>
              <Text style={styles.primaryCardSubtitle}>Smooth recitation with lock-screen controls</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryGrid}>
          <TouchableOpacity style={styles.secondaryCard} onPress={() => navigation.navigate('PrayerTimes')}>
            <Text style={styles.secondaryCardTitle}>Prayer Times</Text>
            <Text style={styles.secondaryCardSubtitle}>Athan + Qibla guidance</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryCard} onPress={() => navigation.navigate('Calendar')}>
            <Text style={styles.secondaryCardTitle}>Islamic Calendar</Text>
            <Text style={styles.secondaryCardSubtitle}>Hijri month view + daily hadith</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryCard} onPress={() => navigation.navigate('Athkar')}>
            <Text style={styles.secondaryCardTitle}>Athkar</Text>
            <Text style={styles.secondaryCardSubtitle}>Morning/Evening + Tasbeeh + Asma Al-Husna</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryCard} onPress={() => navigation.navigate('QuranMiracles')}>
            <Text style={styles.secondaryCardTitle}>Quran Miracles</Text>
            <Text style={styles.secondaryCardSubtitle}>Real categories with ayah refs and sources</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.utilitySection}>
          <Text style={styles.utilityTitle}>Quick Access</Text>
          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Bookmarks')}>
              <Text style={styles.utilityButtonTitle}>My Bookmarks</Text>
              <Text style={styles.utilityButtonSubtitle}>Open saved ayahs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.utilityButtonTitle}>Settings</Text>
              <Text style={styles.utilityButtonSubtitle}>Text size and app options</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.text,
  },
  bgOrbTop: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 160,
    backgroundColor: 'rgba(31,157,85,0.22)',
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 180,
    backgroundColor: 'rgba(45,127,184,0.2)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 14,
    color: UI_COLORS.primarySoft,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 54,
    fontWeight: 'bold',
    color: UI_COLORS.white,
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 19,
    color: '#d6e4ee',
    alignItems: 'center',
    marginBottom: 6,
  },
  introCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: UI_RADII.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    color: '#eaf2f8',
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#c6d3de',
  },
  primaryStack: {
    marginBottom: 14,
  },
  primaryCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: UI_RADII.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...UI_SHADOWS.card,
  },
  cardAccent: {
    width: 8,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  primaryCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  primaryCardSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#d0dde8',
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  secondaryCard: {
    width: '48.5%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: UI_RADII.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...UI_SHADOWS.input,
  },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  secondaryCardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#d0dde8',
  },
  utilitySection: {
    backgroundColor: 'rgba(18,59,54,0.7)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.35)',
    padding: 14,
    ...UI_SHADOWS.card,
  },
  utilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
    marginBottom: 10,
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  utilityButton: {
    width: '48%',
    backgroundColor: 'rgba(215,239,225,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.3)',
    borderRadius: UI_RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  utilityButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
  utilityButtonSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#d7efe1',
    textAlign: 'center',
  },
});
