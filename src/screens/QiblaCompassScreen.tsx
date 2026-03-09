import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useSettings } from '../context/SettingsContext';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import {
  calculateDistanceToKaabaKm,
  calculateQiblaBearing,
  Coordinates,
  normalizeDegrees,
} from '../utils/qiblaUtils';

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

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

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

  const qiblaBearing = currentCoordinates ? calculateQiblaBearing(currentCoordinates) : null;
  const distanceToKaabaKm = currentCoordinates ? calculateDistanceToKaabaKm(currentCoordinates) : null;
  const rotationToQibla =
    heading !== null && qiblaBearing !== null ? normalizeDegrees(qiblaBearing - heading) : null;
  const dialRotation = heading !== null ? -heading : 0;
  const signedTurnDelta =
    heading !== null && qiblaBearing !== null ? ((qiblaBearing - heading + 540) % 360) - 180 : null;
  const isFacingQibla = signedTurnDelta !== null && Math.abs(signedTurnDelta) <= 5;

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
    if (signedTurnDelta === null) return 'Align your phone with North to start guidance.';
    const delta = Math.round(Math.abs(signedTurnDelta));
    if (delta <= 5) return 'You are facing Qibla.';
    return signedTurnDelta > 0 ? `Turn right ${delta}°` : `Turn left ${delta}°`;
  };

  const compassQuality = useMemo(() => {
    if (!isCompassAvailable) {
      return {
        label: 'Unavailable',
        badgeColor: UI_COLORS.danger,
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Compass sensor is unavailable on this device/runtime.',
      };
    }

    if (headingAccuracy === null) {
      return {
        label: 'Initializing',
        badgeColor: '#c98200',
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Move your phone slowly to initialize compass direction.',
      };
    }

    if (headingAccuracy <= 1) {
      return {
        label: 'Low Accuracy',
        badgeColor: '#c98200',
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Re-calibrate by moving phone in a figure-8 and keep away from metal objects.',
      };
    }

    if (headingAccuracy === 2) {
      return {
        label: 'Medium Accuracy',
        badgeColor: UI_COLORS.accent,
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Keep phone flat and away from magnetic interference for better heading confidence.',
      };
    }

    return {
      label: 'Calibrated',
      badgeColor: UI_COLORS.primary,
      textColor: UI_COLORS.white,
      needsCalibrationPrompt: false,
      guidance: '',
    };
  }, [headingAccuracy, isCompassAvailable]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkBg]} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenIntroTile
          title="Qibla Compass"
          description="Use live heading guidance to face the Kaaba precisely. Compass labels rotate with your orientation, and alignment feedback activates when Qibla is reached."
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={[styles.summaryCard, isDark && styles.darkCard]}>
          <Text style={[styles.summaryTitle, isDark && styles.darkText]}>{city || 'Current City'}</Text>
          <Text style={[styles.summaryText, isDark && styles.darkMutedText]}>
            {distanceToKaabaKm !== null
              ? `Distance to Kaaba: ${distanceToKaabaKm.toFixed(1)} km`
              : 'Distance to Kaaba will appear after coordinates are resolved.'}
          </Text>
          {resolvingCoordinates ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={UI_COLORS.primary} />
              <Text style={[styles.loadingText, isDark && styles.darkMutedText]}>Resolving city coordinates...</Text>
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
            <Text style={[styles.qiblaTitle, isDark && styles.darkText]}>Live Compass</Text>
            <View style={[styles.qiblaStatusBadge, { backgroundColor: compassQuality.badgeColor }]}>
              <Text style={[styles.qiblaStatusBadgeText, { color: compassQuality.textColor }]}>
                {compassQuality.label}
              </Text>
            </View>
          </View>

          {qiblaBearing === null ? (
            <Text style={[styles.qiblaHint, isDark && styles.darkText]}>
              Choose a city or tap "Use My Location" on Prayer Times to calculate Qibla direction.
            </Text>
          ) : (
            <>
              <View style={styles.qiblaCompassWrap}>
                <View style={[styles.qiblaDial, isDark && styles.darkQiblaDial]}>
                  <View style={[styles.qiblaOuterRing, isDark && styles.darkQiblaOuterRing]} />
                  <View
                    style={[
                      styles.qiblaFaceLayer,
                      heading !== null ? { transform: [{ rotate: `${dialRotation}deg` }] } : null,
                    ]}
                  >
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
                  </View>
                  <View
                    style={[
                      styles.qiblaArrowWrap,
                      rotationToQibla !== null ? { transform: [{ rotate: `${rotationToQibla}deg` }] } : null,
                    ]}
                  >
                    <View style={styles.qiblaArrowStem} />
                    <Text style={styles.qiblaArrow}>▲</Text>
                  </View>
                  <View style={[styles.qiblaCenterDot, isFacingQibla && styles.qiblaCenterDotAligned]} />
                </View>
              </View>

              <View style={styles.qiblaMetricsRow}>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>Qibla</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>{Math.round(qiblaBearing)}°</Text>
                </View>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>Heading</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>
                    {heading !== null ? `${Math.round(heading)}°` : '--'}
                  </Text>
                </View>
                <View style={[styles.qiblaMetricPill, isDark && styles.darkQiblaMetricPill]}>
                  <Text style={[styles.qiblaMetricLabel, isDark && styles.darkMutedText]}>Distance</Text>
                  <Text style={[styles.qiblaMetricValue, isDark && styles.darkText]}>
                    {distanceToKaabaKm !== null ? `${distanceToKaabaKm.toFixed(1)} km` : '--'}
                  </Text>
                </View>
              </View>

              <Text style={styles.qiblaInstruction}>{qiblaTurnInstruction()}</Text>
              {compassQuality.needsCalibrationPrompt ? (
                <Text style={[styles.qiblaCalibration, isDark && styles.darkText]}>{compassQuality.guidance}</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkBg: { backgroundColor: UI_COLORS.darkBackground },
  darkCard: { backgroundColor: UI_COLORS.darkSurface, borderColor: '#30353b' },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
  scrollContent: { padding: 16, paddingBottom: 36 },
  introTile: { width: '100%', marginHorizontal: 0, marginBottom: 12 },
  summaryCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    padding: 14,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    lineHeight: 20,
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
  },
  qiblaCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    padding: 16,
    marginBottom: 10,
    ...UI_SHADOWS.card,
  },
  qiblaCardFlash: {
    backgroundColor: '#dff5e7',
    borderColor: '#87c8a0',
  },
  qiblaCardFlashDark: {
    backgroundColor: '#264536',
    borderColor: '#4f8f6a',
  },
  qiblaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  qiblaTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: UI_COLORS.text,
    letterSpacing: 0.2,
  },
  qiblaStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  qiblaStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  qiblaHint: {
    fontSize: 14,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    lineHeight: 20,
  },
  qiblaCompassWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  qiblaDial: {
    width: 188,
    height: 188,
    borderRadius: 94,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf5fb',
    overflow: 'hidden',
  },
  darkQiblaDial: {
    backgroundColor: '#1a2430',
  },
  qiblaFaceLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qiblaOuterRing: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 2,
    borderColor: '#b9d3e6',
  },
  darkQiblaOuterRing: {
    borderColor: '#415061',
  },
  qiblaInnerRing: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: '#c8d9e6',
  },
  darkQiblaInnerRing: {
    borderColor: '#354252',
  },
  qiblaCrossLine: {
    position: 'absolute',
    backgroundColor: '#d5e4ef',
  },
  qiblaCrossHorizontal: {
    width: 156,
    height: 1,
  },
  qiblaCrossVertical: {
    width: 1,
    height: 156,
  },
  qiblaCardinal: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.textMuted,
  },
  qiblaNorth: {
    top: 13,
    color: UI_COLORS.accent,
  },
  qiblaEast: {
    right: 14,
  },
  qiblaSouth: {
    bottom: 13,
  },
  qiblaWest: {
    left: 14,
  },
  qiblaInterCardinal: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
    color: '#6f8598',
    letterSpacing: 0.2,
  },
  qiblaNorthEast: {
    top: 30,
    right: 32,
  },
  qiblaSouthEast: {
    right: 32,
    bottom: 30,
  },
  qiblaSouthWest: {
    left: 32,
    bottom: 30,
  },
  qiblaNorthWest: {
    top: 30,
    left: 32,
  },
  qiblaArrowWrap: {
    position: 'absolute',
    height: 124,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  qiblaArrowStem: {
    width: 2,
    height: 70,
    backgroundColor: '#73b891',
    marginBottom: -4,
  },
  qiblaArrow: {
    fontSize: 44,
    color: UI_COLORS.primary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  qiblaCenterDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: UI_COLORS.accent,
    borderWidth: 2,
    borderColor: UI_COLORS.white,
  },
  qiblaCenterDotAligned: {
    backgroundColor: UI_COLORS.primary,
  },
  qiblaMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  qiblaMetricPill: {
    flex: 1,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: '#d2e1ec',
    backgroundColor: '#f7fbff',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  darkQiblaMetricPill: {
    backgroundColor: '#1e2a36',
    borderColor: '#354252',
  },
  qiblaMetricLabel: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginBottom: 2,
  },
  qiblaMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  qiblaInstruction: {
    fontSize: 16,
    textAlign: 'center',
    color: UI_COLORS.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  qiblaCalibration: {
    fontSize: 13,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
});
