import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCheck, Pencil, Trash2, RefreshCw, AlertCircle, Receipt, Wallet, Copy } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { getAvatarColor, getSenderNameColor } from './MessageGroup';
import { toast } from '../../hooks/use-toast';

const MessageBubble = ({ 
  message, 
  isOwn = false,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  avatarColor,
  onEdit,
  onDelete,
  onRetry,
  isAdmin = false,
  hideHeader = false,
}) => {
  const navigate = useNavigate();
  const { getUserProfile } = useGroups();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const senderId = message.senderId?._id || message.senderId;
  const senderName = message.senderId?.name || getUserProfile(senderId)?.name || 'Unknown User';
  const senderInitial = senderName.charAt(0).toUpperCase();
  
  const isDeleted = message.deletedAt || message.content === '[Message deleted]';
  const isEdited = message.editedAt && !isDeleted;
  const isSending = message._status === 'sending';
  const isFailed = message._status === 'failed';
  const isSystem = message.type === 'system';
  const isExpenseMessage = message.type === 'expense' || message.metadata?.expenseId;
  const isSettlementMessage = message.type === 'settlement' || message.metadata?.settlementId;

  // Derive avatar color if not provided
  const derivedAvatarColor = avatarColor || getAvatarColor(senderId);
  const nameColor = getSenderNameColor(senderId);

  // Check if message is editable (sender only, within 15 minutes)
  const canEdit = isOwn && !isDeleted && !isSystem && message.createdAt;
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const isEditable = canEdit && new Date(message.createdAt) > fifteenMinutesAgo;
  
  // Check if message is deletable (sender or admin)
  const canDelete = !isDeleted && !isSystem && (isOwn || isAdmin);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setShowEditDialog(false);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onEdit?.(message._id, editContent.trim());
      setShowEditDialog(false);
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete?.(message._id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    onRetry?.(message._id);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        title: 'Copied to clipboard',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Render system message
  if (isSystem) {
    return (
      <div className="flex justify-center my-4 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 backdrop-blur-sm rounded-full text-xs text-muted-foreground border border-border/30">
          {isExpenseMessage && <Receipt size={14} className="text-primary" />}
          {isSettlementMessage && <Wallet size={14} className="text-success" />}
          <span className="italic">{message.content}</span>
        </div>
      </div>
    );
  }

  // Render expense/settlement card message
  if ((isExpenseMessage || isSettlementMessage) && !isSystem && message.metadata) {
    const expense = message.metadata?.expenseId;
    const settlement = message.metadata?.settlementId;
    
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}>
        <div className={`flex gap-2 max-w-[85%] md:max-w-[75%] lg:max-w-[65%] ${isOwn ? 'flex-row-reverse' : ''}`}>
          {showAvatar && !isOwn && (
            <Avatar className="h-8 w-8 border-2 shrink-0">
              <AvatarFallback className={`${derivedAvatarColor} text-sm font-medium`}>
                {senderInitial}
              </AvatarFallback>
            </Avatar>
          )}
          {!showAvatar && !isOwn && <div className="w-8" />}
          
          <div className="space-y-1 min-w-0">
            {!isOwn && showAvatar && !hideHeader && (
              <p className={`text-xs font-medium ml-1 ${nameColor}`}>{senderName}</p>
            )}
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isExpenseMessage 
                  ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40' 
                  : 'bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40'
              }`}
              onClick={() => {
                if (expense) navigate(`/group/${message.groupId}?tab=expenses`);
                if (settlement) navigate(`/group/${message.groupId}?tab=settlements`);
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {isExpenseMessage ? (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <Receipt size={14} className="text-primary" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                      <Wallet size={14} className="text-success" />
                    </div>
                  )}
                  <span className="text-sm font-semibold">
                    {isExpenseMessage ? 'Expense Added' : 'Settlement Recorded'}
                  </span>
                </div>
                {expense && (
                  <p className="text-sm font-medium">{expense.description || 'View expense details'}</p>
                )}
                {settlement && (
                  <p className="text-sm font-medium">
                    {settlement.currency || '₹'}{settlement.amount?.toLocaleString() || ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{message.content}</p>
              </CardContent>
            </Card>
            <div className={`flex items-center gap-1 text-xs text-muted-foreground ${isOwn ? 'justify-end' : ''}`}>
              <span>{formatTime(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get border radius based on position in group
  const getBubbleRadius = () => {
    if (isOwn) {
      if (isFirstInGroup && isLastInGroup) return 'rounded-2xl rounded-br-md';
      if (isFirstInGroup) return 'rounded-2xl rounded-br-lg';
      if (isLastInGroup) return 'rounded-2xl rounded-tr-lg rounded-br-md';
      return 'rounded-2xl rounded-r-lg';
    } else {
      if (isFirstInGroup && isLastInGroup) return 'rounded-2xl rounded-bl-md';
      if (isFirstInGroup) return 'rounded-2xl rounded-bl-lg';
      if (isLastInGroup) return 'rounded-2xl rounded-tl-lg rounded-bl-md';
      return 'rounded-2xl rounded-l-lg';
    }
  };

  // Get animation class
  const getAnimationClass = () => {
    if (isSending) return '';
    return isOwn ? 'animate-slide-in' : 'animate-slide-in';
  };

  // When used inside MessageGroup (hideHeader=true), render simplified version
  if (hideHeader) {
    return (
      <TooltipProvider>
        <div className={`${isLastInGroup ? 'mb-1' : 'mb-0.5'} group/message ${getAnimationClass()}`}>
          {/* Message bubble with hover actions */}
          <div className={`relative group/bubble inline-block ${isOwn ? 'float-right clear-both' : 'float-left clear-both'}`}>
            {/* Floating action bar */}
            {(isEditable || canDelete) && !isSending && !isFailed && (
              <div 
                className={`absolute ${isOwn ? '-left-24' : '-right-24'} top-1/2 -translate-y-1/2 
                  opacity-0 group-hover/bubble:opacity-100 scale-95 group-hover/bubble:scale-100 
                  transition-all duration-200 pointer-events-none group-hover/bubble:pointer-events-auto z-10`}
              >
                <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg rounded-full px-1.5 py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={handleCopy} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                        <Copy size={14} className="text-muted-foreground hover:text-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Copy</TooltipContent>
                  </Tooltip>
                  {isEditable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => { setEditContent(message.content); setShowEditDialog(true); }} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                          <Pencil size={14} className="text-muted-foreground hover:text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Edit</TooltipContent>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => setShowDeleteDialog(true)} className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors">
                          <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Delete</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`px-3 py-2 ${getBubbleRadius()} transition-shadow duration-200 ${
                isOwn
                  ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md'
                  : 'bg-card border border-border/50 text-foreground shadow-xs hover:shadow-sm'
              } ${isDeleted ? 'opacity-60 italic' : ''} ${
                isFailed ? 'bg-destructive/10 border border-destructive/30' : ''
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            
            {isFailed && (
              <button onClick={handleRetry} className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors" title="Retry sending">
                <RefreshCw size={14} className="text-destructive" />
              </button>
            )}
          </div>

          {/* Message metadata - only show on last message in group */}
          {isLastInGroup && (
            <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 clear-both ${isOwn ? 'justify-end pr-1' : 'pl-1'}`}>
              <span>{formatTime(message.createdAt)}</span>
              {isEdited && <span className="italic">(edited)</span>}
              {isSending && <span className="italic text-muted-foreground/70">Sending...</span>}
              {isFailed && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />Failed
                </span>
              )}
              {isOwn && !isSending && !isFailed && (
                message.readBy && message.readBy.length > 1 
                  ? <CheckCheck size={14} className="text-primary" />
                  : <Check size={14} className="text-muted-foreground" />
              )}
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Message</DialogTitle>
                <DialogDescription>Make changes to your message. You can edit within 15 minutes of sending.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} maxLength={2000} className="resize-none" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{editContent.length}/2000</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleEdit} disabled={isSubmitting || !editContent.trim() || editContent === message.content}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Message</DialogTitle>
                <DialogDescription>Are you sure you want to delete this message? This action cannot be undone.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground line-clamp-3">{message.content}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isSubmitting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-3' : 'mb-1'} group/message ${getAnimationClass()}`}>
        <div className={`flex gap-2 max-w-[85%] md:max-w-[75%] lg:max-w-[65%] ${isOwn ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          {!isOwn && (
            <>
              {showAvatar && isFirstInGroup ? (
                <Avatar className="h-8 w-8 border-2 shrink-0 mt-0.5">
                  <AvatarFallback className={`${derivedAvatarColor} text-sm font-medium`}>
                    {senderInitial}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8 shrink-0" />
              )}
            </>
          )}

          <div className="space-y-1 flex-1 min-w-0">
            {/* Sender name */}
            {!isOwn && showAvatar && isFirstInGroup && !hideHeader && (
              <p className={`text-xs font-medium ml-1 ${nameColor}`}>{senderName}</p>
            )}
            
            {/* Message bubble with hover actions */}
            <div className="relative group/bubble">
              {/* Floating action bar */}
              {(isEditable || canDelete) && !isSending && !isFailed && (
                <div 
                  className={`absolute ${isOwn ? '-left-24' : '-right-24'} top-1/2 -translate-y-1/2 
                    opacity-0 group-hover/bubble:opacity-100 scale-95 group-hover/bubble:scale-100 
                    transition-all duration-200 pointer-events-none group-hover/bubble:pointer-events-auto z-10`}
                >
                  <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg rounded-full px-1.5 py-1">
                    {/* Copy button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCopy}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <Copy size={14} className="text-muted-foreground hover:text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Copy</TooltipContent>
                    </Tooltip>
                    
                    {/* Edit button */}
                    {isEditable && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setEditContent(message.content);
                              setShowEditDialog(true);
                            }}
                            className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          >
                            <Pencil size={14} className="text-muted-foreground hover:text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Edit</TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Delete button */}
                    {canDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setShowDeleteDialog(true)}
                            className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Delete</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`relative px-3 py-2 ${getBubbleRadius()} transition-shadow duration-200 ${
                  isOwn
                    ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md'
                    : 'bg-card border border-border/50 text-foreground shadow-xs hover:shadow-sm'
                } ${isDeleted ? 'opacity-60 italic' : ''} ${
                  isFailed ? 'bg-destructive/10 border border-destructive/30' : ''
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed">{message.content}</p>
              </div>
              
              {/* Retry button for failed messages */}
              {isFailed && (
                <button 
                  onClick={handleRetry}
                  className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-muted transition-colors"
                  title="Retry sending"
                >
                  <RefreshCw size={14} className="text-destructive" />
                </button>
              )}
            </div>

            {/* Message metadata (time, status, edited) - only show on last message in group */}
            {isLastInGroup && (
              <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${isOwn ? 'justify-end pr-1' : 'pl-1'}`}>
                <span>{formatTime(message.createdAt)}</span>
                {isEdited && <span className="italic">(edited)</span>}
                {isSending && <span className="italic text-muted-foreground/70">Sending...</span>}
                {isFailed && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle size={11} />
                    Failed
                  </span>
                )}
                {isOwn && !isSending && !isFailed && (
                  <>
                    {message.readBy && message.readBy.length > 1 ? (
                      <CheckCheck size={14} className="text-primary" />
                    ) : (
                      <Check size={14} className="text-muted-foreground" />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Message</DialogTitle>
              <DialogDescription>
                Make changes to your message. You can edit within 15 minutes of sending.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                maxLength={2000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {editContent.length}/2000
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEdit}
                disabled={isSubmitting || !editContent.trim() || editContent === message.content}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Message</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this message? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {message.content}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default MessageBubble;
