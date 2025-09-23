import { useState, useEffect } from 'react';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Array<{
    content: string;
    role: string;
    created_at: string;
  }>;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/functions/v1/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const createConversation = async (title: string = 'New Conversation') => {
    setLoading(true);
    try {
      const response = await fetch('/functions/v1/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        return newConversation;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/functions/v1/conversations?id=${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  return {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createConversation,
    deleteConversation,
    loading,
    refreshConversations: fetchConversations,
  };
}