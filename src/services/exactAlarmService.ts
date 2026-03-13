import { NativeModules, Platform } from 'react-native';

type ExactAlarmNativeModule = {
  canScheduleExactAlarms?: () => Promise<boolean> | boolean;
  openExactAlarmSettings?: () => Promise<boolean> | boolean;
  isIgnoringBatteryOptimizations?: () => Promise<boolean> | boolean;
};

const nativeModule = NativeModules.ExactAlarmModule as ExactAlarmNativeModule | undefined;

const toBoolean = (value: unknown): boolean => value === true;

export const canScheduleExactAlarms = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (!nativeModule?.canScheduleExactAlarms) return false;

  try {
    return toBoolean(await nativeModule.canScheduleExactAlarms());
  } catch {
    return false;
  }
};

export const openExactAlarmSettings = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  if (!nativeModule?.openExactAlarmSettings) return false;

  try {
    return toBoolean(await nativeModule.openExactAlarmSettings());
  } catch {
    return false;
  }
};

export const isIgnoringBatteryOptimizations = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (!nativeModule?.isIgnoringBatteryOptimizations) return false;

  try {
    return toBoolean(await nativeModule.isIgnoringBatteryOptimizations());
  } catch {
    return false;
  }
};
