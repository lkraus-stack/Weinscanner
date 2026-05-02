import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  legalDocuments,
  type LegalDocumentType,
  type LegalLink,
  type LegalSection,
} from '@/lib/legal-content';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

function normalizeType(value: string | string[] | undefined): LegalDocumentType {
  const type = Array.isArray(value) ? value[0] : value;

  return type === 'imprint' ? 'imprint' : 'privacy';
}

export default function LegalScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const router = useRouter();
  const { colors, styles } = useLegalStyles();
  const documentType = normalizeType(params.type);
  const document = legalDocuments[documentType];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Kellerbuch</Text>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.updatedAt}>Stand: {document.updatedAt}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBlock}>
          <Text style={styles.introText}>{document.intro}</Text>
        </View>

        {document.sections.map((section) => (
          <LegalSectionCard key={section.title} section={section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalSectionCard({ section }: { section: LegalSection }) {
  const { styles } = useLegalStyles();

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{section.title}</Text>

      {section.body?.map((paragraph) => (
        <Text key={paragraph} style={styles.bodyText}>
          {paragraph}
        </Text>
      ))}

      {section.items ? (
        <View style={styles.itemList}>
          {section.items.map((item) => (
            <View key={item} style={styles.itemRow}>
              <View style={styles.itemDot} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section.links ? (
        <View style={styles.linkList}>
          {section.links.map((link) => (
            <LegalLinkButton key={link.url} link={link} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LegalLinkButton({ link }: { link: LegalLink }) {
  const { colors, styles } = useLegalStyles();

  async function openLink() {
    try {
      await Linking.openURL(link.url);
    } catch {
      Alert.alert('Link konnte nicht geöffnet werden', link.url);
    }
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={openLink}
      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{link.label}</Text>
      <Ionicons name="open-outline" size={17} color={colors.primaryDark} />
    </Pressable>
  );
}

function useLegalStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    bodyText: {
      color: colors.text,
      fontSize: typography.size.base,
      fontWeight: typography.weight.regular,
      lineHeight: typography.lineHeight.base,
    },
    content: {
      gap: spacing.md,
      paddingBottom: spacing.xxxl,
      paddingHorizontal: spacing.screenX,
    },
    eyebrow: {
      color: colors.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    header: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.screenX,
      paddingTop: spacing.lg,
    },
    headerCopy: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    introBlock: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      padding: spacing.lg,
    },
    introText: {
      color: colors.text,
      fontSize: typography.size.base,
      fontWeight: typography.weight.medium,
      lineHeight: typography.lineHeight.base,
    },
    itemDot: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      height: 6,
      marginTop: 8,
      width: 6,
    },
    itemList: {
      gap: spacing.sm,
    },
    itemRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    itemText: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
    linkButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    linkList: {
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    linkText: {
      color: colors.primaryDark,
      fontSize: typography.size.md,
      fontWeight: typography.weight.extraBold,
      lineHeight: typography.lineHeight.md,
    },
    pressed: {
      opacity: 0.78,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.sm,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
      lineHeight: typography.lineHeight.lg,
    },
    title: {
      color: colors.text,
      fontSize: typography.size.xxl,
      fontWeight: typography.weight.black,
      letterSpacing: 0,
      lineHeight: typography.lineHeight.xl,
    },
    updatedAt: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.sm,
    },
  });
}
