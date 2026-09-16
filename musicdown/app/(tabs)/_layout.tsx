import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: 'center' }}>
      <Tabs.Screen name="index" options={{ title: 'Descargar', tabBarIcon: () => <TabIcon emoji="📥" /> }} />
      <Tabs.Screen name="youtube" options={{ title: 'YouTube', tabBarIcon: () => <TabIcon emoji="▶️" /> }} />
      <Tabs.Screen name="library" options={{ title: 'Música', tabBarIcon: () => <TabIcon emoji="🎵" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: () => <TabIcon emoji="⚙️" /> }} />
    </Tabs>
  );
}
