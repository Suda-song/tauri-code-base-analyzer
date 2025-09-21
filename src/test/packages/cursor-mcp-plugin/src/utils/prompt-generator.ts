import { Entity } from "../types";
import { multiWorkspaceManager } from "./multi-workspace-utils";
import { extractReadmeSections, ReadmeSection } from "@xhs/modular-code-analysis-agent";

/**
 * 根据文件路径过滤README内容
 */
function filterReadmeByFiles(readmeContent: string, entityFiles: string[], sectionType: 'route' | 'directory'): string {
  if (!readmeContent.trim() || entityFiles.length === 0) return readmeContent;
  
  const lines = readmeContent.split('\n');
  const filteredLines: string[] = [];
  let currentSection = '';
  let shouldInclude = false;
  
  for (const line of lines) {
    // 检测route路径或directory路径
    if (sectionType === 'route') {
      // 匹配route路径格式：### 📁 src/containers/...
      if (line.match(/^### 📁\s+(.+)/)) {
        const routePath = line.match(/^### 📁\s+(.+)/)?.[1] || '';
        shouldInclude = entityFiles.some(file => file.includes(routePath) || routePath.includes(file.replace(/^.*\/src\//, 'src/')));
        currentSection = line;
      }
    } else if (sectionType === 'directory') {
      // 匹配directory路径格式：## 📁 详细文件夹 - src/... 或 #### 📄 filename
      if (line.match(/^##+ 📁.+src\/(.+)/)) {
        const dirPath = line.match(/src\/(.+)/)?.[0] || '';
        shouldInclude = entityFiles.some(file => file.includes(dirPath) || dirPath.includes(file.replace(/^.*\/src\//, 'src/')));
        currentSection = line;
      } else if (line.match(/^#### 📄\s+(.+)/)) {
        const fileName = line.match(/^#### 📄\s+(.+)/)?.[1] || '';
        shouldInclude = entityFiles.some(file => file.includes(fileName));
        currentSection = line;
      }
    }
    
    // 如果遇到新的section标题，重置状态
    if ((line.startsWith('### ') || line.startsWith('## ') || line.startsWith('#### ')) && line !== currentSection) {
      shouldInclude = false;
    }
    
    // 添加相关的行
    if (shouldInclude || (currentSection && line === currentSection)) {
      filteredLines.push(line);
    }
  }
  
  return filteredLines.length > 0 ? filteredLines.join('\n') : '';
}

/**
 * 获取README相关内容（优化过长内容，根据实体文件过滤）
 */
async function getReadmeContent(workspacePath: string, entityFiles: string[]): Promise<string> {
  try {
    const readmeData = await extractReadmeSections({
      workspace: workspacePath,
      sections: ['route', 'directory', 'structure', 'architecture']
    });

    let content = '';
    
    // 收集所有非空的README部分
    const sections = ['structure', 'architecture', 'route', 'directory'] as const;
    const availableContent: string[] = [];
    
    for (const section of sections) {
      if (readmeData[section]?.trim()) {
        let sectionContent = readmeData[section].trim();
        
        // 对route和directory部分根据实体文件进行过滤
        if (section === 'route' || section === 'directory') {
          sectionContent = filterReadmeByFiles(sectionContent, entityFiles, section);
        }
        
        if (sectionContent.trim()) {
          availableContent.push(`### ${section.charAt(0).toUpperCase() + section.slice(1)}\n${sectionContent}`);
        }
      }
    }
    
    if (availableContent.length === 0) return '';
    
    content = availableContent.join('\n\n');
    
    // 如果内容过长（超过4000字符），进行优化
    if (content.length > 4000) {
      // 优先保留structure和architecture，截断其他部分
      const prioritySections = ['structure', 'architecture'];
      let optimizedContent = '';
      
      for (const section of prioritySections) {
        if (readmeData[section as ReadmeSection]?.trim()) {
          optimizedContent += `### ${section.charAt(0).toUpperCase() + section.slice(1)}\n${readmeData[section as ReadmeSection].trim()}\n\n`;
        }
      }
      
      // 如果还有空间，添加过滤后的route或directory内容
      const remainingSpace = 4000 - optimizedContent.length;
      if (remainingSpace > 300) {
        for (const section of ['route', 'directory']) {
          if (readmeData[section as ReadmeSection]?.trim()) {
            let sectionContent = readmeData[section as ReadmeSection].trim();
            
            // 根据实体文件过滤内容
            sectionContent = filterReadmeByFiles(sectionContent, entityFiles, section as 'route' | 'directory');
            
            if (sectionContent.trim()) {
              const truncated = sectionContent.length > remainingSpace/2 
                ? sectionContent.substring(0, remainingSpace/2) + '\n...(内容已截断，仅显示相关部分)'
                : sectionContent;
              optimizedContent += `### ${section.charAt(0).toUpperCase() + section.slice(1)}\n${truncated}\n\n`;
              break;
            }
          }
        }
      }
      
      content = optimizedContent.trim();
    }
    
    return content;
  } catch (error) {
    console.warn(`获取README内容失败 (${workspacePath}):`, error);
    return '';
  }
}

/**
 * 生成代码提示词的辅助函数（支持多workspace）
 * @param userInput 用户输入
 * @param entities 实体列表
 * @param additionalContext 额外上下文
 * @returns 生成的代码提示词
 */
export async function generateCodePrompt(userInput: string, entities: Entity[], additionalContext?: string): Promise<string> {
  // 按workspace分组显示实体
  const workspaceGroups = multiWorkspaceManager.groupEntitiesByWorkspace(entities);

  // 收集每个workspace的README内容
  const workspaceReadmeContents = new Map<string, string>();
  for (const [workspacePath, workspaceEntities] of workspaceGroups.entries()) {
    const entityFiles = workspaceEntities.map(e => e.file);
    const readmeContent = await getReadmeContent(workspacePath, entityFiles);
    if (readmeContent) {
      workspaceReadmeContents.set(workspacePath, readmeContent);
    }
  }

  let prompt = `# 代码实现需求

## 用户需求
${userInput}

${additionalContext ? `## 额外上下文
${additionalContext}

` : ''}## 📋 涉及的代码实体

${Array.from(workspaceGroups.entries())
  .map(([workspacePath, workspaceEntities]) => {
    const workspaceName = require('path').basename(workspacePath);
    
    // 分离核心组件和相关实体
    const coreComponents = workspaceEntities.filter((entity: Entity) => 
      workspaceEntities.indexOf(entity) === 0
    );
    const relatedEntities = workspaceEntities.filter((entity: Entity) => 
      !coreComponents.includes(entity)
    );
    
    let workspaceSection = `### 📂 workspace: ${workspaceName}

#### 核心组件
${coreComponents.map((entity: Entity, index: number) => 
  `${index + 1}. **${entity.id}** (${entity.type})
   - 文件: ${entity.file}
   - 摘要: ${entity.summary || '无摘要'}
   - 标签: ${entity.tags?.join(', ') || '无标签'}
   ${entity.projectDesc ? `- 项目描述: ${entity.projectDesc}` : ''}
   ${entity.publishTag ? `- 需求迭代: ${entity.publishTag}` : ''}
   ${entity.ANNOTATION ? `- 注释: ${entity.ANNOTATION}` : ''}`
).join('\n\n')}`;

    if (relatedEntities.length > 0) {
      workspaceSection += `

#### 相关实体
${relatedEntities.map((entity: Entity, index: number) => 
  `${index + 1}. **${entity.id}** (${entity.type})
   - 文件: ${entity.file}
   - 摘要: ${entity.summary || '无摘要'}
   - 标签: ${entity.tags?.join(', ') || '无标签'}
   ${entity.projectDesc ? `- 项目描述: ${entity.projectDesc}` : ''}
   ${entity.publishTag ? `- 需求迭代: ${entity.publishTag}` : ''}
   ${entity.ANNOTATION ? `- 注释: ${entity.ANNOTATION}` : ''}`
).join('\n\n')}`;
    }

    // 添加该workspace的README内容
    const readmeContent = workspaceReadmeContents.get(workspacePath);
    if (readmeContent) {
      workspaceSection += `

#### 📖 项目结构信息
${readmeContent}`;
    }

    return workspaceSection;
  }).join('\n\n')
}

## 实现要求

请基于以上核心组件${entities.length > 1 ? '和相关代码实体' : ''}，实现用户需求。

要求：
1. **充分理解现有代码结构和业务逻辑**
   - 仔细分析每个实体的摘要、项目描述和标签信息
   - 理解组件间的依赖关系和调用链路

2. **项目结构信息参考**
   - 📖 **项目结构信息**：参考上述各workspace的项目结构说明，了解整体架构设计
   - 🌐 **路由配置**：关注与当前实体相关的路由配置和页面入口信息（已根据实体文件路径过滤）
   - 📂 **目录详情**：参考相关目录的功能说明和文件依赖关系（已根据实体文件路径过滤）
   - 这些信息帮助您理解代码的组织方式、业务功能分工和文件依赖关系

3. **确保新代码与现有代码风格保持一致**
   - 遵循现有的命名规范、组件结构和代码组织方式
   - 保持与现有业务逻辑的一致性

4. **考虑代码的可维护性和扩展性**
   - 设计时考虑未来可能的功能扩展
   - 确保代码具有良好的可读性和可维护性

5. **多项目协同**: 基于上述涉及的不同项目及其实体，需要：
   - 分析需求在各项目中的功能分工和实现边界
   - 识别哪些功能应在哪个项目中实现，避免重复开发
   - 考虑项目间的数据流转和调用关系
   - 确保各项目中相关实体的修改保持逻辑一致性
   - 如涉及共享代码或通用逻辑，合理规划代码复用策略

6. **精准实现**
   - 提供清晰的实现思路和关键代码
   - 如需修改现有文件，请明确指出修改点
   - 确保实现方案与项目现有的技术栈和架构模式保持一致

请开始实现...`;

  return prompt;
} 