import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';
import { getSocket } from '../lib/socketClient';

const SettlementsContext = createContext();

export const useSettlements = () => {
    const context = useContext(SettlementsContext);
    if (!context) {
        throw new Error('useSettlements must be used within a SettlementsProvider');
    }
    return context;
};

export const SettlementsProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [peopleBalances, setPeopleBalances] = useState({ people: [], totalPeople: 0 });
    const [groupBalances, setGroupBalances] = useState([]);
    const [repaymentRequests, setRepaymentRequests] = useState({});
    const [loading, setLoading] = useState({
        people: false,
        groups: false,
        personDetail: false,
        settlement: false,
        repaymentRequest: false,
    });
    const [error, setError] = useState({
        people: null,
        groups: null,
        personDetail: null,
        settlement: null,
        repaymentRequest: null,
    });

    // Fetch cross-group people balances
    const fetchPeopleBalances = useCallback(async (forceRefresh = false) => {
        if (!isAuthenticated) return;

        setLoading(prev => ({ ...prev, people: true }));
        setError(prev => ({ ...prev, people: null }));

        try {
            const url = forceRefresh ? '/settlements/people?forceRefresh=true' : '/settlements/people';
            const data = await apiClient.get(url);
            setPeopleBalances(data);
            return data;
        } catch (err) {
            const message = err.message || 'Failed to fetch people balances';
            setError(prev => ({ ...prev, people: message }));
            console.error('Error fetching people balances:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, people: false }));
        }
    }, [isAuthenticated]);

    // Fetch group balances
    const fetchGroupBalances = useCallback(async () => {
        if (!isAuthenticated) return;

        setLoading(prev => ({ ...prev, groups: true }));
        setError(prev => ({ ...prev, groups: null }));

        try {
            const data = await apiClient.get('/settlements/groups');
            setGroupBalances(data);
            return data;
        } catch (err) {
            const message = err.message || 'Failed to fetch group balances';
            setError(prev => ({ ...prev, groups: message }));
            console.error('Error fetching group balances:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, groups: false }));
        }
    }, [isAuthenticated]);

    // Fetch detailed balance with a specific person
    const fetchPersonDetail = useCallback(async (otherUserId) => {
        if (!isAuthenticated || !otherUserId) return null;

        setLoading(prev => ({ ...prev, personDetail: true }));
        setError(prev => ({ ...prev, personDetail: null }));

        try {
            const data = await apiClient.get(`/settlements/people/${otherUserId}`);
            return data;
        } catch (err) {
            const message = err.message || 'Failed to fetch person balance';
            setError(prev => ({ ...prev, personDetail: message }));
            console.error('Error fetching person detail:', err);
            return null;
        } finally {
            setLoading(prev => ({ ...prev, personDetail: false }));
        }
    }, [isAuthenticated]);

    // Create cross-group settlement
    const createCrossGroupSettlement = useCallback(async (settlementData) => {
        if (!isAuthenticated) return null;

        // Client-side validation
        if (!settlementData.toUserId) {
            const error = new Error('Recipient user ID is required');
            console.error('[SettlementsContext] Validation error:', error.message);
            throw error;
        }

        if (!settlementData.amount || typeof settlementData.amount !== 'number' || settlementData.amount <= 0) {
            const error = new Error('Valid positive amount is required');
            console.error('[SettlementsContext] Validation error:', error.message);
            throw error;
        }

        console.log('[SettlementsContext] Creating cross-group settlement:', {
            toUserId: settlementData.toUserId,
            amount: settlementData.amount,
            isReceiverInitiated: settlementData.isReceiverInitiated
        });

        setLoading(prev => ({ ...prev, settlement: true }));
        setError(prev => ({ ...prev, settlement: null }));

        try {
            const data = await apiClient.post('/settlements/cross-group', settlementData);
            console.log('[SettlementsContext] Settlement created successfully');
            // Refresh people balances after successful settlement
            await fetchPeopleBalances(true);
            return data;
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to create settlement';
            console.error('[SettlementsContext] Error creating cross-group settlement:', {
                message,
                status: err.response?.status,
                data: err.response?.data
            });
            setError(prev => ({ ...prev, settlement: message }));
            throw err;
        } finally {
            setLoading(prev => ({ ...prev, settlement: false }));
        }
    }, [isAuthenticated, fetchPeopleBalances]);



    // Create repayment request
    const createRepaymentRequest = useCallback(async (receiverId, amount, message, relatedGroups, groupBreakdown) => {
        if (!isAuthenticated) return null;

        setLoading(prev => ({ ...prev, repaymentRequest: true }));
        setError(prev => ({ ...prev, repaymentRequest: null }));

        try {
            const data = await apiClient.post('/settlements/repayment-request', {
                receiverId,
                amount,
                message,
                relatedGroups,
                groupBreakdown,
            });
            
            return data;
        } catch (err) {
            setError(prev => ({ ...prev, repaymentRequest: err.message || 'Failed to create repayment request' }));
            console.error('Error creating repayment request:', err);
            throw err;
        } finally {
            setLoading(prev => ({ ...prev, repaymentRequest: false }));
        }
    }, [isAuthenticated]);

    // Fetch repayment request history with specific person
    const fetchRepaymentHistory = useCallback(async (otherUserId) => {
        if (!isAuthenticated || !otherUserId) return null;

        try {
            const data = await apiClient.get(`/settlements/repayment-request/history/${otherUserId}`);
            return data;
        } catch (err) {
            console.error('Error fetching repayment history:', err);
            return null;
        }
    }, [isAuthenticated]);

    // Cancel repayment request
    const cancelRepaymentRequest = useCallback(async (requestId) => {
        if (!isAuthenticated) return null;

        try {
            const data = await apiClient.delete(`/settlements/repayment-request/${requestId}`);
            return data;
        } catch (err) {
            const message = err.message || 'Failed to cancel repayment request';
            console.error('Error cancelling repayment request:', err);
            throw err;
        }
    }, [isAuthenticated]);

    // Get my repayment requests
    const fetchMyRepaymentRequests = useCallback(async () => {
        if (!isAuthenticated) return null;

        try {
            const data = await apiClient.get('/settlements/repayment-request/my-requests');
            setRepaymentRequests(data);
            return data;
        } catch (err) {
            console.error('Error fetching my repayment requests:', err);
            return null;
        }
    }, [isAuthenticated]);

    // Update repayment request status
    const updateRepaymentRequestStatus = useCallback(async (requestId, status, settledAmount) => {
        if (!isAuthenticated) return null;

        try {
            const data = await apiClient.patch(`/settlements/repayment-request/${requestId}/status`, {
                status,
                settledAmount,
            });
            
            // Refresh balances after successful update
            await fetchPeopleBalances(true);
            
            return data;
        } catch (err) {
            const message = err.message || 'Failed to update repayment request status';
            console.error('Error updating repayment request status:', err);
            throw err;
        }
    }, [isAuthenticated, fetchPeopleBalances]);

    // Refresh all balances
    const refreshBalances = useCallback(async () => {
        await Promise.all([
            fetchPeopleBalances(true),
            fetchGroupBalances(),
        ]);
    }, [fetchPeopleBalances, fetchGroupBalances]);

    // Socket event listeners
    useEffect(() => {
        if (!isAuthenticated || !user?._id) return;

        const socket = getSocket();
        if (!socket) return;

        // Debounce utility for socket-triggered refreshes (Comment 9)
        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        };

        // Debounced refresh handlers to prevent multiple rapid refreshes
        const debouncedRefreshPeople = debounce(() => fetchPeopleBalances(true), 500);
        const debouncedRefreshGroups = debounce(() => fetchGroupBalances(), 500);

        // Listen for people balance updates
        const handlePeopleBalanceUpdate = (data) => {
            setPeopleBalances(data);
        };

        // Listen for cross-group settlement created
        const handleCrossGroupSettlement = () => {
            // Refresh balances when a cross-group settlement is created
            debouncedRefreshPeople();
            debouncedRefreshGroups();
        };

        // Listen for balance updates (in-group)
        const handleBalanceUpdate = () => {
            // Refresh group balances when any balance changes
            debouncedRefreshGroups();
        };

        socket.on('people:balance:update', handlePeopleBalanceUpdate);
        socket.on('settlement:crossGroup:created', handleCrossGroupSettlement);
        socket.on('settlement:crossGroup:confirmed', handleCrossGroupSettlement);
        socket.on('balance:update', handleBalanceUpdate);

        return () => {
            socket.off('people:balance:update', handlePeopleBalanceUpdate);
            socket.off('settlement:crossGroup:created', handleCrossGroupSettlement);
            socket.off('settlement:crossGroup:confirmed', handleCrossGroupSettlement);
            socket.off('balance:update', handleBalanceUpdate);
        };
    }, [isAuthenticated, user?._id, fetchPeopleBalances, fetchGroupBalances]);

    const value = {
        peopleBalances,
        groupBalances,
        repaymentRequests,
        loading,
        error,
        fetchPeopleBalances,
        fetchGroupBalances,
        fetchPersonDetail,
        createCrossGroupSettlement,
        createRepaymentRequest,
        fetchRepaymentHistory,
        cancelRepaymentRequest,
        fetchMyRepaymentRequests,
        updateRepaymentRequestStatus,
        refreshBalances,
    };

    return (
        <SettlementsContext.Provider value={value}>
            {children}
        </SettlementsContext.Provider>
    );
};

export default SettlementsContext;
