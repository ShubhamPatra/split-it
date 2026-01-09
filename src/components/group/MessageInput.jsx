import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Smile, Receipt, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

// Lazy load emoji picker - it's ~300KB+ and only needed on interaction
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const MessageInput = ({ 
  onSend, 
  onTyping, 
  disabled = false,
  placeholder = 'Type a message...',
  onAttachExpense,
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const MAX_LENGTH = 2000;
  const TYPING_STOP_DELAY = 3000;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Max ~5 lines
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [message]);

  const handleTypingIndicator = (typing) => {
    if (typing !== isTyping) {
      setIsTyping(typing);
      onTyping?.(typing);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      setMessage(value);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Start typing
      if (value.length > 0) {
        handleTypingIndicator(true);
        
        // Stop typing after delay
        typingTimeoutRef.current = setTimeout(() => {
          handleTypingIndicator(false);
        }, TYPING_STOP_DELAY);
      } else {
        handleTypingIndicator(false);
      }
    }
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isSending) return;
    
    setIsSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage('');
      handleTypingIndicator(false);
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Focus textarea after sending
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const cursorPosition = textareaRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPosition) + emoji + message.slice(cursorPosition);
    
    if (newMessage.length <= MAX_LENGTH) {
      setMessage(newMessage);
      // Move cursor after emoji
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = cursorPosition + emoji.length;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const charCount = message.length;
  const isOverLimit = charCount >= MAX_LENGTH;
  const charPercentage = (charCount / MAX_LENGTH) * 100;

  return (
    <TooltipProvider>
      <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3 md:p-4">
        <div className="flex items-end gap-2">
          {/* Emoji picker button */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    disabled={disabled}
                  >
                    <Smile size={20} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Add emoji</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent 
              side="top" 
              align="start" 
              className="w-auto p-0 border-none shadow-xl"
            >
              <Suspense fallback={
                <div className="w-[320px] h-[400px] flex items-center justify-center bg-card">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={320}
                  height={400}
                  searchPlaceHolder="Search emoji..."
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                  lazyLoadEmojis
                />
              </Suspense>
            </PopoverContent>
          </Popover>

          {/* Message input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl pr-16 py-3 bg-background/80 border-border/50 focus:border-primary/50 transition-colors scrollbar-hide overflow-y-auto"
            />
            {/* Character count - always visible */}
            <span 
              className={`absolute bottom-2 right-3 text-xs transition-colors ${
                isOverLimit 
                  ? 'text-destructive font-medium' 
                  : charPercentage > 90 
                    ? 'text-warning' 
                    : 'text-muted-foreground/60'
              }`}
            >
              {charCount}/{MAX_LENGTH}
            </span>
          </div>

          {/* Attach expense button */}
          {onAttachExpense && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  disabled={disabled}
                  onClick={onAttachExpense}
                >
                  <Receipt size={20} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Add expense</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Send button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSend}
                disabled={disabled || !message.trim() || isSending}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
              >
                {isSending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Send message</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Disabled message */}
        {disabled && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            You must be a group member to send messages.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
};

export default MessageInput;
