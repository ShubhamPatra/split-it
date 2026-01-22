import React, { useState } from 'react';
import { 
    Clock, 
    CheckCircle, 
    XCircle, 
    AlertCircle, 
    ChevronDown, 
    ChevronUp,
    Calendar,
    MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const RequestHistoryTimeline = ({ requests }) => {
    const [expandedItems, setExpandedItems] = useState(new Set());

    if (!requests || requests.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No request history available</p>
            </div>
        );
    }

    const getStatusConfig = (status) => {
        const configs = {
            pending: {
                icon: Clock,
                color: 'text-amber-600',
                bgColor: 'bg-amber-100',
                borderColor: 'border-amber-200',
                label: 'Pending'
            },
            partially_paid: {
                icon: AlertCircle,
                color: 'text-blue-600',
                bgColor: 'bg-blue-100',
                borderColor: 'border-blue-200',
                label: 'Partially Paid'
            },
            settled: {
                icon: CheckCircle,
                color: 'text-green-600',
                bgColor: 'bg-green-100',
                borderColor: 'border-green-200',
                label: 'Settled'
            },
            cancelled: {
                icon: XCircle,
                color: 'text-gray-600',
                bgColor: 'bg-gray-100',
                borderColor: 'border-gray-200',
                label: 'Cancelled'
            }
        };
        return configs[status] || configs.pending;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const toggleExpanded = (requestId) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(requestId)) {
            newExpanded.delete(requestId);
        } else {
            newExpanded.add(requestId);
        }
        setExpandedItems(newExpanded);
    };

    const sortedRequests = [...requests].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    return (
        <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-700 mb-4">Request History</h4>
            
            <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                {/* Timeline Items */}
                {sortedRequests.map((request, index) => {
                    const statusConfig = getStatusConfig(request.status);
                    const Icon = statusConfig.icon;
                    const isExpanded = expandedItems.has(request._id);
                    
                    return (
                        <div key={request._id} className="relative flex items-start mb-6 last:mb-0">
                            {/* Timeline Dot */}
                            <div className={cn(
                                'relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2',
                                statusConfig.bgColor,
                                statusConfig.borderColor
                            )}>
                                <Icon className={cn('h-5 w-5', statusConfig.color)} />
                            </div>
                            
                            {/* Request Content */}
                            <div className="ml-4 flex-1">
                                <Card className={cn('transition-all duration-200', statusConfig.borderColor)}>
                                    <CardContent className="p-4">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}>
                                                    {statusConfig.label}
                                                </Badge>
                                                <div className="flex items-center text-xs text-gray-500">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    {formatDate(request.requestedAt)}
                                                </div>
                                            </div>
                                            
                                            {request.message && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleExpanded(request._id)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                        
                                        {/* Amount and Requester Info */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Amount:</span>
                                                <span className="font-semibold text-lg">₹{request.amount.toFixed(2)}</span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Requested by:</span>
                                                <span className="text-sm font-medium">
                                                    {request.requesterId?.name || 'Unknown'}
                                                </span>
                                            </div>
                                            
                                            {request.settledAmount > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">Settled:</span>
                                                    <span className="text-sm font-medium text-green-600">
                                                        ₹{request.settledAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                                                {/* Message */}
                                                {request.message && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <MessageSquare className="h-4 w-4 text-gray-500" />
                                                            <span className="text-sm font-medium text-gray-700">Message:</span>
                                                        </div>
                                                        <div className="bg-gray-50 rounded-lg p-3">
                                                            <p className="text-sm text-gray-600 italic">
                                                                "{request.message}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Groups */}
                                                {request.relatedGroups && request.relatedGroups.length > 0 && (
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">Groups:</span>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {request.relatedGroups.map((group) => (
                                                                <Badge key={group._id} variant="secondary" className="text-xs">
                                                                    {group.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Group Breakdown */}
                                                {request.groupBreakdown && request.groupBreakdown.length > 0 && (
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">Breakdown:</span>
                                                        <div className="mt-2 space-y-1">
                                                            {request.groupBreakdown.map((breakdown, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs bg-gray-50 rounded p-2">
                                                                    <span className="text-gray-600">
                                                                        {breakdown.groupId?.name || `Group ${idx + 1}`}
                                                                    </span>
                                                                    <span className="font-medium">₹{breakdown.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Status Timeline */}
                                                <div>
                                                    <span className="text-sm font-medium text-gray-700">Status Timeline:</span>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                            <span>Requested: {formatDate(request.requestedAt)}</span>
                                                        </div>
                                                        {request.settledAt && (
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                <span>Settled: {formatDate(request.settledAt)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RequestHistoryTimeline;
