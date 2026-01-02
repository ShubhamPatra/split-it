import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroups } from '../context/GroupContext';
import { users } from '../data/mockData';
import Navbar from '../components/layout/Navbar';
import GroupCard from '../components/common/GroupCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { useToast } from '../hooks/use-toast';

const Groups = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { groups, addGroup } = useGroups();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  // useEffect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Filter groups for current user
  const userGroups = groups.filter(g => g.members.includes(user?.id || ''));

  // Handle member selection
  const handleMemberToggle = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Handle group creation
  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group.",
        variant: "destructive",
      });
      return;
    }

    // Add current user to members (members are optional, can add later)
    const allMembers = [...new Set([user?.id || '', ...selectedMembers])];
    addGroup(groupName, allMembers, user?.id || '');

    toast({
      title: "Group created!",
      description: `${groupName} has been created successfully.`,
    });

    // Reset form
    setGroupName('');
    setSelectedMembers([]);
    setIsDialogOpen(false);
  };

  if (!isAuthenticated) return null;

  // Filter out current user from available members
  const availableMembers = users.filter(u => u.id !== user?.id);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container-responsive py-6 sm:py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Your Groups
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your expense groups
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="min-h-[44px] h-auto w-full sm:w-auto">
                <Plus size={18} />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogDescription>
                  Create a group to start splitting expenses with friends
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName" className="text-sm sm:text-base">Group Name</Label>
                  <Input
                    id="groupName"
                    placeholder="e.g., Weekend Trip, Roommates"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="min-h-[44px] text-sm sm:text-base"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm sm:text-base">Select Members (Optional)</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">You can add members now or later from the group settings</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto mobile-scroll">
                    {availableMembers.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors min-h-[44px]"
                      >
                        <Checkbox
                          id={member.id}
                          checked={selectedMembers.includes(member.id)}
                          onCheckedChange={() => handleMemberToggle(member.id)}
                          className="min-h-[24px] min-w-[24px]"
                        />
                        <label
                          htmlFor={member.id}
                          className="flex-1 cursor-pointer min-h-[44px] flex flex-col justify-center"
                        >
                          <p className="font-medium text-foreground text-sm sm:text-base">{member.name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{member.email}</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleCreateGroup} className="w-full min-h-[44px] h-auto">
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Groups Grid */}
        {userGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGroups.map((group, index) => (
              <div key={group.id} style={{ animationDelay: `${0.1 * index}s` }}>
                <GroupCard group={group} />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-6 sm:p-8 md:p-12 text-center">
            <Users className="mx-auto text-muted-foreground mb-4" size={40} />
            <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
              No groups yet
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Create your first group to start splitting expenses
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="min-h-[44px] h-auto">
              <Plus size={18} />
              Create Group
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Groups;
