import { Stack } from 'expo-router';

export default function ReportCreateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="camera" />
      <Stack.Screen name="location" />
      <Stack.Screen name="category" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
