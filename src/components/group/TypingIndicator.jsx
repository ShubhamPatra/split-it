import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { getAvatarColor } from './MessageGroup';

const TypingIndicator = ({ users }) => {
  if (!users || users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].userName} is typing`;
    }
    if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} are typing`;
    }
    if (users.length === 3) {
      return `${users[0].userName}, ${users[1].userName}, and ${users[2].userName} are typing`;
    }
    return `${users[0].userName}, ${users[1].userName}, and ${users.length - 2} others are typing`;
  };

  // Get initials from user name
  const getInitial = (name) => {
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-sm py-2 px-1 animate-fade-in">
      <div className="flex items-center gap-2">
        {/* User avatars (show up to 3) */}
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user, index) => (
            <Avatar 
              key={user.userId || index} 
              className="h-6 w-6 border-2 border-background"
            >
              <AvatarFallback 
                className={`${getAvatarColor(user.userId)} text-[10px] font-medium`}
              >
                {getInitial(user.userName)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        
        {/* Animated typing dots */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-full px-3 py-1.5">
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '0.6s' }} 
          />
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '150ms', animationDuration: '0.6s' }} 
          />
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" 
            style={{ animationDelay: '300ms', animationDuration: '0.6s' }} 
          />
        </div>
        
        {/* Typing text */}
        <span className="text-xs text-muted-foreground">
          {getTypingText()}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;
