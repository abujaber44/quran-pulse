// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer, CommonActions, NavigationProp, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text } from 'react-native';
import * as Font from 'expo-font';

import { AudioProvider } from './src/context/AudioContext';
import { SettingsProvider } from './src/context/SettingsContext';

import LandingScreen from './src/screens/LandingScreen';
import MemorizeUnderstandScreen from './src/screens/MemorizeUnderstandScreen';
import SurahScreen from './src/screens/SurahScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AsmaAlHusnaScreen from './src/screens/AsmaAlHusnaScreen';
import PrayerTimesScreen from './src/screens/PrayerTimesScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import QuranPlayerScreen from './src/screens/QuranPlayerScreen';

const Stack = createNativeStackNavigator();

// Reusable custom back button (blue text, "← Home")
const CustomBackButton = ({ navigation }: { navigation: NavigationProp<ParamListBase> }) => (
  <TouchableOpacity 
    style={{
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: '#3498db',        // Blue border to match text
      borderRadius: 16,
      alignItems: 'center',
    }}
    onPress={() => navigation.dispatch(CommonActions.goBack())}
  >
    <Text style={{ fontSize: 18, color: '#3498db', fontWeight: '600' }}>← Home</Text>
  </TouchableOpacity>
);

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
          <Stack.Navigator initialRouteName="Landing">
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{ headerShown: false } as any}
            />
            <Stack.Screen
              name="MemorizeUnderstand"
              component={MemorizeUnderstandScreen}
              options={({ navigation }) => ({
                title: 'Memorize & Understand',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="Surah"
              component={SurahScreen}
              options={{ headerShown: false } as any}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={({ navigation }) => ({
                title: 'Settings',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
            <Stack.Screen 
              name="AsmaAlHusna" 
              component={AsmaAlHusnaScreen} 
              options={({ navigation }) => ({
                title: 'Asma Al-Husna',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="PrayerTimes"
              component={PrayerTimesScreen}
              options={({ navigation }) => ({
                title: 'Prayer Times',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={({ navigation }) => ({
                title: 'Bookmarks',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="QuranPlayer"
              component={QuranPlayerScreen}
              options={({ navigation }) => ({
                title: 'Listen to Quran',
                headerLeft: () => <CustomBackButton navigation={navigation} />,
              })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AudioProvider>
    </SettingsProvider>
  );
}