import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

type CompactPlayerCardProps = {
  isDark: boolean;
  badgeLabel: string;
  title: string;
  subtitle?: string;
  currentMs: number;
  durationMs: number;
  isPlaying: boolean;
  isBusy?: boolean;
  disablePrev?: boolean;
  disableNext?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSeek: (value: number) => void;
  onClose?: () => void;
  layout?: 'floating' | 'inline';
};

const formatTime = (ms: number): string => {
  if (!ms) return '0:00';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function CompactPlayerCard({
  isDark,
  badgeLabel,
  title,
  subtitle,
  currentMs,
  durationMs,
  isPlaying,
  isBusy = false,
  disablePrev = false,
  disableNext = false,
  onPrev,
  onNext,
  onTogglePlay,
  onSeek,
  onClose,
  layout = 'floating',
}: CompactPlayerCardProps) {
  return (
    <View style={[styles.playerContainer, layout === 'inline' ? styles.inlineContainer : styles.floatingContainer]}>
      <View style={[styles.playerCard, isDark && styles.darkPlayerCard]}>
        <View style={styles.topRow}>
          <View style={styles.metaWrap}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, isDark && styles.darkText]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, isDark && styles.darkMutedText]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {onClose ? (
            <TouchableOpacity style={[styles.closeButton, isDark && styles.darkCloseButton]} onPress={onClose}>
              <Text style={[styles.closeIcon, isDark && styles.darkCloseIcon]}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(durationMs, 1)}
          value={Math.min(Math.max(currentMs, 0), Math.max(durationMs, 1))}
          onSlidingComplete={onSeek}
          minimumTrackTintColor={UI_COLORS.primary}
          maximumTrackTintColor={isDark ? '#355160' : '#c9d9e7'}
          thumbTintColor={UI_COLORS.primary}
        />

        <View style={styles.bottomRow}>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.iconButton, disablePrev && styles.iconButtonDisabled]}
              onPress={onPrev}
              disabled={disablePrev}
            >
              <Text style={[styles.iconLabel, disablePrev && styles.iconLabelDisabled]}>⏮</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playButton} onPress={onTogglePlay}>
              <Text style={styles.playButtonLabel}>{isBusy ? '…' : isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, disableNext && styles.iconButtonDisabled]}
              onPress={onNext}
              disabled={disableNext}
            >
              <Text style={[styles.iconLabel, disableNext && styles.iconLabelDisabled]}>⏭</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.timeText, isDark && styles.darkMutedText]}>
            {formatTime(currentMs)} / {formatTime(durationMs)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  playerContainer: {},
  floatingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  inlineContainer: {
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  playerCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    ...UI_SHADOWS.floating,
  },
  darkPlayerCard: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: '#ecf6ff',
    borderWidth: 1,
    borderColor: '#bfd9ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.accent,
  },
  titleWrap: {
    marginLeft: 8,
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginTop: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfd9ec',
    backgroundColor: '#ecf6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCloseButton: {
    borderColor: '#4d6376',
    backgroundColor: '#213241',
  },
  closeIcon: {
    fontSize: 19,
    color: UI_COLORS.accent,
    fontWeight: '700',
    lineHeight: 19,
  },
  darkCloseIcon: {
    color: '#94c4e7',
  },
  slider: {
    width: '100%',
    height: 20,
    marginTop: 1,
  },
  bottomRow: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f8ff',
    borderWidth: 1,
    borderColor: '#c8dff0',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconLabel: {
    fontSize: 16,
    color: UI_COLORS.primary,
    fontWeight: '700',
  },
  iconLabelDisabled: {
    color: UI_COLORS.textLight,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_COLORS.primary,
  },
  playButtonLabel: {
    color: UI_COLORS.white,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 20,
  },
  timeText: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
    marginTop: 5,
  },
  darkText: {
    color: UI_COLORS.white,
  },
  darkMutedText: {
    color: '#a8b3bd',
  },
});
