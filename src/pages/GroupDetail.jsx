import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Receipt, CheckCircle, History, Filter, X, Download, Smartphone, FileText, FileSpreadsheet, Shield, Crown, UserPlus, UserMinus, Settings, Link, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useNotifications } from '../context/NotificationContext';
import { useGroupRoles } from '../hooks/useGroupRoles';
import { getCategoryById } from '../data/categories';
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
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
    getUserProfile
  } = useGroups();
  const { refreshNotifications } = useNotifications();
  const { toast } = useToast();
  
  const group = getGroupById(id || '');
  
  const { 
    isAdmin, 
    canEditExpense, 
    canDeleteExpense, 
    getMemberRole,
    setMemberRole,
    canManageRoles,
    canManageMembers
  } = useGroupRoles(id || '', group?.createdBy || '');

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
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

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

  if (!isAuthenticated) return null;

  const expenses = getGroupExpenses(id || '');
  const balances = getGroupBalances(id || '');
  const totalExpenses = getTotalExpenses(id || '');
  const settlements = getGroupSettlements(id || '');

  const filteredExpenses = categoryFilter === 'all' 
    ? expenses 
    : expenses.filter(exp => exp.category === categoryFilter);

  const usedCategories = [...new Set(expenses.map(exp => exp.category))];

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Group not found</h1>
          <Button onClick={() => navigate('/groups')}>Back to Groups</Button>
        </main>
      </div>
    );
  }

  const handleSettle = () => {
    if (!settlePaidBy || !settlePaidTo) {
      toast({ title: "Select members", description: "Please select who paid and who received.", variant: "destructive" });
      return;
    }
    if (settlePaidBy === settlePaidTo) {
      toast({ title: "Invalid selection", description: "Payer and receiver cannot be the same person.", variant: "destructive" });
      return;
    }
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }

    addSettlement({
      groupId: group.id,
      fromUserId: settlePaidBy,
      toUserId: settlePaidTo,
      amount: parseFloat(settleAmount),
      currency: 'INR',
      settledAt: settleDate,
      paymentMethod: paymentMethod,
    });

    toast({ title: "Settlement recorded!", description: `₹${parseFloat(settleAmount).toLocaleString()} settlement has been recorded.` });
    
    // If UPI payment and user is the payer, offer to pay now
    if (paymentMethod === 'upi' && settlePaidBy === user?.id) {
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
    setSettlePaidTo('');
    setPaymentMethod('cash');
    setIsSettleDialogOpen(false);
  };

  const suggestAmount = () => {
    if (settlePaidBy && settlePaidTo) {
      const payerBalance = balances[settlePaidBy] || 0;
      const receiverBalance = balances[settlePaidTo] || 0;
      if (payerBalance < 0 && receiverBalance > 0) {
        const suggested = Math.min(Math.abs(payerBalance), receiverBalance);
        setSettleAmount(suggested.toFixed(0));
      }
    }
  };

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

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast({ title: "Link copied", description: "Invite link copied to clipboard!" });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (memberId === group.createdBy) {
      toast({ title: "Cannot remove creator", description: "The group creator cannot be removed from the group.", variant: "destructive" });
      return;
    }
    const memberBalance = balances[memberId] || 0;
    if (Math.abs(memberBalance) > 0.01) {
      toast({ title: "Cannot remove member", description: `${getUserProfile(memberId)?.name || 'User'} has an outstanding balance of ₹${Math.abs(memberBalance).toFixed(0)}. Settle up first.`, variant: "destructive" });
      return;
    }
    const memberName = getUserProfile(memberId)?.name || 'User';
    const success = await removeMemberFromGroup(group.id, memberId);
    if (success) {
      toast({ title: "Member removed", description: `${memberName} has been removed from the group.` });
    } else {
      toast({ title: "Error", description: "Failed to remove member. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        <button onClick={() => navigate('/groups')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors min-h-[44px] min-w-[44px]">
          <ArrowLeft size={18} />
          <span className="text-sm sm:text-base">Back to Groups</span>
        </button>

        <div className="glass-card rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 truncate">{group.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                <Users size={16} />
                <span>{group.members.length} members</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Expenses</p>
                <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">₹{totalExpenses.toLocaleString()}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-h-[44px] h-auto"><Download size={16} className="sm:mr-1" /><span className="hidden sm:inline">Export</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuLabel>Full Report</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { exportFullReportToPdf(expenses, settlements, balances, group.name, getUserProfile); toast({ title: "PDF exported" }); }} className="cursor-pointer">
                    <FileText size={16} className="mr-2 text-red-500" />Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { exportFullReportToCsv(expenses, settlements, balances, group.name, getUserProfile); toast({ title: "CSV exported" }); }} className="cursor-pointer">
                    <FileSpreadsheet size={16} className="mr-2 text-green-500" />Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setIsSettleDialogOpen(true)} className="min-h-[44px] h-auto"><CheckCircle size={16} className="sm:mr-1" /><span className="hidden sm:inline">Settle</span></Button>
              <Button size="sm" onClick={() => navigate(`/add-expense?groupId=${group.id}`)} className="min-h-[44px] h-auto"><Plus size={16} className="sm:mr-1" /><span className="hidden sm:inline">Expense</span></Button>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs sm:text-sm text-muted-foreground">Members</p>
              <div className="flex items-center gap-2">
                {isAdmin(user?.id || '') && <Badge variant="outline" className="gap-1 text-xs"><Shield size={12} />You're Admin</Badge>}
                {canManageMembers(user?.id || '') && (
                  <Button variant="outline" size="sm" onClick={() => setIsMemberDialogOpen(true)} className="min-h-[44px] h-auto py-2 text-xs sm:text-sm"><Settings size={14} />Manage</Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.members.map(memberId => {
                const memberRole = getMemberRole(memberId);
                const isCurrentUser = memberId === user?.id;
                const isMemberAdmin = memberRole === 'admin';
                return (
                  <DropdownMenu key={memberId}>
                    <DropdownMenuTrigger asChild>
                      <button className={`px-3 py-3 text-xs sm:text-sm rounded-full flex items-center gap-1.5 transition-colors min-h-[44px] ${isMemberAdmin ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                        {isMemberAdmin && <Crown size={12} />}
                        {getUserProfile(memberId)?.name || 'User'}{isCurrentUser && ' (You)'}
                      </button>
                    </DropdownMenuTrigger>
                    {canManageRoles(user?.id || '') && !isCurrentUser && (
                      <DropdownMenuContent align="start" className="bg-popover">
                        <DropdownMenuLabel>Role Management</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setMemberRole(memberId, isMemberAdmin ? 'member' : 'admin'); toast({ title: isMemberAdmin ? 'Admin removed' : 'Admin added', description: `${getUserProfile(memberId)?.name || 'User'} is now ${isMemberAdmin ? 'a member' : 'an admin'}` }); }} className="cursor-pointer">
                          {isMemberAdmin ? <>Remove Admin</> : <><Crown size={14} className="mr-2" />Make Admin</>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                );
              })}
            </div>
          </div>
        </div>

        <Tabs defaultValue="expenses" className="animate-fade-in">
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-3 sm:inline-grid">
            <TabsTrigger value="expenses" className="gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px]"><Receipt size={14} />Expenses</TabsTrigger>
            <TabsTrigger value="balances" className="gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px]"><Users size={14} />Balances</TabsTrigger>
            <TabsTrigger value="settlements" className="gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px]"><History size={14} />Settlements</TabsTrigger>
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
                  <button onClick={() => setCategoryFilter('all')} className={`px-2 sm:px-3 py-3 text-xs sm:text-sm rounded-full transition-colors min-h-[44px] ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>All ({expenses.length})</button>
                  {usedCategories.map(catId => {
                    const cat = getCategoryById(catId);
                    const count = expenses.filter(e => e.category === catId).length;
                    const IconComponent = cat.icon;
                    return (
                      <button key={catId} onClick={() => setCategoryFilter(catId)} className={`px-2 sm:px-3 py-3 text-xs sm:text-sm rounded-full transition-colors flex items-center gap-1.5 min-h-[44px] ${categoryFilter === catId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                        <IconComponent size={12} className={categoryFilter === catId ? '' : cat.color} />{cat.name} ({count})
                      </button>
                    );
                  })}
                  {categoryFilter !== 'all' && <button onClick={() => setCategoryFilter('all')} className="p-3 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px]" title="Clear filter"><X size={16} /></button>}
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
              <div className="glass-card rounded-xl p-6 sm:p-8 md:p-12 text-center">
                <Filter className="mx-auto text-muted-foreground mb-4" size={40} />
                <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">No expenses in this category</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">Try selecting a different category filter</p>
                <Button variant="outline" onClick={() => setCategoryFilter('all')} className="min-h-[44px]">Show All Expenses</Button>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-6 sm:p-8 md:p-12 text-center">
                <Receipt className="mx-auto text-muted-foreground mb-4" size={40} />
                <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">No expenses yet</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">Add your first expense to start tracking</p>
                <Button onClick={() => navigate(`/add-expense?groupId=${group.id}`)} className="min-h-[44px]"><Plus size={18} />Add Expense</Button>
              </div>
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
              <div className="glass-card rounded-xl p-12 text-center">
                <CheckCircle className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">No settlements yet</h3>
                <p className="text-muted-foreground mb-6">Record a settlement when members pay each other back</p>
                <Button onClick={() => setIsSettleDialogOpen(true)}><CheckCircle size={18} />Record Settlement</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Record Settlement</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Record a payment between group members to settle up</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Who paid?</Label>
              <Select value={settlePaidBy} onValueChange={(val) => { setSettlePaidBy(val); suggestAmount(); }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select payer" /></SelectTrigger>
                <SelectContent>
                  {group.members.map(memberId => (
                    <SelectItem key={memberId} value={memberId}>
                      {getUserProfile(memberId)?.name || 'Unknown'}{memberId === user?.id && ' (You)'}{(balances[memberId] || 0) < -0.01 && <span className="text-destructive ml-2">(owes ₹{Math.abs(balances[memberId] || 0).toFixed(0)})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Who received?</Label>
              <Select value={settlePaidTo} onValueChange={(val) => { setSettlePaidTo(val); suggestAmount(); }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select receiver" /></SelectTrigger>
                <SelectContent>
                  {group.members.filter(m => m !== settlePaidBy).map(memberId => (
                    <SelectItem key={memberId} value={memberId}>
                      {getUserProfile(memberId)?.name || 'Unknown'}{memberId === user?.id && ' (You)'}{(balances[memberId] || 0) > 0.01 && <span className="text-success ml-2">(gets ₹{(balances[memberId] || 0).toFixed(0)})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settleAmount" className="text-sm sm:text-base">Amount</Label>
              <Input id="settleAmount" type="number" placeholder="Enter amount" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} min="0" step="0.01" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Payment Method</Label>
              <div className="flex gap-2">
                <Button type="button" variant={paymentMethod === 'cash' ? 'default' : 'outline'} className="flex-1 min-h-[44px] h-auto text-sm" onClick={() => setPaymentMethod('cash')}>✓ Paid</Button>
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
                  💡 UPI payment unavailable - {getUserProfile(settlePaidTo)?.name} hasn't added their UPI ID yet
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settleDate" className="text-sm sm:text-base">Date</Label>
              <Input id="settleDate" type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className="min-h-[44px]" />
            </div>
            <Button onClick={handleSettle} className="w-full min-h-[44px] h-auto"><CheckCircle size={18} />Record Settlement</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Manage Members</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Invite new members by email or manage existing members</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4">
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm sm:text-base"><Link size={16} />Invite by Link</Label>
              <div className="space-y-2">
                {!inviteLink && !group?.inviteCode ? (
                  <Button 
                    onClick={handleGenerateInviteLink} 
                    disabled={isGeneratingLink}
                    variant="outline"
                    className="w-full min-h-[44px] h-auto"
                  >
                    <Link size={16} className="mr-2" />
                    {isGeneratingLink ? 'Generating...' : 'Generate Invite Link'}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      value={inviteLink || `${window.location.origin}/join/${group?.inviteCode}`} 
                      readOnly 
                      className="flex-1 font-mono text-xs sm:text-sm min-h-[44px]" 
                    />
                    <Button onClick={handleCopyInviteLink} variant="outline" className="min-h-[44px] min-w-[44px]">
                      {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Share this link with anyone to invite them to the group</p>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm sm:text-base"><UserPlus size={16} />Invite by Email</Label>
              <div className="flex gap-2">
                <Input type="email" placeholder="Enter email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInviteMember(); } }} className="flex-1 min-h-[44px]" />
                <Button onClick={handleInviteMember} disabled={!inviteEmail.trim()} className="min-h-[44px]"><Plus size={16} />Invite</Button>
              </div>
            </div>
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
                      {!isCreator && memberId !== user?.id && (user?.id === group.createdBy) && (
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
    </div>
  );
};

export default GroupDetail;
