import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SELECTED_RECITER: '@selected_reciter',
};

export const saveReciter = async (reciterId: string) => {
  await AsyncStorage.setItem(KEYS.SELECTED_RECITER, reciterId);
};

export const getReciter = async (): Promise<string> => {
  const id = await AsyncStorage.getItem(KEYS.SELECTED_RECITER);
  return id || 'ar.alafasy';
};