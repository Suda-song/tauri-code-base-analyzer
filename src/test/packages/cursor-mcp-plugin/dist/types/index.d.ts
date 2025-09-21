import { EnrichedEntity } from "@xhs/modular-code-analysis-agent";
export interface Entity extends EnrichedEntity {
    id: string;
    rawName: string;
    type: string;
    file: string;
    summary: string;
    tags: string[];
    isDDD?: boolean;
    isWorkspace?: boolean;
    workspaceIndex?: number;
    workspacePath?: string;
}
export interface SearchResult {
    searchEntity: Entity;
    relevanceScore: number;
    relatedEntities: {
        prompt: string;
        relatedEntities: {
            imports: Entity[];
            calls: Entity[];
            templates: Entity[];
            similar: Entity[];
        };
    };
}
export interface ConversationState {
    sessionId: string;
    step: 'select-core' | 'load-related' | 'confirm-selection' | 'ready-generate' | 'completed' | 'search' | 'confirm' | 'generate';
    userInput: string;
    searchResults?: SearchResult[];
    selectedEntities?: Entity[];
    combinedPrompt?: string;
    coreComponents?: EnrichedEntity[];
    relevanceScores?: {
        [entityId: string]: number;
    };
    selectedCoreIndex?: number;
    workspaceResults?: Map<string, any>;
    workspaceRelatedEntities?: Map<string, any>;
    workspaceAllRelatedEntities?: Map<string, Entity[]>;
    workspaceDefaultSelection?: Map<string, Entity[]>;
    workspaceAiReasoning?: Map<string, string>;
    relatedEntities?: {
        imports: Entity[];
        calls: Entity[];
        templates: Entity[];
        similar: Entity[];
    };
    allRelatedEntities?: Entity[];
    defaultSelection?: Entity[];
    customSelection?: Entity[];
    finalSelection?: Entity[];
    generatedPrompt?: string;
    aiReasoning?: string;
}
