import React, { useState, useMemo } from 'react';
import { CheckCircle2, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import SettlementCard from './SettlementCard';
import PersonDetailModal from './PersonDetailModal';
import CrossGroupSettlementModal from './CrossGroupSettlementModal';
import RepaymentRequestModal from './RepaymentRequestModal';
import { useSettlements } from '../../context/SettlementsContext';
import { useToast } from '../../hooks/use-toast';

/**
 * People Settlement View
 * Displays list of people with cross-group balances
 */
const PeopleSettlementView = ({
    people = [],
    loading = false,
}) => {
    const [filter, setFilter] = useState('all'); // 'all', 'theyOwe', 'iOwe'
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [settlePerson, setSettlePerson] = useState(null);
    const [personDetail, setPersonDetail] = useState(null);
    const [requestPerson, setRequestPerson] = useState(null);
    const [processingSettlements, setProcessingSettlements] = useState(new Set());
    // Comment 5: Store idempotency keys to prevent duplicates across retries
    const idempotencyKeysRef = React.useRef(new Map());
    
    const { updateRepaymentRequestStatus, createCrossGroupSettlement, createRepaymentRequest, fetchPeopleBalances } = useSettlements();
    const { toast } = useToast();

    // Filter and sort people
    const filteredPeople = useMemo(() => {
        let filtered = [...people];

        if (filter === 'theyOwe') {
            filtered = filtered.filter(p => p.netBalance > 0.01);
        } else if (filter === 'iOwe') {
            filtered = filtered.filter(p => p.netBalance < -0.01);
        }

        // Sort by absolute balance (largest first)
        return filtered.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
    }, [people, filter]);

    // Calculate summary stats
    const stats = useMemo(() => {
        const theyOwe = people
            .filter(p => p.netBalance > 0)
            .reduce((sum, p) => sum + p.netBalance, 0);
        const iOwe = people
            .filter(p => p.netBalance < 0)
            .reduce((sum, p) => sum + Math.abs(p.netBalance), 0);
        return { theyOwe, iOwe, net: theyOwe - iOwe };
    }, [people]);

    const handlePersonClick = (person) => {
        setSelectedPerson(person);
    };

    const handleSettle = async (person) => {
        // Comment 6: Handle edge case where pending request exists but balance is zero
        if (person.pendingRequest && Math.abs(person.netBalance) < 0.01) {
            toast({
                title: 'Balance Already Settled',
                description: 'This balance has been settled through other payments. The pending request will be auto-cancelled.',
                variant: 'default',
            });
            // Optionally auto-cancel the request here if cancelRepaymentRequest is available
            return;
        }

        // Check if person has positive balance (they owe you)
        if (person.netBalance > 0) {
            // Prevent duplicate submissions
            if (processingSettlements.has(person.userId)) {
                toast({
                    title: 'Processing',
                    description: 'Please wait, settlement is being processed...',
                    variant: 'default',
                });
                return;
            }

            // Mark paid flow
            try {
                // Add to processing set
                setProcessingSettlements(prev => new Set(prev).add(person.userId));

                const pendingRequest = person.pendingRequest;
                
                if (pendingRequest) {
                    // Comment 4: Check for balance discrepancy before marking paid
                    if (Math.abs(person.netBalance - pendingRequest.amount) > 0.01) {
                        toast({
                            title: 'Balance Changed',
                            description: `Balance has changed since request (₹${pendingRequest.amount.toFixed(2)} → ₹${person.netBalance.toFixed(2)}). Marking ₹${pendingRequest.amount.toFixed(2)} as paid.`,
                            variant: 'default',
                        });
                    }

                    // Comment 1 Fix: Mark paid on pending request should also create settlement to update balances
                    // First, create the cross-group settlement to update balances
                    let idempotencyKey = idempotencyKeysRef.current.get(person.userId);
                    if (!idempotencyKey) {
                        idempotencyKey = `mark-paid-request-${pendingRequest._id}-${Date.now()}`;
                        idempotencyKeysRef.current.set(person.userId, idempotencyKey);
                    }
                    
                    await createCrossGroupSettlement({
                        toUserId: person.userId,
                        amount: pendingRequest.amount,
                        isReceiverInitiated: true,
                        paymentMethod: 'cash',
                        paymentStatus: 'confirmed',
                        paymentNotes: `Payment received for repayment request #${pendingRequest._id}`,
                        idempotencyKey
                    });

                    // Then update the request status to settled
                    await updateRepaymentRequestStatus(
                        pendingRequest._id, 
                        'settled', 
                        pendingRequest.amount
                    );
                    
                    toast({
                        title: 'Payment marked as paid',
                        description: 'Balance updated. Email and notification sent.',
                    });

                    // Clear stored idempotency key after successful settlement
                    idempotencyKeysRef.current.delete(person.userId);

                    // Comment 4: Suggest creating another request if balance still remains
                    if (person.netBalance > pendingRequest.amount + 0.01) {
                        const remainingAmount = person.netBalance - pendingRequest.amount;
                        toast({
                            title: 'Remaining Balance',
                            description: `₹${remainingAmount.toFixed(2)} still owed. Create another request?`,
                            variant: 'default',
                        });
                    }
                } else {
                    // No pending request - directly record payment using cross-group settlement
                    // Comment 5: Use stored idempotency key or generate new one
                    let idempotencyKey = idempotencyKeysRef.current.get(person.userId);
                    if (!idempotencyKey) {
                        idempotencyKey = `mark-paid-${person.userId}-${Date.now()}`;
                        idempotencyKeysRef.current.set(person.userId, idempotencyKey);
                    }
                    
                    // Comment 106 in PeopleSettlementView: isReceiverInitiated means the current user
                    // (who is owed money) is confirming they received payment from toUserId
                    await createCrossGroupSettlement({
                        toUserId: person.userId,
                        amount: person.netBalance,
                        isReceiverInitiated: true,
                        paymentMethod: 'cash',
                        paymentStatus: 'confirmed',
                        paymentNotes: 'Payment received and recorded',
                        idempotencyKey
                    });
                    toast({
                        title: 'Payment recorded',
                        description: 'Payment has been marked as received.',
                    });

                    // Comment 5: Clear stored idempotency key after successful settlement
                    idempotencyKeysRef.current.delete(person.userId);
                }
                
                // Refresh balances
                await fetchPeopleBalances(true);
            } catch (error) {
                console.error('Error marking payment as paid:', error);
                toast({
                    title: 'Error',
                    description: error.message || 'Failed to mark payment as paid',
                    variant: 'destructive',
                });
            } finally {
                // Comment 12: Clear processing state immediately after request completes
                // No need for arbitrary delay - backend idempotency and button state provide sufficient protection
                setProcessingSettlements(prev => {
                    const next = new Set(prev);
                    next.delete(person.userId);
                    return next;
                });
            }
        } else {
            // Negative balance - open settlement modal for user to pay
            setSettlePerson(person);
        }
    };

    const handleRequest = (person) => {
        // Open RepaymentRequestModal for partial amount and message support
        setRequestPerson(person);
    };

    const handleDetailSettle = async (person, detail) => {
        // For positive balances, use the same direct Mark Paid logic
        if (person.netBalance > 0) {
            await handleSettle(person);
        } else {
            // For negative balances, open the settlement modal
            setPersonDetail(detail);
            setSettlePerson(person);
        }
    };

    const filterLabels = {
        all: 'All',
        theyOwe: 'They Owe Me',
        iOwe: 'I Owe Them',
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (people.length === 0) {
        return (
            <Card className="border-border shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
                        <CheckCircle2 className="text-success" size={40} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">All Settled Up!</h3>
                    <p className="text-muted-foreground max-w-sm">
                        You don't have any outstanding balances with anyone across your groups. Great job!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="border-border shadow-sm hover:border-primary/20 transition-colors duration-150">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-success mb-1">
                            <TrendingUp size={16} />
                            <span className="text-sm font-medium">You're Owed</span>
                        </div>
                        <p className="text-2xl font-bold text-success">
                            ₹{stats.theyOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border shadow-sm hover:border-primary/20 transition-colors duration-150">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-destructive mb-1">
                            <TrendingDown size={16} />
                            <span className="text-sm font-medium">You Owe</span>
                        </div>
                        <p className="text-2xl font-bold text-destructive">
                            ₹{stats.iOwe.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                    {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Filter size={14} />
                            {filterLabels[filter]}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setFilter('all')}>
                            All
                            {filter === 'all' && <Badge variant="secondary" className="ml-auto">✓</Badge>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter('theyOwe')}>
                            They Owe Me
                            {filter === 'theyOwe' && <Badge variant="secondary" className="ml-auto">✓</Badge>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter('iOwe')}>
                            I Owe Them
                            {filter === 'iOwe' && <Badge variant="secondary" className="ml-auto">✓</Badge>}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* People List */}
            <div className="space-y-3">
                {filteredPeople.map((person, index) => (
                    <div
                        key={person.userId}
                        className="animate-fade-in"
                        style={{ animationDelay: `${0.03 * index}s` }}
                    >
                        <SettlementCard
                            variant="person"
                            data={person}
                            onClick={() => handlePersonClick(person)}
                            onSettle={() => handleSettle(person)}
                            onRequestRepayment={() => handleRequest(person)}
                            requestStatus={person.requestStatus}
                            lastRequestAt={person.lastRequestAt}
                            isProcessing={processingSettlements.has(person.userId)}
                        />
                    </div>
                ))}
            </div>

            {/* Person Detail Modal */}
            <PersonDetailModal
                isOpen={!!selectedPerson}
                onClose={() => setSelectedPerson(null)}
                person={selectedPerson}
                onSettle={handleDetailSettle}
            />

            {/* Cross-Group Settlement Modal */}
            <CrossGroupSettlementModal
                isOpen={!!settlePerson}
                onClose={() => {
                    setSettlePerson(null);
                    setPersonDetail(null);
                    // Don't reopen - let user manually trigger if they want to make another payment
                }}
                person={settlePerson}
                personDetail={personDetail}
            />

            {/* Repayment Request Modal */}
            {requestPerson && (
                <RepaymentRequestModal
                    isOpen={!!requestPerson}
                    onClose={() => setRequestPerson(null)}
                    receiver={{
                        _id: requestPerson.userId,
                        name: requestPerson.name,
                        email: requestPerson.email,
                    }}
                    amount={requestPerson.netBalance}
                    groups={requestPerson.groupsInvolved?.map(g => ({
                        groupId: g.groupId,
                        groupName: g.groupName,
                        amount: g.balance
                    })) || []}
                    onSuccess={async () => {
                        setRequestPerson(null);
                        await fetchPeopleBalances(true);
                        toast({
                            title: 'Request sent',
                            description: 'Repayment request has been sent successfully.',
                        });
                    }}
                />
            )}
        </div>
    );
};

export default PeopleSettlementView;
