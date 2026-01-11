import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import MessageBubble from './MessageBubble';

// Avatar color palette for consistent user colors
const avatarColors = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
];

// Hash userId to get consistent color
export const getAvatarColor = (userId) => {
  if (!userId || typeof userId !== 'string') return avatarColors[0];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

// Get sender name color that matches avatar
const getSenderNameColor = (userId) => {
  if (!userId || typeof userId !== 'string') return 'text-muted-foreground';
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'text-blue-600 dark:text-blue-400',
    'text-purple-600 dark:text-purple-400',
    'text-pink-600 dark:text-pink-400',
    'text-orange-600 dark:text-orange-400',
    'text-teal-600 dark:text-teal-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-rose-600 dark:text-rose-400',
    'text-emerald-600 dark:text-emerald-400',
  ];
  return colors[hash % colors.length];
};

const MessageGroup = ({
  messages,
  senderId,
  senderName,
  senderInitial,
  isOwn,
  onEdit,
  onDelete,
  onRetry,
  isAdmin,
  getUserProfile,
}) => {
  const avatarColor = getAvatarColor(senderId);
  const nameColor = getSenderNameColor(senderId);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex gap-2 max-w-[85%] md:max-w-[75%] lg:max-w-[65%] ${isOwn ? 'flex-row-reverse' : ''}`}>
        {/* Avatar - only for other users' messages */}
        {!isOwn && (
          <Avatar className="h-8 w-8 border-2 shrink-0 mt-0.5">
            <AvatarFallback className={`${avatarColor} text-sm font-medium`}>
              {senderInitial}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex flex-col">
          {/* Sender name - only for other users' first message in group */}
          {!isOwn && (
            <p className={`text-xs font-medium ml-1 mb-1 ${nameColor}`}>
              {senderName}
            </p>
          )}

          {/* Messages in the group */}
          {messages.map((message, index) => (
            <MessageBubble
              key={message._id}
              message={message}
              isOwn={isOwn}
              showAvatar={false}
              isFirstInGroup={index === 0}
              isLastInGroup={index === messages.length - 1}
              avatarColor={avatarColor}
              onEdit={onEdit}
              onDelete={onDelete}
              onRetry={onRetry}
              isAdmin={isAdmin}
              hideHeader={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageGroup;
export { avatarColors, getSenderNameColor };
