"use strict";
/**
 * 模板格式化器 - 统一的格式化逻辑管理
 *
 * 这个模块将所有的格式化逻辑和模板字符串集中管理，实现了完全的关注点分离。
 * 所有的Markdown模板、数据格式化、结构化输出都在这里统一处理，
 * 使业务逻辑代码更加清晰，模板修改更加便捷。
 *
 * 设计理念：
 * - 职责分离：格式化逻辑与业务逻辑完全分离
 * - 统一管理：所有模板字符串集中在一个地方
 * - 可重用性：格式化方法可在多个地方复用
 * - 类型安全：完整的TypeScript类型定义
 *
 * 支持的格式化场景：
 * - 路由分析结果格式化
 * - 数据流分析结果格式化
 * - 项目目录结构模板
 * - 统计表格生成
 * - README文档构建
 * - 各种回退模板
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateFormatters = void 0;
const path_1 = __importDefault(require("path"));
const mermaid_generator_1 = require("./mermaid-generator");
const architecture_analyzer_1 = require("./architecture-analyzer");
/**
 * 模板格式化器类
 *
 * 提供了项目文档生成所需的所有格式化方法，采用静态方法设计，
 * 无状态且线程安全，所有方法都专注于特定的格式化任务。
 */
class TemplateFormatters {
    /**
     * 格式化路由分析结果
     *
     * 将路由分析的原始数据转换为结构化的Markdown格式，
     * 包含路由配置概览和详细的页面组件列表。
     *
     * 格式化内容：
     * - 路由配置文件路径
     * - 路由总数统计
     * - 页面组件详细列表（路径、组件、标题等）
     *
     * @param routeResult 路由分析的原始数据，如果为null则返回提示信息
     * @returns 格式化后的Markdown文本，包含完整的路由分析报告
     */
    static formatRouteAnalysis(routeResult, routePageAnalysis) {
        if (!routeResult)
            return 'No route analysis results available.';
        let formatted = `## 🌐 Route Configuration Analysis

**Route Config Path**: \`${routeResult.routeConfigPath || 'Not found'}\`
**Total Routes**: ${routeResult.totalRoutes || 0}

## 📋 Route Page Structure & Entities

${routePageAnalysis}
`;
        return formatted;
    }
    /**
     * 格式化增强的路由分析结果
     *
     * 以路由入口文件为维度，生成更有可读性的分析报告
     *
     * @param enhancedResult 增强的路由分析结果
     * @returns 格式化后的Markdown文本
     */
    static formatEnhancedRouteAnalysis(enhancedResult) {
        if (!enhancedResult.routeAnalysis) {
            return 'No enhanced route analysis results available.';
        }
        const { routeAnalysis, componentRelations, fileRelations, totalRelatedFiles, totalRelatedEntities } = enhancedResult;
        let formatted = `## 🌐 Route Configuration Analysis

**Route Config Path**: \`${routeAnalysis.routeConfigPath || 'Not found'}\`
**Total Routes**: ${routeAnalysis.totalRoutes || 0}
**Related Files**: ${totalRelatedFiles || 0}
**Related Entities**: ${totalRelatedEntities || 0}

`;
        // 以路由入口文件为维度组织内容
        if (routeAnalysis.pageComponents && routeAnalysis.pageComponents.length > 0) {
            for (const pageComponent of routeAnalysis.pageComponents) {
                formatted += this.formatSingleRouteFile(pageComponent, fileRelations, componentRelations);
                formatted += '\n---\n\n';
            }
        }
        return formatted;
    }
    /**
     * 格式化单个路由文件的分析 - 按用户期望的格式
     */
    static formatSingleRouteFile(pageComponent, fileRelations, componentRelations) {
        let content = `## 📁 ${pageComponent.componentPath}\n\n`;
        // Route Purpose 部分
        content += `### 🎯 Route Purpose\n`;
        content += `- **Primary Role**: 页面路由入口文件\n`;
        content += `- **Route Path**: \`${pageComponent.path}\`\n`;
        content += `- **Route Name**: \`${pageComponent.name}\`\n`;
        if (pageComponent.meta && pageComponent.meta.title) {
            content += `- **Page Title**: ${pageComponent.meta.title}\n`;
        }
        // 找到该路由对应的实体信息
        const routeDir = path_1.default.dirname(pageComponent.componentPath);
        const routeFileRelation = fileRelations.find(fr => fr.filePath === routeDir);
        if (routeFileRelation && routeFileRelation.entities.length > 0) {
            // 显示该路由文件的具体实体
            const mainEntity = routeFileRelation.entities.find(e => e.file === pageComponent.componentPath ||
                e.file.endsWith(path_1.default.basename(pageComponent.componentPath)));
            if (mainEntity) {
                content += `- **Entities**: \`${mainEntity.id}\` (${mainEntity.type})\n`;
                if (mainEntity.summary) {
                    content += `- **Functional Description**: ${mainEntity.summary}\n`;
                }
            }
            else {
                content += `- **Entities**: ${routeFileRelation.entities.length}个实体\n`;
                if (routeFileRelation.aiGeneratedSummary) {
                    content += `- **Functional Description**: ${routeFileRelation.aiGeneratedSummary}\n`;
                }
            }
        }
        content += '\n';
        // 关联文件夹部分
        content += `### 📦 关联文件夹\n\n`;
        // 找到与该路由相关的其他目录
        const relatedDirectories = fileRelations.filter(fr => fr.filePath !== routeDir &&
            (fr.relationType === 'api_service' ||
                fr.relationType === 'dependency' ||
                fr.relationType === 'utility' ||
                fr.relationType === 'store' ||
                this.isRelatedToRoute(routeDir, fr.filePath)));
        if (relatedDirectories.length === 0) {
            content += '暂无直接关联的文件夹。\n\n';
        }
        else {
            relatedDirectories.forEach((directory, index) => {
                const folderNumber = index + 1;
                content += `- **文件夹${folderNumber}: ${directory.filePath}**\n`;
                const summary = directory.aiGeneratedSummary || directory.originalSummaries[0] || '功能模块';
                content += `  - \`目录说明\`: ${summary}\n\n`;
                // 从 componentRelations 中提取与该目录相关的依赖关系
                const directoryDependencies = this.extractDirectoryDependencies(directory.filePath, componentRelations);
                content += `  - \`文件依赖\`: ${directoryDependencies}\n\n`;
                // 显示关联实体
                const entityIds = directory.entities.map(entity => entity.id).join(', ');
                content += `  - \`关联实体\`: ${entityIds || '暂无实体'}\n\n`;
                content += '\n';
            });
        }
        return content;
    }
    /**
     * 判断目录是否与路由相关
     */
    static isRelatedToRoute(routeDir, targetDir) {
        // 检查是否是同一主模块下的目录
        const routeParts = routeDir.split('/');
        const targetParts = targetDir.split('/');
        // 如果在同一个主容器下（如都在 src/containers/Assistance/ 下）
        if (routeParts.length >= 3 && targetParts.length >= 3) {
            return routeParts.slice(0, 3).join('/') === targetParts.slice(0, 3).join('/');
        }
        return false;
    }
    /**
     * 从组件关系数据中提取特定目录的依赖信息
     */
    static extractDirectoryDependencies(directoryPath, componentRelations) {
        if (!componentRelations || !componentRelations.dependencies)
            return '暂无依赖信息';
        // 查找与该目录相关的依赖关系
        const relevantDependencies = componentRelations.dependencies.filter(dep => dep.fromDirectory === directoryPath || dep.toDirectory === directoryPath);
        if (relevantDependencies.length === 0) {
            return '暂无明确依赖关系';
        }
        // 分类处理依赖关系
        const outgoingDeps = []; // 该目录依赖的其他目录
        const incomingDeps = []; // 其他目录依赖该目录
        relevantDependencies.slice(0, 5).forEach(dep => {
            const typeMap = {
                'import': '代码导入',
                'api_call': 'API接口',
                'utility': '工具函数',
                'component': '组件引用',
                'store': '状态管理'
            };
            const typeDesc = typeMap[dep.dependencyType] || '模块依赖';
            if (dep.fromDirectory === directoryPath) {
                // 该目录依赖其他目录
                const otherDir = dep.toDirectory.replace(/^src\//, '');
                outgoingDeps.push(`依赖 ${otherDir} (${typeDesc}${dep.dependencyCount}次)`);
            }
            else {
                // 其他目录依赖该目录
                const otherDir = dep.fromDirectory.replace(/^src\//, '');
                incomingDeps.push(`被 ${otherDir} 引用 (${typeDesc}${dep.dependencyCount}次)`);
            }
        });
        const descriptions = [];
        if (outgoingDeps.length > 0) {
            descriptions.push(...outgoingDeps);
        }
        if (incomingDeps.length > 0) {
            descriptions.push(...incomingDeps);
        }
        return descriptions.length > 0 ? descriptions.join('；') : '暂无明确依赖关系';
    }
    /**
     * 按关系类型分组路径维度数据
     */
    static groupPathDataByType(pathDataList) {
        const grouped = new Map();
        pathDataList.forEach(pathData => {
            const type = pathData.relationType;
            if (!grouped.has(type)) {
                grouped.set(type, []);
            }
            grouped.get(type).push(pathData);
        });
        return grouped;
    }
    /**
     * 获取关系类型的显示名称
     */
    static getRelationTypeDisplayName(relationType) {
        const typeMap = {
            'route_component': '🏠 路由组件',
            'dependency': '🔗 依赖组件',
            'api_service': '🌐 API服务',
            'utility': '🛠️ 工具类',
            'store': '📦 状态管理',
            'other': '📄 其他文件'
        };
        return typeMap[relationType] || '📄 其他文件';
    }
    /**
     * 格式化数据流分析结果
     *
     * 将数据流分析的原始数据转换为结构化的Markdown格式，
     * 包含数据流概览、Mermaid图表和页面数据流详细列表。
     *
     * 格式化内容：
     * - 页面数据流总数
     * - API调用总数
     * - 状态管理信息
     * - Mermaid图表（如果存在）
     * - 页面数据流详细列表（前5个）
     *
     * @param dataFlowResult 数据流分析的原始数据，如果为null则返回提示信息
     * @returns 格式化后的Markdown文本，包含完整的数据流分析报告
     */
    static formatDataFlowAnalysis(dataFlowResult) {
        if (!dataFlowResult)
            return 'No data flow analysis results available.';
        let formatted = `### 📊 Data Flow Analysis

**Page Flows**: ${dataFlowResult.pageFlows?.length || 0}
**API Calls**: ${dataFlowResult.apiCalls?.length || 0}
**State Management**: ${dataFlowResult.stateManagement?.length || 0}

`;
        if (dataFlowResult.mermaidDiagram) {
            formatted += `#### Data Flow Diagram

\`\`\`mermaid
${dataFlowResult.mermaidDiagram}
\`\`\`

`;
        }
        if (dataFlowResult.pageFlows && dataFlowResult.pageFlows.length > 0) {
            formatted += `#### Page Data Flows
`;
            dataFlowResult.pageFlows.slice(0, 5).forEach((flow, index) => {
                formatted += `${index + 1}. **${flow.pageName}**\n`;
                formatted += `   - File: \`${flow.pageFile}\`\n`;
                formatted += `   - API Calls: ${flow.apiCalls?.length || 0}\n`;
                formatted += `   - State Access: ${flow.stateAccess?.length || 0}\n`;
                formatted += `   - Component Usage: ${flow.componentUsage?.length || 0}\n\n`;
            });
        }
        return formatted;
    }
    /**
     * 生成简单代码分析模板
     *
     * 生成一个简化的代码分析报告，包含前20个重要目录的概览。
     * 每个目录包含其目的、文件数量和检测到的实体数量。
     *
     * @param analysis 项目分析结果
     * @param entities 项目中的所有实体
     * @param directoryMap 目录路径到实体列表的映射
     * @param importantDirectories 排序后的重要目录列表
     * @returns 格式化后的Markdown文本，包含所有重要目录的概览
     */
    static generateSimpleCodeAnalysis(analysis, entities, directoryMap, importantDirectories) {
        return importantDirectories.slice(0, 20).map(dir => {
            const folderEntities = directoryMap.get(dir.path) || [];
            const entityList = folderEntities.slice(0, 5).map(entity => `- **${entity.id || entity.rawName}** (${entity.type})`).join('\n');
            return `## 📁 ${dir.path}

### 🎯 Directory Function
- **Primary Role**: ${dir.purpose}
- **File Count**: ${dir.fileCount} files
- **Entity Count**: ${folderEntities.length} entities

### 📋 Main Entities
${entityList || '- No detected entities'}

---`;
        }).join('\n');
    }
    /**
     * 生成回退架构概览模板
     *
     * 生成一个回退的架构概览，包含项目基本信息、技术栈、文件数量、
     * 实体数量和目录数量。主要用于当详细分析不可用时提供一个基础概览。
     *
     * @param analysis 项目分析结果
     * @param entities 项目中的所有实体
     * @returns 格式化后的Markdown文本，包含回退的架构概览
     */
    static generateFallbackArchitectureOverview(analysis, entities) {
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        return `# ${analysis.projectName} - Project Architecture Overview

## 📊 Basic Project Information
- **Project Type**: ${analysis.projectType}
- **Technology Stack**: ${analysis.technologies.join(', ')}
- **Total Files**: ${analysis.structure.totalFiles}
- **Code Entities**: ${filteredEntities.length}
- **Directory Count**: ${analysis.structure.directories?.length || 0}

## 🏗️ Technology Architecture

### Core Technologies
${analysis.technologies.map(tech => `- **${tech}**: Core technology component`).join('\n')}

### Project Structure
- **Source Files**: ${analysis.structure.totalFiles} files
- **Entity Distribution**: ${filteredEntities.length} code entities
- **Directory Organization**: ${analysis.structure.directories?.length || 0} directories

## 📋 Entity Overview
${this.formatEntitySummary(filteredEntities)}

---

*Note: This is a basic analysis. For more detailed insights, please ensure all analysis dependencies are properly configured.*`;
    }
    /**
     * 生成回退目录分析模板
     *
     * 生成一个回退的目录分析模板，包含目录基本信息和检测到的实体。
     * 主要用于当详细分析不可用时提供一个基础目录分析。
     *
     * @param dir 目录信息
     * @param entities 目录中的实体列表
     * @returns 格式化后的Markdown文本，包含回退的目录分析
     */
    static generateFallbackDirectoryAnalysis(dir, entities) {
        const entityList = entities.slice(0, 5).map(entity => `- **${entity.id || entity.rawName}** (${entity.type}): Located in \`${path_1.default.basename(entity.file)}\``).join('\n');
        return `## 📁 ${dir.path}

### 🎯 Directory Overview
- **Primary Role**: ${dir.purpose}
- **File Count**: ${dir.fileCount} files
- **Entity Count**: ${entities.length} entities

### 📋 Key Entities
${entityList || '- No detected entities'}

### 🔍 Analysis Status
*This is a simplified analysis. Enhanced analysis temporarily unavailable.*

---`;
    }
    /**
     * 综合分析报告模板
     *
     * 构建一个综合的技术分析报告，包含架构概览、目录结构、路由分析、
     * 数据流分析等部分。所有部分都是可选的，只有当有数据时才生成。
     *
     * @param data 包含各个分析结果的对象
     * @returns 格式化后的Markdown文本，包含综合的技术分析报告
     */
    static buildComprehensiveReport(data) {
        const { architectureOverview, detailedCodeAnalysis, routeAnalysis, dataFlowAnalysis } = data;
        let report = '# Comprehensive Technical Analysis Report\n\n';
        // Architecture overview
        if (architectureOverview) {
            report += '## 🏗️ Architecture Analysis\n\n';
            report += architectureOverview;
            report += '\n\n---\n\n';
        }
        // Detailed code analysis
        if (detailedCodeAnalysis) {
            report += '## 🗂️ Project Directory Structure\n\n';
            report += detailedCodeAnalysis;
            report += '\n\n---\n\n';
        }
        // Route analysis
        if (routeAnalysis) {
            report += routeAnalysis;
            report += '\n\n---\n\n';
        }
        // Data flow analysis
        if (dataFlowAnalysis) {
            report += '## 📊 Application Data Flow Analysis\n\n';
            report += dataFlowAnalysis;
            report += '\n\n---\n\n';
        }
        return report;
    }
    /**
     * 构建完整README模板
     *
     * 构建一个完整的README文档，包含项目概览、架构洞察、目录分析、
     * 自定义需求和项目亮点。所有部分都是可选的，只有当有数据时才生成。
     *
     * @param analysis 项目分析结果
     * @param insights AI洞察，包含架构洞察和使用指南
     * @param entities 项目中的所有实体
     * @param customContent 自定义的业务特定要求或注意事项
     * @returns 格式化后的Markdown文本，包含完整的README文档
     */
    static buildReadme(aiGenerator, analysis, insights, entities, customContent) {
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        const importantDirectories = aiGenerator['filterImportantDirectories'](analysis.structure.directories);
        const directoryMap = aiGenerator['groupEntitiesByDirectory'](filteredEntities);
        // Build directory structure tree
        const directoryStructure = this.buildDirectoryTree(importantDirectories, directoryMap);
        // Generate project structure diagram for top-level display
        const mermaidGenerator = new mermaid_generator_1.MermaidGenerator();
        const architectureAnalyzer = new architecture_analyzer_1.ArchitectureAnalyzer();
        const mermaidDiagrams = mermaidGenerator.generateAllDiagrams(analysis, filteredEntities, architectureAnalyzer.analyzeArchitecture(analysis, filteredEntities));
        const projectStructureSection = this.generateProjectStructureSection(mermaidDiagrams);
        let readme = `# ${analysis.projectName} - Code Structure Analysis

## 📊 Project Overview
- **Project Name**: ${analysis.projectName}
- **Project Type**: ${analysis.projectType}
- **Technology Stack**: ${analysis.technologies.slice(0, 8).join(', ')}
- **Architecture Pattern**: ${analysis.architecture.pattern}
- **Total Files**: ${analysis.structure.totalFiles}
- **Total Code Lines**: ${analysis.codeStats.totalLines}
- **Total Entities**: ${filteredEntities.length}
`;
        if (projectStructureSection) {
            readme += '\n\n';
            readme += projectStructureSection;
            readme += '\n\n---\n\n';
        }
        if (directoryStructure) {
            readme += '\n\n## 🗂️ Project Directory Structure\n';
            readme += directoryStructure;
            readme += '\n\n---\n\n';
        }
        // Route analysis
        if (insights.routeAnalysis) {
            readme += '\n\n---\n\n';
            readme += insights.routeAnalysis;
            readme += '\n\n---\n\n';
        }
        // Custom content section
        readme += this.generateCustomRequirementsSection(customContent);
        // Architecture insights
        if (insights.architectureInsights) {
            readme += `${insights.architectureInsights}

## 📂 Detailed Directory Analysis
${insights.usageGuide}

${insights.developmentGuide}

## 🎯 Project Highlights

### ✨ Technical Highlights
- Modern technology stack ensuring project foresight and maintainability
- Well-designed modular architecture with clear responsibilities and easy scalability
- Comprehensive type system improving development efficiency and code quality

### 🔧 Architecture Advantages
- Clear layered architecture following software engineering best practices
- Reasonable file organization facilitating team collaboration
- Good coding standards improving project readability and maintainability

### 📚 Maintenance Guide
- Regularly update dependencies to keep the tech stack fresh
- Continuously optimize code structure to eliminate technical debt
- Improve documentation system to enhance project transferability

---

*This document is automatically generated by AI, focusing on in-depth analysis of project architecture and code structure. Generated at：${new Date().toLocaleString('en-US')}*
`;
        }
        return readme;
    }
    /**
     * 生成回退README模板
     *
     * 生成一个回退的README模板，包含项目基本信息和分析状态。
     * 主要用于当详细分析不可用时提供一个基础项目概览。
     *
     * @param analysis 项目分析结果
     * @returns 格式化后的Markdown文本，包含回退的README
     */
    static generateFallbackReadme(analysis) {
        return `# ${analysis.projectName}

## 📋 Basic Project Information
- **Project Type**: ${analysis.projectType}
- **Technology Stack**: ${analysis.technologies.join(', ')}
- **Total Files**: ${analysis.structure.totalFiles}

## ⚠️ Analysis Status
The detailed AI analysis is currently unavailable. This is a basic project overview.

### Project Structure
- **Files**: ${analysis.structure.totalFiles}
- **Directories**: ${analysis.structure.directories?.length || 0}

### Technology Stack
${analysis.technologies.map(tech => `- ${tech}`).join('\n')}

---

*For detailed analysis, please ensure all dependencies are properly configured and try again.*`;
    }
    /**
     * 生成空目录分析模板
     *
     * 生成一个表示目录为空的Markdown模板，包含目录路径和状态。
     * 主要用于当目录中没有检测到实体时。
     *
     * @param dir 目录信息
     * @returns 格式化后的Markdown文本，表示目录为空
     */
    static generateEmptyDirectoryAnalysis(dir) {
        return `## 📁 ${dir.path}

**Status**: No code entities detected in this directory

**Purpose**: ${dir.purpose}

---`;
    }
    /**
     * 生成无效实体目录分析模板
     *
     * 生成一个表示目录存在但未检测到有效实体的Markdown模板，
     * 包含目录路径和状态。主要用于当目录存在但无法提取实体时。
     *
     * @param dir 目录信息
     * @returns 格式化后的Markdown文本，表示目录存在但未检测到有效实体
     */
    static generateInvalidEntitiesDirectoryAnalysis(dir) {
        return `## 📁 ${dir.path}

**Status**: Directory exists but no valid entities extracted

**Purpose**: ${dir.purpose}

---`;
    }
    /**
     * 构建目录树结构模板
     *
     * 生成一个Mermaid格式的目录树结构模板，包含目录路径、文件数量、
     * 实体数量和目录用途。主要用于可视化项目结构。
     *
     * @param directories 目录信息列表
     * @param directoryMap 目录路径到实体列表的映射
     * @returns 格式化后的Mermaid代码，表示目录树结构
     */
    static buildDirectoryTree(directories, directoryMap) {
        let tree = '```\n';
        directories.forEach((dir, index) => {
            const folderEntities = directoryMap.get(dir.path) || [];
            const isLast = index === directories.length - 1;
            const prefix = isLast ? '└── ' : '├── ';
            tree += `${prefix}📁 ${dir.path}\n`;
            tree += `${isLast ? '    ' : '│   '}├── Files: ${dir.fileCount} files\n`;
            tree += `${isLast ? '    ' : '│   '}├── Entities: ${folderEntities.length} entities\n`;
            tree += `${isLast ? '    ' : '│   '}└── Purpose: ${dir.purpose}\n`;
            if (!isLast) {
                tree += '│\n';
            }
        });
        tree += '```\n';
        return tree;
    }
    /**
     * 生成项目架构图表模板
     *
     * 生成一个Markdown格式的项目架构图表模板，包含一个Mermaid图表。
     * 主要用于可视化项目的技术架构。
     *
     * @param mermaidDiagrams 包含Mermaid图表信息的数组
     * @returns 格式化后的Markdown文本，包含项目架构图表
     */
    static generateProjectStructureSection(mermaidDiagrams) {
        if (!mermaidDiagrams || !Array.isArray(mermaidDiagrams) || mermaidDiagrams.length === 0) {
            return '';
        }
        const firstDiagram = mermaidDiagrams[0];
        if (!firstDiagram || !firstDiagram.title || !firstDiagram.description || !firstDiagram.content) {
            return '';
        }
        return `## 📊 Project Architecture Diagrams

### ${firstDiagram.title}
${firstDiagram.description}

\`\`\`mermaid
${firstDiagram.content}
\`\`\`

`;
    }
    /**
     * 生成自定义需求模板
     *
     * 生成一个Markdown格式的自定义需求模板，包含业务特定要求和
     * 重点关注事项。主要用于在README中添加特定的业务或技术要求。
     *
     * @param customContent 自定义的业务特定要求或注意事项
     * @returns 格式化后的Markdown文本，包含自定义需求
     */
    static generateCustomRequirementsSection(customContent) {
        if (!customContent)
            return '';
        return `
## 🎯 业务特定要求与重点关注

${customContent}

---

`;
    }
    /**
     * 格式化实体摘要
     *
     * 将实体列表按类型进行统计，并生成一个实体分布概览。
     * 主要用于在README中生成实体分布的Markdown表格。
     *
     * @param entities 项目中的所有实体
     * @returns 格式化后的Markdown文本，包含实体分布概览
     */
    static formatEntitySummary(entities) {
        const entityTypes = new Map();
        entities.forEach(entity => {
            const count = entityTypes.get(entity.type) || 0;
            entityTypes.set(entity.type, count + 1);
        });
        if (entityTypes.size === 0) {
            return '- No code entities detected';
        }
        const summary = Array.from(entityTypes.entries())
            .map(([type, count]) => `- **${type}**: ${count} entities`)
            .join('\n');
        return `### Entity Distribution\n${summary}`;
    }
}
exports.TemplateFormatters = TemplateFormatters;
