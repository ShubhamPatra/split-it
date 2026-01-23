import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, UserPlus, Loader2, QrCode, Keyboard, Search, Grid3X3, List, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { useChat } from '../context/ChatContext';
import Navbar from '../components/layout/Navbar';
import GroupCard from '../components/common/GroupCard';
import QRScanner from '../components/common/QRScanner';
import PastCollaboratorsSelector from '../components/group/PastCollaboratorsSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Card, CardContent } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';

const Groups = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, addGroup, joinGroupByInvite } = useGroups();
  const { fetchUnreadCountsForGroups } = useChat();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  // useEffect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch unread counts for all member groups whenever groups or user.id changes,
  // and refresh every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const fetchCounts = () => {
      const groupIds = groups
        .filter(g => g.members.includes(user.id))
        .map(g => g.id);
      if (groupIds.length > 0) {
        fetchUnreadCountsForGroups(groupIds);
      }
    };

    // Fetch immediately on change
    fetchCounts();

    // Set up interval to refresh every 30 seconds
    const intervalId = setInterval(fetchCounts, 30000);

    // Cleanup interval on unmount or dependency change
    return () => clearInterval(intervalId);
  }, [isAuthenticated, groups, user?.id, fetchUnreadCountsForGroups]);

  // Filter groups for current user
  const userGroups = useMemo(() =>
    groups.filter(g => g.members.includes(user?.id || '')),
    [groups, user?.id]
  );

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return userGroups;
    const query = searchQuery.toLowerCase();
    return userGroups.filter(g => g.name.toLowerCase().includes(query));
  }, [userGroups, searchQuery]);

  // Calculate stats
  const totalMembers = useMemo(() =>
    userGroups.reduce((sum, g) => sum + g.members.length, 0),
    [userGroups]
  );

  // Handle group creation
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group.",
        variant: "destructive",
      });
      return;
    }

    // Create group with current user and selected members
    const members = [user?.id || '', ...selectedMembers];
    const groupId = await addGroup(groupName, members, user?.id || '');

    if (groupId) {
      const memberCount = selectedMembers.length;
      toast({
        title: "Group created!",
        description: memberCount > 0
          ? `${groupName} has been created with ${memberCount + 1} members.`
          : `${groupName} has been created successfully. You can add members from the group settings.`,
      });
    }

    // Reset form
    setGroupName('');
    setSelectedMembers([]);
    setIsDialogOpen(false);
  };

  // Handle joining a group via invite code
  const handleJoinGroup = async (scannedCode = null) => {
    const code = (scannedCode || inviteCode).trim();
    if (!code) {
      toast({
        title: "Code required",
        description: "Please enter an invite code or link.",
        variant: "destructive",
      });
      return;
    }

    setJoinLoading(true);
    try {
      // Extract code from URL if user pasted a full link
      let extractedCode = code;
      if (code.includes('/join/')) {
        extractedCode = code.split('/join/').pop();
      }

      await joinGroupByInvite(extractedCode);
      toast({
        title: "Joined group!",
        description: "You have successfully joined the group.",
      });
      setInviteCode('');
      setIsJoinDialogOpen(false);
    } catch (error) {
      toast({
        title: "Failed to join",
        description: error.message || "Invalid or expired invite code.",
        variant: "destructive",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Desktop Layout */}
        <div className={`lg:grid lg:gap-8 ${userGroups.length > 0 ? 'lg:grid-cols-12' : ''}`}>
          {/* Main Content */}
          <div className={userGroups.length > 0 ? 'lg:col-span-8 xl:col-span-9' : ''}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                  Your Groups
                </h1>
                <p className="text-muted-foreground">
                  {userGroups.length} group{userGroups.length !== 1 ? 's' : ''} • {totalMembers} total members
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {/* Join Group Dialog */}
                <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="min-h-[48px] h-auto w-full sm:w-auto">
                      <UserPlus size={18} />
                      Join Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                          <UserPlus className="text-primary" size={20} />
                        </div>
                        <div>
                          <DialogTitle className="text-xl">Join a Group</DialogTitle>
                          <DialogDescription>
                            Enter a code or scan a QR invite
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <Tabs defaultValue="code" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="code" className="flex items-center gap-2">
                          <Keyboard className="h-4 w-4" />
                          Enter Code
                        </TabsTrigger>
                        <TabsTrigger value="scan" className="flex items-center gap-2">
                          <QrCode className="h-4 w-4" />
                          Scan QR
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="code" className="mt-4">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="inviteCode" className="text-sm font-medium">Invite Code or Link</Label>
                            <Input
                              id="inviteCode"
                              value={inviteCode}
                              onChange={(e) => setInviteCode(e.target.value)}
                              placeholder="ABC123XY or https://..."
                              className="h-12 font-mono"
                              onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                            />
                          </div>

                          <div className="p-3 rounded bg-muted/50 border border-border/50">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Tip:</span> Ask a group member to share their invite code or link with you.
                            </p>
                          </div>

                          <Button
                            onClick={handleJoinGroup}
                            className="w-full min-h-[48px] h-auto shadow-md"
                            disabled={joinLoading}
                          >
                            {joinLoading ? (
                              <>
                                <Loader2 size={18} className="animate-spin" />
                                Joining...
                              </>
                            ) : (
                              'Join Group'
                            )}
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="scan" className="mt-4">
                        <div className="space-y-4">
                          <QRScanner
                            onScan={(scannedData) => {
                              // Extract code from scanned URL or use directly
                              let code = scannedData;
                              if (scannedData.includes('/join/')) {
                                code = scannedData.split('/join/').pop();
                              }
                              setInviteCode(code);
                              // Auto-join after scanning
                              handleJoinGroup(code);
                            }}
                            onError={(err) => {
                              console.error('QR scan error:', err);
                            }}
                          />

                          {joinLoading && (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 size={16} className="animate-spin" />
                              Joining group...
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>

                {/* Create Group Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="min-h-[48px] h-auto w-full sm:w-auto shadow-lg shadow-primary/25 hover:shadow-xl transition-all">
                      <Plus size={18} />
                      New Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                          <Users className="text-primary" size={20} />
                        </div>
                        <div>
                          <DialogTitle className="text-xl">Create New Group</DialogTitle>
                          <DialogDescription>
                            Start splitting expenses with friends
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="groupName" className="text-sm font-medium">Group Name</Label>
                        <Input
                          id="groupName"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Weekend Trip, Roommates, etc."
                          className="h-12"
                        />
                      </div>

                      {/* Past Collaborators Selector */}
                      <PastCollaboratorsSelector
                        selectedMembers={selectedMembers}
                        onSelectionChange={setSelectedMembers}
                        excludeIds={[user?.id || '']}
                      />

                      <div className="p-3 rounded bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Tip:</span> You can also add more members after creating the group.
                        </p>
                      </div>

                      <Button onClick={handleCreateGroup} className="w-full min-h-[48px] h-auto shadow-md">
                        Create Group {selectedMembers.length > 0 && `with ${selectedMembers.length + 1} members`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search and View Toggle - Desktop */}
            {userGroups.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/50 bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  />
                </div>
                <div className="hidden md:flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/50">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-9 w-9 p-0"
                  >
                    <Grid3X3 size={16} />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-9 w-9 p-0"
                  >
                    <List size={16} />
                  </Button>
                </div>
              </div>
            )}

            {/* Groups Grid */}
            {filteredGroups.length > 0 ? (
              <div className={viewMode === 'grid'
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                : "space-y-3"
              }>
                {filteredGroups.map((group, index) => (
                  <div key={group.id} className="animate-fade-in" style={{ animationDelay: `${0.03 * index}s` }}>
                    <GroupCard group={group} />
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Search className="text-muted-foreground" size={28} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                    No groups found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    No groups match "{searchQuery}"
                  </p>
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50 animate-fade-in">
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-16 h-16 rounded bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="text-primary" size={28} />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                    No groups yet
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Create your first group to start splitting expenses with friends and family
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)} className="min-h-[48px] h-auto shadow-lg shadow-primary/25">
                    <Plus size={18} />
                    Create Your First Group
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Desktop Only (only show when there are groups) */}
          {userGroups.length > 0 && (
            <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
              <div className="sticky top-24 space-y-6">
                {/* Stats Card */}
                <Card className="border-border/50 shadow-sm animate-fade-in bg-muted/30" style={{ animationDelay: '0.3s' }}>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                      <TrendingUp size={14} className="text-primary" />
                      Overview
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Groups</span>
                        <span className="font-bold text-foreground">{userGroups.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Members</span>
                        <span className="font-bold text-foreground">{totalMembers}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Avg. Members/Group</span>
                        <span className="font-bold text-foreground">{(totalMembers / userGroups.length).toFixed(1)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};

export default Groups;
