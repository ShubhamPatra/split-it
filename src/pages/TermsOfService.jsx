import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Scale, Ban, RefreshCw, Gavel, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import Logo from '../components/common/Logo';
import SEO from '../components/common/SEO';

const TermsOfService = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: CheckCircle,
      title: 'Acceptance of Terms',
      content: `By accessing or using Split-It ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service. These Terms apply to all visitors, users, and others who access or use the Service.`
    },
    {
      icon: FileText,
      title: 'Description of Service',
      content: `Split-It is an expense splitting application that allows users to track shared expenses, create groups, split bills, and settle debts among group members. The Service includes web and mobile applications, and any related services or features we may provide.`
    },
    {
      icon: Scale,
      title: 'User Accounts',
      content: `When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms. You are responsible for safeguarding the password you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.`
    },
    {
      icon: AlertTriangle,
      title: 'Acceptable Use',
      content: `You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service: (a) in any way that violates any applicable law or regulation; (b) to transmit any material that is defamatory, offensive, or otherwise objectionable; (c) to impersonate or attempt to impersonate another user or person; (d) to engage in any conduct that restricts or inhibits anyone's use of the Service; (e) to attempt to gain unauthorized access to the Service or its related systems.`
    },
    {
      icon: Ban,
      title: 'Prohibited Activities',
      content: `You are prohibited from: using the Service for any fraudulent or illegal purpose; attempting to reverse engineer or extract source code from the Service; using automated systems or software to extract data from the Service; interfering with or disrupting the Service or servers; uploading viruses or malicious code; collecting user information without consent; using the Service to send spam or unsolicited communications.`
    },
    {
      icon: RefreshCw,
      title: 'Service Modifications',
      content: `We reserve the right to withdraw or amend our Service, and any service or material we provide, in our sole discretion without notice. We will not be liable if for any reason all or any part of the Service is unavailable at any time or for any period. From time to time, we may restrict access to some parts of the Service, or the entire Service, to users.`
    }
  ];

  const disclaimers = [
    {
      title: 'No Financial Advice',
      description: 'Split-It is a tool for tracking expenses and is not intended to provide financial, tax, or legal advice.'
    },
    {
      title: 'Accuracy of Information',
      description: 'While we strive for accuracy, we do not guarantee that expense calculations or balances are error-free.'
    },
    {
      title: 'Third-Party Services',
      description: 'We are not responsible for any third-party services or content linked from our Service.'
    },
    {
      title: 'No Warranty',
      description: 'The Service is provided "as is" without warranties of any kind, either express or implied.'
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <SEO title="Terms of Service" description="Read Split-It's Terms of Service. Understand the rules and guidelines for using our expense splitting application." />
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
            <Gavel className="text-primary" size={32} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Please read these terms carefully before using Split-It. By using our service, you agree to be bound by these terms.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last updated: January 11, 2026
          </p>
        </div>

        {/* Introduction Card */}
        <Card className="max-w-4xl mx-auto mb-8 border-border/50 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <p className="text-foreground leading-relaxed">
              Welcome to Split-It! These Terms of Service ("Terms") govern your use of our expense splitting application and services. By creating an account or using Split-It, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you are using the Service on behalf of an organization, you are agreeing to these Terms for that organization.
            </p>
          </CardContent>
        </Card>

        {/* Main Sections */}
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
                  <p className="text-muted-foreground leading-relaxed">
                    {section.content}
                  </p>
                </CardContent>
              </Card>
            );
          })}

          {/* User Content Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-info/10">
                  <FileText size={20} className="text-info" />
                </div>
                User Content
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Our Service allows you to post, link, store, share, and otherwise make available certain information, text, or data ("User Content"). You are responsible for the User Content that you post to the Service, including its legality, reliability, and appropriateness.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By posting User Content to the Service, you grant us the right to use, modify, and display such content in connection with the Service. You retain ownership of your User Content, but you grant Split-It a license to use it for providing and improving the Service.
              </p>
            </CardContent>
          </Card>

          {/* Disclaimers Section */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertTriangle size={20} className="text-warning" />
                </div>
                Disclaimers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                {disclaimers.map((item, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground leading-relaxed">
                In no event shall Split-It, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from: (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration of your transmissions or content.
              </p>
            </CardContent>
          </Card>

          {/* Indemnification */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground leading-relaxed">
                You agree to defend, indemnify, and hold harmless Split-It and its licensees, employees, contractors, agents, officers, and directors from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses arising from: (i) your use of and access to the Service; (ii) your violation of any term of these Terms; (iii) your violation of any third-party right; or (iv) any claim that your User Content caused damage to a third party.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Termination</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or delete your account through the app settings.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed and construed in accordance with the laws applicable in your jurisdiction, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                <Mail size={24} className="text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Questions about Terms?</h3>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us.
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
              <button onClick={() => navigate('/terms-of-service')} className="text-primary">
                Terms of Service
              </button>
              <button onClick={() => navigate('/privacy-policy')} className="hover:text-primary transition-colors">
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

export default TermsOfService;
