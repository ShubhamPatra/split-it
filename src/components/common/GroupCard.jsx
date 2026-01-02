import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Trash2 } from 'lucide-react';
import { useGroups } from '../../context/GroupContext';
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
  const { getTotalExpenses, deleteGroup, getGroupExpenses, getGroupSettlements, getUserProfile } = useGroups();
  const { toast } = useToast();
  
  // Memoize expensive calculations
  const totalExpenses = useMemo(() => getTotalExpenses(group.id), [group.id, getTotalExpenses]);
  const expenseCount = useMemo(() => getGroupExpenses(group.id).length, [group.id, getGroupExpenses]);
  const settlementCount = useMemo(() => getGroupSettlements(group.id).length, [group.id, getGroupSettlements]);
  const formattedDate = useMemo(() => new Date(group.createdAt).toLocaleDateString(), [group.createdAt]);

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteGroup(group.id);
    toast({ title: "Group deleted", description: `"${group.name}" and all its expenses have been removed.` });
  };

  const handleCardClick = () => navigate(`/group/${group.id}`);

  return (
    <div onClick={handleCardClick} className="glass-card rounded-lg sm:rounded-xl p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all duration-200 animate-fade-in group/card w-full">
      <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-1 truncate">{group.name}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Created on {formattedDate}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity min-h-[44px] min-w-[44px] h-10 w-10 text-muted-foreground hover:text-destructive" 
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 size={18} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Group</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete "{group.name}"? This will also delete {expenseCount} expense{expenseCount !== 1 ? 's' : ''} and {settlementCount} settlement{settlementCount !== 1 ? 's' : ''}. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]">Delete Group</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ArrowRight className="text-muted-foreground group-hover/card:text-primary transition-colors flex-shrink-0" size={20} />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Users size={16} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs sm:text-sm text-muted-foreground">{group.members.length} members</span>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        {group.members.slice(0, 3).map(memberId => {
          const profile = getUserProfile(memberId);
          const displayName = profile?.name?.split(' ')[0] || 'User';
          return <span key={memberId} className="px-2 py-1 bg-secondary text-secondary-foreground text-[10px] sm:text-xs rounded-full">{displayName}</span>;
        })}
        {group.members.length > 3 && <span className="px-2 py-1 bg-muted text-muted-foreground text-[10px] sm:text-xs rounded-full">+{group.members.length - 3} more</span>}
      </div>
      <div className="pt-3 border-t border-border">
        <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Expenses</p>
        <p className="font-display font-bold text-lg sm:text-xl md:text-2xl text-primary truncate">₹{totalExpenses.toLocaleString()}</p>
      </div>
    </div>
  );
});

GroupCard.displayName = 'GroupCard';

export default GroupCard;
