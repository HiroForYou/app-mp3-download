import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { clearLibrary } from '../../lib/download';
import { getServerSettings, setServerSettings } from '../../lib/settings';
import { Button } from '../../lib/tw/Button';
import { Text, TextInput, View } from '../../lib/tw';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getServerSettings();
      setServerUrl(settings.serverUrl);
      setApiKey(settings.apiKey);
    })();
  }, []);

  const testConnection = useCallback(async () => {
    const base = serverUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setTestResult('Ingresa una URL primero.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${base}/api/health`, {
        headers: apiKey ? { 'x-api-key': apiKey } : undefined,
      });
      setTestResult(response.ok ? 'Conexión exitosa.' : `El servidor respondió con error ${response.status}.`);
    } catch {
      setTestResult('No se pudo conectar al servidor.');
    } finally {
      setTesting(false);
    }
  }, [serverUrl, apiKey]);

  const handleSave = useCallback(async () => {
    await setServerSettings({ serverUrl, apiKey });
    setSaved(true);
  }, [serverUrl, apiKey]);

  const handleClearLibrary = useCallback(() => {
    Alert.alert('Borrar todo', '¿Eliminar todas las canciones descargadas? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await clearLibrary();
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  }, []);

  return (
    <View className="flex-1 gap-4 bg-white p-4">
      <View className="gap-3 rounded-2xl bg-gray-100 p-4">
        <Text className="text-sm font-semibold uppercase text-gray-500">Servidor de conversión (YouTube)</Text>
        <TextInput
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base"
          value={serverUrl}
          onChangeText={(value) => {
            setServerUrl(value);
            setSaved(false);
          }}
          placeholder="https://tu-servidor.com"
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base"
          value={apiKey}
          onChangeText={(value) => {
            setApiKey(value);
            setSaved(false);
          }}
          placeholder="Clave API (opcional)"
          autoCapitalize="none"
          secureTextEntry
        />
      </View>
      <Button label={testing ? 'Probando…' : 'Probar conexión'} variant="outlined" onPress={testConnection} disabled={testing} />
      {testResult ? <Text className="text-center text-gray-700">{testResult}</Text> : null}
      <Button label="Guardar" onPress={handleSave} />
      {saved ? <Text className="text-center text-green-600">Guardado.</Text> : null}
      <Button
        label={clearing ? 'Borrando…' : 'Borrar todas las descargas'}
        variant="text"
        onPress={handleClearLibrary}
        disabled={clearing}
      />
    </View>
  );
}
