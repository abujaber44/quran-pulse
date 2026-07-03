import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { UI_COLORS, UI_RADII } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import { useLanguage } from '../i18n';
import { fetchSurahs, getSurahStartPage } from '../services/quranApi';
import { getPageDataUri, getPageImageUrl, prefetchAroundPage } from '../services/mushafPageService';
import { recordKhatmahPage } from '../services/khatmahService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_PAGES = 604;
const PAGE_BOOKMARK_KEY = '@quran_pulse_page_bookmark';
const PAGE_BOOKMARK_HISTORY_KEY = '@quran_pulse_page_bookmark_history';
const LAST_PAGE_KEY = '@quran_pulse_last_mushaf_page';
const BOOKMARK_HISTORY_MAX = 3;

export interface PageBookmark {
  page: number;
  ayahNumber?: number;
}

export const getPageBookmark = async (): Promise<PageBookmark | null> => {
  try {
    const raw = await AsyncStorage.getItem(PAGE_BOOKMARK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PageBookmark;
  } catch {
    return null;
  }
};

export const getPageBookmarkHistory = async (): Promise<PageBookmark[]> => {
  try {
    const raw = await AsyncStorage.getItem(PAGE_BOOKMARK_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PageBookmark[];
  } catch {
    return [];
  }
};

// Replaced bookmarks are kept in a short history so an accidental overwrite
// doesn't lose the reader's place.
const pushBookmarkHistory = async (replaced: PageBookmark): Promise<void> => {
  try {
    const history = await getPageBookmarkHistory();
    const deduped = [replaced, ...history.filter((b) => b.page !== replaced.page)];
    await AsyncStorage.setItem(
      PAGE_BOOKMARK_HISTORY_KEY,
      JSON.stringify(deduped.slice(0, BOOKMARK_HISTORY_MAX))
    );
  } catch {
    // History is a convenience — losing it must not block the bookmark save
  }
};

export const savePageBookmark = async (bookmark: PageBookmark | null): Promise<void> => {
  const existing = await getPageBookmark();
  if (existing && existing.page !== bookmark?.page) {
    await pushBookmarkHistory(existing);
  }
  if (bookmark === null) {
    await AsyncStorage.removeItem(PAGE_BOOKMARK_KEY);
  } else {
    await AsyncStorage.setItem(PAGE_BOOKMARK_KEY, JSON.stringify(bookmark));
  }
};

export const getLastViewedPage = async (): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_PAGE_KEY);
    if (!raw) return null;
    const page = Number(raw);
    return page >= 1 && page <= TOTAL_PAGES ? page : null;
  } catch {
    return null;
  }
};

function getJuzForPage(page: number): number {
  const starts = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
  for (let i = starts.length - 1; i >= 0; i--) {
    if (page >= starts[i]) return i + 1;
  }
  return 1;
}

function getJuzStartPage(juz: number): number {
  const starts: Record<number, number> = {
    1:1,2:22,3:42,4:62,5:82,6:102,7:121,8:142,9:162,10:182,
    11:201,12:222,13:242,14:262,15:282,16:302,17:322,18:342,19:362,20:382,
    21:402,22:422,23:442,24:462,25:482,26:502,27:522,28:542,29:562,30:582,
  };
  return starts[juz] ?? 1;
}

function buildPageHtml(imgSrc: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0}
body{background:#17384d;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
img{max-width:100%;max-height:100%;object-fit:contain;filter:invert(1);mix-blend-mode:screen}
</style></head><body><img src="${imgSrc}"/></body></html>`;
}

// Loads the page from local storage (downloading once if needed) so previously
// viewed and prefetched pages render offline; falls back to the remote URL.
const MushafPageView = memo(function MushafPageView({ pageNum }: { pageNum: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPageDataUri(pageNum).then((uri) => {
      if (!cancelled) setImgSrc(uri ?? getPageImageUrl(pageNum));
    });
    return () => {
      cancelled = true;
    };
  }, [pageNum]);

  return (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={styles.imageWrap}>
        {imgSrc ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: buildPageHtml(imgSrc) }}
            style={styles.pageWebView}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled={false}
            cacheEnabled
          />
        ) : (
          <View style={styles.pageLoading}>
            <ActivityIndicator color="rgba(255,255,255,0.35)" />
          </View>
        )}
      </View>
    </View>
  );
});

interface SurahListItem {
  id: number;
  name_simple: string;
  name_arabic: string;
}

export default function MushafReaderScreen({ route }: any) {
  const { juzNumber, initialPage } = route.params;
  const allPages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  const { t, lang } = useLanguage();
  const startIndex = (initialPage ?? getJuzStartPage(juzNumber)) - 1;
  const [currentPageIndex, setCurrentPageIndex] = useState(startIndex);
  const [bookmark, setBookmarkState] = useState<PageBookmark | null>(null);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [ayahInput, setAyahInput] = useState('');
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpTab, setJumpTab] = useState<'surah' | 'juz' | 'page'>('surah');
  const [pageInput, setPageInput] = useState('');
  const [surahList, setSurahList] = useState<SurahListItem[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    getPageBookmark().then(setBookmarkState);
  }, []);

  const currentPage = allPages[currentPageIndex];
  const currentJuz = getJuzForPage(currentPage);
  const isBookmarked = bookmark?.page === currentPage;

  // Warm the offline cache ahead of the reader; after a short dwell, remember
  // the position and count the page toward an active khatmah (dwell avoids
  // counting pages swiped past quickly).
  useEffect(() => {
    prefetchAroundPage(currentPage);
    const timer = setTimeout(() => {
      AsyncStorage.setItem(LAST_PAGE_KEY, String(currentPage)).catch(() => {});
      void recordKhatmahPage(currentPage);
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    if (!showJumpModal || surahList.length > 0) return;
    fetchSurahs()
      .then((chapters: any[]) =>
        setSurahList(chapters.map((c) => ({ id: c.id, name_simple: c.name_simple, name_arabic: c.name_arabic })))
      )
      .catch(() => {});
  }, [showJumpModal, surahList.length]);

  const jumpToPage = useCallback((page: number) => {
    const target = Math.min(TOTAL_PAGES, Math.max(1, page));
    flatListRef.current?.scrollToIndex({ index: target - 1, animated: false });
    setCurrentPageIndex(target - 1);
    setShowJumpModal(false);
    setPageInput('');
  }, []);

  const handleBookmarkPress = useCallback(() => {
    if (isBookmarked) {
      savePageBookmark(null).then(() => setBookmarkState(null));
    } else {
      setAyahInput('');
      setShowBookmarkModal(true);
    }
  }, [isBookmarked, currentPage]);

  const handleSaveBookmark = useCallback(() => {
    const ayahNum = ayahInput.trim() ? Number(ayahInput.trim()) : undefined;
    const bm: PageBookmark = { page: currentPage, ayahNumber: ayahNum && ayahNum > 0 ? ayahNum : undefined };
    savePageBookmark(bm).then(() => {
      setBookmarkState(bm);
      setShowBookmarkModal(false);
    });
  }, [currentPage, ayahInput]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentPageIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderPage = useCallback(
    ({ item: pageNum }: { item: number }) => <MushafPageView pageNum={pageNum} />,
    []
  );

  return (
    <GlassBackground>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarJump}
            onPress={() => setShowJumpModal(true)}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text style={styles.topBarText}>{t.juz} {currentJuz}</Text>
            <Text style={styles.topBarPage}>{currentPage} / {TOTAL_PAGES}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBookmarkPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isBookmarked ? '#f5a623' : 'rgba(255,255,255,0.45)'}
            />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={allPages}
          keyExtractor={(item) => `page-${item}`}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          inverted
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={3}
        />

        <Modal visible={showBookmarkModal} transparent animationType="fade" onRequestClose={() => setShowBookmarkModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowBookmarkModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Pressable style={styles.modalCard} onPress={() => undefined}>
                <Text style={styles.modalTitle}>{t.saveBookmark}</Text>
                <Text style={styles.modalSubtitle}>{t.page} {currentPage}</Text>
                <Text style={styles.modalLabel}>{t.enterAyahNumber}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t.ayah}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={ayahInput}
                  onChangeText={setAyahInput}
                  keyboardType="number-pad"
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setShowBookmarkModal(false)}>
                    <Text style={styles.modalCancelText}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSave} onPress={handleSaveBookmark}>
                    <Text style={styles.modalSaveText}>{t.savePageBookmark}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal visible={showJumpModal} transparent animationType="fade" onRequestClose={() => setShowJumpModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowJumpModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Pressable style={[styles.modalCard, styles.jumpCard]} onPress={() => undefined}>
                <Text style={styles.modalTitle}>{t.jumpTo}</Text>
                <View style={styles.jumpTabs}>
                  {([
                    ['surah', t.surahTab],
                    ['juz', t.juz],
                    ['page', t.pageTab],
                  ] as const).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.jumpTabBtn, jumpTab === key && styles.jumpTabBtnActive]}
                      onPress={() => setJumpTab(key)}
                    >
                      <Text style={[styles.jumpTabText, jumpTab === key && styles.jumpTabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {jumpTab === 'surah' && (
                  <FlatList
                    data={surahList}
                    keyExtractor={(item) => `s-${item.id}`}
                    style={styles.jumpList}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.jumpRow} onPress={() => jumpToPage(getSurahStartPage(item.id))}>
                        <Text style={styles.jumpRowNum}>{item.id}</Text>
                        <Text style={styles.jumpRowName}>
                          {lang === 'ar' ? item.name_arabic : item.name_simple}
                        </Text>
                        <Text style={styles.jumpRowPage}>{t.page} {getSurahStartPage(item.id)}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<ActivityIndicator color="rgba(255,255,255,0.4)" style={{ marginVertical: 24 }} />}
                  />
                )}

                {jumpTab === 'juz' && (
                  <View style={styles.juzGrid}>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                      <TouchableOpacity
                        key={j}
                        style={[styles.juzCell, j === currentJuz && styles.juzCellActive]}
                        onPress={() => jumpToPage(getJuzStartPage(j))}
                      >
                        <Text style={[styles.juzCellText, j === currentJuz && styles.juzCellTextActive]}>{j}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {jumpTab === 'page' && (
                  <View>
                    <Text style={styles.modalLabel}>{t.goToPage} (1–{TOTAL_PAGES})</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder={t.page}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={pageInput}
                      onChangeText={setPageInput}
                      keyboardType="number-pad"
                      autoFocus
                      onSubmitEditing={() => pageInput.trim() && jumpToPage(Number(pageInput.trim()))}
                    />
                    <TouchableOpacity
                      style={styles.modalSave}
                      onPress={() => pageInput.trim() && jumpToPage(Number(pageInput.trim()))}
                    >
                      <Text style={styles.modalSaveText}>{t.go}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarJump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  topBarPage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  page: { flex: 1 },
  imageWrap: {
    flex: 1,
    marginHorizontal: 4,
  },
  pageWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,18,31,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'rgba(18,46,63,0.97)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 20,
  },
  jumpCard: {
    maxHeight: 520,
    minWidth: SCREEN_WIDTH - 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f5a623',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: UI_COLORS.text,
    textAlign: 'center',
    marginBottom: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: UI_RADII.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  modalSave: {
    flex: 1,
    backgroundColor: '#f5a623',
    borderRadius: UI_RADII.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '700',
  },
  jumpTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  jumpTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: UI_RADII.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  jumpTabBtnActive: {
    backgroundColor: '#f5a623',
  },
  jumpTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  jumpTabTextActive: {
    color: '#000',
  },
  jumpList: {
    maxHeight: 360,
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  jumpRowNum: {
    width: 30,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  jumpRowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: UI_COLORS.text,
  },
  jumpRowPage: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  juzGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  juzCell: {
    width: 44,
    height: 44,
    borderRadius: UI_RADII.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzCellActive: {
    backgroundColor: '#f5a623',
    borderColor: '#f5a623',
  },
  juzCellText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  juzCellTextActive: {
    color: '#000',
  },
});
