import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useMotion } from '../stores/settingsStore';
import { haptic } from '../services/haptics';
import { motion } from '../theme';

const APressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticKind?: Parameters<typeof haptic>[0] | null;
  children?: React.ReactNode;
}

/** Pressable with a spring scale press effect and optional haptic. */
export function PressableScale({ style, scaleTo = 0.96, hapticKind = 'tap', onPressIn, onPressOut, onPress, disabled, children, ...rest }: PressableScaleProps) {
  const m = useMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        if (m !== 'off') {
          scale.value = m === 'reduced' ? withTiming(0.98, { duration: 80 }) : withSpring(scaleTo, motion.spring);
        }
        onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = m === 'off' ? 1 : withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      onPress={e => {
        if (hapticKind) {
          haptic(hapticKind);
        }
        onPress?.(e);
      }}
      style={[style, anim, disabled ? { opacity: 0.45 } : null]}>
      {children}
    </APressable>
  );
}
