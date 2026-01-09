import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';
import { Search, Users, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { debounce, getInitials } from '../../utils/helperFunctions';

const PastCollaboratorsSelector = ({ selectedMembers, onSelectionChange, excludeIds = [] }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch collaborators on mount
  useEffect(() => {
    const fetchCollaborators = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/groups/collaborators');
        setCollaborators(response.collaborators || []);
      } catch (error) {
        console.error('Failed to fetch collaborators:', error);
        toast({
          title: 'Error',
          description: 'Failed to load past collaborators',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCollaborators();
  }, []);

  // Filter collaborators based on search term and exclusions
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(collab => {
      // Exclude specified IDs
      if (excludeIds.includes(collab.id)) return false;

      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          collab.name?.toLowerCase().includes(search) ||
          collab.email?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [collaborators, searchTerm, excludeIds]);

  // Handle checkbox toggle
  const handleToggle = (collaboratorId) => {
    const newSelection = selectedMembers.includes(collaboratorId)
      ? selectedMembers.filter(id => id !== collaboratorId)
      : [...selectedMembers, collaboratorId];
    onSelectionChange(newSelection);
  };

  // Select all visible
  const selectAll = () => {
    const allIds = filteredCollaborators.map(c => c.id);
    const newSelection = [...new Set([...selectedMembers, ...allIds])];
    onSelectionChange(newSelection);
  };

  // Clear selection
  const clearSelection = () => {
    const filteredIds = filteredCollaborators.map(c => c.id);
    const newSelection = selectedMembers.filter(id => !filteredIds.includes(id));
    onSelectionChange(newSelection);
  };

  // Debounced search handler
  const handleSearchChange = debounce((value) => {
    setSearchTerm(value);
  }, 300);

  if (loading) {
    return (
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (collaborators.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">No past collaborators found</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          People from your existing groups will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Add from Previous Groups</span>
          {selectedMembers.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedMembers.length} selected
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={filteredCollaborators.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selectedMembers.length === 0}
            >
              Clear
            </Button>
          </div>

          {/* Collaborators list */}
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredCollaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No results found
              </p>
            ) : (
              filteredCollaborators.map(collaborator => (
                <label
                  key={collaborator.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedMembers.includes(collaborator.id)}
                    onCheckedChange={() => handleToggle(collaborator.id)}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {getInitials(collaborator.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{collaborator.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {collaborator.email}
                      </p>
                    </div>
                    {collaborator.collaborationCount > 1 && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {collaborator.collaborationCount} groups
                      </Badge>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PastCollaboratorsSelector;
