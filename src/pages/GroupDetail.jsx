import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Receipt, CheckCircle, History, Filter, X, Download, Smartphone, FileText, FileSpreadsheet, Shield, Crown, UserPlus, UserMinus, Settings, Wallet, AlertTriangle, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { useGroupRoles } from '../hooks/useGroupRoles';
import { getCategoryById } from '../data/categories';
import { calculateOptimalSettlements } from '../utils/settlementOptimizer';
import apiClient from '../lib/apiClient';
import {
  exportFullReportToCsv,
  exportFullReportToPdf
} from '../lib/exportCsv';
import Navbar from '../components/layout/Navbar';
import ExpenseCard from '../components/common/ExpenseCard';
import BalanceCard from '../components/common/BalanceCard';
import SettlementCard from '../components/common/SettlementCard';
import SettlementSuggestions from '../components/common/SettlementSuggestions';
import ExpenseAnalytics from '../components/common/ExpenseAnalytics';
import UpiPaymentButton from '../components/common/UpiPaymentButton';
import InviteModal from '../components/group/InviteModal';
import ChatButton from '../components/group/ChatButton';
import ChatPanel from '../components/group/ChatPanel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useToast } from '../hooks/use-toast';

const GroupDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const {
    getGroupById,
    getGroupExpenses,
    getGroupBalances,
    getTotalExpenses,
    getGroupSettlements,
    addSettlement,
    addMemberToGroup,
    removeMemberFromGroup,
    generateInviteCode,
    getUserProfile,
    loadGroupExpenses
  } = useGroups();
  const { getUnreadCount, subscribeToGroup, unsubscribeFromGroup } = useChat();
  const { refreshNotifications } = useNotifications();
  const { toast } = useToast();

  const group = getGroupById(id || '');

  const {
    isAdmin,
    isCreator,
    canEditExpense,
    canDeleteExpense,
    getMemberRole,
    setMemberRole,
    canManageRoles,
    canManageMembers
  } = useGroupRoles(id || '', group?.createdBy || '');

  // Get initial tab from URL search params
  const initialTab = searchParams.get('tab') || 'expenses';

  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const [settlePaidBy, setSettlePaidBy] = useState('');
  const [settlePaidTo, setSettlePaidTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [, setIsGeneratingLink] = useState(false);
  const [, setLinkCopied] = useState(false);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Chat unread count
  const chatUnreadCount = getUnreadCount(id || '');

  // Budget settings state (Comment 4)
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [budgetLoading, setBudgetLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load expenses for this group on mount (only once per group)
  // Use a ref to prevent reloading when loadGroupExpenses function changes
  const hasLoadedRef = useRef(null);
  useEffect(() => {
    if (id && isAuthenticated && hasLoadedRef.current !== id) {
      hasLoadedRef.current = id;
      loadGroupExpenses(id);
    }

    // Cleanup: leave socket room when unmounting or group changes
    return () => {
      if (id) {
        import('../lib/socketClient').then(({ leaveGroupRoom }) => {
          leaveGroupRoom(id);
        });
      }
    };
  }, [id, isAuthenticated, loadGroupExpenses]);

  // Subscribe to chat events when on chat tab
  useEffect(() => {
    if (id) {
      subscribeToGroup(id);
      return () => unsubscribeFromGroup(id);
    }
  }, [id, subscribeToGroup, unsubscribeFromGroup]);

  useEffect(() => {
    // Set invite link if group has an existing invite code
    if (group?.inviteCode) {
      setInviteLink(`${window.location.origin}/join/${group.inviteCode}`);
    }
  }, [group?.inviteCode]);

  useEffect(() => {
    if (user?.id) {
      setSettlePaidBy(user.id);
    }
  }, [user]);

  // Auto-switch to cash if UPI is selected but receiver doesn't have UPI ID
  useEffect(() => {
    if (paymentMethod === 'upi' && settlePaidTo) {
      const receiver = getUserProfile(settlePaidTo);
      if (!receiver?.upiId) {
        setPaymentMethod('cash');
      }
    }
  }, [settlePaidTo, paymentMethod, getUserProfile]);

  // Load budget settings (Comment 4)
  useEffect(() => {
    const loadBudget = async () => {
      if (!id || !isAdmin(user?.id || '')) return;
      try {
        const budget = await apiClient.get(`/groups/${id}/budget`);
        setBudgetEnabled(budget.enabled || false);
        setMonthlyLimit(budget.monthlyLimit?.toString() || '');
        setAlertThreshold(budget.alertThreshold || 80);
      } catch (error) {
        console.error('Error loading budget:', error);
      }
    };
    loadBudget();
    // isAdmin is stable from useGroupRoles hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  // Calculate who the current user owes money to (must be before early returns)
  const balancesForMemo = getGroupBalances(id || '');

  // All optimal settlements for the group (for admins/creators)
  const allDebts = React.useMemo(() => {
    if (!balancesForMemo || Object.keys(balancesForMemo).length === 0) return [];
    return calculateOptimalSettlements(balancesForMemo);
  }, [balancesForMemo]);

  // Just the current user's debts
  const userDebts = React.useMemo(() => {
    if (!user?.id) return [];
    return allDebts.filter(s => s.from === user.id);
  }, [allDebts, user?.id]);

  // Get debts for a specific payer (used in admin mode)
  const getDebtsForPayer = (payerId) => {
    return allDebts.filter(s => s.from === payerId);
  };

  if (!isAuthenticated) return null;

  const expenses = getGroupExpenses(id || '');
  const balances = balancesForMemo;
  const totalExpenses = getTotalExpenses(id || '');
  const settlements = getGroupSettlements(id || '');

  // Calculate current month's spending for budget
  const currentMonthSpending = expenses
    .filter(exp => {
      const expDate = new Date(exp.date);
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, exp) => sum + exp.amount, 0);

  const budgetPercentage = monthlyLimit ? (currentMonthSpending / parseFloat(monthlyLimit)) * 100 : 0;
  const isOverBudget = budgetPercentage > 100;
  const isNearBudget = budgetPercentage >= alertThreshold && budgetPercentage <= 100;

  const filteredExpenses = categoryFilter === 'all'
    ? expenses
    : expenses.filter(exp => exp.category === categoryFilter);

  const usedCategories = [...new Set(expenses.map(exp => exp.category))];

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 text-center">
          <Card className="border-border/50 shadow-sm max-w-md mx-auto">
            <CardContent className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mx-auto mb-4">
                <Users className="text-muted-foreground" size={32} />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-2">Group not found</h1>
              <p className="text-muted-foreground mb-6">The group you're looking for doesn't exist or has been deleted.</p>
              <Button onClick={() => navigate('/groups')} className="min-h-[48px] shadow-lg shadow-primary/25">Back to Groups</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleSettle = () => {
    const payerId = (isAdmin(user?.id || '') || isCreator(user?.id || '')) ? settlePaidBy : user?.id;

    if (!payerId) {
      toast({ title: "Select payer", description: "Please select who made the payment.", variant: "destructive" });
      return;
    }
    if (!settlePaidTo) {
      toast({ title: "Select recipient", description: "Please select who received the payment.", variant: "destructive" });
      return;
    }
    if (payerId === settlePaidTo) {
      toast({ title: "Invalid selection", description: "Payer and receiver cannot be the same person.", variant: "destructive" });
      return;
    }
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }

    addSettlement({
      groupId: group.id,
      fromUserId: payerId,
      toUserId: settlePaidTo,
      amount: parseFloat(settleAmount),
      currency: 'INR',
      settledAt: settleDate,
      paymentMethod: paymentMethod,
    });

    const payerName = payerId === user?.id ? 'Your' : `${getUserProfile(payerId)?.name}'s`;
    toast({ title: "Settlement recorded!", description: `${payerName} ₹${parseFloat(settleAmount).toLocaleString()} settlement has been recorded.` });

    // If UPI payment and current user is the payer, offer to pay now
    if (paymentMethod === 'upi' && payerId === user?.id) {
      const receiver = getUserProfile(settlePaidTo);
      if (receiver?.upiId) {
        setPendingPayment({
          amount: parseFloat(settleAmount),
          receiverName: receiver.name,
          receiverUpiId: receiver.upiId,
          note: `Settlement payment to ${receiver.name}`,
        });
        setShowPaymentPrompt(true);
      }
    }

    setSettleAmount('');
    setSettlePaidBy('');
    setSettlePaidTo('');
    setPaymentMethod('cash');
    setIsSettleDialogOpen(false);
  };

  const suggestAmount = (receiverId) => {
    if (!receiverId) return;
    // Find the debt amount for this receiver
    const debt = userDebts.find(d => d.to === receiverId);
    if (debt) {
      setSettleAmount(debt.amount.toFixed(2));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleInviteMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast({ title: "Enter an email", description: "Please enter an email address to invite.", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    try {
      // Search for user by email using API
      const foundUsers = await apiClient.get(`/users/search?q=${encodeURIComponent(email)}`);
      const existingUser = foundUsers.find(u => u.email.toLowerCase() === email);

      if (existingUser) {
        // Check if user is already a member
        if (group.members.includes(existingUser.id)) {
          toast({ title: "Already a member", description: `${existingUser.name} is already in this group.`, variant: "destructive" });
          setInviteEmail('');
          return;
        }

        // Add member to group
        const success = await addMemberToGroup(group.id, existingUser.id);
        if (success) {
          toast({ title: "Member added", description: `${existingUser.name} has been added to the group.` });
          // Refresh notifications so the invited user sees it
          refreshNotifications();
        } else {
          toast({ title: "Error", description: "Failed to add member to the group.", variant: "destructive" });
        }
      } else {
        toast({ title: "User not found", description: `No user found with email ${email}. They need to sign up first.`, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      toast({ title: "Error", description: "Failed to invite member. Please try again.", variant: "destructive" });
    }

    setInviteEmail('');
  };

  // eslint-disable-next-line no-unused-vars
  const handleGenerateInviteLink = async () => {
    if (!group?.id) return;

    setIsGeneratingLink(true);
    try {
      const code = await generateInviteCode(group.id);
      if (code) {
        const link = `${window.location.origin}/join/${code}`;
        setInviteLink(link);
        toast({ title: "Invite link generated", description: "Share this link to invite members." });
      } else {
        toast({ title: "Error", description: "Failed to generate invite link.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast({ title: "Error", description: "Failed to generate invite link.", variant: "destructive" });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleCopyInviteLink = () => {
    const linkToCopy = inviteLink || (group?.inviteCode ? `${window.location.origin}/join/${group.inviteCode}` : null);
    if (linkToCopy) {
      navigator.clipboard.writeText(linkToCopy);
      setLinkCopied(true);
      toast({ title: "Link copied", description: "Invite link copied to clipboard!" });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleRemoveMember = (memberId) => {
    if (memberId === group.createdBy) {
      toast({ title: "Cannot remove creator", description: "The group creator cannot be removed from the group.", variant: "destructive" });
      return;
    }
    const memberBalance = balances[memberId] || 0;
    if (Math.abs(memberBalance) > 0.01) {
      toast({ title: "Cannot remove member", description: `${getUserProfile(memberId)?.name || 'User'} has an outstanding balance of ₹${Math.abs(memberBalance).toFixed(0)}. Settle up first.`, variant: "destructive" });
      return;
    }
    removeMemberFromGroup(group.id, memberId);
    toast({ title: "Member removed", description: `${getUserProfile(memberId)?.name || 'User'} has been removed from the group.` });
  };

  // Save budget settings (Comment 4)
  const handleSaveBudget = async () => {
    if (!group?.id) return;

    setBudgetLoading(true);
    try {
      await apiClient.put(`/groups/${group.id}/budget`, {
        enabled: budgetEnabled,
        monthlyLimit: budgetEnabled ? parseFloat(monthlyLimit) || 0 : 0,
        alertThreshold: alertThreshold,
        currency: 'INR',
      });

      toast({
        title: "Budget updated",
        description: budgetEnabled
          ? `Monthly budget set to ₹${parseFloat(monthlyLimit).toLocaleString()}`
          : "Budget tracking disabled"
      });
      setIsBudgetDialogOpen(false);
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: "Failed to update budget settings.",
        variant: "destructive"
      });
    } finally {
      setBudgetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        <button onClick={() => navigate('/groups')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors min-h-[44px] min-w-[44px] group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm sm:text-base">Back to Groups</span>
        </button>

        <Card className="border-border/50 shadow-sm mb-6 sm:mb-8 animate-fade-in overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 truncate">{group.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                  <Users size={16} />
                  <span>{group.members.length} members</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="text-left sm:text-right px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
                  <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">₹{totalExpenses.toLocaleString()}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-h-[44px] h-auto border-border/50 hover:border-primary/30 hover:bg-primary/5"><Download size={16} className="sm:mr-1" /><span className="hidden sm:inline">Export</span></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover border-border/50">
                    <DropdownMenuLabel>Full Report</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => { exportFullReportToPdf(expenses, settlements, balances, group.name, getUserProfile); toast({ title: "PDF exported" }); }} className="cursor-pointer">
                      <FileText size={16} className="mr-2 text-red-500" />Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { exportFullReportToCsv(expenses, settlements, balances, group.name, getUserProfile); toast({ title: "CSV exported" }); }} className="cursor-pointer">
                      <FileSpreadsheet size={16} className="mr-2 text-green-500" />Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => { try { await apiClient.post('/expenses/export', { groupId: group.id }); toast({ title: "Report sent", description: "Check your email for the expense report" }); } catch (err) { toast({ title: "Failed to send", description: err.message || "Could not send report", variant: "destructive" }); } }} className="cursor-pointer">
                      <Mail size={16} className="mr-2 text-blue-500" />Email Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => setIsSettleDialogOpen(true)} className="min-h-[44px] h-auto border-border/50 hover:border-success/30 hover:bg-success/5 hover:text-success"><CheckCircle size={16} className="sm:mr-1" /><span className="hidden sm:inline">Settle</span></Button>
                <Button size="sm" onClick={() => navigate(`/add-expense?groupId=${group.id}`)} className="min-h-[44px] h-auto shadow-lg shadow-primary/25 hover:shadow-xl"><Plus size={16} className="sm:mr-1" /><span className="hidden sm:inline">Expense</span></Button>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs sm:text-sm text-muted-foreground">Members</p>
                <div className="flex items-center gap-2">
                  {isAdmin(user?.id || '') && <Badge variant="outline" className="gap-1 text-xs border-primary/30 bg-primary/5 text-primary"><Shield size={12} />You're Admin</Badge>}
                  <Button variant="outline" size="sm" onClick={() => setIsInviteModalOpen(true)} className="min-h-[44px] h-auto py-2 text-xs sm:text-sm border-border/50 hover:border-primary/30"><UserPlus size={14} className="sm:mr-1" /><span className="hidden sm:inline">Invite</span></Button>
                  {canManageRoles(user?.id || '') && (
                    <Button variant="outline" size="sm" onClick={() => setIsMemberDialogOpen(true)} className="min-h-[44px] h-auto py-2 text-xs sm:text-sm border-border/50 hover:border-primary/30"><Settings size={14} /></Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.members.map(memberId => {
                  const memberRole = getMemberRole(memberId);
                  const isCurrentUser = memberId === user?.id;
                  const isMemberAdmin = memberRole === 'admin';
                  const isMemberCreator = memberId === group.createdBy;
                  return (
                    <DropdownMenu key={memberId}>
                      <DropdownMenuTrigger asChild>
                        <button className={`px-3 py-2.5 text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all min-h-[44px] ${isMemberAdmin ? 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary border border-primary/20 hover:border-primary/40' : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary/80 border border-transparent hover:border-border/50'}`}>
                          {isMemberCreator && <Crown size={12} />}
                          {isMemberAdmin && !isMemberCreator && <Shield size={12} />}
                          {getUserProfile(memberId)?.name || 'User'}{isCurrentUser && ' (You)'}{isMemberCreator && ' (Creator)'}
                        </button>
                      </DropdownMenuTrigger>
                      {canManageRoles(user?.id || '') && !isCurrentUser && !isMemberCreator && (
                        <DropdownMenuContent align="start" className="bg-popover border-border/50">
                          <DropdownMenuLabel>Role Management</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setMemberRole(memberId, isMemberAdmin ? 'member' : 'admin'); toast({ title: isMemberAdmin ? 'Admin removed' : 'Admin added', description: `${getUserProfile(memberId)?.name || 'User'} is now ${isMemberAdmin ? 'a member' : 'an admin'}` }); }} className="cursor-pointer">
                            {isMemberAdmin ? <>Remove Admin</> : <><Shield size={14} className="mr-2" />Make Admin</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      )}
                    </DropdownMenu>
                  );
                })}
              </div>
            </div>

            {/* Budget Section (Comment 4) */}
            {budgetEnabled && monthlyLimit && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Monthly Budget</span>
                  </div>
                  {isAdmin(user?.id || '') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsBudgetDialogOpen(true)}
                      className="text-xs h-8 hover:bg-primary/10"
                    >
                      <Settings size={12} className="mr-1" />Edit
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className={isOverBudget ? 'text-destructive font-medium' : isNearBudget ? 'text-warning font-medium' : ''}>
                      ₹{currentMonthSpending.toLocaleString()} / ₹{parseFloat(monthlyLimit).toLocaleString()}
                    </span>
                    <span className={`text-xs ${isOverBudget ? 'text-destructive' : isNearBudget ? 'text-warning' : 'text-muted-foreground'}`}>
                      {budgetPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${isOverBudget ? 'bg-gradient-to-r from-destructive to-destructive/80' : isNearBudget ? 'bg-gradient-to-r from-warning to-warning/80' : 'bg-gradient-to-r from-primary to-primary/80'}`}
                      style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                    />
                  </div>
                  {isOverBudget && (
                    <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-lg w-fit">
                      <AlertTriangle size={12} />
                      <span>Over budget by ₹{(currentMonthSpending - parseFloat(monthlyLimit)).toLocaleString()}</span>
                    </div>
                  )}
                  {isNearBudget && !isOverBudget && (
                    <div className="flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-1 rounded-lg w-fit">
                      <AlertTriangle size={12} />
                      <span>Approaching budget limit</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Budget Setup Prompt for Admins */}
            {!budgetEnabled && isAdmin(user?.id || '') && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50">
                <button
                  onClick={() => setIsBudgetDialogOpen(true)}
                  className="w-full p-3 border border-dashed border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground group"
                >
                  <Wallet size={16} className="group-hover:text-primary transition-colors" />
                  <span className="group-hover:text-foreground transition-colors">Set up monthly budget</span>
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-3 sm:inline-grid bg-muted/50 p-1 rounded-xl h-12">
            <TabsTrigger value="expenses" className="gap-1 sm:gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"><Receipt size={14} />Expenses</TabsTrigger>
            <TabsTrigger value="balances" className="gap-1 sm:gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"><Users size={14} />Balances</TabsTrigger>
            <TabsTrigger value="settlements" className="gap-1 sm:gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"><History size={14} />Settlements</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            {/* Expense Analytics */}
            {expenses.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <ExpenseAnalytics expenses={expenses} group={group} />
              </div>
            )}

            {expenses.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"><Filter size={14} /><span>Filter by:</span></div>
                  <button onClick={() => setCategoryFilter('all')} className={`px-3 py-2.5 text-xs sm:text-sm rounded-xl transition-all min-h-[44px] ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/50'}`}>All ({expenses.length})</button>
                  {usedCategories.map(catId => {
                    const cat = getCategoryById(catId);
                    const count = expenses.filter(e => e.category === catId).length;
                    const IconComponent = cat.icon;
                    return (
                      <button key={catId} onClick={() => setCategoryFilter(catId)} className={`px-3 py-2.5 text-xs sm:text-sm rounded-xl transition-all flex items-center gap-1.5 min-h-[44px] ${categoryFilter === catId ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/50'}`}>
                        <IconComponent size={12} className={categoryFilter === catId ? '' : cat.color} />{cat.name} ({count})
                      </button>
                    );
                  })}
                  {categoryFilter !== 'all' && <button onClick={() => setCategoryFilter('all')} className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all min-h-[44px] min-w-[44px]" title="Clear filter"><X size={16} /></button>}
                </div>
              </div>
            )}

            {filteredExpenses.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {filteredExpenses.map((expense, index) => (
                  <div key={expense.id} style={{ animationDelay: `${0.1 * index}s` }}>
                    <ExpenseCard expense={expense} canEdit={canEditExpense(user?.id || '', expense.paidBy)} canDelete={canDeleteExpense(user?.id || '', expense.paidBy)} isAdmin={isAdmin(user?.id || '')} />
                  </div>
                ))}
              </div>
            ) : expenses.length > 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Filter className="text-muted-foreground" size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">No expenses in this category</h3>
                  <p className="text-muted-foreground mb-6">Try selecting a different category filter</p>
                  <Button variant="outline" onClick={() => setCategoryFilter('all')} className="min-h-[48px] border-border/50 hover:border-primary/30">Show All Expenses</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Receipt className="text-primary" size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">No expenses yet</h3>
                  <p className="text-muted-foreground mb-6">Add your first expense to start tracking</p>
                  <Button onClick={() => navigate(`/add-expense?groupId=${group.id}`)} className="min-h-[48px] shadow-lg shadow-primary/25"><Plus size={18} />Add Expense</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="balances">
            {/* Settlement Suggestions */}
            <div className="mb-4 sm:mb-6">
              <SettlementSuggestions
                balances={balances}
                settlements={settlements}
                profiles={group.members.reduce((acc, memberId) => {
                  acc[memberId] = { name: getUserProfile(memberId)?.name || 'User' };
                  return acc;
                }, {})}
                onSettleClick={(fromId, toId, amount) => {
                  setSettlePaidBy(fromId);
                  setSettlePaidTo(toId);
                  setSettleAmount(amount.toString());
                  setIsSettleDialogOpen(true);
                }}
              />
            </div>

            {/* Individual Balances */}
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users size={20} />
              Member Balances
            </h3>
            <div className="space-y-4">
              {group.members.map((memberId, index) => (
                <div key={memberId} style={{ animationDelay: `${0.1 * index}s` }}>
                  <BalanceCard memberId={memberId} balance={balances[memberId] || 0} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settlements">
            {settlements.length > 0 ? (
              <div className="space-y-4">
                {settlements.map((settlement, index) => (
                  <div key={settlement.id} style={{ animationDelay: `${0.1 * index}s` }}>
                    <SettlementCard settlement={settlement} />
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-success" size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">No settlements yet</h3>
                  <p className="text-muted-foreground mb-6">Record a settlement when members pay each other back</p>
                  <Button onClick={() => setIsSettleDialogOpen(true)} className="min-h-[48px] shadow-lg shadow-primary/25"><CheckCircle size={18} />Record Settlement</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Floating Chat Button */}
        <ChatButton
          onClick={() => setIsChatOpen(true)}
          unreadCount={chatUnreadCount}
        />

        {/* Sliding Chat Panel */}
        <ChatPanel
          groupId={id}
          groupName={group?.name}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </main>

      <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Record Settlement</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Record a payment you made to settle up</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4">
            {/* Admin/Creator mode - can record for anyone */}
            {(isAdmin(user?.id || '') || isCreator(user?.id || '')) ? (
              <>
                {allDebts.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="mx-auto text-success mb-3" size={48} />
                    <p className="text-lg font-medium text-foreground">All settled up!</p>
                    <p className="text-sm text-muted-foreground">No pending settlements in this group.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">Who paid?</Label>
                      <Select value={settlePaidBy} onValueChange={(val) => { setSettlePaidBy(val); setSettlePaidTo(''); setSettleAmount(''); }}>
                        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select payer" /></SelectTrigger>
                        <SelectContent>
                          {[...new Set(allDebts.map(d => d.from))].map(memberId => (
                            <SelectItem key={memberId} value={memberId}>
                              {getUserProfile(memberId)?.name || 'Unknown'}{memberId === user?.id && ' (You)'}
                              <span className="text-destructive ml-2">(owes ₹{Math.abs(balances[memberId] || 0).toFixed(0)})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {settlePaidBy && (
                      <div className="space-y-2">
                        <Label className="text-sm sm:text-base">Paid to</Label>
                        <Select value={settlePaidTo} onValueChange={(val) => { setSettlePaidTo(val); const debt = getDebtsForPayer(settlePaidBy).find(d => d.to === val); if (debt) setSettleAmount(debt.amount.toFixed(2)); }}>
                          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select receiver" /></SelectTrigger>
                          <SelectContent>
                            {getDebtsForPayer(settlePaidBy).map(debt => (
                              <SelectItem key={debt.to} value={debt.to}>
                                {getUserProfile(debt.to)?.name || 'Unknown'}
                                <span className="text-success ml-2">(owed ₹{debt.amount.toFixed(0)})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {settlePaidBy && settlePaidTo && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="settleAmount" className="text-sm sm:text-base">Amount</Label>
                          <Input id="settleAmount" type="number" placeholder="Enter amount" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} min="0" step="0.01" className="min-h-[44px]" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Note:</span> {getUserProfile(settlePaidBy)?.name} owes ₹{getDebtsForPayer(settlePaidBy).find(d => d.to === settlePaidTo)?.amount.toFixed(2) || 0} to {getUserProfile(settlePaidTo)?.name}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm sm:text-base">Payment Method</Label>
                          <div className="flex gap-2">
                            <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="flex-1 min-h-[44px] h-auto text-sm" onClick={() => setPaymentMethod('cash')}>Paid</Button>
                            <Button
                              type="button"
                              variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                              className="flex-1 min-h-[44px] h-auto text-sm"
                              onClick={() => setPaymentMethod('upi')}
                              disabled={!getUserProfile(settlePaidTo)?.upiId}
                              title={!getUserProfile(settlePaidTo)?.upiId ? 'Receiver has not set up UPI ID' : 'Pay via UPI'}
                            >
                              <Smartphone size={16} className="mr-1" />UPI
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="settleDate" className="text-sm sm:text-base">Date</Label>
                          <div className="relative">
                            <Input id="settleDate" type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className="pr-10 min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                          </div>
                        </div>
                        <Button onClick={handleSettle} className="w-full min-h-[44px] h-auto"><CheckCircle size={18} />Record Settlement</Button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              /* Regular member mode - can only record their own payments */
              userDebts.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="mx-auto text-success mb-3" size={48} />
                  <p className="text-lg font-medium text-foreground">You're all settled up!</p>
                  <p className="text-sm text-muted-foreground">You don't owe anyone in this group.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">You are paying</Label>
                    <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="font-medium">{getUserProfile(user?.id)?.name || 'You'}</span>
                      <span className="text-destructive ml-2">(owes ₹{Math.abs(balances[user?.id] || 0).toFixed(0)})</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Pay to</Label>
                    <Select value={settlePaidTo} onValueChange={(val) => { setSettlePaidTo(val); suggestAmount(val); }}>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select who to pay" /></SelectTrigger>
                      <SelectContent>
                        {userDebts.map(debt => (
                          <SelectItem key={debt.to} value={debt.to}>
                            {getUserProfile(debt.to)?.name || 'Unknown'}
                            <span className="text-success ml-2">(you owe ₹{debt.amount.toFixed(0)})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settleAmount" className="text-sm sm:text-base">Amount</Label>
                    <Input id="settleAmount" type="number" placeholder="Enter amount" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} min="0" step="0.01" className="min-h-[44px]" />
                    {settlePaidTo && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Note:</span> You owe ₹{userDebts.find(d => d.to === settlePaidTo)?.amount.toFixed(2) || 0} to {getUserProfile(settlePaidTo)?.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Payment Method</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="flex-1 min-h-[44px] h-auto text-sm" onClick={() => setPaymentMethod('cash')}>Paid</Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                        className="flex-1 min-h-[44px] h-auto text-sm"
                        onClick={() => setPaymentMethod('upi')}
                        disabled={!settlePaidTo || !getUserProfile(settlePaidTo)?.upiId}
                        title={!settlePaidTo ? 'Select receiver first' : !getUserProfile(settlePaidTo)?.upiId ? 'Receiver has not set up UPI ID' : 'Pay via UPI'}
                      >
                        <Smartphone size={16} className="mr-1" />UPI
                      </Button>
                    </div>
                    {settlePaidTo && !getUserProfile(settlePaidTo)?.upiId && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Note:</span> UPI payment unavailable - {getUserProfile(settlePaidTo)?.name} hasn't added their UPI ID yet
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settleDate" className="text-sm sm:text-base">Date</Label>
                    <div className="relative">
                      <Input id="settleDate" type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className="pr-10 min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                    </div>
                  </div>
                  <Button onClick={handleSettle} className="w-full min-h-[44px] h-auto"><CheckCircle size={18} />Record Settlement</Button>
                </>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Manage Members</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">View and manage group members</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm sm:text-base"><Users size={16} />Current Members ({group.members.length})</Label>
              <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto mobile-scroll">
                {group.members.map(memberId => {
                  const memberRole = getMemberRole(memberId);
                  const isCreator = memberId === group.createdBy;
                  const memberBalance = balances[memberId] || 0;
                  const hasBalance = Math.abs(memberBalance) > 0.01;
                  return (
                    <div key={memberId} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {memberRole === 'admin' && <Crown size={14} className="text-primary flex-shrink-0" />}
                        <span className="font-medium text-sm truncate">{getUserProfile(memberId)?.name || 'User'}</span>
                        {isCreator && <Badge variant="outline" className="text-[10px] flex-shrink-0">Creator</Badge>}
                        {memberId === user?.id && <Badge variant="secondary" className="text-[10px] flex-shrink-0">You</Badge>}
                      </div>
                      {!isCreator && memberId !== user?.id && canManageMembers(user?.id || '') && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] flex-shrink-0" onClick={() => handleRemoveMember(memberId)} disabled={hasBalance}>
                          <UserMinus size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UPI Payment Prompt Dialog */}
      <Dialog open={showPaymentPrompt} onOpenChange={setShowPaymentPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Now via UPI?</DialogTitle>
            <DialogDescription>
              You can pay ₹{pendingPayment?.amount.toLocaleString()} to {pendingPayment?.receiverName} right now using UPI
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-primary/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
              <p className="font-display text-3xl font-bold text-primary">
                ₹{pendingPayment?.amount.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-secondary rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Pay to</p>
              <p className="font-semibold">{pendingPayment?.receiverName}</p>
              {pendingPayment?.receiverUpiId && (
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  {pendingPayment.receiverUpiId}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {pendingPayment?.receiverUpiId && (
                <UpiPaymentButton
                  amount={pendingPayment.amount}
                  receiverName={pendingPayment.receiverName}
                  receiverUpiId={pendingPayment.receiverUpiId}
                  note={pendingPayment.note}
                  className="flex-1"
                />
              )}
              <Button
                variant="outline"
                onClick={() => setShowPaymentPrompt(false)}
                className="flex-1"
              >
                Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Settings Dialog (Comment 4) */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet size={18} />
              Budget Settings
            </DialogTitle>
            <DialogDescription>
              Set a monthly spending limit for this group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Budget Tracking</p>
                <p className="text-sm text-muted-foreground">Get alerts when approaching the limit</p>
              </div>
              <Switch
                checked={budgetEnabled}
                onCheckedChange={setBudgetEnabled}
              />
            </div>

            {budgetEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="monthlyLimit">Monthly Budget Limit (₹)</Label>
                  <Input
                    id="monthlyLimit"
                    type="number"
                    placeholder="e.g., 10000"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    min="0"
                    step="100"
                    className="min-h-[44px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Alert Threshold: {alertThreshold}%</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Get notified when spending reaches this percentage
                  </p>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>50%</span>
                    <span>95%</span>
                  </div>
                </div>

                {monthlyLimit && (
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Preview</p>
                    <p className="text-sm">
                      Alert when spending exceeds <span className="font-medium">₹{((parseFloat(monthlyLimit) || 0) * alertThreshold / 100).toLocaleString()}</span>
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBudgetDialogOpen(false)}
                className="flex-1 min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveBudget}
                disabled={budgetLoading || (budgetEnabled && !monthlyLimit)}
                className="flex-1 min-h-[44px]"
              >
                {budgetLoading ? 'Saving...' : 'Save Budget'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <InviteModal
        groupId={group?.id}
        groupName={group?.name}
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
};

export default GroupDetail;
