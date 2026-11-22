const React = require('react');
const { View, Text, StyleSheet, TouchableOpacity } = require('react-native');

const MapView = React.forwardRef((props, ref) => {
  const {
    style,
    children,
    initialRegion,
    region,
    onRegionChange,
    onRegionChangeComplete,
    ...rest
  } = props;

  React.useImperativeHandle(ref, () => ({
    animateToRegion: (r) => {
      if (onRegionChangeComplete) {
        onRegionChangeComplete(r);
      }
    },
    animateCamera: () => {},
    fitToCoordinates: () => {},
    fitToElements: () => {},
    fitToSuppliedMarkers: () => {},
    setCamera: () => {},
  }));

  return React.createElement(
    View,
    {
      style: [styles.mapContainer, style],
      ...rest,
    },
    React.createElement(
      View,
      { style: styles.mapGrid },
      React.createElement(
        View,
        { style: styles.badge },
        React.createElement(Text, { style: styles.badgeText }, 'Map View (Web Preview)')
      ),
      children
    )
  );
});

MapView.displayName = 'MapView';

const Marker = React.forwardRef((props, ref) => {
  const { coordinate, onPress, children, title, style, ...rest } = props;
  return React.createElement(
    TouchableOpacity,
    {
      ref,
      onPress: onPress,
      activeOpacity: 0.8,
      style: [styles.marker, style],
      ...rest,
    },
    children || React.createElement(Text, { style: styles.defaultPin }, '📍')
  );
});

Marker.displayName = 'Marker';

function Circle() {
  return null;
}

function Polygon() {
  return null;
}

function Polyline() {
  return null;
}

function Callout({ children }) {
  return children || null;
}

function Overlay() {
  return null;
}

class AnimatedRegion {
  constructor(opts) {
    Object.assign(this, opts || {});
  }
  setValue(opts) {
    Object.assign(this, opts || {});
  }
  timing() {
    return { start: (cb) => cb && cb({ finished: true }) };
  }
}

const styles = StyleSheet.create({
  mapContainer: {
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 180,
  },
  mapGrid: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  marker: {
    position: 'absolute',
  },
  defaultPin: {
    fontSize: 24,
  },
});

module.exports = MapView;
module.exports.default = MapView;
module.exports.MapView = MapView;
module.exports.Marker = Marker;
module.exports.Circle = Circle;
module.exports.Polygon = Polygon;
module.exports.Polyline = Polyline;
module.exports.Callout = Callout;
module.exports.Overlay = Overlay;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = 'default';
module.exports.AnimatedRegion = AnimatedRegion;

