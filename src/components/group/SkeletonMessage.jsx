import React from 'react';

const SkeletonMessage = ({ isOwn = false }) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex gap-2 max-w-[75%] md:max-w-[65%] ${isOwn ? 'flex-row-reverse' : ''}`}>
        {/* Avatar skeleton */}
        {!isOwn && (
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
        )}
        
        <div className="space-y-2 flex-1">
          {/* Sender name skeleton */}
          {!isOwn && (
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          )}
          
          {/* Message bubble skeleton */}
          <div 
            className={`h-14 bg-muted rounded-2xl animate-pulse ${
              isOwn 
                ? 'w-48 rounded-br-md ml-auto' 
                : 'w-56 rounded-bl-md'
            }`} 
          />
          
          {/* Timestamp skeleton */}
          <div className={`h-2 w-12 bg-muted rounded animate-pulse ${isOwn ? 'ml-auto' : ''}`} />
        </div>
      </div>
    </div>
  );
};

// Multiple skeleton messages for loading state
export const SkeletonMessageList = ({ count = 5 }) => {
  // Alternate between own and other messages for realistic appearance
  const patterns = [false, false, true, false, true, false, false, true, false, true];
  
  return (
    <div className="space-y-1 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonMessage 
          key={index} 
          isOwn={patterns[index % patterns.length]} 
        />
      ))}
    </div>
  );
};

export default SkeletonMessage;
