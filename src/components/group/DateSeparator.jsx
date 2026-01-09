import React from 'react';

const DateSeparator = ({ date }) => {
  const formatDateLabel = (dateStr) => {
    const messageDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if same day
    const isSameDay = (d1, d2) => 
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
    
    if (isSameDay(messageDate, today)) {
      return 'Today';
    }
    
    if (isSameDay(messageDate, yesterday)) {
      return 'Yesterday';
    }
    
    // Format as "Jan 10, 2026"
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="sticky top-0 z-10 flex items-center justify-center my-6 animate-fade-in">
      <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-1.5 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">
          {formatDateLabel(date)}
        </span>
      </div>
    </div>
  );
};

export default DateSeparator;
