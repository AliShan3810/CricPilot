import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { dark, spacing } from '../theme';

interface State {
  error: Error | null;
}

/**
 * Last line of defence for rendering errors. Scoring data is safe: every ball is
 * committed to SQLite before the UI updates, so "Try again" resumes exactly where it was.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.error(error);
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.wrap}>
        <AppText variant="h1" color={dark.text} align="center">
          Something went wrong
        </AppText>
        <AppText variant="body" color={dark.textSecondary} align="center">
          Your matches are saved. Tap below to continue where you left off.
        </AppText>
        <AppText variant="caption" color={dark.textMuted} align="center">
          {this.state.error.message}
        </AppText>
        <Button label="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: dark.background },
});
