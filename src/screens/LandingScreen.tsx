import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

type RootStackParamList = {
  MemorizeUnderstand: undefined;
  AsmaAlHusna: undefined;
  PrayerTimes: undefined;
  Bookmarks: undefined;
  QuranPlayer: undefined;
  Calendar: undefined;
};

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
          Quran Pulse
        </Animated.Text>

        <Animated.View style={[styles.introCard, { opacity: fadeAnim }]}>
          <Text style={styles.subtitle}>
            Memorize • Recite • Understand
          </Text>

          <Text style={styles.description}>
            Quran Pulse is your peaceful companion to connect deeply with the Word of Allah.
            Listen to beautiful recitations, reflect through clear tafseer, memorize and understand ayah by ayah,
            explore the 99 Beautiful Names of Allah, follow daily prayer times with Athan reminders,
            keep your favorite verses in bookmarks, and stay mindful of the Islamic calendar — all in one serene place.
          </Text>
        </Animated.View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MemorizeUnderstand')}>
            <Text style={styles.buttonText}>Memorize & Understand</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('QuranPlayer')}>
            <Text style={styles.buttonText}>Listen to Quran</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AsmaAlHusna')}>
            <Text style={styles.buttonText}>Asma'a Allah Al-Husna</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('PrayerTimes')}>
            <Text style={styles.buttonText}>Prayer Times & Athan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Calendar')}>
            <Text style={styles.buttonText}>Islamic Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Bookmarks')}>
            <Text style={styles.buttonText}>My Bookmarks</Text>
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
  },
  title: { 
    fontSize: 52, 
    fontWeight: 'bold', 
    color: UI_COLORS.white, 
    fontFamily: 'AmiriQuran', 
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: { 
    fontSize: 24, 
    color: UI_COLORS.textLight, 
    marginBottom: 16, 
    textAlign: 'center' 
  },
  introCard: {
    alignItems: 'center',
    width: '92%',
    maxWidth: 760,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: UI_RADII.lg,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  description: { 
    fontSize: 18, 
    color: '#ecf0f1', 
    textAlign: 'center', 
    marginBottom: 36, 
    lineHeight: 27,
    maxWidth: 720,
    paddingHorizontal: 18,
  },
  buttonContainer: { 
    width: '90%', 
    maxWidth: 400 
  },
  button: { 
    backgroundColor: UI_COLORS.primary, 
    paddingVertical: 17, 
    borderRadius: UI_RADII.md, 
    marginBottom: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...UI_SHADOWS.card,
  },
  buttonText: { 
    color: UI_COLORS.white, 
    fontSize: 18, 
    fontWeight: '600' 
  },
});
