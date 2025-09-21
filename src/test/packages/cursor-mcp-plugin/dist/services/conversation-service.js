"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationService = void 0;
class ConversationService {
    constructor() {
        this.conversations = new Map();
    }
    getConversation(sessionId) {
        return this.conversations.get(sessionId);
    }
    setConversation(sessionId, state) {
        this.conversations.set(sessionId, state);
    }
    updateConversation(sessionId, updates) {
        const current = this.getConversation(sessionId);
        if (current) {
            Object.assign(current, updates);
        }
    }
    deleteConversation(sessionId) {
        this.conversations.delete(sessionId);
    }
}
exports.conversationService = new ConversationService();
