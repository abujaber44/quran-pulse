import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { fetchSurahs } from '../services/quranApi';
import { fetchQuranMiraclesContent, MiraclesContentResult } from '../services/miraclesService';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import { MiracleCategory, MiracleItem, Surah } from '../types';
import AskMiracleModal from '../components/AskMiracleModal';
import { useLanguage } from '../i18n';

type CategoryFilter = 'all' | MiracleCategory;
type LanguageFilter = 'en' | 'ar';

const CATEGORY_BADGE_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: '#d8ebfb', text: '#1b5d8b' },
  { bg: '#e4f5dc', text: '#1b6d3f' },
  { bg: '#fbe8cf', text: '#965a07' },
  { bg: '#e5e3f9', text: '#4a3b99' },
  { bg: '#f9e2e5', text: '#8b3142' },
  { bg: '#d9f5f2', text: '#145d57' },
];

const CATEGORY_ICONS: Record<string, string> = {
  'all': '✨',
  'Language & Eloquence': '📝',
  'Numerical Patterns': '🔢',
  'Cosmology & Natural World': '🌍',
  'Human Development': '🧬',
  'Water & Seas': '🌊',
  'History & Prophecy': '📜',
  'Law, Society & Civilization': '⚖️',
};

const getCategoryIcon = (category: string): string =>
  CATEGORY_ICONS[category] ?? '📖';

const formatCategoryLabel = (category: string): string => {
  const trimmed = category.trim();
  if (!trimmed) return 'Other';

  if (/[A-Z]/.test(trimmed) || /[&/]/.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getCategoryBadge = (category: string): { bg: string; text: string } => {
  const sum = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_BADGE_PALETTE[sum % CATEGORY_BADGE_PALETTE.length];
};

const getItemLanguage = (item: MiracleItem): LanguageFilter =>
  item.id.endsWith('-ar') ? 'ar' : 'en';

const parseAyahRef = (ref: string): { surahId: number; ayahNum: number } | null => {
  const cleaned = ref.trim();
  if (!cleaned) return null;

  const surahAyahMatch = cleaned.match(/^(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (surahAyahMatch) {
    const surahId = Number(surahAyahMatch[1]);
    const ayahNum = Number(surahAyahMatch[2]);
    if (Number.isFinite(surahId) && Number.isFinite(ayahNum) && surahId > 0 && ayahNum > 0) {
      return { surahId, ayahNum };
    }
    return null;
  }

  const surahOnlyMatch = cleaned.match(/^(\d+)$/);
  if (surahOnlyMatch) {
    const surahId = Number(surahOnlyMatch[1]);
    if (Number.isFinite(surahId) && surahId > 0) {
      return { surahId, ayahNum: 1 };
    }
  }

  return null;
};

export default function QuranMiraclesScreen() {
  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();
  const isDark = settings.isDarkMode;
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<MiracleItem[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageFilter>(lang as LanguageFilter);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceType, setSourceType] = useState<'cms' | 'fallback'>('fallback');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [selectedMiracle, setSelectedMiracle] = useState<MiracleItem | null>(null);

  const loadMiracles = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result: MiraclesContentResult = await fetchQuranMiraclesContent();
      setItems(result.items);
      setSourceType(result.source);
      setUpdatedAt(result.updatedAt);
      setWarning(result.warning);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMiracles(false);
  }, [loadMiracles]);

  useEffect(() => {
    let active = true;

    const loadSurahs = async () => {
      try {
        const data = await fetchSurahs();
        if (!active) return;
        setSurahs(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setSurahs([]);
      }
    };

    void loadSurahs();
    return () => {
      active = false;
    };
  }, []);

  const languageItems = useMemo(() => {
    const filtered = items.filter((item) => getItemLanguage(item) === selectedLanguage);
    return filtered.length > 0 ? filtered : items;
  }, [items, selectedLanguage]);

  const availableCategories = useMemo(() => {
    const unique = [
      ...new Set(languageItems.map((item) => item.category.trim()).filter((category) => category.length > 0)),
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [languageItems]);

  const categoryFilters = useMemo<Array<{ key: CategoryFilter; label: string }>>(
    () => [{ key: 'all', label: t.allCategories }, ...availableCategories.map((category) => ({
      key: category,
      label: formatCategoryLabel(category),
    }))],
    [availableCategories]
  );

  useEffect(() => {
    if (selectedCategory === 'all') return;
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return languageItems;
    return languageItems.filter((item) => item.category === selectedCategory);
  }, [languageItems, selectedCategory]);

  const openSourceUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showAlert({
          title: 'Invalid Link',
          message: 'Unable to open this source URL on your device.',
          variant: 'danger',
        });
        return;
      }
      await Linking.openURL(url);
    } catch {
      showAlert({
        title: 'Error',
        message: 'Could not open source link. Please try again.',
        variant: 'danger',
      });
    }
  }, [showAlert]);

  const navigateToAyahRef = useCallback(
    (ref: string) => {
      const parsed = parseAyahRef(ref);
      if (!parsed) {
        showAlert({
          title: 'Unsupported Reference',
          message: `Could not parse ayah reference: ${ref}`,
          variant: 'danger',
        });
        return;
      }

      const targetSurah = surahs.find((surah) => Number(surah.id) === parsed.surahId);
      if (!targetSurah) {
        showAlert({
          title: 'Surah Not Ready',
          message: 'Surah metadata is still loading. Please try again in a moment.',
          variant: 'info',
        });
        return;
      }

      navigation.navigate('Surah', {
        surah: targetSurah,
        surahs,
        initialAyah: parsed.ayahNum,
        scrollNonce: Date.now(),
      });
    },
    [navigation, showAlert, surahs]
  );

  const renderMiracleCard = ({ item }: { item: MiracleItem }) => {
    const badge = getCategoryBadge(item.category);

    return (
      <View style={[styles.card, isDark && styles.darkCard]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.categoryPill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.categoryPillText, { color: badge.text }]}>{formatCategoryLabel(item.category)}</Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, isDark && styles.darkText]}>{item.title}</Text>
        <Text style={[styles.cardSummary, isDark && styles.darkMutedText]}>{item.summary}</Text>
        <Text style={[styles.cardDetail, isDark && styles.darkText]}>{item.detail}</Text>

        {item.ayahRefs.length > 0 ? (
          <View style={styles.ayahRefsWrap}>
            <Text style={[styles.ayahRefsTitle, isDark && styles.darkMutedText]}>Ayah refs</Text>
            <View style={styles.ayahRefsRow}>
              {item.ayahRefs.map((ref) => (
                <TouchableOpacity
                  key={`${item.id}-${ref}`}
                  style={[styles.ayahRefChip, isDark && styles.darkAyahRefChip]}
                  onPress={() => navigateToAyahRef(ref)}
                >
                  <Text style={styles.ayahRefChipText}>{ref}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {item.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 6).map((tag) => (
              <View key={`${item.id}-${tag}`} style={[styles.tagChip, isDark && styles.darkTagChip]}>
                <Text style={[styles.tagChipText, isDark && styles.darkMutedText]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.examples && item.examples.length > 0 ? (
          <View style={[styles.examplesBox, isDark && styles.darkExamplesBox]}>
            <Text style={[styles.examplesTitle, isDark && styles.darkText]}>Examples</Text>
            {item.examples.slice(0, 2).map((example, index) => (
              <View key={`${item.id}-example-${index}`} style={styles.exampleItem}>
                <Text style={[styles.exampleItemTitle, isDark && styles.darkText]}>{example.title}</Text>
                <Text style={[styles.exampleItemText, isDark && styles.darkMutedText]}>{example.description}</Text>
                {example.ayahRef ? (
                  <Text style={[styles.exampleMeta, isDark && styles.darkMutedText]}>Ayah: {example.ayahRef}</Text>
                ) : null}
                {(() => {
                  const sourceUrl = example.sourceUrl;
                  if (!sourceUrl) return null;

                  return (
                  <TouchableOpacity
                    style={[styles.exampleSourceButton, isDark && styles.darkSourceButton]}
                    onPress={() => {
                      void openSourceUrl(sourceUrl);
                    }}
                  >
                    <Text style={styles.sourceButtonText}>Open Example Source</Text>
                  </TouchableOpacity>
                  );
                })()}
              </View>
            ))}
          </View>
        ) : null}

        {item.caution ? (
          <View style={[styles.cautionBox, isDark && styles.darkCautionBox]}>
            <Text style={[styles.cautionLabel, isDark && styles.darkText]}>{t.note}</Text>
            <Text style={[styles.cautionText, isDark && styles.darkMutedText]}>{item.caution}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.aiInsightButton}
          onPress={() => setSelectedMiracle(item)}
        >
          <Text style={styles.aiInsightButtonText}>{t.askAiExplainMiracle}</Text>
        </TouchableOpacity>

        {item.sources.length > 0 ? (
          <View style={styles.sourcesWrap}>
            <Text style={[styles.sourcesTitle, isDark && styles.darkText]}>{t.sources}</Text>
            <View style={styles.sourcesRow}>
              {item.sources.slice(0, 3).map((source) => (
                <TouchableOpacity
                  key={`${item.id}-${source.url}`}
                  style={[styles.sourceButton, isDark && styles.darkSourceButton]}
                  onPress={() => {
                    void openSourceUrl(source.url);
                  }}
                >
                  <Text style={styles.sourceButtonText}>{source.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <GlassBackground isDark={isDark}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={UI_COLORS.primary} />
          <Text style={[styles.loaderText, isDark && styles.darkText]}>Loading miracle insights...</Text>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground isDark={isDark}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        <ScreenIntroTile
          title={t.miraclesTitle}
          subtitle="Dynamic Categories with Sources"
          description={t.miraclesDescription}
          isDark={isDark}
          style={styles.introTile}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categoryFilters.map((filter) => {
            const selected = selectedCategory === filter.key;
            const icon = getCategoryIcon(filter.key);
            return (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.categoryTab,
                  selected && styles.categoryTabActive,
                  isDark && styles.darkCategoryTab,
                  selected && isDark && styles.darkCategoryTabActive,
                ]}
                onPress={() => setSelectedCategory(filter.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryIcon}>{icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selected && styles.categoryLabelActive,
                    isDark && styles.darkMutedText,
                    selected && styles.categoryLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {filter.label}
                </Text>
                {selected && <View style={styles.categoryDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderMiracleCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadMiracles(true);
              }}
              tintColor={UI_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>
              No items found in this category.
            </Text>
          }
        />
      </View>

      <AskMiracleModal
        visible={selectedMiracle !== null}
        onClose={() => setSelectedMiracle(null)}
        miracle={selectedMiracle ? {
          title: selectedMiracle.title,
          summary: selectedMiracle.summary,
          detail: selectedMiracle.detail,
          category: selectedMiracle.category,
          ayahRefs: selectedMiracle.ayahRefs,
        } : null}
      />
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  darkCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
  introTile: { marginBottom: 8 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, color: UI_COLORS.text, fontSize: 14 },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  categoryTab: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    minWidth: 80,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(31, 157, 85, 0.12)',
    borderColor: UI_COLORS.primary,
  },
  darkCategoryTab: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  darkCategoryTabActive: {
    backgroundColor: 'rgba(31, 157, 85, 0.2)',
    borderColor: UI_COLORS.primary,
  },
  categoryIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: UI_COLORS.primary,
  },
  categoryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: UI_COLORS.primary,
    marginTop: 4,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...UI_SHADOWS.input,
  },
  statusText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  statusSubText: {
    marginTop: 2,
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  warningText: {
    marginTop: 4,
    fontSize: 12,
    color: '#8a6d1b',
    lineHeight: 17,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 26,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    padding: 14,
    marginVertical: 7,
    ...UI_SHADOWS.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  cardSummary: {
    marginTop: 6,
    fontSize: 14,
    color: UI_COLORS.textMuted,
    lineHeight: 20,
  },
  cardDetail: {
    marginTop: 7,
    fontSize: 14,
    color: UI_COLORS.text,
    lineHeight: 21,
  },
  ayahRefsWrap: {
    marginTop: 8,
  },
  ayahRefsTitle: {
    color: UI_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  ayahRefsRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ayahRefChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b6d2e8',
    backgroundColor: '#ecf6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkAyahRefChip: {
    borderColor: '#4d6376',
    backgroundColor: '#213241',
  },
  ayahRefChipText: {
    color: UI_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  tagsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f2f8fc',
  },
  darkTagChip: {
    backgroundColor: '#1e2a36',
    borderColor: '#354252',
  },
  tagChipText: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  cautionBox: {
    marginTop: 10,
    borderRadius: UI_RADII.sm,
    backgroundColor: '#fff6e8',
    borderWidth: 1,
    borderColor: '#f0d4a7',
    padding: 10,
  },
  darkCautionBox: {
    backgroundColor: '#3d3222',
    borderColor: '#745c39',
  },
  cautionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 3,
  },
  cautionText: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    lineHeight: 17,
  },
  examplesBox: {
    marginTop: 10,
    borderRadius: UI_RADII.sm,
    backgroundColor: '#edf6ff',
    borderWidth: 1,
    borderColor: '#c9def2',
    padding: 10,
  },
  darkExamplesBox: {
    backgroundColor: '#1f2f40',
    borderColor: '#3e5468',
  },
  examplesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 6,
  },
  exampleItem: {
    marginBottom: 8,
  },
  exampleItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  exampleItemText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: UI_COLORS.textMuted,
  },
  exampleMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  exampleSourceButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: '#b6d2e8',
    backgroundColor: '#ecf6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiInsightButton: {
    backgroundColor: UI_COLORS.accent,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  aiInsightButtonText: {
    color: UI_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sourcesWrap: {
    marginTop: 11,
  },
  sourcesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 6,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceButton: {
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: '#b6d2e8',
    backgroundColor: '#ecf6ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  darkSourceButton: {
    borderColor: '#4d6376',
    backgroundColor: '#213241',
  },
  sourceButtonText: {
    fontSize: 12,
    color: UI_COLORS.accent,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    fontSize: 15,
  },
});
