import React from 'react';
import { MessageSquare, Send } from 'lucide-react';

const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      {/* Icon container with subtle gradient */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <MessageSquare className="h-12 w-12 text-primary" strokeWidth={1.5} />
        </div>
        {/* Decorative send icon */}
        <div className="absolute -right-1 -bottom-1 w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center">
          <Send className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
      </div>
      
      {/* Text content */}
      <h3 className="text-lg font-semibold mb-2 text-foreground">
        Start the conversation
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
        Send a message to kick off the discussion about expenses and settlements with your group members.
      </p>
      
      {/* Subtle hint */}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/70">
        <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground font-mono text-xs">
          Enter
        </kbd>
        <span>to send a message</span>
      </div>
    </div>
  );
};

export default EmptyState;
