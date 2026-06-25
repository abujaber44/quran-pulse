import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchTajweedVerse, getTajweedRuleInfo, type TajweedVerse } from '../services/quranApi';
import { getAiInsight } from '../services/aiService';
import { UI_COLORS, UI_RADII } from '../theme/ui';
import { useLanguage } from '../i18n';

interface TajweedViewProps {
  verseKey: string;
  arabicFontFamily?: string;
}

export default function TajweedView({ verseKey, arabicFontFamily }: TajweedViewProps) {
  const { t, lang } = useLanguage();
  const [tajweed, setTajweed] = useState<TajweedVerse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [ruleExplanation, setRuleExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const ruleInfo = getTajweedRuleInfo();

  useEffect(() => {
    setLoading(true);
    fetchTajweedVerse(verseKey).then((data) => {
      setTajweed(data);
      setLoading(false);
    });
  }, [verseKey]);

  const handleRuleTap = async (rule: string) => {
    if (selectedRule === rule) {
      setSelectedRule(null);
      setRuleExplanation(null);
      return;
    }
    setSelectedRule(rule);
    setRuleExplanation(null);
    setLoadingExplanation(true);

    const info = ruleInfo[rule];
    try {
      const explanation = await getAiInsight('athkar', {
        title: `Tajweed Rule: ${info?.en ?? rule}`,
        text: `${info?.en ?? rule} (${info?.ar ?? ''})`,
        repetitions: 0,
        fadl: `This is a Quran recitation (tajweed) rule called ${info?.en}. Explain what this tajweed rule is, when it applies, and how to pronounce it correctly. Give a brief example. Keep it educational and concise (2 paragraphs).`,
      }, undefined, lang);
      setRuleExplanation(explanation);
    } catch {
      setRuleExplanation(lang === 'ar' ? 'لم نتمكن من تحميل الشرح.' : 'Could not load explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={UI_COLORS.primary} />
      </View>
    );
  }

  if (!tajweed || tajweed.words.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{lang === 'ar' ? 'التجويد غير متوفر' : 'Tajweed not available'}</Text>
      </View>
    );
  }

  const activeRules = [...new Set(tajweed.words.filter(w => w.rule).map(w => w.rule!))];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t.tajweedRules}</Text>

      <View style={styles.tajweedText}>
        <View style={styles.tajweedWordsRow}>
          {tajweed.words.map((w, i) => {
            const color = w.rule ? (ruleInfo[w.rule]?.color ?? null) : null;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                disabled={!w.rule}
                onPress={() => w.rule && handleRuleTap(w.rule)}
                style={[
                  styles.tajweedWordWrap,
                  color ? { borderBottomWidth: 3, borderBottomColor: color } : null,
                ]}
              >
                <Text style={[
                  styles.arabicBase,
                  arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
                ]}>
                  {w.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.legendGrid}>
        {activeRules.map((rule) => {
          const info = ruleInfo[rule];
          if (!info) return null;
          const isSelected = selectedRule === rule;
          return (
            <TouchableOpacity
              key={rule}
              style={[styles.legendItem, isSelected && styles.legendItemActive]}
              onPress={() => handleRuleTap(rule)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: info.color }]} />
              <Text style={[styles.legendLabel, isSelected && styles.legendLabelActive]}>
                {lang === 'ar' ? info.ar : info.en}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedRule && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationTitle}>
            {lang === 'ar' ? ruleInfo[selectedRule]?.ar : ruleInfo[selectedRule]?.en}
          </Text>
          {loadingExplanation ? (
            <ActivityIndicator size="small" color={UI_COLORS.accent} style={{ marginTop: 8 }} />
          ) : ruleExplanation ? (
            <Text style={styles.explanationText}>{ruleExplanation}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.3)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.accent,
    marginBottom: 10,
  },
  tajweedText: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: UI_RADII.sm,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,217,230,0.4)',
  },
  tajweedWordsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  tajweedWordWrap: {
    paddingBottom: 2,
    marginBottom: 4,
  },
  arabicBase: {
    fontSize: 22,
    lineHeight: 38,
    color: UI_COLORS.text,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(200,217,230,0.3)',
    gap: 5,
  },
  legendItemActive: {
    borderColor: UI_COLORS.accent,
    backgroundColor: 'rgba(45,127,184,0.08)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  legendLabelActive: {
    color: UI_COLORS.accent,
  },
  explanationBox: {
    backgroundColor: 'rgba(45,127,184,0.06)',
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: UI_COLORS.accent,
    padding: 12,
    marginTop: 4,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.accent,
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    color: UI_COLORS.text,
  },
  errorText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
});
