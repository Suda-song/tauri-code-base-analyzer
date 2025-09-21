"use strict";
/**
 * AI 提示词配置管理
 *
 * 这个模块将所有的AI提示词集中管理，与业务逻辑完全分离，提高了代码的可维护性。
 * 采用策略模式设计，每种分析场景都有对应的提示词模板，支持灵活的参数化配置。
 *
 * 设计原则：
 * - 职责分离：提示词管理与业务逻辑分离
 * - 参数化：所有提示词支持动态参数注入
 * - 可扩展：新增分析场景只需添加新的提示词模板
 * - 类型安全：完整的TypeScript类型定义
 *
 * 支持的分析场景：
 * - 项目架构概览分析
 * - 目录详细分析
 * - 综合分析报告
 * - 业务组件分析
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplates = void 0;
/**
 * AI 提示词模板类
 *
 * 核心的提示词生成器，采用静态方法设计，无状态且线程安全。
 * 每个方法负责生成特定场景下的AI提示词，确保AI分析的质量和一致性。
 */
class PromptTemplates {
    /**
     * 生成项目架构概览分析提示词
     *
     * 这是最重要的提示词模板之一，用于指导AI生成全面的项目架构分析。
     * 提示词设计遵循AI工程最佳实践，包含清晰的角色定义、详细的上下文信息、
     * 明确的输出要求和结构化的分析框架。
     *
     * 提示词特色：
     * - 角色扮演：让AI扮演资深软件架构师角色
     * - 多维分析：从DDD、架构模式、技术栈等多个角度分析
     * - 上下文丰富：包含项目信息、实体数据、图表信息等
     * - 业务导向：支持自定义业务需求的特别关注
     *
     * @param data 包含项目分析所需的完整数据集
     * @returns 结构化的AI提示词，指导生成架构概览分析
     */
    static generateArchitectureOverviewPrompt(data) {
        const { analysis, entities, customContent, architectureResult, coreTypesAnalysis, mermaidDiagrams } = data;
        const customSection = customContent ? `

**Special Business Requirements and Guidelines:**
${customContent}

**IMPORTANT:** Please pay special attention to the above business requirements and ensure they are addressed throughout the analysis. These are critical business-specific considerations that should be highlighted and integrated into every relevant section of the analysis.` : '';
        return `You are a senior software architect. Please generate a comprehensive project architecture overview analysis.

Project Information:
- Project Name: ${analysis.projectName}
- Project Type: ${analysis.projectType}
- Technology Stack: ${analysis.technologies.join(', ')}
- Total Files: ${analysis.structure.totalFiles}
- Total Entities: ${entities.length}

Architecture Analysis:
${JSON.stringify(architectureResult, null, 2)}

Core Types Analysis:
${coreTypesAnalysis}

Project Structure Diagrams:
${mermaidDiagrams && mermaidDiagrams.length > 0 ?
            mermaidDiagrams.map((d) => `${d.title}: ${d.description}`).join('\n') :
            'No available project structure diagrams'}${customSection}

Please analyze from the following perspectives:

## 🏗️ Project Architecture Overview

### 🏛️ DDD (Domain-Driven Design) Analysis
- 需要识别是否用到了 DDD 架构，如果用到了才输出领域驱动分析
- Identify domain concepts and boundaries in the project
- Analyze DDD elements like entities, value objects, aggregates

Please provide a comprehensive analysis focusing on architectural insights and best practices.`;
    }
    /**
     * 生成目录详细分析提示词
     *
     * 这个提示词模板用于指导AI对单个目录进行深入的代码分析和结构化报告。
     * 它包含了丰富的上下文信息，如目录路径、目的、文件数量、实体列表等，
     * 以及详细的实体属性（名称、类型、文件、导入、调用等）和文件-实体映射。
     *
     * 提示词特色：
     * - 上下文丰富：提供完整的目录信息和实体数据
     * - 实体详细：展示每个实体的详细属性，便于理解
     * - 文件-实体映射：清晰展示文件与实体的对应关系
     * - 业务导向：支持自定义业务需求的特别关注
     *
     * @param data 包含目录分析所需的数据
     * @returns 结构化的AI提示词，指导生成目录详细分析
     */
    static generateDirectoryAnalysisPrompt(data, isRoute) {
        const { dir, representativeEntities, fileEntries, customContent } = data;
        let customSection = '';
        if (customContent) {
            customSection = `
**CRITICAL Business Requirements & Special Attention Points**:
${customContent}

**IMPORTANT**: The above business requirements are CRITICAL and must be given special attention. Please ensure the analysis addresses these requirements specifically, especially regarding shared-item logic layers, UI-logic decoupling architecture, and directory structure completeness.`;
        }
        return `You are a professional code analyst. Please generate a comprehensive analysis report for the following directory or page route.

**${isRoute ? 'Route' : 'Directory'} Information**:
- **Path**: ${dir.fullPath || dir.path}
- **Purpose**: ${dir.purpose}
${!isRoute && `- **File Count**: ${dir.fileCount} files
- **Detected Entities**: ${representativeEntities.length} entities`}

**Entity Details**:
${JSON.stringify(representativeEntities.map(e => ({
            name: e.id || e.rawName,
            type: e.type,
            file: e.file,
            imports: e.IMPORTS?.slice(0, 3) || [],
            calls: e.CALLS?.slice(0, 3) || [],
            templateComponents: e.TEMPLATE_COMPONENTS?.slice(0, 2) || [],
            summary: e.summary || ''
        })), null, 2)}

**File-Entity Structure**:
${fileEntries.map(([file, entities]) => `- **${file}**: ${entities.map(e => e.id || e.rawName).join(', ')}`).join('\n')}${customSection}

**Required Output Format**:

## 📁 ${dir.fullPath || dir.path}

### 🎯 ${isRoute ? 'Route' : 'Directory'} Purpose
- **Primary Role**: ${dir.purpose}
${!isRoute ? `- **File Count**: ${dir.fileCount} files
- **Entity Count**: ${representativeEntities.length} entities` : ''}
${isRoute ? `- **Entities**: ${fileEntries[0][1].map(e => `\`${e.id || e.rawName}\` (${e.type})`).join(', ')}` : ''}
- **Functional Description**: [One paragraph explaining this directory's role and importance in the overall project]

${!isRoute ? `### 📋 File Structure & Entities
${fileEntries.map(([file, entities]) => `
#### 📄 ${require('path').basename(file)}
- **Path**: \`${file}\`
- **Entities**: ${entities.map(e => `\`${e.id || e.rawName}\` (${e.type})`).join(', ')}
- **Purpose**: [Brief description of this file's role]`).join('')}
` : ''}

### 📦 Dependencies & Relationships
- **Imported Modules**: [Analyze key imported dependencies]
- **Function Calls**: [Analyze main function calls]
- **Component Relations**: [Analyze component relationships]

---`;
    }
    /**
     * 生成综合分析报告提示词
     *
     * 这个提示词模板用于指导AI生成一个综合性的技术文档报告，
     * 将架构概览、详细代码分析、路由分析、数据流分析等不同维度的分析结果
     * 整合到一个完整的报告中。
     *
     * 提示词特色：
     * - 多维度整合：将不同分析结果有机整合
     * - 结构清晰：采用清晰的标题和层级
     * - 业务导向：强调分析结果与业务需求的关联
     * - 输出格式规范：提供标准的Markdown格式输出
     *
     * @param data 包含所有分析组件的数据
     * @returns 结构化的AI提示词，指导生成综合分析报告
     */
    static generateComprehensiveAnalysisPrompt(data) {
        const { architectureOverview, detailedCodeAnalysis, routeAnalysis, dataFlowAnalysis, mermaidDiagrams, analysis, entities, customContent } = data;
        const customSection = customContent ? `

**🎯 CRITICAL Business Requirements & Focus Areas:**
${customContent}

**⚠️ ATTENTION:** The above requirements are of HIGHEST PRIORITY. Every analysis section must address these requirements specifically. Pay special attention to architecture decisions, code organization patterns, and business logic implementation that relates to these requirements.` : '';
        return `You are a senior technical architect and business analyst. Generate a comprehensive technical documentation report.

**Project Overview:**
- Project: ${analysis.projectName}
- Type: ${analysis.projectType}
- Technologies: ${analysis.technologies.join(', ')}
- Files: ${analysis.structure.totalFiles}
- Entities: ${entities.length}

**Available Analysis Components:**

**1. Architecture Overview:**
${architectureOverview}

**2. Detailed Code Analysis:**
${detailedCodeAnalysis}

**3. Route Analysis:**
${routeAnalysis}

**4. Data Flow Analysis:**
${dataFlowAnalysis}

**5. Project Diagrams:**
${mermaidDiagrams ? JSON.stringify(mermaidDiagrams, null, 2) : 'No diagrams available'}${customSection}

**Required Output Format:**

# ${analysis.projectName} - Code Structure Analysis

## 📊 Project Overview
[Synthesize the project overview focusing on business value and technical architecture]

## 🏗️ Architecture Analysis
[Combine architecture insights with business requirements]

## 🗂️ Project Directory Structure
[Present the structure analysis with business context]

## 🌐 Application Route Analysis
[Present route analysis with focus on user journeys and business flows]

## 📊 Application Data Flow Analysis
[Present data flow analysis emphasizing business processes]

## 🔧 Technical Recommendations
[Provide actionable recommendations based on the analysis]

## 📈 Business Impact Analysis
[Connect technical findings to business objectives]

Please ensure the analysis is comprehensive, actionable, and directly addresses any specified business requirements.`;
    }
    /**
     * 生成业务组件分析提示词
     *
     * 这个提示词模板用于指导AI从业务视角分析项目中的组件，
     * 识别哪些组件直接服务于业务需求，以及它们之间的关联关系。
     *
     * 提示词特色：
     * - 业务导向：强调组件与业务需求的关联
     * - 组件详细：展示每个组件的详细信息，便于理解
     * - 关联关系：分析组件之间的集成点和依赖关系
     * - 业务影响评估：评估组件对业务连续性和优化的影响
     *
     * @param data 包含业务组件分析所需的数据
     * @returns 结构化的AI提示词，指导生成业务组件分析
     */
    static generateBusinessComponentAnalysisPrompt(data) {
        const { entities, customContent } = data;
        const customSection = customContent ? `

**Business Context & Requirements:**
${customContent}

**Focus Areas:** Please pay special attention to how the components below relate to the business requirements above.` : '';
        return `You are a business-focused software architect. Analyze the following components from a business perspective.

**Component Information:**
${JSON.stringify(entities.slice(0, 20).map(e => ({
            name: e.id || e.rawName,
            type: e.type,
            file: e.file,
            summary: e.summary || '',
            imports: e.IMPORTS?.slice(0, 3) || [],
            calls: e.CALLS?.slice(0, 3) || []
        })), null, 2)}${customSection}

Please analyze these components focusing on:

### 🎯 Business Value Analysis
- What business functions do these components serve?
- How do they contribute to user experience?
- What business processes do they support?

### 🔗 Component Relationships
- How do these components work together?
- What are the key integration points?
- Which components are most critical to business operations?

### 🚀 Business Impact Assessment
- Which components handle core business logic?
- What are the dependencies that could impact business continuity?
- Where are the opportunities for business process optimization?

Provide actionable insights that connect technical implementation to business outcomes.`;
    }
}
exports.PromptTemplates = PromptTemplates;
