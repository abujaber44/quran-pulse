import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  CommonActions,
  NavigationProp,
  ParamListBase,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View } from 'react-native';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { AudioProvider } from './src/context/AudioContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { ThemedAlertProvider } from './src/context/ThemedAlertContext';
import { CUSTOM_FONT_ASSETS } from './src/theme/fonts';
import { UI_COLORS, UI_RADII } from './src/theme/ui';

import LandingScreen from './src/screens/LandingScreen';
import MemorizeUnderstandScreen from './src/screens/MemorizeUnderstandScreen';
import SurahScreen from './src/screens/SurahScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AthkarScreen from './src/screens/AsmaAlHusnaScreen';
import PrayerTimesScreen from './src/screens/PrayerTimesScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import QuranPlayerScreen from './src/screens/QuranPlayerScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AthanDiagnosticsScreen from './src/screens/AthanDiagnosticsScreen';
import QiblaCompassScreen from './src/screens/QiblaCompassScreen';
import QuranMiraclesScreen from './src/screens/QuranMiraclesScreen';

const Stack = createNativeStackNavigator();
const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CustomBackButton = ({ navigation }: { navigation: NavigationProp<ParamListBase> }) => (
  <TouchableOpacity
    style={{
      minWidth: 82,
      height: 36,
      borderRadius: UI_RADII.lg,
      paddingHorizontal: 10,
      //backgroundColor: 'rgba(45,127,184,0.14)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: UI_COLORS.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 4,
      elevation: 2,
    }}
    onPress={() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Landing' }],
        })
      );
    }}
  >
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: UI_COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
      }}
    >
      <Text style={{ fontSize: 14, color: UI_COLORS.white, fontWeight: '700' }}>←</Text>
    </View>
    <Text style={{ fontSize: 16, color: UI_COLORS.accent, fontWeight: '700' }}>Home</Text>
  </TouchableOpacity>
);

const getSharedHeaderOptions = (navigation: NavigationProp<ParamListBase>) => ({
  title: 'Quran Pulse',
  headerTitleAlign: 'center' as const,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: UI_COLORS.surface },
  headerTitleStyle: { color: UI_COLORS.text, fontWeight: '700' as const },
  ...(isExpoGo ? {} : { statusBarStyle: 'dark' as const }),
  headerBackVisible: false,
  headerTintColor: UI_COLORS.accent,
  headerLeftContainerStyle: { paddingLeft: 8 },
  headerTitleContainerStyle: { paddingHorizontal: 8 },
  headerLeft: () => <CustomBackButton navigation={navigation} />,
});

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync(CUSTOM_FONT_ASSETS);
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null; // Loading screen
  }

  return (
    <SettingsProvider>
      <ThemedAlertProvider>
        <AudioProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Landing"
              screenOptions={isExpoGo ? undefined : { statusBarStyle: 'dark' as const }}
            >
            <Stack.Screen
              name="Landing"
              component={LandingScreen}
              options={{
                headerShown: false,
                ...(isExpoGo ? {} : { statusBarStyle: 'light' as const }),
              } as any}
            />
            <Stack.Screen
              name="MemorizeUnderstand"
              component={MemorizeUnderstandScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="Surah"
              component={SurahScreen}
              options={{ headerShown: false } as any}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen 
              name="Athkar" 
              component={AthkarScreen} 
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="PrayerTimes"
              component={PrayerTimesScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="AthanDiagnostics"
              component={AthanDiagnosticsScreen}
              options={{
                title: 'Quran Pulse',
                headerTitleAlign: 'center' as const,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: UI_COLORS.surface },
                headerTitleStyle: { color: UI_COLORS.text, fontWeight: '700' as const },
                ...(isExpoGo ? {} : { statusBarStyle: 'dark' as const }),
                headerBackVisible: true,
                headerBackTitle: 'Prayer Times',
                headerTintColor: UI_COLORS.accent,
              }}
            />
            <Stack.Screen
              name="QiblaCompass"
              component={QiblaCompassScreen}
              options={{
                title: 'Quran Pulse',
                headerTitleAlign: 'center' as const,
                headerShadowVisible: false,
                headerStyle: { backgroundColor: UI_COLORS.surface },
                headerTitleStyle: { color: UI_COLORS.text, fontWeight: '700' as const },
                ...(isExpoGo ? {} : { statusBarStyle: 'dark' as const }),
                headerBackVisible: true,
                headerBackTitle: 'Prayer Times',
                headerTintColor: UI_COLORS.accent,
              }}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="QuranPlayer"
              component={QuranPlayerScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="Calendar"
              component={CalendarScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            <Stack.Screen
              name="QuranMiracles"
              component={QuranMiraclesScreen}
              options={({ navigation }) => getSharedHeaderOptions(navigation)}
            />
            </Stack.Navigator>
          </NavigationContainer>
        </AudioProvider>
      </ThemedAlertProvider>
    </SettingsProvider>
  );
}
