import { useState, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'loading';

interface AppPermissions {
  camera: PermissionStatus;
  location: PermissionStatus;
  photos: PermissionStatus;
  contacts: PermissionStatus;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<AppPermissions>({
    camera: 'loading',
    location: 'loading',
    photos: 'loading',
    contacts: 'loading',
  });

  const checkAllPermissions = async () => {
    const [camera, location, photos, contacts] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
      Contacts.getPermissionsAsync(),
    ]);

    setPermissions({
      camera: camera.status as PermissionStatus,
      location: location.status as PermissionStatus,
      photos: photos.status as PermissionStatus,
      contacts: contacts.status as PermissionStatus,
    });
  };

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const requestPermission = async (type: keyof AppPermissions) => {
    let result;
    switch (type) {
      case 'camera':
        result = await Camera.requestCameraPermissionsAsync();
        break;
      case 'location':
        result = await Location.requestForegroundPermissionsAsync();
        break;
      case 'photos':
        result = await ImagePicker.requestMediaLibraryPermissionsAsync();
        break;
      case 'contacts':
        result = await Contacts.requestPermissionsAsync();
        break;
    }

    if (result) {
      setPermissions(prev => ({
        ...prev,
        [type]: result.status as PermissionStatus,
      }));
    }
    return result?.status === 'granted';
  };

  return {
    permissions,
    requestPermission,
    refreshPermissions: checkAllPermissions,
  };
}
