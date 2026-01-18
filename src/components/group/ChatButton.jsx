import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '../ui/badge';

const DRAG_THRESHOLD = 5; // Minimum pixels to consider it a drag

const ChatButton = ({ onClick, unreadCount = 0 }) => {
  // Default position - resets on refresh
  const [position, setPosition] = useState({ right: 16, bottom: 80 });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef(position);
  const buttonRef = useRef(null);
  const hasDraggedRef = useRef(false);

  // Update ref when position changes
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handleDragStart = useCallback((clientX, clientY) => {
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startRight: positionRef.current.right,
      startBottom: positionRef.current.bottom
    };
  }, []);

  const handleDragMove = useCallback((clientX, clientY) => {
    if (!isDragging) return;

    const deltaX = dragStartRef.current.x - clientX;
    const deltaY = dragStartRef.current.y - clientY;

    // Check if we've moved enough to consider it a drag
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
    }

    if (!hasDraggedRef.current) return;

    const buttonSize = 56; // w-14 = 56px
    const padding = 16;
    const maxRight = window.innerWidth - buttonSize - padding;
    const maxBottom = window.innerHeight - buttonSize - padding;

    const newRight = Math.max(padding, Math.min(maxRight, dragStartRef.current.startRight + deltaX));
    const newBottom = Math.max(padding, Math.min(maxBottom, dragStartRef.current.startBottom + deltaY));

    setPosition({ right: newRight, bottom: newBottom });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
    if (hasDraggedRef.current) {
      e.preventDefault(); // Prevent scrolling while dragging
    }
  }, [isDragging, handleDragMove]);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Handle click - only trigger if we haven't dragged
  const handleClick = useCallback((e) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.();
  }, [onClick]);

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        right: `${position.right}px`,
        bottom: `${position.bottom}px`,
      }}
      className={`fixed z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-shadow duration-200 ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105 active:scale-95'
        }`}
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
