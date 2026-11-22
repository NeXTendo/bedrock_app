import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_PHOTOS = 5;

export default function CameraScreen() {
  const { draft, setDraft } = useReportStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(() => draft.photos.slice(0, MAX_PHOTOS));
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <StatusBar style="light" />
        <Ionicons name="camera-outline" size={64} color={theme.colors.textDim} style={styles.permissionIcon} />
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (selectedPhotos.length >= MAX_PHOTOS) return;
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync();
      if (result) {
        setPhoto(result.uri);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const pickImage = async () => {
    const remaining = MAX_PHOTOS - selectedPhotos.length;
    if (remaining <= 0) {
      Alert.alert('Photo limit reached', `You can attach up to ${MAX_PHOTOS} photos to a report.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedPhotos(current => Array.from(new Set([
        ...current,
        ...result.assets.map(asset => asset.uri),
      ])).slice(0, MAX_PHOTOS));
    }
  };

  const rotateImage = async () => {
    if (!photo) return;
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        photo,
        [{ rotate: 90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhoto(result.uri);
    } catch (error) {
      console.error('Error rotating image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const addPhoto = () => {
    if (!photo) return;
    if (selectedPhotos.length >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached', `You can attach up to ${MAX_PHOTOS} photos to a report.`);
      setPhoto(null);
      return;
    }
    setSelectedPhotos(current => [...current, photo]);
    setPhoto(null);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(current => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const handleNext = () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('Add a photo', 'Take or choose at least one photo for this report.');
      return;
    }
    setDraft({ photos: selectedPhotos });
    router.push('/report/create/location');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {!photo ? (
        <>
          <CameraView style={styles.camera} ref={cameraRef} facing={facing} flash={flash} enableTorch={flash === 'on'} />
          <View style={styles.overlay}>
            <View style={[styles.topControls, { marginTop: insets.top + 20 }]}>
              <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
                <IconSymbol name="chevron.right" color="white" size={30} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
                <Ionicons 
                  name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off'} 
                  size={24} 
                  color="white" 
                />
              </TouchableOpacity>
            </View>
            
            {selectedPhotos.length > 0 ? (
              <View style={[styles.selectionTray, { bottom: insets.bottom + 124 }]}>
                <View style={styles.selectionHeader}>
                  <Text style={styles.selectionCount}>{selectedPhotos.length}/{MAX_PHOTOS} photos</Text>
                  <TouchableOpacity style={styles.continueButton} onPress={handleNext}>
                    <Text style={styles.continueText}>Continue</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedPhotoList}>
                  {selectedPhotos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.thumbnailContainer}>
                      <Image source={{ uri }} style={styles.thumbnail} />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${index + 1}`}
                      >
                        <Ionicons name="close-circle" size={22} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <Text style={[styles.selectionHint, { bottom: insets.bottom + 112 }]}>
                Take or choose up to {MAX_PHOTOS} photos
              </Text>
            )}

            <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 40 }]}>
              <TouchableOpacity style={styles.sideButton} onPress={pickImage}>
                <Ionicons name="images" size={30} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.captureButton, selectedPhotos.length >= MAX_PHOTOS && styles.disabledCaptureButton]}
                onPress={takePicture}
                disabled={selectedPhotos.length >= MAX_PHOTOS}
                accessibilityLabel="Take a photo"
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.sideButton} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.preview} />
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          )}
          
          <View style={[styles.topControls, { marginTop: insets.top + 20 }]}>
            <View />
            <TouchableOpacity style={styles.iconButton} onPress={rotateImage} disabled={isProcessing}>
              <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={[styles.previewActions, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.retakeButton} onPress={() => setPhoto(null)} disabled={isProcessing}>
              <Text style={styles.retakeText}>RETAKE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={addPhoto} disabled={isProcessing}>
              <Text style={styles.nextText}>ADD PHOTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionIcon: {
    marginBottom: 20,
  },
  permissionText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  sideButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
  },
  disabledCaptureButton: {
    opacity: 0.45,
  },
  selectionHint: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectionTray: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 14,
    padding: 10,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectionCount: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  continueText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedPhotoList: {
    gap: 8,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 11,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    ...StyleSheet.absoluteFill,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  previewActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingTop: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retakeButton: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  retakeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  nextText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
