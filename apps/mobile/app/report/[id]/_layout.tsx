import { Stack } from 'expo-router';

export default function ReportDetailsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="log" options={{ presentation: 'card' }} />
    </Stack>
  );
}
