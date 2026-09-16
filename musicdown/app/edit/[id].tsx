import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteTrack, downloadImageBytes, updateTrackMetadata } from '../../lib/download';
import { searchCovers, type CoverResult } from '../../lib/itunes';
import { getTrack } from '../../lib/library';
import { Button } from '../../lib/tw/Button';
import { Pressable, ScrollView, Text, TextInput, View } from '../../lib/tw';
import type { Track } from '../../lib/types';

type PendingCover = { kind: 'remote'; url: string } | { kind: 'local'; uri: string };

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [track, setTrack] = useState<Track | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');

  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoverResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const found = await getTrack(id);
      if (!found) {
        router.back();
        return;
      }
      setTrack(found);
      setTitle(found.title);
      setArtist(found.artist);
      setAlbum(found.album);
      setPreviewUri(found.coverUri);
      setQuery(`${found.artist} ${found.title}`.trim());
    })();
  }, [id, router]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Se necesita permiso para acceder a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setPendingCover({ kind: 'local', uri });
    setPreviewUri(uri);
  }, []);

  const changeCover = useCallback(() => {
    Alert.alert('Cambiar portada', undefined, [
      { text: 'Elegir de galería', onPress: pickFromGallery },
      { text: 'Buscar portada', onPress: () => setCoverSearchOpen(true) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [pickFromGallery]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      setResults(await searchCovers(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La búsqueda falló.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const selectCover = useCallback((result: CoverResult) => {
    setPendingCover({ kind: 'remote', url: result.artworkUrl });
    setPreviewUri(result.artworkUrl);
    setCoverSearchOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!track) return;
    setBusy(true);
    setError(null);
    try {
      let coverBytes: Uint8Array | undefined;
      if (pendingCover?.kind === 'remote') {
        const bytes = await downloadImageBytes(pendingCover.url);
        if (bytes) coverBytes = bytes;
      } else if (pendingCover?.kind === 'local') {
        coverBytes = await new File(pendingCover.uri).bytes();
      }
      await updateTrackMetadata(track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || track.artist,
        album: album.trim(),
        coverBytes,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }, [track, pendingCover, title, artist, album, router]);

  const handleDelete = useCallback(() => {
    if (!track) return;
    Alert.alert('Eliminar canción', `¿Eliminar "${track.title}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteTrack(track.id);
          router.back();
        },
      },
    ]);
  }, [track, router]);

  if (!track) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Cargando…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4">
        <Pressable onPress={changeCover} className="self-center">
          <View style={{ width: 160, height: 160 }}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={{ width: 160, height: 160, borderRadius: 12 }} />
            ) : (
              <View className="h-40 w-40 items-center justify-center rounded-xl bg-gray-200">
                <Text className="text-sm text-gray-400">Sin portada</Text>
              </View>
            )}
            <View className="absolute bottom-1.5 right-1.5 h-8 w-8 items-center justify-center rounded-full bg-black/60">
              <Text className="text-sm text-white">✎</Text>
            </View>
          </View>
        </Pressable>
        <Text className="-mt-3 text-center text-xs text-gray-400">Toca la portada para cambiarla</Text>
        <TextInput
          className="rounded-xl border border-gray-300 px-4 py-3 text-base"
          value={title}
          onChangeText={setTitle}
          placeholder="Título"
        />
        <TextInput
          className="rounded-xl border border-gray-300 px-4 py-3 text-base"
          value={artist}
          onChangeText={setArtist}
          placeholder="Artista"
        />
        <TextInput
          className="rounded-xl border border-gray-300 px-4 py-3 text-base"
          value={album}
          onChangeText={setAlbum}
          placeholder="Álbum (opcional)"
        />
        {error ? <Text className="text-red-600">{error}</Text> : null}
        <Button label={busy ? 'Guardando…' : 'Guardar'} onPress={handleSave} disabled={busy} />
        <Button label="Eliminar" variant="text" onPress={handleDelete} />
      </ScrollView>

      <Modal
        visible={coverSearchOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCoverSearchOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable className="flex-1 bg-black/40" onPress={() => setCoverSearchOpen(false)} />
          <View
            className="max-h-[75%] gap-3 rounded-t-2xl bg-white px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <TextInput
              className="rounded-xl border border-gray-300 px-4 py-3 text-base"
              value={query}
              onChangeText={setQuery}
              placeholder="Artista - título"
              onSubmitEditing={runSearch}
            />
            <Button label={searching ? 'Buscando…' : 'Buscar'} onPress={runSearch} disabled={searching} />
            <FlatList
              style={{ flexGrow: 0 }}
              data={results}
              keyExtractor={(result) => result.id}
              initialNumToRender={8}
              windowSize={5}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text className="py-4 text-center text-gray-500">Busca un álbum</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectCover(item)}
                  className="flex-row items-center gap-3 border-b border-gray-100 py-3 active:bg-gray-50"
                >
                  <Image source={{ uri: item.thumbnailUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} />
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900">{item.title}</Text>
                    <Text className="text-sm text-gray-500">{item.artist}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
