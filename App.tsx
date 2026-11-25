import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { ToastHost } from './src/components/Toast';
import { ConfirmHost } from './src/components/ConfirmDialog';
import { ErrorBoundary } from './src/app/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/theme';

function Shell() {
  const { colors, isDark } = useTheme();
  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.gold,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <BottomSheetModalProvider>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
        <ToastHost />
        <ConfirmHost />
      </BottomSheetModalProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#080F1F' } });
