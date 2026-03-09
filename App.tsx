import React, { useEffect, useState } from 'react';
import { NavigationContainer, CommonActions, NavigationProp, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View } from 'react-native';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';

import { AudioProvider } from './src/context/AudioContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { UI_COLORS, UI_RADII } from './src/theme/ui';

import LandingScreen from './src/screens/LandingScreen';
import MemorizeUnderstandScreen from './src/screens/MemorizeUnderstandScreen';
import SurahScreen from './src/screens/SurahScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AsmaAlHusnaScreen from './src/screens/AsmaAlHusnaScreen';
import PrayerTimesScreen from './src/screens/PrayerTimesScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import QuranPlayerScreen from './src/screens/QuranPlayerScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AthanDiagnosticsScreen from './src/screens/AthanDiagnosticsScreen';
import QiblaCompassScreen from './src/screens/QiblaCompassScreen';
import QuranMiraclesScreen from './src/screens/QuranMiraclesScreen';

const Stack = createNativeStackNavigator();

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
              name="AsmaAlHusna" 
              component={AsmaAlHusnaScreen} 
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
    </SettingsProvider>
  );
}
