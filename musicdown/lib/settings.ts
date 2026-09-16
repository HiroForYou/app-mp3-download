import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'musicdown.serverUrl';
const API_KEY_KEY = 'musicdown.apiKey';

const DEFAULT_SERVER_URL = 'http://192.168.18.72:3008';

export interface ServerSettings {
  serverUrl: string;
  apiKey: string;
}

export async function getServerSettings(): Promise<ServerSettings> {
  const [serverUrl, apiKey] = await Promise.all([
    AsyncStorage.getItem(SERVER_URL_KEY),
    AsyncStorage.getItem(API_KEY_KEY),
  ]);
  return { serverUrl: serverUrl ?? DEFAULT_SERVER_URL, apiKey: apiKey ?? '' };
}

export async function setServerSettings(settings: ServerSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SERVER_URL_KEY, settings.serverUrl.trim()),
    AsyncStorage.setItem(API_KEY_KEY, settings.apiKey.trim()),
  ]);
}
