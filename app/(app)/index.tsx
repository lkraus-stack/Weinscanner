import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ColorFilter } from '@/components/history/ColorFilter';
import { HistoryItem } from '@/components/history/HistoryItem';
import { HistorySearchBar } from '@/components/history/HistorySearchBar';
import { MonthHeader } from '@/components/history/MonthHeader';
import {
  type HistoryItemRecord,
  useHistory,
  type WineColor,
} from '@/hooks/useHistory';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type HistoryListRow =
  | { id: string; title: string; type: 'month' }
  | { id: string; item: HistoryItemRecord; type: 'item' };

const MONTH_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
});

function getMonthKey(value: string) {
  const date = new Date(value);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthTitle(value: string) {
  return MONTH_FORMATTER.format(new Date(value));
}

function buildRows(items: HistoryItemRecord[]) {
  const rows: HistoryListRow[] = [];
  const stickyHeaderIndices: number[] = [];
  let currentMonthKey: string | null = null;

  for (const item of items) {
    const monthKey = getMonthKey(item.scannedAt);

    if (monthKey !== currentMonthKey) {
      stickyHeaderIndices.push(rows.length);
      rows.push({
        id: `month-${monthKey}`,
        title: getMonthTitle(item.scannedAt),
        type: 'month',
      });
      currentMonthKey = monthKey;
    }

    rows.push({
      id: item.scanId,
      item,
      type: 'item',
    });
  }

  return { rows, stickyHeaderIndices };
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [wineColor, setWineColor] = useState<WineColor | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const historyQuery = useHistory({ searchQuery, wineColor });
  const items = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [historyQuery.data]
  );
  const { rows, stickyHeaderIndices } = useMemo(
    () => buildRows(items),
    [items]
  );
  const isInitialLoading = historyQuery.isLoading;
  const hasActiveFilters = Boolean(wineColor || searchQuery.trim().length > 1);

  const openDetail = useCallback(
    (item: HistoryItemRecord) => {
      router.push({
        pathname: '/wine-detail',
        params: { scanId: item.scanId },
      });
    },
    [router]
  );

  const loadMore = useCallback(() => {
    if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
      historyQuery.fetchNextPage();
    }
  }, [historyQuery]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<HistoryListRow>) => {
      if (item.type === 'month') {
        return <MonthHeader title={item.title} />;
      }

      return <HistoryItem item={item.item} onPress={openDetail} />;
    },
    [openDetail]
  );

  const renderFooter = useCallback(() => {
    if (!historyQuery.isFetchingNextPage) {
      return <View style={styles.footerSpacer} />;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [historyQuery.isFetchingNextPage]);

  const listEmptyComponent = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Verlauf wird geladen...</Text>
        </View>
      );
    }

    if (historyQuery.isError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Verlauf konnte nicht geladen werden"
          description="Bitte versuche es gleich noch einmal."
          cta={{
            label: 'Erneut versuchen',
            onPress: () => historyQuery.refetch(),
          }}
        />
      );
    }

    if (hasActiveFilters) {
      return (
        <EmptyState
          icon="search-outline"
          title="Keine Treffer"
          description="Passe Suche oder Filter an, um mehr Weine zu sehen."
        />
      );
    }

    return (
      <EmptyState
        icon="wine-outline"
        title="Noch kein Verlauf"
        description="Gespeicherte Scans erscheinen hier, sobald du deinen ersten Wein erfasst hast."
        cta={{
          label: 'Wein scannen',
          onPress: () => router.push('/(app)/scan'),
        }}
      />
    );
  }, [hasActiveFilters, historyQuery, isInitialLoading, router]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.eyebrow}>Kellerbuch</Text>
        <Text style={styles.title}>Verlauf</Text>
        <HistorySearchBar
          value={searchQuery}
          onDebouncedChange={setSearchQuery}
        />
      </View>

      <View style={styles.filterShell}>
        <ColorFilter value={wineColor} onChange={setWineColor} />
      </View>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        getItemType={(item) => item.type}
        stickyHeaderIndices={stickyHeaderIndices}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={historyQuery.isRefetching && !historyQuery.isFetchingNextPage}
            onRefresh={historyQuery.refetch}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  filterShell: {
    paddingBottom: spacing.sm,
  },
  footerLoader: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  footerSpacer: {
    height: 112,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.screenX,
  },
  listContent: {
    paddingBottom: 110,
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.brand,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    lineHeight: typography.lineHeight.brand,
  },
});
