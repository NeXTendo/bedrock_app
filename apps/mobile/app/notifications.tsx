import React, { useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, useColorScheme } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  REPORTED: 'Reported',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

function formatNotificationBody(body: string): string {
  const statusChange = body.match(/^Your report status changed to:\s*(.+)$/i);
  if (!statusChange) return body;

  const status = statusChange[1].trim().replace(/[.!?]+$/, '');
  const normalizedStatus = status.replace(/[\s-]+/g, '_').toUpperCase();
  const label = STATUS_LABELS[normalizedStatus] || normalizedStatus
    .split('_')
    .filter(Boolean)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

  return `Your report is now ${label}.`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.session?.user?.id);
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('mobile-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const renderNotification = ({ item }: { item: any }) => {
    const isRead = !!item.is_read;
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          { backgroundColor: isRead ? colors.surface : colors.accentSoft, borderColor: colors.border },
        ]}
        onPress={() => {
          if (!isRead) markAsRead.mutate(item.id);
          if (item.report_id) {
            router.push(`/report/${item.report_id}` as any);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: isRead ? colors.surface2 : colors.surface }]}>
          <IconSymbol 
            name={item.type === 'report_update' ? 'bell.badge.fill' : 'megaphone.fill'} 
            color={isRead ? colors.textDim : colors.accent} 
            size={18} 
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }, !isRead && styles.unreadText]}>{item.title}</Text>
          <Text style={[styles.body, { color: colors.textDim }]} numberOfLines={2}>
            {formatNotificationBody(typeof item.body === 'string' ? item.body : '')}
          </Text>
          <Text style={[styles.time, { color: colors.textDim }]}>{timeAgo(item.sent_at)}</Text>
        </View>
        {!isRead && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
        leftElement={
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <IconSymbol name="chevron.left" color={colors.text} size={18} />
          </TouchableOpacity>
        }
        rightElement={
          unreadCount > 0 ? (
            <TouchableOpacity 
              onPress={() => markAllRead.mutate()} 
              style={[styles.markAllButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.markAllText, { color: colors.text }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: 14, paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="bell.fill" color={colors.surface2} size={56} />
              <Text style={[styles.emptyText, { color: colors.textDim }]}>You&apos;re all caught up!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 0,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  unreadText: {
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
