import { useCallback, useState } from 'react';

import { downloadTrack } from '../../lib/download';
import { Button } from '../../lib/tw/Button';
import { Text, TextInput, View } from '../../lib/tw';

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    const value = url.trim();
    if (!value) {
      setError('Pega un enlace primero.');
      return;
    }
    setBusy(true);
    setProgress(null);
    setError(null);
    setSuccess(null);
    try {
      const track = await downloadTrack(value, (percent) => setProgress(percent));
      setUrl('');
      setSuccess(`"${track.title}" se guardó en Música.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar el enlace.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [url]);

  const buttonLabel = busy
    ? progress !== null
      ? `Descargando… ${Math.round(progress)}%`
      : 'Descargando…'
    : 'Descargar';

  return (
    <View className="flex-1 gap-3 bg-white p-4">
      <TextInput
        className="rounded-xl border border-gray-300 px-4 py-3 text-base"
        value={url}
        onChangeText={setUrl}
        placeholder="Pega el enlace del MP3 o de YouTube"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Button label={buttonLabel} onPress={handleDownload} disabled={busy} />
      {busy && progress !== null ? (
        <View className="h-2 overflow-hidden rounded-full bg-gray-200">
          <View className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(2, Math.round(progress))}%` }} />
        </View>
      ) : null}
      {error ? <Text className="text-red-600">{error}</Text> : null}
      {success ? <Text className="text-green-600">{success}</Text> : null}
    </View>
  );
}
