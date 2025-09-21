import { ConversationState } from "../types";

class ConversationService {
  private conversations: Map<string, ConversationState> = new Map();

  getConversation(sessionId: string): ConversationState | undefined {
    return this.conversations.get(sessionId);
  }

  setConversation(sessionId: string, state: ConversationState): void {
    this.conversations.set(sessionId, state);
  }

  updateConversation(sessionId: string, updates: Partial<ConversationState>): void {
    const current = this.getConversation(sessionId);
    if (current) {
      Object.assign(current, updates);
    }
  }

  deleteConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }
}

export const conversationService = new ConversationService(); 