import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteExternalAsset, deleteTrack, listAllMusicFolderAudio, type ExternalAudioItem } from '../../lib/download';
import { listTracks } from '../../lib/library';
import { Pressable, Text, View } from '../../lib/tw';
import type { Track } from '../../lib/types';

type LibraryRow =
  | { kind: 'app'; key: string; id: string; title: string; artist: string; fileUri: string }
  | { kind: 'external'; key: string; id: string; title: string; artist: string; fileUri: string };

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type FilterMode = 'downloaded' | 'all';
type SortMode = 'recent' | 'title' | 'artist';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recientes',
  title: 'Título A-Z',
  artist: 'Artista A-Z',
};

const SORT_MODES: SortMode[] = ['recent', 'title', 'artist'];

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filterMode, setFilterMode] = useState<FilterMode>('downloaded');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [externalItems, setExternalItems] = useState<ExternalAudioItem[]>([]);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const reloadAppTracks = useCallback(async () => {
    const appTracks = await listTracks();
    setTracks(appTracks);
    return appTracks;
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadAppTracks();
    }, [reloadAppTracks])
  );

  const scanMusicFolder = useCallback(async () => {
    setScanning(true);
    setExternalError(null);
    try {
      const appTracks = await reloadAppTracks();
      const knownAssetIds = new Set(appTracks.map((t) => t.mediaAssetId).filter((v): v is string => Boolean(v)));
      setExternalItems(await listAllMusicFolderAudio(knownAssetIds));
      setHasScanned(true);
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : 'No se pudo leer la carpeta Music.');
    } finally {
      setScanning(false);
    }
  }, [reloadAppTracks]);

  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingKey(null);
    }
  }, [status.didJustFinish]);

  const rows: LibraryRow[] = [
    ...tracks.map((t): LibraryRow => ({ kind: 'app', key: `app:${t.id}`, id: t.id, title: t.title, artist: t.artist, fileUri: t.fileUri })),
    ...(filterMode === 'all'
      ? externalItems.map(
          (item): LibraryRow => ({
            kind: 'external',
            key: `ext:${item.mediaAssetId}`,
            id: item.mediaAssetId,
            title: item.title,
            artist: item.artist,
            fileUri: item.fileUri,
          })
        )
      : []),
  ];

  if (sortMode === 'title') {
    rows.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortMode === 'artist') {
    rows.sort((a, b) => a.artist.localeCompare(b.artist));
  }

  const nowPlaying = rows.find((r) => r.key === playingKey) ?? null;

  const openSortMenu = useCallback(() => setSortMenuOpen(true), []);

  const togglePlay = useCallback(
    (row: LibraryRow) => {
      if (playingKey === row.key && status.playing) {
        player.pause();
        return;
      }
      if (playingKey === row.key) {
        player.play();
        return;
      }
      player.replace(row.fileUri);
      player.play();
      setPlayingKey(row.key);
    },
    [player, playingKey, status.playing]
  );

  const seekBy = useCallback(
    (delta: number) => {
      const target = Math.max(0, Math.min(status.duration || 0, status.currentTime + delta));
      player.seekTo(target);
    },
    [player, status.currentTime, status.duration]
  );

  const toggleSelected = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }, []);

  const startSelecting = useCallback((key: string) => {
    setSelectionMode(true);
    setSelected(new Set([key]));
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const handleRowPress = useCallback(
    (row: LibraryRow) => {
      if (selectionMode) {
        toggleSelected(row.key);
        return;
      }
      if (row.kind === 'app') {
        router.push(`/edit/${row.id}`);
      }
    },
    [selectionMode, toggleSelected, router]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    Alert.alert(
      'Eliminar canciones',
      `¿Eliminar ${selected.size} canción(es) seleccionada(s)? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              player.pause();
              setPlayingKey(null);
              const deletedExternalIds = new Set<string>();
              const errors: string[] = [];
              for (const key of selected) {
                const [kind, id] = key.split(':', 2);
                try {
                  if (kind === 'app') {
                    await deleteTrack(id);
                  } else {
                    await deleteExternalAsset(id);
                    deletedExternalIds.add(id);
                  }
                } catch (e) {
                  errors.push(e instanceof Error ? e.message : String(e));
                }
              }
              cancelSelection();
              await reloadAppTracks();
              if (deletedExternalIds.size > 0) {
                setExternalItems((prev) => prev.filter((item) => !deletedExternalIds.has(item.mediaAssetId)));
              }
              if (errors.length > 0) {
                Alert.alert('No se pudo eliminar', errors.join('\n'));
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [selected, player, reloadAppTracks, cancelSelection]);

  return (
    <View className="flex-1 bg-white">
      {!selectionMode ? (
        <View className="flex-row gap-2 border-b border-gray-100 px-4 py-2">
          <Pressable
            onPress={() => setFilterMode('downloaded')}
            className={`flex-1 items-center rounded-lg py-2 ${filterMode === 'downloaded' ? 'bg-blue-600' : 'bg-gray-100'}`}
          >
            <Text className={`text-sm font-medium ${filterMode === 'downloaded' ? 'text-white' : 'text-gray-600'}`}>
              Mis descargas
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterMode('all')}
            className={`flex-1 items-center rounded-lg py-2 ${filterMode === 'all' ? 'bg-blue-600' : 'bg-gray-100'}`}
          >
            <Text className={`text-sm font-medium ${filterMode === 'all' ? 'text-white' : 'text-gray-600'}`}>
              Todas (carpeta Music)
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!selectionMode && filterMode === 'all' ? (
        <View className="flex-row items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <Text className="flex-1 text-xs text-gray-500">
            {scanning
              ? 'Escaneando tu música… puede tardar unos segundos.'
              : hasScanned
                ? `${externalItems.length} canción(es) encontradas fuera de la app.`
                : 'Toca "Escanear" para buscar canciones en Music.'}
          </Text>
          <Pressable onPress={scanMusicFolder} disabled={scanning} className="ml-2 rounded-lg bg-blue-600 px-3 py-1.5">
            <Text className="text-xs font-medium text-white">
              {scanning ? 'Escaneando…' : hasScanned ? 'Actualizar' : 'Escanear'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!selectionMode ? (
        <Pressable
          onPress={openSortMenu}
          className="flex-row items-center justify-end gap-1 px-4 py-1.5"
        >
          <Text className="text-xs text-gray-400">⇅ {SORT_LABELS[sortMode]}</Text>
        </Pressable>
      ) : null}
      {selectionMode ? (
        <View className="flex-row items-center justify-between border-b border-gray-100 bg-blue-50 px-4 py-3">
          <Pressable onPress={cancelSelection}>
            <Text className="text-base text-gray-600">✕ Cancelar</Text>
          </Pressable>
          <Text className="text-base font-medium text-gray-900">{selected.size} seleccionada(s)</Text>
          <Pressable onPress={handleDeleteSelected} disabled={deleting}>
            <Text className="text-base font-semibold text-red-600">{deleting ? 'Eliminando…' : 'Eliminar'}</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: nowPlaying ? 128 : 16, flexGrow: 1 }}
        data={rows}
        keyExtractor={(row) => row.key}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          externalError ? (
            <View className="mx-4 mt-4 rounded-xl bg-amber-50 p-3">
              <Text className="text-sm text-amber-800">{externalError}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !scanning ? (
            <View className="px-4 py-6">
              <Text className="text-gray-500">
                {filterMode === 'all'
                  ? hasScanned
                    ? 'No se encontraron canciones en Music.'
                    : 'Toca "Escanear" arriba para ver todas las canciones de Music.'
                  : 'No has descargado ninguna canción todavía.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: row }) => {
          const isPlaying = playingKey === row.key && status.playing;
          const isSelected = selected.has(row.key);
          return (
            <View className="flex-row items-center gap-3 border-b border-gray-100 px-4 py-3">
              <Pressable
                onPress={() => (selectionMode ? toggleSelected(row.key) : togglePlay(row))}
                onLongPress={() => startSelecting(row.key)}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
              >
                <Text className="text-lg">{isPlaying ? '⏸' : '▶'}</Text>
              </Pressable>
              <Pressable className="flex-1" onPress={() => handleRowPress(row)} onLongPress={() => startSelecting(row.key)}>
                <Text className="text-base font-medium text-gray-900">{row.title}</Text>
                <Text className={`text-sm ${row.kind === 'app' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {row.kind === 'app' ? row.artist : 'Fuera de la app · sin edición'}
                </Text>
              </Pressable>
              {selectionMode ? (
                <Pressable
                  onPress={() => toggleSelected(row.key)}
                  className={`h-7 w-7 items-center justify-center rounded-md border ${
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {isSelected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
      {nowPlaying ? (
        <View className="absolute bottom-0 left-0 right-0 gap-1 border-t border-gray-100 bg-white px-4 pt-3 pb-4">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {nowPlaying.title}
          </Text>
          <Slider
            style={{ width: '100%', height: 32 }}
            minimumValue={0}
            maximumValue={status.duration || 1}
            value={scrubbing ? scrubValue : status.currentTime}
            onValueChange={(value) => {
              setScrubbing(true);
              setScrubValue(value);
            }}
            onSlidingComplete={(value) => {
              player.seekTo(value);
              setScrubbing(false);
            }}
            minimumTrackTintColor="#2563eb"
            maximumTrackTintColor="#e5e7eb"
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-gray-500">{formatTime(scrubbing ? scrubValue : status.currentTime)}</Text>
            <View className="flex-row items-center gap-6">
              <Pressable onPress={() => seekBy(-10)}>
                <Text className="text-lg">⏪</Text>
              </Pressable>
              <Pressable onPress={() => (status.playing ? player.pause() : player.play())}>
                <Text className="text-2xl">{status.playing ? '⏸' : '▶'}</Text>
              </Pressable>
              <Pressable onPress={() => seekBy(10)}>
                <Text className="text-lg">⏩</Text>
              </Pressable>
            </View>
            <Text className="text-xs text-gray-500">{formatTime(status.duration)}</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={sortMenuOpen} animationType="fade" transparent onRequestClose={() => setSortMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setSortMenuOpen(false)} />
        <View className="gap-1 rounded-t-2xl bg-white px-4 pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="mb-2 text-sm font-semibold uppercase text-gray-500">Ordenar por</Text>
          {SORT_MODES.map((mode) => {
            const isActive = sortMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => {
                  setSortMode(mode);
                  setSortMenuOpen(false);
                }}
                className="flex-row items-center gap-3 border-b border-gray-100 py-3"
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isActive ? 'border-blue-600' : 'border-gray-300'
                  }`}
                >
                  {isActive ? <View className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
                </View>
                <Text className="text-base text-gray-900">{SORT_LABELS[mode]}</Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}
