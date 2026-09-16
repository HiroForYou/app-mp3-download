import { Stack } from 'expo-router';

import '../global.css';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Editar canción' }} />
    </Stack>
  );
}
