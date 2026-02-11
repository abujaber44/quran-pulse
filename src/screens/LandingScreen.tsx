import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

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
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        Quran Pulse
      </Animated.Text>

      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.subtitle}>
          Memorize • Recite • Understand
        </Text>

        <Text style={styles.description}>
          Quran Pulse is your companion to deeply connect with the Word of Allah.  
          Listen to beautiful recitations, reflect with clear tafseer, memorize with ease,  
          and understand the meanings — all in one peaceful place.
        </Text>
      </Animated.View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MemorizeUnderstand')}>
          <Text style={styles.buttonText}>Memorize & Understand</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AsmaAlHusna')}>
          <Text style={styles.buttonText}>Asma'a Allah Al-Husna</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('PrayerTimes')}>
          <Text style={styles.buttonText}>Prayer Times & Athan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Bookmarks')}>
          <Text style={styles.buttonText}>My Bookmarks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('QuranPlayer')}>
          <Text style={styles.buttonText}>Listen to Quran</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Calendar')}>
          <Text style={styles.buttonText}>Islamic Calendar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#2c3e50', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 24 
  },
  title: { 
    fontSize: 52, 
    fontWeight: 'bold', 
    color: '#fff', 
    fontFamily: 'AmiriQuran', 
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 24, 
    color: '#bdc3c7', 
    marginBottom: 16, 
    textAlign: 'center' 
  },
  description: { 
    fontSize: 18, 
    color: '#ecf0f1', 
    textAlign: 'center', 
    marginBottom: 40, 
    lineHeight: 26,
    paddingHorizontal: 20 
  },
  buttonContainer: { 
    width: '90%', 
    maxWidth: 400 
  },
  button: { 
    backgroundColor: '#27ae60', 
    paddingVertical: 18, 
    borderRadius: 16, 
    marginBottom: 16, 
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '600' 
  },
});