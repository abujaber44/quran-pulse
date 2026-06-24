import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useSettings } from '../context/SettingsContext';
import { UI_COLORS, UI_GLASS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import {
  calculateDistanceToKaabaKm,
  calculateQiblaBearing,
  Coordinates,
  normalizeDegrees,
} from '../utils/qiblaUtils';
import { useLanguage } from '../i18n';

const isValidCoordinates = (value: unknown): value is Coordinates => {
  if (!value || typeof value !== 'object') return false;
  const coords = value as { latitude?: unknown; longitude?: unknown };
  return (
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
};

const QIBLA_VIBRATION_INTERVAL_MS = 1000;
const COMPASS_SIZE = 300;
const COMPASS_RADIUS = COMPASS_SIZE / 2;
const TICK_COUNT = 36;

const TickMarks = React.memo(() => {
  const ticks = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const angle = (i * 360) / TICK_COUNT;
    const isMajor = i % 3 === 0;
    ticks.push(
      <View
        key={i}
        style={[
          styles.tick,
          {
            height: isMajor ? 12 : 6,
            width: isMajor ? 2 : 1,
            backgroundColor: isMajor ? '#8aa8c0' : '#b9d3e6',
            top: 0,
            left: COMPASS_RADIUS - 1,
            transform: [
              { translateY: 0 },
              { rotate: `${angle}deg` },
              { translateY: 0 },
            ],
            transformOrigin: `center ${COMPASS_RADIUS}px`,
          },
        ]}
      />,
    );
  }
  return <>{ticks}</>;
});

export default function QiblaCompassScreen({ route }: any) {
  const city = typeof route?.params?.city === 'string' ? route.params.city : '';
  const initialCoordinates = isValidCoordinates(route?.params?.coordinates) ? route.params.coordinates : null;

  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(initialCoordinates);
  const [resolvingCoordinates, setResolvingCoordinates] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [isCompassAvailable, setIsCompassAvailable] = useState(true);
  const [qiblaFlashOn, setQiblaFlashOn] = useState(false);
  const qiblaVibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qiblaFlashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dialAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const prevHeadingRef = useRef<number>(0);

  const { settings } = useSettings();
  const { t } = useLanguage();
  const isDark = settings.isDarkMode;

  // --- Coordinate resolution (unchanged) ---
  useEffect(() => {
    if (currentCoordinates || !city) return;
    let isActive = true;

    const resolveCoordinates = async () => {
      setResolvingCoordinates(true);
      try {
        const geocoded = await Location.geocodeAsync(city);
        if (!isActive) return;
        if (Array.isArray(geocoded) && geocoded.length > 0) {
          setCurrentCoordinates({
            latitude: geocoded[0].latitude,
            longitude: geocoded[0].longitude,
          });
        }
      } catch (error) {
        console.error('Failed to resolve coordinates for qibla compass:', error);
      } finally {
        if (isActive) {
          setResolvingCoordinates(false);
        }
      }
    };

    void resolveCoordinates();
    return () => {
      isActive = false;
    };
  }, [city, currentCoordinates]);

  // --- Heading subscription (unchanged) ---
  useEffect(() => {
    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    const startHeadingWatch = async () => {
      try {
        subscription = await Location.watchHeadingAsync(
          (headingData) => {
            if (!isActive) return;
            const resolvedHeading = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
            setHeading(resolvedHeading);
            setHeadingAccuracy(headingData.accuracy ?? null);
          },
          () => {
            if (!isActive) return;
            setIsCompassAvailable(false);
          }
        );
      } catch {
        if (!isActive) return;
        setIsCompassAvailable(false);
      }
    };

    void startHeadingWatch();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, []);

  // --- Qibla calculations (unchanged) ---
  const qiblaBearing = currentCoordinates ? calculateQiblaBearing(currentCoordinates) : null;
  const distanceToKaabaKm = currentCoordinates ? calculateDistanceToKaabaKm(currentCoordinates) : null;
  const rotationToQibla =
    heading !== null && qiblaBearing !== null ? normalizeDegrees(qiblaBearing - heading) : null;
  const dialRotation = heading !== null ? -heading : 0;
  const signedTurnDelta =
    heading !== null && qiblaBearing !== null ? ((qiblaBearing - heading + 540) % 360) - 180 : null;
  const isFacingQibla = signedTurnDelta !== null && Math.abs(signedTurnDelta) <= 5;

  // --- Smooth animated rotation ---
  useEffect(() => {
    if (heading === null) return;

    let targetDial = -heading;
    const prevDial = prevHeadingRef.current;
    let diff = targetDial - prevDial;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    targetDial = prevDial + diff;
    prevHeadingRef.current = targetDial;

    Animated.timing(dialAnim, {
      toValue: targetDial,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  }, [heading]);

  // --- Glow animation ---
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: isFacingQibla ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [isFacingQibla]);

  // --- Vibration & flash (unchanged) ---
  useEffect(() => {
    if (!isFacingQibla) {
      if (qiblaVibrationIntervalRef.current) {
        clearInterval(qiblaVibrationIntervalRef.current);
        qiblaVibrationIntervalRef.current = null;
      }
      if (qiblaFlashIntervalRef.current) {
        clearInterval(qiblaFlashIntervalRef.current);
        qiblaFlashIntervalRef.current = null;
      }
      setQiblaFlashOn(false);
      return;
    }

    Vibration.vibrate(120);
    setQiblaFlashOn(true);

    if (!qiblaVibrationIntervalRef.current) {
      qiblaVibrationIntervalRef.current = setInterval(() => {
        Vibration.vibrate(120);
      }, QIBLA_VIBRATION_INTERVAL_MS);
    }

    if (!qiblaFlashIntervalRef.current) {
      qiblaFlashIntervalRef.current = setInterval(() => {
        setQiblaFlashOn((previous) => !previous);
      }, 450);
    }

    return () => {
      if (qiblaVibrationIntervalRef.current) {
        clearInterval(qiblaVibrationIntervalRef.current);
        qiblaVibrationIntervalRef.current = null;
      }
      if (qiblaFlashIntervalRef.current) {
        clearInterval(qiblaFlashIntervalRef.current);
        qiblaFlashIntervalRef.current = null;
      }
      setQiblaFlashOn(false);
    };
  }, [isFacingQibla]);

  const qiblaTurnInstruction = () => {
    if (signedTurnDelta === null) return { text: t.alignPhone, arrow: '' };
    const delta = Math.round(Math.abs(signedTurnDelta));
    if (delta <= 5) return { text: t.facingQibla, arrow: '🕋' };
    return signedTurnDelta > 0
      ? { text: `${t.turnRight} ${delta}°`, arrow: '→' }
      : { text: `${t.turnLeft} ${delta}°`, arrow: '←' };
  };

  const compassQuality = useMemo(() => {
    if (!isCompassAvailable) {
      return { label: t.unavailable, badgeColor: UI_COLORS.danger, textColor: UI_COLORS.white, needsCalibrationPrompt: true, guidance: 'Compass sensor is unavailable on this device/runtime.' };
    }
    if (headingAccuracy === null) {
      return { label: t.initializing, badgeColor: '#c98200', textColor: UI_COLORS.white, needsCalibrationPrompt: true, guidance: 'Move your phone slowly to initialize compass direction.' };
    }
    if (headingAccuracy <= 1) {
      return { label: t.lowAccuracy, badgeColor: '#c98200', textColor: UI_COLORS.white, needsCalibrationPrompt: true, guidance: 'Re-calibrate by moving phone in a figure-8 and keep away from metal objects.' };
    }
    if (headingAccuracy === 2) {
      return { label: t.medium, badgeColor: UI_COLORS.accent, textColor: UI_COLORS.white, needsCalibrationPrompt: true, guidance: 'Keep phone flat and away from magnetic interference for better accuracy.' };
    }
    return { label: t.calibrated, badgeColor: UI_COLORS.primary, textColor: UI_COLORS.white, needsCalibrationPrompt: false, guidance: '' };
  }, [headingAccuracy, isCompassAvailable]);

  const instruction = qiblaTurnInstruction();

  const dialInterpolation = dialAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(31, 157, 85, 0)', 'rgba(31, 157, 85, 0.25)'],
  });

  return (
    <GlassBackground isDark={isDark}>
    <SafeAreaView style={[styles.container, isDark && styles.darkBg]} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenIntroTile
          title={t.qiblaCompass}
          description={t.qiblaDescription}
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={[styles.summaryCard, isDark && styles.darkCard]}>
          <Text style={[styles.summaryTitle, isDark && styles.darkText]}>🕋 {city || 'Current City'}</Text>
          <Text style={[styles.summaryText, isDark && styles.darkMutedText]}>
            {distanceToKaabaKm !== null
              ? `${t.distanceToKaaba}: ${distanceToKaabaKm.toFixed(1)} km`
              : 'Distance will appear after coordinates are resolved.'}
          </Text>
          {resolvingCoordinates ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={UI_COLORS.primary} />
              <Text style={[styles.loadingText, isDark && styles.darkMutedText]}>{t.resolvingCoordinates}</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.qiblaCard,
            isDark && styles.darkCard,
            qiblaFlashOn && (isDark ? styles.qiblaCardFlashDark : styles.qiblaCardFlash),
          ]}
        >
          <View style={styles.qiblaHeaderRow}>
            <Text style={[styles.qiblaTitle, isDark && styles.darkText]}>{t.liveCompass}</Text>
            <View style={[styles.qiblaStatusBadge, { backgroundColor: compassQuality.badgeColor }]}>
              <Text style={[styles.qiblaStatusBadgeText, { color: compassQuality.textColor }]}>
                {compassQuality.label}
              </Text>
            </View>
          </View>

          {qiblaBearing === null ? (
            <Text style={[styles.qiblaHint, isDark && styles.darkText]}>
              {t.chooseCity}
            </Text>
          ) : (
            <>
              <View style={styles.qiblaCompassWrap}>
                <Animated.View style={[styles.glowRing, { backgroundColor: glowColor }]} />
                <View style={[styles.qiblaDial, isDark && styles.darkQiblaDial]}>
                  <View style={[styles.qiblaOuterRing, isDark && styles.darkQiblaOuterRing]} />
                  <Animated.View
                    style={[
                      styles.qiblaFaceLayer,
                      { transform: [{ rotate: dialInterpolation }] },
                    ]}
                  >
                    <TickMarks />
                    <View style={[styles.qiblaInnerRing, isDark && styles.darkQiblaInnerRing]} />
                    <View style={[styles.qiblaCrossLine, styles.qiblaCrossHorizontal]} />
                    <View style={[styles.qiblaCrossLine, styles.qiblaCrossVertical]} />
                    <Text style={[styles.qiblaCardinal, styles.qiblaNorth]}>N</Text>
                    <Text style={[styles.qiblaCardinal, styles.qiblaEast]}>E</Text>
                    <Text style={[styles.qiblaCardinal, styles.qiblaSouth]}>S</Text>
                    <Text style={[styles.qiblaCardinal, styles.qiblaWest]}>W</Text>
                    <Text style={[styles.qiblaInterCardinal, styles.qiblaNorthEast]}>NE</Text>
                    <Text style={[styles.qiblaInterCardinal, styles.qiblaSouthEast]}>SE</Text>
                    <Text style={[styles.qiblaInterCardinal, styles.qiblaSouthWest]}>SW</Text>
                    <Text style={[styles.qiblaInterCardinal, styles.qiblaNorthWest]}>NW</Text>
                    <View
                      style={[
                        styles.qiblaArrowWrap,
                        qiblaBearing !== null ? { transform: [{ rotate: `${qiblaBearing}deg` }] } : undefined,
                      ]}
                    >
                      <View style={styles.qiblaArrowInner}>
                        <View style={styles.qiblaArrowHead} />
                        <View style={styles.qiblaArrowStem} />
                      </View>
                    </View>
                  </Animated.View>
                  <View style={[styles.qiblaCenterDot, isFacingQibla && styles.qiblaCenterDotAligned]} />
                </View>
              </View>

              <View style={styles.instructionWrap}>
                <Text style={styles.instructionArrow}>{instruction.arrow}</Text>
                <Text style={[styles.instructionText, isFacingQibla && styles.instructionAligned]}>
                  {instruction.text}
                </Text>
              </View>

              <View style={styles.qiblaMetricsRow}>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>🧭 {t.qibla}</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>{Math.round(qiblaBearing)}°</Text>
                </View>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>📍 {t.heading}</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>
                    {heading !== null ? `${Math.round(heading)}°` : '--'}
                  </Text>
                </View>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>🕋 {t.distance}</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>
                    {distanceToKaabaKm !== null ? `${distanceToKaabaKm.toFixed(0)} km` : '--'}
                  </Text>
                </View>
              </View>

              {compassQuality.needsCalibrationPrompt ? (
                <Text style={[styles.qiblaCalibration, isDark && styles.darkMutedText]}>{compassQuality.guidance}</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkBg: {},
  darkCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
  scrollContent: { padding: 16, paddingBottom: 36 },
  introTile: { width: '100%', marginHorizontal: 0, marginBottom: 12 },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    padding: 16,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: UI_COLORS.text, marginBottom: 4 },
  summaryText: { fontSize: 14, color: UI_COLORS.textMuted, lineHeight: 20 },
  loadingRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, color: UI_COLORS.textMuted },
  qiblaCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    padding: 20,
    marginBottom: 10,
    ...UI_SHADOWS.card,
  },
  qiblaCardFlash: { backgroundColor: '#dff5e7', borderColor: '#87c8a0' },
  qiblaCardFlashDark: { backgroundColor: '#264536', borderColor: '#4f8f6a' },
  qiblaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qiblaTitle: { fontSize: 22, fontWeight: '700', color: UI_COLORS.text },
  qiblaStatusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  qiblaStatusBadgeText: { fontSize: 11, fontWeight: '700' },
  qiblaHint: { fontSize: 14, textAlign: 'center', color: UI_COLORS.textMuted, lineHeight: 20 },
  qiblaCompassWrap: { alignItems: 'center', marginBottom: 20 },
  glowRing: {
    position: 'absolute',
    width: COMPASS_SIZE + 30,
    height: COMPASS_SIZE + 30,
    borderRadius: (COMPASS_SIZE + 30) / 2,
  },
  qiblaDial: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf5fb',
    overflow: 'hidden',
  },
  darkQiblaDial: { backgroundColor: '#1a2430' },
  qiblaFaceLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
  },
  qiblaOuterRing: {
    position: 'absolute',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_RADIUS,
    borderWidth: 3,
    borderColor: '#9abdd4',
  },
  darkQiblaOuterRing: { borderColor: '#415061' },
  qiblaInnerRing: {
    position: 'absolute',
    width: COMPASS_SIZE * 0.72,
    height: COMPASS_SIZE * 0.72,
    borderRadius: (COMPASS_SIZE * 0.72) / 2,
    borderWidth: 1,
    borderColor: '#c8d9e6',
  },
  darkQiblaInnerRing: { borderColor: '#354252' },
  qiblaCrossLine: { position: 'absolute', backgroundColor: '#d5e4ef' },
  qiblaCrossHorizontal: { width: COMPASS_SIZE * 0.8, height: 1 },
  qiblaCrossVertical: { width: 1, height: COMPASS_SIZE * 0.8 },
  qiblaCardinal: { position: 'absolute', fontSize: 16, fontWeight: '800', color: UI_COLORS.textMuted },
  qiblaNorth: { top: 18, color: UI_COLORS.danger, fontSize: 18 },
  qiblaEast: { right: 18 },
  qiblaSouth: { bottom: 18 },
  qiblaWest: { left: 18 },
  qiblaInterCardinal: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '700',
    color: '#8aa8c0',
  },
  qiblaNorthEast: { top: 42, right: 42 },
  qiblaSouthEast: { right: 42, bottom: 42 },
  qiblaSouthWest: { left: 42, bottom: 42 },
  qiblaNorthWest: { top: 42, left: 42 },
  qiblaArrowWrap: {
    position: 'absolute',
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 15,
  },
  qiblaArrowInner: {
    alignItems: 'center',
  },
  qiblaArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: UI_COLORS.primary,
    marginBottom: -2,
  },
  qiblaArrowStem: {
    width: 4,
    height: COMPASS_RADIUS - 40,
    backgroundColor: UI_COLORS.primary,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  qiblaCenterDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: UI_COLORS.accent,
    borderWidth: 3,
    borderColor: UI_COLORS.white,
    ...UI_SHADOWS.input,
  },
  qiblaCenterDotAligned: { backgroundColor: UI_COLORS.primary },
  instructionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    gap: 10,
  },
  instructionArrow: { fontSize: 28 },
  instructionText: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  instructionAligned: { color: UI_COLORS.primary },
  qiblaMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  qiblaMetricPill: {
    flex: 1,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  darkQiblaMetricPill: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  qiblaMetricLabel: { fontSize: 12, color: UI_COLORS.textMuted, marginBottom: 4 },
  qiblaMetricValue: { fontSize: 20, fontWeight: '800', color: UI_COLORS.text },
  qiblaCalibration: {
    fontSize: 13,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
});
