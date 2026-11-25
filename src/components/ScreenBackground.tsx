import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Gradient } from './Gradient';

interface Props {
  source: ImageSourcePropType;
  /** scroll offset for a subtle parallax drift */
  scrollY?: SharedValue<number>;
  /** 0..1 extra darkening for busy screens */
  dim?: number;
  /** height of the image area; defaults to full screen */
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  imageOpacity?: number;
  /** 'hero': navy wash over the photo that fades into the page (readable white text in both themes) */
  variant?: 'wash' | 'hero';
}

/**
 * Full-bleed background art with a readability gradient. Each screen passes its own
 * image (see theme/images.ts) so backgrounds match the screen's purpose.
 */
export function ScreenBackground({ source, scrollY, dim = 0, height, style, children, imageOpacity, variant = 'wash' }: Props) {
  const { colors, isDark } = useTheme();
  const parallax = useAnimatedStyle(() => {
    if (!scrollY) {
      return {};
    }
    return {
      transform: [
        { translateY: interpolate(scrollY.value, [-200, 0, 400], [60, 0, -120], 'clamp') },
        { scale: interpolate(scrollY.value, [-200, 0], [1.2, 1], 'clamp') },
      ],
    };
  });
  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]}>
      <Animated.View style={[styles.imageWrap, height !== undefined ? { height, bottom: undefined } : null, parallax]} pointerEvents="none">
        <Image
          source={source}
          resizeMode="cover"
          style={[styles.fill, { opacity: variant === 'hero' ? 1 : imageOpacity ?? (isDark ? 1 : 0.55) }]}
          accessibilityIgnoresInvertColors
        />
        {variant === 'hero' ? (
          <Gradient colors={['rgba(11,17,32,0.5)', 'rgba(11,17,32,0.12)', 'rgba(11,17,32,0.55)', colors.background]} locations={[0, 0.35, 0.75, 1]} />
        ) : (
          <Gradient colors={colors.imageOverlay} locations={[0, 0.55, 1]} />
        )}
        {dim > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: dim }]} /> : null}
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // explicit size: static images otherwise fall back to their intrinsic size and ignore left/right/bottom
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  imageWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
