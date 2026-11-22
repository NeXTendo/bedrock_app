import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, CheckSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

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

export default function NotificationTray() {
  const { session } = useAuth();
  const { deptCode } = useParams<{ deptCode: string }>();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, any>[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('sent_at', { ascending: false })
      .limit(10);
    setNotifications(data || []);
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    fetchNotifications();

    const channelName = `user-notifications-${session.user.id}`;

    // Remove any stale channel with the same name before creating a new one
    // (guards against React StrictMode double-invocation)
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Record<string, any>, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, reportId?: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (reportId && deptCode) {
        navigate(`/dept/${deptCode}/reports/${reportId}`);
        setIsOpen(false);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg relative transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center border-2 border-white px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium text-slate-500">({unreadCount} new)</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
              >
                <CheckSquare size={12} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="mx-auto text-slate-300 mb-2" size={28} />
                <p className="text-xs font-semibold text-slate-600">No notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're caught up with all updates</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.is_read;
                const reportId = n.report_id;
                
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id, reportId)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-2.5 ${isUnread ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isUnread ? 'bg-primary' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs text-slate-800 truncate ${isUnread ? 'font-semibold text-slate-900' : 'font-medium'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {formatNotificationBody(typeof n.body === 'string' ? n.body : '')}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium block mt-1">
                        {formatRelativeTime(n.sent_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
