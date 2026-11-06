import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import LottieView from 'lottie-react-native';
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
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.skipButton, { top: insets.top + 20 }]}
        onPress={() => router.replace('/(auth)/login')}
      >
        <Text style={styles.skipText}>SKIP</Text>
      </TouchableOpacity>

      <View style={styles.slide}>
        <LottieView
          source={slides[currentSlideIndex].animation}
          autoPlay
          loop
          style={styles.animation}
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{slides[currentSlideIndex].title}</Text>
          <Text style={styles.description}>{slides[currentSlideIndex].description}</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.indicatorContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                currentSlideIndex === index && styles.activeIndicator,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentSlideIndex === slides.length - 1 ? 'GET STARTED' : 'NEXT'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  skipText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    fontFamily: 'System', // Replace with Syne later
  },
  description: {
    fontSize: 16,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
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
    height: 4,
    width: 12,
    backgroundColor: theme.colors.surface2,
    borderRadius: 2,
    marginRight: 4,
  },
  activeIndicator: {
    width: 24,
    backgroundColor: theme.colors.accent,
  },
  nextButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
