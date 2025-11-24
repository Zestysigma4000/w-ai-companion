import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationsContextValue {
  conversations: Conversation[];
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  createConversation: (title?: string) => Promise<Conversation | undefined>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deleteAllConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  loading: boolean;
}

const ConversationsContext = createContext<ConversationsContextValue | undefined>(undefined);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load conversations', {
          description: 'Unable to connect to the server.'
        });
        return;
      }

      if (data) {
        setConversations(data);
        if (!currentConversationId && data.length > 0) {
          setCurrentConversationId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations', {
        description: 'An unexpected error occurred.'
      });
    }
  };

  const createConversation = async (title: string = 'New Conversation') => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        toast.error('Authentication required', {
          description: 'Please sign in to create conversations.'
        });
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          title,
          user_id: session.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        toast.error('Failed to create conversation', {
          description: 'Unable to save to the database.'
        });
        return;
      }

      if (data) {
        setConversations(prev => [data, ...prev]);
        setCurrentConversationId(data.id);
        return data;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation', {
        description: 'An unexpected error occurred.'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('Error deleting conversation:', error);
        toast.error('Failed to delete conversation', {
          description: 'Unable to connect to the database.'
        });
        throw new Error('Failed to delete conversation');
      }

      // Optimistically update local state and pick a sensible next selection
      setConversations(prev => {
        const idx = prev.findIndex(conv => conv.id === conversationId);
        const filtered = prev.filter(conv => conv.id !== conversationId);

        if (currentConversationId === conversationId) {
          // Prefer the next item at the same index, else previous, else first
          const next = filtered[idx] || filtered[idx - 1] || filtered[0];
          setCurrentConversationId(next ? next.id : null);
        }

        return filtered;
      });

      // Sync with backend to avoid drift (e.g., if other clients modified state)
      await fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation', {
        description: 'An unexpected error occurred.'
      });
      throw error;
    }
  };

  const deleteAllConversations = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        toast.error('Authentication required', {
          description: 'Please sign in to delete conversations.'
        });
        return;
      }

      // Delete all messages for this user first
      const { error: msgErr } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', session.user.id);
      if (msgErr) {
        console.error('Error deleting messages:', msgErr);
        toast.error('Failed to delete messages', {
          description: 'Unable to connect to the database.'
        });
      }

      // Then delete all conversations for this user
      const { error: convErr } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', session.user.id);
      if (convErr) {
        console.error('Error deleting conversations:', convErr);
        toast.error('Failed to delete conversations', {
          description: 'Unable to connect to the database.'
        });
        throw new Error('Failed to delete conversations');
      }

      setConversations([]);
      setCurrentConversationId(null);
      toast.success('All conversations deleted');
    } catch (error) {
      console.error('Error in deleteAllConversations:', error);
      toast.error('Failed to delete conversations', {
        description: 'An unexpected error occurred.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<ConversationsContextValue>(() => ({
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    deleteConversation,
    deleteAllConversations,
    loading,
    refreshConversations: fetchConversations,
  }), [conversations, currentConversationId, loading]);

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return ctx;
}
