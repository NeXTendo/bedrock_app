import { Ionicons } from '@expo/vector-icons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * An icon component that uses native SF Symbols on iOS, and Ionicons on Android and web.
 */
const MAPPING: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  'house.fill': 'home',
  'paperplane.fill': 'earth',
  'plus.circle.fill': 'add-circle',
  'list.bullet': 'list',
  'person.fill': 'person',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-forward',
  'mappin.and.ellipse': 'pin',
  'mappin.circle.fill': 'pin',
  'location.fill': 'location',
  'exclamationmark.triangle.fill': 'warning',
  'calendar': 'calendar',
  'flame.fill': 'flame',
  'map.fill': 'map',
  'layers.fill': 'layers',
  'info.circle.fill': 'information-circle',
  'xmark.circle.fill': 'close-circle',
  'chevron.left': 'chevron-back',
  'car.fill': 'car',
  'drop.fill': 'water',
  'trash.fill': 'trash',
  'bolt.fill': 'flash',
  'eye.fill': 'eye',
  'eye.slash.fill': 'eye-off',
  'magnifyingglass': 'search',
  'arrow.up.arrow.down': 'swap-vertical',
  'bell.fill': 'notifications',
  'bell.badge.fill': 'notifications',
  'gearshape.fill': 'settings',
  'globe.americas.fill': 'globe',
  'rectangle.portrait.and.arrow.right': 'log-out',
  'camera.fill': 'camera',
  'megaphone.fill': 'megaphone',
  'heart': 'heart-outline',
  'heart.fill': 'heart',
  'square.and.arrow.up': 'share-social',
  'sun.max.fill': 'sunny',
  'moon.stars.fill': 'moon',
  'iphone': 'phone-portrait',
  'photo.fill': 'images',
  'person.2.fill': 'people',
  'shield.fill': 'shield-checkmark',
  'wifi': 'wifi',
  'arrow.clockwise': 'reload',
  'server.rack': 'server',
  'lock.fill': 'lock-closed',
  'sparkles': 'sparkles',
  'checkmark.circle.fill': 'checkmark-circle',
  'antenna.radiowaves': 'radio',
  'image.fill': 'image',
  'building.2.fill': 'business',
  'phone.fill': 'call',
  'cross.case.fill': 'medkit',
  'wrench.and.screwdriver.fill': 'construct',
};

export type IconSymbolName = keyof typeof MAPPING | (string & {});

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] || (name as ComponentProps<typeof Ionicons>['name']) || 'help-circle';
  return <Ionicons color={color as any} size={size} name={iconName} style={style} />;
}
