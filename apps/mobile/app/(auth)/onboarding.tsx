import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppColors } from '@/hooks/useAppColors';
import AppLottieView from '@/components/ui/AppLottieView';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Report Issues',
    description: 'See a pothole or broken streetlight? Report it in seconds with a photo and location.',
    animation: require('@/assets/lottie/city-report.json'),
  },
  {
    id: '2',
    title: 'Track Progress',
    description: 'Stay updated as the city works on your report. Get notifications on status changes.',
    animation: require('@/assets/lottie/tracking.json'),
  },
  {
    id: '3',
    title: 'Community Action',
    description: 'Upvote reports from your neighbors to help the city prioritize critical repairs.',
    animation: require('@/assets/lottie/community.json'),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={[styles.skipButton, { top: insets.top + 20 }]}
        onPress={() => router.replace('/(auth)/login')}
      >
        <Text style={[styles.skipText, { color: colors.textDim }]}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.slide}>
        <AppLottieView
          source={slides[currentSlideIndex].animation}
          autoPlay
          loop
          style={styles.animation}
        />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{slides[currentSlideIndex].title}</Text>
          <Text style={[styles.description, { color: colors.textDim }]}>{slides[currentSlideIndex].description}</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                { backgroundColor: currentSlideIndex === index ? colors.accent : colors.surface2 },
                currentSlideIndex === index && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.accent }]} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentSlideIndex === slides.length - 1 ? 'Get started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F2EA',
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  animation: {
    width: width * 0.8,
    height: width * 0.8,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 23,
  },
  footer: {
    padding: 40,
    paddingTop: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
  },
  indicator: {
    height: 6,
    width: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  activeIndicator: {
    width: 20,
  },
  nextButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
