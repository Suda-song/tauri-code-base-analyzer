"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFilePath = exports.getEnrichmentConfig = exports.getLLMConfig = exports.DEFAULT_ENRICHMENT_CONFIG = void 0;
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
// 加载.env文件
(0, dotenv_1.config)();
exports.DEFAULT_ENRICHMENT_CONFIG = {
    concurrency: 5,
    maxRetries: 3,
    retryDelay: 1000,
    inputPath: 'entities.json',
    outputPath: 'entities.enriched.json',
    preInitialize: false
};
const getLLMConfig = () => {
    return {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
        maxConcurrency: parseInt(process.env.LLM_MAX_CONCURRENCY || '5', 10)
    };
};
exports.getLLMConfig = getLLMConfig;
const getEnrichmentConfig = (customConfig) => {
    return {
        ...exports.DEFAULT_ENRICHMENT_CONFIG,
        ...customConfig
    };
};
exports.getEnrichmentConfig = getEnrichmentConfig;
const resolveFilePath = (filePath, relativeTo) => {
    if (path_1.default.isAbsolute(filePath)) {
        return filePath;
    }
    const basePath = relativeTo || process.cwd();
    return path_1.default.resolve(basePath, filePath);
};
exports.resolveFilePath = resolveFilePath;
