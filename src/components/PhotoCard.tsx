import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme, withAlpha } from '../theme';
import { Gradient } from './Gradient';
import { PressableScale } from './PressableScale';

interface Props {
  source: ImageSourcePropType;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** colour washed over the bottom of the photo */
  tint?: string;
  accessibilityLabel?: string;
  testID?: string;
  imagePosition?: 'top' | 'center' | 'bottom';
}

/** Photography-backed card with a readability gradient; content sits at the bottom. */
export function PhotoCard({ source, onPress, style, children, tint, accessibilityLabel, testID, imagePosition = 'center' }: Props) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.card, { borderColor: colors.border }, style]}>
      <Image source={source} style={[styles.fill, imagePosition === 'top' ? styles.top : imagePosition === 'bottom' ? styles.bottom : null]} resizeMode="cover" />
      <Gradient colors={['rgba(11,17,32,0.05)', 'rgba(11,17,32,0.55)', withAlpha(tint ?? '#0B1120', 0.95)]} locations={[0, 0.5, 1]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
  if (!onPress) {
    return body;
  }
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} scaleTo={0.97}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, justifyContent: 'flex-end' },
  content: { padding: spacing.md, gap: 4 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  top: { top: 0, height: '130%' },
  bottom: { top: '-30%', height: '130%' },
});
