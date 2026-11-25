import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { FormField } from '../../components/Controls';
import { Gradient } from '../../components/Gradient';
import { PressableScale } from '../../components/PressableScale';
import { haptic } from '../../services/haptics';
import { useSettings } from '../../stores/settingsStore';
import { BRAND_NAME, images, radius, spacing, useTheme } from '../../theme';
import type { RootScreenProps } from '../../app/navigation/types';

const PAGES = [
  {
    image: images.onboardBatter,
    kicker: 'Score like a pro',
    title: 'Every ball,\nscored in a tap',
    body: 'Big, one-handed scoring keys built for bright sunlight. Wides, no-balls, free hits, run outs: all handled by the laws of cricket.',
  },
  {
    image: images.onboardStadium,
    kicker: 'Broadcast experience',
    title: 'Your match,\nbroadcast style',
    body: 'Live scoreboards, partnerships, worm and Manhattan charts, wagon wheels and celebrations for every boundary and wicket.',
  },
  {
    image: images.onboardBall,
    kicker: '100% offline',
    title: 'No signal?\nNo problem',
    body: `${BRAND_NAME} keeps everything on your phone. Every ball is saved instantly, so you can pick up exactly where you left off, even after a restart.`,
  },
];

export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const update = useSettings(s => s.update);
  const existingName = useSettings(s => s.userName);
  const [name, setName] = useState(existingName);
  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);
  const listRef = useRef<Animated.ScrollView>(null);

  const onScroll = useAnimatedScrollHandler(e => {
    x.value = e.contentOffset.x;
  });

  const finish = () => {
    haptic('success');
    update({ onboardingDone: true, userName: name.trim().slice(0, 24) });
    navigation.replace('Main');
  };

  const go = (i: number) => {
    listRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const last = index === PAGES.length - 1;

  return (
    <View style={styles.root} testID="onboarding">
      <Animated.ScrollView
        ref={listRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {PAGES.map((p, i) => (
          <Page key={p.title} page={p} i={i} x={x} width={width} height={height} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.topBar, { top: insets.top + spacing.xs }]}>
        {!last ? (
          <PressableScale onPress={finish} testID="onboarding-skip" accessibilityLabel="Skip introduction" style={[styles.skip, { backgroundColor: colors.glass, borderColor: colors.border }]}>
            <AppText variant="label">Skip</AppText>
          </PressableScale>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}>
          {PAGES.map((_, i) => (
            <Dot key={i} i={i} x={x} width={width} color={colors.primary} />
          ))}
        </View>
        {last ? (
          <FormField
            label="What should we call you? (optional)"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            maxLength={24}
            returnKeyType="done"
            testID="onboarding-name"
          />
        ) : null}
        <Button
          size="lg"
          label={last ? 'Get Started' : 'Next'}
          testID={last ? 'onboarding-get-started' : 'onboarding-next'}
          onPress={() => (last ? finish() : go(index + 1))}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function Page({ page, i, x, width, height }: { page: (typeof PAGES)[number]; i: number; x: SharedValue<number>; width: number; height: number }) {
  const imageStyle = useAnimatedStyle(() => {
    const input = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      transform: [
        { translateX: interpolate(x.value, input, [-width * 0.35, 0, width * 0.35], Extrapolation.CLAMP) },
        { scale: interpolate(x.value, input, [1.25, 1.05, 1.25], Extrapolation.CLAMP) },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => {
    const input = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      opacity: interpolate(x.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(x.value, input, [40, 0, 40], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={[styles.page, { width, height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <Image source={page.image} style={styles.fill} resizeMode="cover" />
      </Animated.View>
      <Gradient colors={['rgba(11,17,32,0.45)', 'rgba(11,17,32,0.1)', 'rgba(13,17,23,0.78)', '#0D1117']} locations={[0, 0.25, 0.52, 0.8]} />
      <Animated.View style={[styles.copy, textStyle]}>
        <AppText variant="overline" tone="accent">
          {page.kicker}
        </AppText>
        <AppText variant="h1" style={styles.title} color="#F8FAFC">
          {page.title}
        </AppText>
        <AppText variant="body" color="#CBD5E1">
          {page.body}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Dot({ i, x, width, color }: { i: number; x: SharedValue<number>; width: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const input = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      width: interpolate(x.value, input, [8, 26, 8], Extrapolation.CLAMP),
      opacity: interpolate(x.value, input, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117' },
  page: { overflow: 'hidden', backgroundColor: '#0D1117' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  copy: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 260, gap: spacing.sm },
  title: { fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  topBar: { position: 'absolute', right: spacing.md },
  skip: { paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1 },
  bottom: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 0, gap: spacing.md },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginBottom: spacing.xs },
  dot: { height: 8, borderRadius: 4 },
});
