import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Trash2, MessageSquare } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';

const GroupCard = React.memo(({ group }) => {
  const navigate = useNavigate();
  const { getTotalExpenses, deleteGroup, getGroupSettlements, getUserProfile } = useGroups();
  const { getUnreadCount } = useChat();
  const { toast } = useToast();
  
  // Memoize expensive calculations
  // Note: expenses are lazy-loaded per group, so count may be 0 until group is visited
  const totalExpenses = useMemo(() => getTotalExpenses(group.id), [group.id, getTotalExpenses]);
  const settlementCount = useMemo(() => getGroupSettlements(group.id).length, [group.id, getGroupSettlements]);
  const formattedDate = useMemo(() => new Date(group.createdAt).toLocaleDateString(), [group.createdAt]);
  const unreadCount = getUnreadCount(group.id);

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteGroup(group.id);
    toast({ title: "Group deleted", description: `"${group.name}" and all its expenses have been removed.` });
  };

  const handleCardClick = () => navigate(`/group/${group.id}`);

  return (
    <div 
      onClick={handleCardClick} 
      className="relative overflow-hidden bg-card rounded-xl p-5 border border-border/50 shadow-sm cursor-pointer group/card animate-fade-in w-full
        hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] transition-all duration-300
        before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:via-transparent before:to-success/5 before:opacity-0 before:transition-opacity before:duration-500 group-hover/card:before:opacity-100"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-lg tracking-tight text-foreground mb-1 truncate">{group.name}</h3>
              {unreadCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  <MessageSquare size={12} />
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Created on {formattedDate}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity min-h-[44px] min-w-[44px] h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 size={18} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Group</AlertDialogTitle>
                  <AlertDialogDescription>Are you sure you want to delete "{group.name}"? This will also delete all expenses and {settlementCount} settlement{settlementCount !== 1 ? 's' : ''}. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]">Delete Group</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ArrowRight className="text-muted-foreground group-hover/card:text-primary group-hover/card:translate-x-1 transition-all duration-300 flex-shrink-0" size={20} />
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users size={16} className="text-primary flex-shrink-0" />
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground">{group.members.length} members</span>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
          {group.members.slice(0, 3).map(memberId => {
            const profile = getUserProfile(memberId);
            const displayName = profile?.name?.split(' ')[0] || 'User';
            return <span key={memberId} className="px-3 py-1 bg-gradient-to-r from-primary/10 to-primary/5 text-primary-dark border border-primary/20 rounded-full text-xs font-medium">{displayName}</span>;
          })}
          {group.members.length > 3 && <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">+{group.members.length - 3} more</span>}
        </div>
        <div className="pt-4 border-t border-border/50">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Expenses</p>
          <p className="font-display font-bold text-2xl sm:text-3xl bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent truncate">₹{totalExpenses.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
});

GroupCard.displayName = 'GroupCard';

export default GroupCard;
