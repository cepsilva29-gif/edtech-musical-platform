import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="catalogo" options={{ title: 'Catalogo' }} />
      <Tabs.Screen name="ferramentas" options={{ title: 'Ferramentas' }} />
      <Tabs.Screen name="lives" options={{ title: 'Lives' }} />
      <Tabs.Screen name="assinatura" options={{ title: 'Assinatura' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
