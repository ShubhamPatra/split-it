import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import GroupChat from './GroupChat';

const ChatPanel = ({ groupId, groupName, isOpen, onClose, unreadCount }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:bg-black/20 landscape:bg-black/30"
        onClick={onClose}
      />
      
      {/* Chat Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-full sm:w-[420px] md:w-[480px] landscape:w-[85vw] landscape:max-w-[600px] landscape:max-h-[100vh] landscape:overflow-hidden bg-background border-l border-border/50 shadow-2xl z-50 flex flex-col animate-slide-in-right`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{groupName || 'Group Chat'}</h2>
              <p className="text-xs text-muted-foreground">Group conversation</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-10 w-10 rounded-xl hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <GroupChat groupId={groupId} />
        </div>
      </div>
    </>
  );
};

export default ChatPanel;
