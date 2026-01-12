import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';

import { AudioProvider } from './src/context/AudioContext';
import { SettingsProvider } from './src/context/SettingsContext';

import HomeScreen from './src/screens/HomeScreen';
import SurahScreen from './src/screens/SurahScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AsmaAlHusnaScreen from './src/screens/AsmaAlHusnaScreen';
import PrayerTimesScreen from './src/screens/PrayerTimesScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import QuranPlayerScreen from './src/screens/QuranPlayerScreen'; // ← Added

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        AmiriQuran: require('./assets/fonts/Amiri-Regular.ttf'),
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null; // Loading screen
  }

  return (
    <SettingsProvider>
      <AudioProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Surah"
              component={SurahScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen 
              name="AsmaAlHusna" 
              component={AsmaAlHusnaScreen} 
              options={{ title: 'Asma Al-Husna' }}
            />
            <Stack.Screen
              name="PrayerTimes"
              component={PrayerTimesScreen}
              options={{ title: 'Prayer Times' }}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={{ title: 'Bookmarks' }}
            />
            {/* New: Quran Player Screen */}
            <Stack.Screen
              name="QuranPlayer"
              component={QuranPlayerScreen}
              options={{ title: 'Listen to Quran' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AudioProvider>
    </SettingsProvider>
  );
}