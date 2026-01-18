import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Bell, Share2, Trash2, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import Logo from '../components/common/Logo';
import SEO from '../components/common/SEO';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Database,
      title: 'Information We Collect',
      content: [
        'Account information (name, email address, profile picture)',
        'Financial data (expenses, settlements, payment information)',
        'Usage data (app interactions, features used)',
        'Device information (device type, operating system, browser)',
        'Location data (only when explicitly permitted for currency detection)'
      ]
    },
    {
      icon: Eye,
      title: 'How We Use Your Information',
      content: [
        'To provide and maintain our expense splitting services',
        'To process transactions and send related notifications',
        'To personalize your experience and improve our services',
        'To communicate with you about updates, features, and support',
        'To detect, prevent, and address technical issues or fraud'
      ]
    },
    {
      icon: Share2,
      title: 'Information Sharing',
      content: [
        'With group members: expense details and balances within shared groups',
        'With service providers: necessary data for app functionality (hosting, analytics)',
        'For legal compliance: when required by law or to protect our rights',
        'We never sell your personal information to third parties'
      ]
    },
    {
      icon: Lock,
      title: 'Data Security',
      content: [
        'Industry-standard encryption for data in transit and at rest',
        'Secure authentication with password hashing',
        'Regular security audits and vulnerability assessments',
        'Access controls limiting employee access to user data',
        'Secure cloud infrastructure with redundant backups'
      ]
    },
    {
      icon: Bell,
      title: 'Notifications & Communications',
      content: [
        'Push notifications for expense updates and settlements (optional)',
        'Email notifications for important account activities',
        'Marketing communications (with your consent, easily unsubscribable)',
        'You can manage notification preferences in your account settings'
      ]
    },
    {
      icon: Trash2,
      title: 'Data Retention & Deletion',
      content: [
        'We retain your data while your account is active',
        'You can request data export at any time',
        'Account deletion removes your personal data within 30 days',
        'Some data may be retained for legal or legitimate business purposes',
        'Backup data is purged within 90 days of deletion request'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <SEO title="Privacy Policy" description="Learn how Split-It collects, uses, and protects your personal information. Your privacy and data security are our priorities." />
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8 relative">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <Logo size="sm" onClick={() => navigate('/')} className="cursor-pointer" />
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Back
          </Button>
        </header>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-6">
            <Shield className="text-primary" size={32} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Your privacy is important to us. This policy explains how Split-It collects, uses, and protects your personal information.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: January 11, 2026
          </p>
        </div>

        {/* Introduction Card */}
        <Card className="max-w-4xl mx-auto mb-8 border-border/50 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <p className="text-foreground leading-relaxed">
              Split-It ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and share your information when you use our expense splitting application and related services (collectively, the "Service"). By using Split-It, you agree to the collection and use of information in accordance with this policy.
            </p>
          </CardContent>
        </Card>

        {/* Policy Sections */}
        <div className="max-w-4xl mx-auto space-y-6">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon size={20} className="text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <ul className="space-y-2">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}

          {/* Your Rights Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield size={20} className="text-success" />
                </div>
                Your Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Right to access your personal data',
                  'Right to correct inaccurate data',
                  'Right to delete your data',
                  'Right to data portability',
                  'Right to restrict processing',
                  'Right to withdraw consent'
                ].map((right, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Shield size={14} className="text-success flex-shrink-0" />
                    <span className="text-sm text-foreground">{right}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cookies Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Cookies & Tracking</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information. Cookies are files with small amounts of data which may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
              </p>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground">
                Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal data, please contact us. If we become aware that we have collected personal data from children without verification of parental consent, we take steps to remove that information from our servers.
              </p>
            </CardContent>
          </Card>

          {/* Changes Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We will let you know via email and/or a prominent notice on our Service, prior to the change becoming effective. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                <Mail size={24} className="text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Questions about Privacy?</h3>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please contact us.
              </p>
              <a href="mailto:notifications.splitit@gmail.com">
                <Button variant="outline" className="gap-2">
                  <Mail size={16} />
                  notifications.splitit@gmail.com
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-16 py-8 border-t border-border/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2026 Split-It. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/terms-of-service')} className="hover:text-primary transition-colors">
                Terms of Service
              </button>
              <button onClick={() => navigate('/privacy-policy')} className="text-primary">
                Privacy Policy
              </button>
            </div>
          </div>
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:notifications.splitit@gmail.com" className="text-primary hover:underline">
              notifications.splitit@gmail.com
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
