import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';

export default function ReportScreen() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to the camera step
    router.replace('/report/create/camera');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}
