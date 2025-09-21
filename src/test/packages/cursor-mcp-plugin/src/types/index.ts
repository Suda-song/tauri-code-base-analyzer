import { EnrichedEntity } from "@xhs/modular-code-analysis-agent";

export interface Entity extends EnrichedEntity {
  id: string;
  rawName: string;
  type: string;
  file: string;
  summary: string;
  tags: string[];
  projectDesc?: string; // 项目描述
  publishTag?: string; // 需求迭代
  isDDD?: boolean;
  isWorkspace?: boolean;
  workspaceIndex?: number; // 标识来自哪个workspace（0-based索引）
  workspacePath?: string;  // 实体所属的workspace路径
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
  relevanceScores?: {[entityId: string]: number};
  selectedCoreIndex?: number;
  workspaceResults?: Map<string, any>; // 按workspace分组的搜索结果
  // 按workspace分组的处理结果
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