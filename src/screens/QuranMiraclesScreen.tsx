import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { fetchSurahs } from '../services/quranApi';
import { fetchQuranMiraclesContent, MiraclesContentResult } from '../services/miraclesService';
import { normalizeArabicForSearch } from '../utils/arabicSearch';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import { MiracleCategory, MiracleItem, Surah } from '../types';
import AskMiracleModal from '../components/AskMiracleModal';
import { useLanguage } from '../i18n';

type CategoryFilter = 'all' | MiracleCategory;
type LanguageFilter = 'en' | 'ar';

const CATEGORY_BADGE_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: 'rgba(45,127,184,0.2)', text: '#7bbce0' },
  { bg: 'rgba(31,157,85,0.2)', text: '#5ddb92' },
  { bg: 'rgba(224,185,0,0.2)', text: '#e0b900' },
  { bg: 'rgba(130,110,220,0.2)', text: '#b0a0f0' },
  { bg: 'rgba(231,76,60,0.2)', text: '#f08080' },
  { bg: 'rgba(31,157,130,0.2)', text: '#5ddbb0' },
];

const CATEGORY_ICONS: Record<string, string> = {
  'all': '✨',
  'Language & Eloquence': '📝',
  'Numerical Patterns': '🔢',
  'Cosmology & Natural World': '🌍',
  'Human Development': '🧬',
  'Water & Seas': '🌊',
  'Earth & Geology': '⛰️',
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Follows the app language live; falls back to all items when no
  // translated variants exist for the selected language.
  const languageItems = useMemo(() => {
    const filtered = items.filter((item) => getItemLanguage(item) === (lang as LanguageFilter));
    return filtered.length > 0 ? filtered : items;
  }, [items, lang]);

  const availableCategories = useMemo(() => {
    const unique = [
      ...new Set(languageItems.map((item) => item.category.trim()).filter((category) => category.length > 0)),
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [languageItems]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of languageItems) {
      const key = item.category.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [languageItems]);

  const categoryFilters = useMemo<Array<{ key: CategoryFilter; label: string; count: number }>>(
    () => [
      { key: 'all' as const, label: t.allCategories, count: languageItems.length },
      ...availableCategories.map((category) => ({
        key: category,
        label: formatCategoryLabel(category),
        count: categoryCounts.get(category) ?? 0,
      })),
    ],
    [availableCategories, categoryCounts, languageItems.length, t.allCategories]
  );

  useEffect(() => {
    if (selectedCategory === 'all') return;
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredItems = useMemo(() => {
    let result = selectedCategory === 'all'
      ? languageItems
      : languageItems.filter((item) => item.category === selectedCategory);

    if (isSearching) {
      const query = normalizeArabicForSearch(searchQuery.trim());
      result = result.filter((item) => {
        const haystack = normalizeArabicForSearch(
          `${item.title} ${item.summary} ${item.detail} ${item.tags.join(' ')}`
        );
        return haystack.includes(query);
      });
    }

    return result;
  }, [languageItems, selectedCategory, searchQuery, isSearching]);

  // Deterministic daily pick, stable for the whole day
  const miracleOfTheDay = useMemo<MiracleItem | null>(() => {
    if (languageItems.length === 0) return null;
    const daysSinceEpoch = Math.floor(Date.now() / 86400000);
    return languageItems[daysSinceEpoch % languageItems.length];
  }, [languageItems]);

  const showFeatured = selectedCategory === 'all' && !isSearching && miracleOfTheDay !== null;

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

  const isArabic = lang === 'ar';

  const renderExpandedBody = (item: MiracleItem) => (
    <>
      <Text style={[styles.cardDetail, isArabic && styles.rtlText]}>{item.detail}</Text>

      {item.ayahRefs.length > 0 ? (
        <View style={styles.ayahRefsRow}>
          {item.ayahRefs.map((ref) => (
            <TouchableOpacity
              key={`${item.id}-${ref}`}
              style={styles.ayahRefChip}
              onPress={() => navigateToAyahRef(ref)}
            >
              <Text style={styles.ayahRefChipText}>📖 {ref}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {item.caution ? (
        <View style={styles.cautionBox}>
          <Text style={[styles.cautionText, isArabic && styles.rtlText]}>⚠️ {item.caution}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.aiInsightButton}
          onPress={() => setSelectedMiracle(item)}
        >
          <Text style={styles.aiInsightButtonText}>{t.askAiExplainMiracle}</Text>
        </TouchableOpacity>
        {item.sources.length > 0 ? (
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => {
              void openSourceUrl(item.sources[0].url);
            }}
          >
            <Text style={styles.sourceButtonText}>🔗 {t.sources}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  const renderMiracleCard = ({ item }: { item: MiracleItem }) => {
    const badge = getCategoryBadge(item.category);
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
      >
        <View style={styles.cardHeaderRow}>
          <View style={[styles.categoryPill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.categoryPillText, { color: badge.text }]}>
              {getCategoryIcon(item.category)} {formatCategoryLabel(item.category)}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="rgba(255,255,255,0.4)"
          />
        </View>

        <Text style={[styles.cardTitle, isArabic && styles.rtlText]}>{item.title}</Text>
        <Text
          style={[styles.cardSummary, isArabic && styles.rtlText]}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {item.summary}
        </Text>

        {isExpanded && renderExpandedBody(item)}
      </TouchableOpacity>
    );
  };

  const renderFeaturedCard = () => {
    if (!miracleOfTheDay) return null;
    const isExpanded = expandedId === `featured-${miracleOfTheDay.id}`;

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        activeOpacity={0.9}
        onPress={() =>
          setExpandedId((prev) =>
            prev === `featured-${miracleOfTheDay.id}` ? null : `featured-${miracleOfTheDay.id}`
          )
        }
      >
        <View style={styles.featuredHeader}>
          <Text style={styles.featuredLabel}>⭐ {t.miracleOfTheDay}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="rgba(245,199,120,0.7)"
          />
        </View>
        <Text style={[styles.featuredTitle, isArabic && styles.rtlText]}>{miracleOfTheDay.title}</Text>
        <Text
          style={[styles.featuredSummary, isArabic && styles.rtlText]}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {miracleOfTheDay.summary}
        </Text>
        {isExpanded && renderExpandedBody(miracleOfTheDay)}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <GlassBackground isDark={isDark}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={UI_COLORS.primary} />
          <Text style={styles.loaderText}>{t.loadingMiracles}</Text>
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
          description={t.miraclesDescription}
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <TextInput
              style={[styles.searchInput, isArabic && styles.rtlText]}
              placeholder={t.searchMiracles}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableWithoutFeedback onPress={() => setSearchQuery('')}>
                <View style={styles.clearButton}>
                  <Text style={styles.clearIcon}>×</Text>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScrollView}
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
                ]}
                onPress={() => setSelectedCategory(filter.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryIcon}>{icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selected && styles.categoryLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {filter.label}
                </Text>
                <Text style={[styles.categoryCount, selected && styles.categoryCountActive]}>
                  {filter.count}
                </Text>
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
          ListHeaderComponent={showFeatured ? renderFeaturedCard() : null}
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
            <Text style={styles.emptyText}>{t.noMiraclesFound}</Text>
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
  introTile: { marginBottom: 8 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, color: UI_COLORS.text, fontSize: 14 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.input,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    color: UI_COLORS.text,
  },
  clearButton: { paddingHorizontal: 16 },
  clearIcon: { fontSize: 20, color: UI_COLORS.textMuted },
  // flexGrow: 0 stops the horizontal ScrollView from absorbing leftover
  // vertical space (which stretched the tabs when the list below shrank).
  // zIndex/elevation keeps the tabs painted above the list below it so the
  // featured "Miracle of the Day" card can never visually overlap them.
  categoryScrollView: {
    flexGrow: 0,
    zIndex: 10,
    elevation: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  categoryTab: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    minWidth: 80,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(31, 157, 85, 0.12)',
    borderColor: UI_COLORS.primary,
  },
  categoryIcon: {
    fontSize: 20,
    marginBottom: 3,
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
  categoryCount: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
  },
  categoryCountActive: {
    color: '#5ddb92',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 26,
  },
  featuredCard: {
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.35)',
    padding: 14,
    marginTop: 8,
    marginBottom: 10,
    ...UI_SHADOWS.card,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  featuredLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f5c778',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  featuredSummary: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(240,228,205,0.85)',
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    marginVertical: 7,
    ...UI_SHADOWS.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 18,
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
    marginTop: 10,
    fontSize: 14,
    color: UI_COLORS.text,
    lineHeight: 21,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ayahRefsRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ayahRefChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(45,127,184,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ayahRefChipText: {
    color: UI_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  cautionBox: {
    marginTop: 10,
    borderRadius: UI_RADII.sm,
    backgroundColor: 'rgba(224,185,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224,185,0,0.25)',
    padding: 10,
  },
  cautionText: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  aiInsightButton: {
    flex: 1,
    backgroundColor: UI_COLORS.accent,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
  },
  aiInsightButtonText: {
    color: UI_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sourceButton: {
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(45,127,184,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
