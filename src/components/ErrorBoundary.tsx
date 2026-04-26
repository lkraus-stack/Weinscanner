import * as Sentry from '@sentry/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Component, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type ErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
  title?: string;
};

type ErrorBoundaryBaseProps = ErrorBoundaryProps & {
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundaryBase extends Component<
  ErrorBoundaryBaseProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  componentDidUpdate(previousProps: ErrorBoundaryBaseProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { colors, styles, title = 'Hier ist etwas schiefgelaufen' } =
      this.props;

    return (
      <View style={styles.screen}>
        <View style={styles.iconShell}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.error} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>
          Bitte versuche es noch einmal. Wenn der Fehler bleibt, prüfen wir das
          in Sentry.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return <ErrorBoundaryBase {...props} colors={colors} styles={styles} />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      minHeight: 52,
      minWidth: 172,
      paddingHorizontal: spacing.xl,
    },
    buttonPressed: {
      opacity: 0.78,
    },
    buttonText: {
      color: colors.white,
      fontSize: typography.size.base,
      fontWeight: typography.weight.extraBold,
    },
    description: {
      color: colors.textSecondary,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
      maxWidth: 320,
      textAlign: 'center',
    },
    iconShell: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 88,
      justifyContent: 'center',
      width: 88,
    },
    screen: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      gap: spacing.xl,
      justifyContent: 'center',
      paddingHorizontal: spacing.screenX,
    },
    title: {
      color: colors.text,
      fontSize: typography.size.xxl,
      fontWeight: typography.weight.black,
      letterSpacing: 0,
      lineHeight: typography.lineHeight.xl,
      textAlign: 'center',
    },
  });
}
