import { ConversationState } from "../types";
declare class ConversationService {
    private conversations;
    getConversation(sessionId: string): ConversationState | undefined;
    setConversation(sessionId: string, state: ConversationState): void;
    updateConversation(sessionId: string, updates: Partial<ConversationState>): void;
    deleteConversation(sessionId: string): void;
}
export declare const conversationService: ConversationService;
export {};
