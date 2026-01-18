import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/common/SEO';
import { Button } from '../components/ui/button';
import Logo from '../components/common/Logo';
import HowItWorksVisual from '../components/common/HowItWorksVisual';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ChevronDown, MessageCircle, Shield } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // Refs for step elements (for IntersectionObserver)
  const stepRefs = useRef([]);
  const setStepRef = useCallback((el, index) => {
    stepRefs.current[index] = el;
  }, []);

  // Set up IntersectionObserver for step detection
  useEffect(() => {
    const observerOptions = {
      threshold: 0.5,
      rootMargin: '-20% 0px -20% 0px'
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const stepNumber = parseInt(entry.target.dataset.step, 10);
          if (stepNumber) {
            // Use functional update to avoid stale closure and prevent redundant updates
            setActiveStep(prevStep => prevStep !== stepNumber ? stepNumber : prevStep);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    stepRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []); // Empty dependency array - observer runs once and stays stable

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Show floating CTA when scrolled past hero
  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingCTA(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-xl mx-auto">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              size="sm"
              className="min-h-[40px] text-sm text-muted-foreground hover:text-foreground"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate('/signup')}
              size="sm"
              className="min-h-[40px] text-sm"
            >
              Join
            </Button>
          </div>
        </div>
      </header>

      {/* Announcement Banner */}
      <div className="bg-accent/5 border-b border-accent/20">
        <div className="px-4 py-2 max-w-screen-xl mx-auto flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
          <p className="text-xs text-accent font-medium">New: Instant UPI settlements now live</p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b border-border">
        <div className="px-4 py-16 lg:py-20 max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16">
            {/* Hero Text */}
            <div className="flex flex-col gap-4 lg:flex-1">
              <h1 className="font-display text-4xl lg:text-5xl font-bold leading-[1.1] text-foreground max-w-[340px]">
                Shared money, handled properly.
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-[360px]">
                The platform for group expenses. No spreadsheets, no awkward conversations, just clarity.
              </p>
              <div className="mt-2">
                <Button
                  onClick={() => navigate('/signup')}
                  className="text-sm font-medium px-6 py-3 h-auto"
                >
                  Get Started
                </Button>
              </div>
            </div>

            {/* Product Mockup */}
            <div className="mt-4 lg:mt-0 lg:flex-1">
              <div className="bg-card border border-border rounded overflow-hidden max-w-sm mx-auto lg:ml-auto">
                {/* Card Header */}
                <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goa Trip - Dec 2024</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    Active
                  </span>
                </div>

                {/* Expense Rows */}
                <div className="divide-y divide-border">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-foreground">Swiggy Order</p>
                      <p className="text-xs text-muted-foreground">Paid by Priya · 2 hours ago</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">₹575.00</p>
                      <p className="text-xs text-accent font-medium">You owe ₹287.50</p>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-foreground">Rent (January)</p>
                      <p className="text-xs text-muted-foreground">Paid by You · Yesterday</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">₹36,000.00</p>
                      <p className="text-xs text-muted-foreground font-medium">Owed to you ₹18,000.00</p>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex justify-between items-center bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">Electricity Bill</p>
                      <p className="text-xs text-muted-foreground">Paid by Arjun · 3 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">₹1,236.99</p>
                      <p className="text-xs text-accent font-medium">You owe ₹412.33</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-primary flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-primary-foreground/60">Net Balance</p>
                    <p className="text-lg font-bold text-primary-foreground">+₹17,300.17</p>
                  </div>
                  <button className="bg-accent text-accent-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity">
                    Settle Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators Section */}
      <section className="bg-background border-b border-border">
        <div className="px-4 py-8 max-w-screen-xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-border rounded bg-card text-center">
              <p className="text-2xl font-bold text-foreground">10,000+</p>
              <p className="text-xs text-muted-foreground">Groups Created</p>
            </div>
            <div className="p-4 border border-border rounded bg-card text-center">
              <p className="text-2xl font-bold text-foreground">₹50L+</p>
              <p className="text-xs text-muted-foreground">Settled</p>
            </div>
            <div className="p-4 border border-border rounded bg-card text-center">
              <p className="text-2xl font-bold text-foreground">99.9%</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="p-4 border border-border rounded bg-card text-center">
              <p className="text-2xl font-bold text-foreground">4.8★</p>
              <p className="text-xs text-muted-foreground">User Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-card border-b border-border">
        <div className="px-4 py-12 lg:py-16 max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
                Spreadsheets aren't for friends.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                Manual tracking creates friction, awkward conversations, and calculation errors. Stop being the unpaid group accountant.
              </p>
            </div>

            {/* Feature Cards - Expanded to 6 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Real-time Balances</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Every expense logged is immediately reconciled. No waiting for end-of-month summaries.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Instant Settlement</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Integrated UPI payments for one-tap settlement. Clear your debt before you leave the restaurant.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Audit-style Clarity</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Full transaction history with receipt attachments. Professional reporting for peace of mind.</p>
                  </div>
                </div>
              </div>

              {/* New Feature Cards */}
              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Smart Split Algorithms</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Percentage, exact amount, or custom splits. Handle any expense scenario with precision.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Receipt Scanning</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">OCR technology for automatic expense entry. Just snap a photo and we do the rest.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border border-border rounded bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Multi-Currency Support</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Handle international trips and expenses. Automatic conversion at real-time rates.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-background border-b border-border" aria-label="How it works">
        <div className="px-4 py-12 lg:py-16 max-w-screen-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-8">How it works</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Left Column: Steps */}
            <div className="flex flex-col gap-6 max-w-xl" aria-live="polite">
              {/* Step 1 */}
              <div
                className="flex gap-4"
                ref={(el) => setStepRef(el, 0)}
                data-step="1"
                aria-current={activeStep === 1 ? 'step' : undefined}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full border ${activeStep === 1 ? 'border-accent bg-accent/10 text-accent' : 'border-foreground text-foreground bg-card'} flex items-center justify-center text-sm font-semibold transition-colors duration-300`}>1</div>
                  <div className="w-px bg-border flex-1 mt-2"></div>
                </div>
                <div className="pb-6">
                  <h3 className="text-base font-semibold text-foreground mb-1">Create Group</h3>
                  <p className="text-sm text-muted-foreground">Create a shared space for trips, rent, or recurring house bills in under 30 seconds.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className="flex gap-4"
                ref={(el) => setStepRef(el, 1)}
                data-step="2"
                aria-current={activeStep === 2 ? 'step' : undefined}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full border ${activeStep === 2 ? 'border-accent bg-accent/10 text-accent' : 'border-foreground text-foreground bg-card'} flex items-center justify-center text-sm font-semibold transition-colors duration-300`}>2</div>
                  <div className="w-px bg-border flex-1 mt-2"></div>
                </div>
                <div className="pb-6">
                  <h3 className="text-base font-semibold text-foreground mb-1">Add Expenses</h3>
                  <p className="text-sm text-muted-foreground">Log expenses quickly. Split equally or customize per person. Add receipts too.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className="flex gap-4"
                ref={(el) => setStepRef(el, 2)}
                data-step="3"
                aria-current={activeStep === 3 ? 'step' : undefined}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full border ${activeStep === 3 ? 'border-accent bg-accent/10 text-accent' : 'border-foreground text-foreground bg-card'} flex items-center justify-center text-sm font-semibold transition-colors duration-300`}>3</div>
                  <div className="w-px bg-border flex-1 mt-2"></div>
                </div>
                <div className="pb-6">
                  <h3 className="text-base font-semibold text-foreground mb-1">Track Balances</h3>
                  <p className="text-sm text-muted-foreground">Watch the ledger update in real-time. Everyone sees who's paid and who owes.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div
                className="flex gap-4"
                ref={(el) => setStepRef(el, 3)}
                data-step="4"
                aria-current={activeStep === 4 ? 'step' : undefined}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full ${activeStep === 4 ? 'bg-accent' : 'bg-accent/80'} flex items-center justify-center transition-colors duration-300`}>
                    <svg className="w-4 h-4 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Settle Up</h3>
                  <p className="text-sm text-muted-foreground">Settle via UPI with one tap. Debts cleared, friendships intact.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Visual */}
            <div className="hidden lg:block sticky top-24 self-start">
              <HowItWorksVisual activeStep={activeStep} />
            </div>
          </div>

          {/* Mobile Visual (shown below steps on smaller screens) */}
          <div className="mt-8 lg:hidden flex justify-center">
            <div className="max-w-sm w-full">
              <HowItWorksVisual activeStep={activeStep} />
            </div>
          </div>
        </div>
      </section>


      {/* Use Cases Section */}
      <section className="bg-card border-b border-border">
        <div className="px-4 py-12 lg:py-16 max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
                Built for every shared expense scenario
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                Whether it's daily bills or once-in-a-lifetime trips, Split-It adapts to your needs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 border border-border rounded bg-background">
                <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Roommate Expenses</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Monthly rent splitting</li>
                  <li>• Utility bills tracking</li>
                  <li>• Shared grocery costs</li>
                </ul>
              </div>

              <div className="p-6 border border-border rounded bg-background">
                <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Trip Planning</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Group vacations</li>
                  <li>• Weekend getaways</li>
                  <li>• International travel</li>
                </ul>
              </div>

              <div className="p-6 border border-border rounded bg-background">
                <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Event Management</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Birthday parties & celebrations</li>
                  <li>• Group dinners</li>
                  <li>• Office team outings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Enhanced */}
      <section className="bg-background border-b border-border">
        <div className="px-4 py-10 lg:py-12 max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Audit Standard Card */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h2 className="text-sm font-semibold text-foreground">The Audit Standard</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-4 bg-muted/30 rounded border border-border">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Exports</p>
                  <p className="text-xl font-bold text-foreground">CSV/PDF</p>
                  <p className="text-xs text-accent font-medium mt-1">Ready anytime</p>
                </div>
                <div className="p-4 bg-muted/30 rounded border border-border">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Accuracy</p>
                  <p className="text-xl font-bold text-foreground">100.0%</p>
                  <p className="text-xs text-accent font-medium mt-1">Precise splits</p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded border border-border flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Weekly Summary</p>
                  <p className="text-sm font-semibold text-foreground">Automated Ledger</p>
                </div>
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </div>

            {/* Platform Metrics Card */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <h2 className="text-sm font-semibold text-foreground">Platform Metrics</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-4 bg-muted/30 rounded border border-border">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Active Users</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-foreground">5,234</p>
                    <span className="text-xs text-accent font-medium flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      12%
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded border border-border">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Avg. Settlement</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-foreground">2.3s</p>
                    <span className="text-xs text-accent font-medium flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Fast
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded border border-border flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">This Month</p>
                  <p className="text-sm font-semibold text-foreground">847 New Groups</p>
                </div>
                <span className="text-xs text-accent font-medium flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  23%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="bg-card border-b border-border">
        <div className="px-4 py-12 lg:py-16 max-w-screen-xl mx-auto">
          <div className="flex flex-col gap-8">
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
              Why Split-It?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Manual Tracking */}
              <div className="p-6 border border-border rounded bg-background">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Manual Tracking</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Spreadsheets get outdated quickly
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Calculator errors cause disputes
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Awkward payment reminders
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    No receipt or history tracking
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Settlement delays
                  </li>
                </ul>
              </div>

              {/* Split-It */}
              <div className="p-6 border border-accent/30 rounded bg-accent/5">
                <h3 className="text-sm font-semibold text-accent uppercase tracking-wide mb-4">Split-It</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-sm text-foreground">
                    <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Real-time sync across all members
                  </li>
                  <li className="flex items-start gap-3 text-sm text-foreground">
                    <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    100% accurate split calculations
                  </li>
                  <li className="flex items-start gap-3 text-sm text-foreground">
                    <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Automated polite reminders
                  </li>
                  <li className="flex items-start gap-3 text-sm text-foreground">
                    <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Full audit trail with receipts
                  </li>
                  <li className="flex items-start gap-3 text-sm text-foreground">
                    <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    One-tap UPI settlement
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section - Expanded */}
      <section className="bg-primary">
        <div className="px-4 py-16 lg:py-20 max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-6 h-6 text-primary-foreground opacity-40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <p className="text-primary-foreground text-base font-medium leading-relaxed mb-4">
                "Split-It provides clarity over conversation. We no longer have to 'discuss' money; the app just tells us the truth."
              </p>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-full mb-2 flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  AM
                </div>
                <p className="text-primary-foreground font-medium text-sm">Asish Mohanty</p>
                <p className="text-primary-foreground/60 text-xs">Cuttack</p>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-6 h-6 text-primary-foreground opacity-40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <p className="text-primary-foreground text-base font-medium leading-relaxed mb-4">
                "Our Goa trip had 15 people and 50+ expenses. Split-It made it effortless. We settled up before landing back home."
              </p>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-full mb-2 flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  SS
                </div>
                <p className="text-primary-foreground font-medium text-sm">Subham Sethy</p>
                <p className="text-primary-foreground/60 text-xs">Bhubaneswar</p>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-6 h-6 text-primary-foreground opacity-40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
              </div>
              <p className="text-primary-foreground text-base font-medium leading-relaxed mb-4">
                "As a student, every rupee matters. Split-It helps our hostel friends stay fair without any drama."
              </p>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-full mb-2 flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  SJ
                </div>
                <p className="text-primary-foreground font-medium text-sm">Sumit Kumar Jena</p>
                <p className="text-primary-foreground/60 text-xs">Bhubaneswar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-card border-b border-border">
        <div className="px-4 py-16 lg:py-20 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
            {/* Left Column - FAQ Accordion */}
            <div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-muted-foreground mt-2 mb-10 lg:mb-12">
                Everything you need to know about Split-It
              </p>

              <div className="space-y-3">
                <Collapsible className="border border-border rounded-lg bg-background overflow-hidden">
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-5 text-left hover:bg-muted/30 transition-all duration-200 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                    <span className="text-base font-semibold text-foreground pr-8">Is Split-It free to use?</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border bg-muted/20">
                    <div className="pt-4">
                      Yes, Split-It is completely free for personal use. Create unlimited groups, add unlimited expenses, and settle with no transaction fees.
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="border border-border rounded-lg bg-background overflow-hidden">
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-5 text-left hover:bg-muted/30 transition-all duration-200 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                    <span className="text-base font-semibold text-foreground pr-8">How secure is my financial data?</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border bg-muted/20">
                    <div className="pt-4">
                      We use bank-grade encryption for all data. Your UPI transactions go directly through your bank's secure gateway. We never store payment credentials.
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="border border-border rounded-lg bg-background overflow-hidden">
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-5 text-left hover:bg-muted/30 transition-all duration-200 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                    <span className="text-base font-semibold text-foreground pr-8">Can I use Split-It offline?</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border bg-muted/20">
                    <div className="pt-4">
                      You can view your existing groups and balances offline. New expenses sync automatically when you're back online.
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="border border-border rounded-lg bg-background overflow-hidden">
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-5 text-left hover:bg-muted/30 transition-all duration-200 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                    <span className="text-base font-semibold text-foreground pr-8">How do UPI settlements work?</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border bg-muted/20">
                    <div className="pt-4">
                      When you settle, we generate a UPI payment link with the exact amount. Tap to pay via any UPI app (GPay, PhonePe, Paytm). The transaction is instant.
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="border border-border rounded-lg bg-background overflow-hidden">
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-5 text-left hover:bg-muted/30 transition-all duration-200 data-[state=open]:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                    <span className="text-base font-semibold text-foreground pr-8">What if someone doesn't have Split-It?</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border bg-muted/20">
                    <div className="pt-4">
                      You can add anyone to a group using their email. They'll receive an invite to sign up. Until then, you can still track their share of expenses.
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {/* Right Column - Supporting Content */}
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* Support Contact Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-base font-semibold">Still have questions?</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-muted-foreground">
                    Our support team is here to help you get the most out of Split-It.
                  </CardDescription>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.href = 'mailto:notifications.splitit@gmail.com'}
                  >
                    Contact Support
                  </Button>
                </CardFooter>
              </Card>

              {/* Security Reassurance Card */}
              <Card className="bg-accent/5 border-accent/20 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-accent" />
                  <h4 className="font-semibold text-base text-foreground">Bank-grade security</h4>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    256-bit encryption
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    SOC 2 compliant
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    Regular security audits
                  </li>
                </ul>
                <Badge variant="success" className="mt-2">Verified Secure</Badge>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Professional Grid Layout */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-screen-xl mx-auto px-4 py-10">
          {/* Main Grid: 5 columns on desktop, 2 on tablet, 1 on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-10 lg:gap-12 items-start">

            {/* Column 1: Brand Identity */}
            <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-1">
              <Logo size="sm" />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Engineered for financial transparency between friends.
              </p>
            </div>

            {/* Column 2: Product Links */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">Product</p>
              <div className="flex flex-col space-y-3">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Features</Link>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Security</Link>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Pricing</Link>
              </div>
            </div>

            {/* Column 3: Company Links */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">Company</p>
              <div className="flex flex-col space-y-3">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">About</Link>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Contact</Link>
              </div>
            </div>

            {/* Column 4: Resources Links */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">Resources</p>
              <div className="flex flex-col space-y-3">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Blog</Link>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">Help Center</Link>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors leading-relaxed">API Docs</Link>
              </div>
            </div>

            {/* Column 5: Newsletter + Social + CTA */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              {/* Newsletter Section */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-1">Stay updated</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <Button size="sm" className="px-4 text-sm">Subscribe</Button>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4 py-2">
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="X (Twitter)">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </button>
              </div>

              {/* CTA Section */}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">Ready to automate your group finances?</p>
                <Button
                  onClick={() => navigate('/signup')}
                  className="w-full sm:w-auto text-sm"
                >
                  Get Started for Free
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom: Copyright & Legal */}
          <div className="pt-8 mt-8 border-t border-border">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-6">
                <Link to="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
                <Link to="/terms-of-service" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
              </div>
              <p className="text-xs text-muted-foreground">© 2026 Split-It. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating CTA Button - Mobile Only */}
      {showFloatingCTA && (
        <div className="fixed bottom-6 left-4 right-4 md:hidden z-40 safe-area-inset-bottom">
          <Button
            onClick={() => navigate('/signup')}
            className="w-full shadow-lg text-sm font-medium py-3 h-auto"
          >
            Get Started
          </Button>
        </div>
      )}
    </div>
  );
};

export default Index;
