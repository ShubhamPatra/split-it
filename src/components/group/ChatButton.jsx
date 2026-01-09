import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '../ui/badge';

const ChatButton = ({ onClick, unreadCount = 0 }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label="Open chat"
    >
      <MessageSquare className="h-6 w-6" />
      
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-6 min-w-[24px] px-1.5 text-xs font-bold animate-scale-in"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
      
      {/* Pulse animation when there are unread messages */}
      {unreadCount > 0 && (
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
      )}
    </button>
  );
};

export default ChatButton;
