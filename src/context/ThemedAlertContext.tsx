import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

export type ThemedAlertVariant = 'info' | 'success' | 'danger';
type ThemedAlertButtonRole = 'default' | 'cancel' | 'destructive';

type ThemedAlertButton = {
  text: string;
  onPress?: () => void;
  role?: ThemedAlertButtonRole;
};

type ThemedAlertOptions = {
  title: string;
  message?: string;
  variant?: ThemedAlertVariant;
  dismissible?: boolean;
  buttons?: ThemedAlertButton[];
};

type AlertState = Required<Pick<ThemedAlertOptions, 'title' | 'variant' | 'dismissible'>> &
  Omit<ThemedAlertOptions, 'title' | 'variant' | 'dismissible'> & {
    buttons: ThemedAlertButton[];
  };

type ThemedAlertContextValue = {
  showAlert: (options: ThemedAlertOptions) => void;
  hideAlert: () => void;
};

const ThemedAlertContext = createContext<ThemedAlertContextValue | undefined>(undefined);

const VARIANT_ACCENT: Record<ThemedAlertVariant, string> = {
  info: UI_COLORS.accent,
  success: UI_COLORS.primary,
  danger: UI_COLORS.danger,
};

const DEFAULT_BUTTON_TEXT: Record<ThemedAlertVariant, string> = {
  info: 'OK',
  success: 'Great',
  danger: 'Understood',
};

export function ThemedAlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const hideAlert = useCallback(() => {
    setAlertState(null);
  }, []);

  const showAlert = useCallback((options: ThemedAlertOptions) => {
    const variant = options.variant || 'info';
    const buttons =
      options.buttons && options.buttons.length > 0
        ? options.buttons
        : [{ text: DEFAULT_BUTTON_TEXT[variant], role: 'default' as const }];

    setAlertState({
      title: options.title,
      message: options.message,
      variant,
      dismissible: options.dismissible ?? true,
      buttons,
    });
  }, []);

  const handleButtonPress = useCallback((button: ThemedAlertButton) => {
    setAlertState(null);
    if (button.onPress) {
      setTimeout(() => {
        button.onPress?.();
      }, 0);
    }
  }, []);

  const value = useMemo(
    () => ({
      showAlert,
      hideAlert,
    }),
    [hideAlert, showAlert]
  );

  const accentColor = alertState ? VARIANT_ACCENT[alertState.variant] : UI_COLORS.accent;
  const useVerticalButtons = !!alertState && alertState.buttons.length > 2;

  return (
    <ThemedAlertContext.Provider value={value}>
      {children}
      <Modal visible={!!alertState} transparent animationType="fade" onRequestClose={hideAlert}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (alertState?.dismissible) {
              hideAlert();
            }
          }}
        >
          <Pressable style={styles.card} onPress={() => undefined}>
            <Text style={[styles.title, { color: accentColor }]}>{alertState?.title}</Text>
            {alertState?.message ? <Text style={styles.message}>{alertState.message}</Text> : null}

            <View
              style={[
                styles.buttonsWrap,
                useVerticalButtons ? styles.buttonsWrapVertical : styles.buttonsWrapHorizontal,
              ]}
            >
              {alertState?.buttons.map((button, index) => {
                const role = button.role || 'default';
                const buttonStyles = [
                  styles.buttonBase,
                  role === 'cancel'
                    ? styles.buttonCancel
                    : role === 'destructive'
                      ? styles.buttonDanger
                      : { backgroundColor: accentColor },
                  useVerticalButtons ? styles.buttonVertical : styles.buttonHorizontal,
                ];
                const textStyles = [
                  styles.buttonText,
                  role === 'cancel' ? styles.buttonCancelText : styles.buttonFilledText,
                ];

                return (
                  <TouchableOpacity
                    key={`${button.text}-${index}`}
                    style={buttonStyles}
                    activeOpacity={0.85}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text style={textStyles}>{button.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedAlertContext.Provider>
  );
}

export function useThemedAlert() {
  const context = useContext(ThemedAlertContext);
  if (!context) {
    throw new Error('useThemedAlert must be used within ThemedAlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 18, 31, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    ...UI_SHADOWS.card,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: UI_COLORS.text,
  },
  buttonsWrap: {
    marginTop: 14,
    gap: 10,
  },
  buttonsWrapHorizontal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  buttonsWrapVertical: {
    flexDirection: 'column',
  },
  buttonBase: {
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonHorizontal: {
    minWidth: 92,
  },
  buttonVertical: {
    width: '100%',
  },
  buttonCancel: {
    backgroundColor: UI_COLORS.surface,
    borderColor: UI_COLORS.border,
  },
  buttonDanger: {
    backgroundColor: UI_COLORS.danger,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonCancelText: {
    color: UI_COLORS.textMuted,
  },
  buttonFilledText: {
    color: UI_COLORS.white,
  },
});
