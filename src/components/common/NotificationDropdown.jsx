import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, Receipt, Wallet, Users, Info, CheckCircle, AlertTriangle, MessageCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import apiClient from '../../lib/apiClient';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '../../hooks/use-toast';

// Simple time ago formatter without external dependencies
const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'expense_added': return <Receipt size={16} className="text-primary" />;
    case 'balance_update': return <Wallet size={16} className="text-warning" />;
    case 'settlement': return <Check size={16} className="text-success" />;
    case 'role_change': return <Users size={16} className="text-accent-foreground" />;
    case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
    case 'chat_message': return <MessageCircle size={16} className="text-blue-500" />;
    default: return <Info size={16} className="text-muted-foreground" />;
  }
};

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, refreshNotifications } = useNotifications();
  const { toast } = useToast();
  const [processingAction, setProcessingAction] = useState(null);

  const handleConfirmPayment = async (notification, e) => {
    e.stopPropagation();
    setProcessingAction(notification.id);
    
    try {
      await apiClient.post(`/settlements/${notification.relatedId}/confirm`);
      toast({ 
        title: 'Payment confirmed!', 
        description: 'The settlement has been marked as confirmed.' 
      });
      await refreshNotifications();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error.response?.data?.message || 'Failed to confirm payment.', 
        variant: 'destructive' 
      });
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative min-h-[44px] min-w-[44px] h-10 w-10">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-popover z-[60]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs min-h-[32px]" 
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-destructive hover:text-destructive min-h-[32px]" 
                onClick={clearNotifications}
              >
                Clear
              </Button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px] sm:h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map(notification => (
              <DropdownMenuItem 
                key={notification.id} 
                className={`flex items-start gap-3 p-3 cursor-pointer min-h-[72px] ${!notification.read ? 'bg-accent/50' : ''}`} 
                onClick={() => {
                  markAsRead(notification.id);
                  // Handle navigation based on action type
                  if (notification.actionType === 'chat_message') {
                    // Navigate to group chat tab
                    const groupId = notification.data?.groupId || notification.relatedId;
                    if (groupId) {
                      navigate(`/group/${groupId}?tab=chat`);
                    }
                  } else if (notification.actionType === 'navigate') {
                    // Support both data.url and relatedId for navigation
                    const url = notification.data?.url || notification.relatedId;
                    if (url) {
                      navigate(url);
                    }
                  }
                }}
              >
                <div className="mt-1 flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!notification.read ? 'font-medium' : ''}`}>{notification.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-1">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{getTimeAgo(notification.timestamp)}</p>
                  
                  {/* Action buttons for confirm_payment */}
                  {notification.actionType === 'confirm_payment' && !notification.actionCompleted && (
                    <Button 
                      size="sm" 
                      className="mt-2 h-8 text-xs min-h-[36px]"
                      onClick={(e) => handleConfirmPayment(notification, e)}
                      disabled={processingAction === notification.id}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      {processingAction === notification.id ? 'Confirming...' : 'Confirm Receipt'}
                    </Button>
                  )}
                  
                  {notification.actionCompleted && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1">
                      <Check size={12} /> Confirmed
                    </p>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0 min-h-[36px] min-w-[36px]" 
                  onClick={(e) => { e.stopPropagation(); removeNotification(notification.id); }}
                >
                  <Trash2 size={14} />
                </Button>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
