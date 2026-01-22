import React, { memo } from 'react';

/**
 * HowItWorksVisual - Displays different UI states based on the active step
 * Each step shows a different mockup of the app's functionality
 */
const HowItWorksVisual = memo(function HowItWorksVisual({ activeStep = 1 }) {
    return (
        <div
            className="relative w-full max-w-md min-h-[400px]"
            role="img"
            aria-label="Product demonstration showing the SplitIt app workflow"
            aria-hidden="true"
            tabIndex={-1}
        >
            {/* Step 1: Create Group */}
            <div
                className={`absolute inset-0 transition-all duration-500 ${activeStep === 1
                    ? 'opacity-100 z-10'
                    : 'opacity-0 z-0 pointer-events-none'
                    }`}
                aria-hidden={activeStep !== 1}
            >
                <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Create New Group</p>
                    </div>

                    {/* Group Form */}
                    <div className="p-4 space-y-4">
                        {/* Group Name Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Group Name</label>
                            <div className="px-3 py-2.5 border border-border rounded bg-background">
                                <span className="text-sm text-foreground">Goa Trip 2024</span>
                            </div>
                        </div>

                        {/* Member Avatars */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Members</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded bg-muted">
                                    <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center text-[10px] font-semibold">P</div>
                                    <span className="text-xs text-foreground">Priya</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded bg-muted">
                                    <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center text-[10px] font-semibold">A</div>
                                    <span className="text-xs text-foreground">Arjun</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded bg-muted">
                                    <div className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center text-[10px] font-semibold">R</div>
                                    <span className="text-xs text-foreground">Rahul</span>
                                </div>
                                <button className="w-7 h-7 border border-dashed border-border rounded flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Create Button */}
                        <button className="w-full bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm font-medium hover:opacity-90 transition-opacity">
                            Create Group
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 2: Add Expenses */}
            <div
                className={`absolute inset-0 transition-all duration-500 ${activeStep === 2
                    ? 'opacity-100 z-10'
                    : 'opacity-0 z-0 pointer-events-none'
                    }`}
                aria-hidden={activeStep !== 2}
            >
                <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Expense</p>
                    </div>

                    {/* Expense Form */}
                    <div className="p-4 space-y-4">
                        {/* Description Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Description</label>
                            <div className="px-3 py-2.5 border border-border rounded bg-background">
                                <span className="text-sm text-foreground">Beach Resort Booking</span>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Amount</label>
                            <div className="flex items-center px-3 py-2.5 border border-border rounded bg-background">
                                <span className="text-sm font-medium text-muted-foreground mr-1">₹</span>
                                <span className="text-sm font-semibold text-foreground">12,500.00</span>
                            </div>
                        </div>

                        {/* Category Selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Category</label>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-muted rounded text-foreground">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    <span className="text-xs font-medium">Stay</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-muted-foreground">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span className="text-xs font-medium">Food</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-muted-foreground">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    <span className="text-xs font-medium">Travel</span>
                                </div>
                            </div>
                        </div>

                        {/* Split Among */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Split equally among</label>
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-muted text-foreground border-2 border-card flex items-center justify-center text-[10px] font-semibold">P</div>
                                    <div className="w-6 h-6 rounded-full bg-muted text-foreground border-2 border-card flex items-center justify-center text-[10px] font-semibold">A</div>
                                    <div className="w-6 h-6 rounded-full bg-muted text-foreground border-2 border-card flex items-center justify-center text-[10px] font-semibold">R</div>
                                    <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-semibold text-foreground">Y</div>
                                </div>
                                <span className="text-xs text-muted-foreground">4 members · ₹3,125 each</span>
                            </div>
                        </div>

                        {/* Add Button */}
                        <button className="w-full bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm font-medium hover:opacity-90 transition-opacity">
                            Add Expense
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 3: Track Balances */}
            <div
                className={`absolute inset-0 transition-all duration-500 ${activeStep === 3
                    ? 'opacity-100 z-10'
                    : 'opacity-0 z-0 pointer-events-none'
                    }`}
                aria-hidden={activeStep !== 3}
            >
                <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goa Trip 2024</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                            4 members
                        </span>
                    </div>

                    {/* Expense Rows */}
                    <div className="divide-y divide-border">
                        <div className="px-4 py-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-foreground">Beach Resort Booking</p>
                                <p className="text-xs text-muted-foreground">Paid by You · 2 hours ago</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">₹12,500.00</p>
                                <p className="text-xs text-muted-foreground font-medium">Owed to you ₹9,375</p>
                            </div>
                        </div>

                        <div className="px-4 py-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-foreground">Taxi to Airport</p>
                                <p className="text-xs text-muted-foreground">Paid by Arjun · Yesterday</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">₹2,400.00</p>
                                <p className="text-xs text-accent font-medium">You owe ₹600</p>
                            </div>
                        </div>

                        <div className="px-4 py-3 flex justify-between items-center bg-muted/30">
                            <div>
                                <p className="text-sm font-medium text-foreground">Dinner at Fisherman's</p>
                                <p className="text-xs text-muted-foreground">Paid by Priya · 2 days ago</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">₹3,850.00</p>
                                <p className="text-xs text-accent font-medium">You owe ₹962.50</p>
                            </div>
                        </div>
                    </div>

                    {/* Balance Footer */}
                    <div className="px-4 py-3 bg-muted/50 border-t border-border flex justify-between items-center">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Net Balance</p>
                            <p className="text-lg font-bold text-accent">+₹7,812.50</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Expenses</p>
                            <p className="text-sm font-semibold text-foreground">₹18,750.00</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 4: Settle Up */}
            <div
                className={`absolute inset-0 transition-all duration-500 ${activeStep === 4
                    ? 'opacity-100 z-10'
                    : 'opacity-0 z-0 pointer-events-none'
                    }`}
                aria-hidden={activeStep !== 4}
            >
                <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-border bg-accent/10">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Settlement Summary</p>
                        </div>
                    </div>

                    {/* Settlement Content */}
                    <div className="p-4 space-y-4">
                        {/* Balance Summary */}
                        <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground mb-1">You are owed</p>
                            <p className="text-3xl font-bold text-accent">+₹7,812.50</p>
                            <p className="text-xs text-muted-foreground mt-1">from 3 members</p>
                        </div>

                        {/* Individual Settlements */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 border border-border rounded bg-background">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">A</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Arjun owes you</p>
                                        <p className="text-xs text-muted-foreground">₹2,604.17</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 bg-accent text-accent-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity">
                                    Request
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-border rounded bg-background">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">P</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Priya owes you</p>
                                        <p className="text-xs text-muted-foreground">₹2,604.17</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 bg-accent text-accent-foreground rounded text-xs font-medium hover:opacity-90 transition-opacity">
                                    Request
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-border rounded bg-background">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-semibold">R</div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Rahul owes you</p>
                                        <p className="text-xs text-accent font-medium">₹2,604.16</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-accent text-xs font-medium">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Paid
                                </div>
                            </div>
                        </div>

                        {/* UPI Settlement Button */}
                        <button className="w-full bg-primary text-primary-foreground px-4 py-3 rounded text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Settle All via UPI
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default HowItWorksVisual;
