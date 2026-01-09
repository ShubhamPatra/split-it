import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';

const NewMessageIndicator = ({ unreadCount, onClick }) => {
  if (!unreadCount || unreadCount <= 0) return null;

  return (
    <Button
      onClick={onClick}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 h-auto rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-up z-20 hover:-translate-y-1"
      size="sm"
    >
      <ChevronDown size={16} className="mr-1.5" />
      <span className="text-sm font-medium">
        {unreadCount} new message{unreadCount > 1 ? 's' : ''}
      </span>
    </Button>
  );
};

export default NewMessageIndicator;
