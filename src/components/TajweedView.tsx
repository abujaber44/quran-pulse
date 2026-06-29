import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchTajweedVerse, getTajweedRuleInfo, type TajweedVerse } from '../services/quranApi';
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
  const [webViewHeight, setWebViewHeight] = useState(120);

  const ruleInfo = getTajweedRuleInfo();

  useEffect(() => {
    setLoading(true);
    fetchTajweedVerse(verseKey).then((data) => {
      setTajweed(data);
      setLoading(false);
    });
  }, [verseKey]);

  const handleRuleTap = (rule: string) => {
    setSelectedRule(prev => prev === rule ? null : rule);
  };

  const onWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const data = event.nativeEvent.data;
    if (data.startsWith('height:')) {
      setWebViewHeight(Math.ceil(Number(data.split(':')[1])) + 4);
    } else if (data.startsWith('rule:')) {
      handleRuleTap(data.split(':')[1]);
    }
  }, []);

  const buildTajweedHtml = useCallback(() => {
    if (!tajweed) return '';
    const spans = tajweed.words.map(w => {
      if (!w.rule) return w.text;
      const color = ruleInfo[w.rule]?.color ?? '#FFFFFF';
      return `<span style="color:${color};font-weight:700;cursor:pointer" onclick="window.ReactNativeWebView.postMessage('rule:${w.rule}')">${w.text}</span>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent;direction:rtl;text-align:right;padding:2px 0;overflow:hidden;-webkit-text-size-adjust:100%}
.t{font-size:22px;line-height:38px;color:#FFFFFF;font-family:serif}</style></head>
<body><p class="t">${spans}</p>
<script>
function send(){window.ReactNativeWebView.postMessage('height:'+document.body.scrollHeight)}
new MutationObserver(send).observe(document.body,{childList:true,subtree:true});
window.onload=send;setTimeout(send,100);
</script></body></html>`;
  }, [tajweed, ruleInfo]);

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
        {Platform.OS === 'ios' ? (
          <Text style={[styles.arabicBase, arabicFontFamily ? { fontFamily: arabicFontFamily } : null]}>
            {tajweed.words.map((w, i) => {
              if (!w.rule) return <Text key={i}>{w.text}</Text>;
              const color = ruleInfo[w.rule]?.color ?? UI_COLORS.text;
              return (
                <Text key={i} style={{ color, fontWeight: '700' }} onPress={() => handleRuleTap(w.rule!)}>
                  {w.text}
                </Text>
              );
            })}
          </Text>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: buildTajweedHtml() }}
            style={{ height: webViewHeight, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            onMessage={onWebViewMessage}
            javaScriptEnabled
            showsVerticalScrollIndicator={false}
          />
        )}
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

      {selectedRule && ruleInfo[selectedRule] && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationTitle}>
            {lang === 'ar' ? ruleInfo[selectedRule].ar : ruleInfo[selectedRule].en}
          </Text>
          <Text style={styles.explanationText}>
            {lang === 'ar' ? ruleInfo[selectedRule].descAr : ruleInfo[selectedRule].descEn}
          </Text>
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
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.accent,
    marginBottom: 10,
  },
  tajweedText: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: UI_RADII.sm,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  arabicBase: {
    fontSize: 22,
    lineHeight: 38,
    color: UI_COLORS.text,
    writingDirection: 'rtl',
    textAlign: 'right',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 5,
  },
  legendItemActive: {
    borderColor: UI_COLORS.accent,
    backgroundColor: 'rgba(45,127,184,0.15)',
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
