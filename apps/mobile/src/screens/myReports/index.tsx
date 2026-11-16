import type { MyReport, ReportStatus } from '@utalk/shared';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StateMessage } from '@/components/stateMessage';
import { ThemedText } from '@/components/themedText';
import { ThemedView } from '@/components/themedView';
import { MaxContentWidth, Spacing, ThemeColor } from '@/constants/theme';
import { useMyReports } from '@/hooks/queries';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/lib/errorMessages';
import { relativeTime } from '@/lib/relativeTime';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS } from '@/lib/reportLabels';

const STATUS_COLORS: Record<ReportStatus, ThemeColor> = {
  pending: 'textSecondary',
  removed: 'success',
  dismissed: 'text',
};

// Mis reportes (desde Ajustes): cada uno con su número de caso y en qué
// quedó. No dice quién lo resolvió.
export function MyReportsScreen() {
  const theme = useTheme();
  const reports = useMyReports();
  const pullToRefresh = usePullToRefresh(() => reports.refetch());

  const empty = reports.isPending ? (
    <StateMessage kind="loading" />
  ) : reports.isError ? (
    <StateMessage kind="error" message={errorMessage(reports.error)} onRetry={() => void reports.refetch()} />
  ) : (
    <StateMessage
      kind="empty"
      title="No reportaste nada"
      description="Si algo te parece que no debería estar, usa Reportar desde su ···."
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList<MyReport>
          data={reports.data ?? []}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => <ReportRow report={item} />}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Quien lo escribió no sabe que lo reportaste.
            </ThemedText>
          }
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          refreshControl={
            <RefreshControl
              {...pullToRefresh}
              tintColor={theme.textSecondary}
            />
          }
          contentContainerStyle={styles.content}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ReportRow({ report }: { report: MyReport }) {
  const theme = useTheme();
  // Una publicación eliminada ya no se puede abrir.
  const canOpen = !(report.target === 'post' && report.status === 'removed');
  const what = report.target === 'post' ? 'Publicación' : 'Comentario en';

  return (
    <Pressable
      accessibilityRole={canOpen ? 'link' : undefined}
      disabled={!canOpen}
      onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: report.postId } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.rowHeader}>
        <ThemedText type="smallBold">Caso #{report.caseNumber}</ThemedText>
        <ThemedText type="smallBold" themeColor={STATUS_COLORS[report.status]}>
          {REPORT_STATUS_LABELS[report.status]}
        </ThemedText>
      </View>
      <ThemedText type="small" numberOfLines={2}>
        {what} «{report.postTitle}»
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {REPORT_CATEGORY_LABELS[report.category]} · {relativeTime(report.createdAt)}
        {report.resolvedAt ? ` · resuelto ${relativeTime(report.resolvedAt)}` : ''}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hint: {
    marginBottom: Spacing.two,
  },
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
