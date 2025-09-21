/**
 * Mermaid 图表生成器 - 负责生成项目架构图和依赖图
 */

import { ProjectAnalysis } from '../types';
import { BaseEntity, MermaidDiagram } from './types';
import { ArchitectureInsights, DDDAnalysis } from './architecture-analyzer';

export class MermaidGenerator {
  
  /**
   * 生成所有相关的Mermaid图表
   */
  generateAllDiagrams(
    analysis: ProjectAnalysis, 
    entities: BaseEntity[], 
    architectureInsights: ArchitectureInsights
  ): MermaidDiagram[] {
    const diagrams: MermaidDiagram[] = [];
    
    // 1. 项目架构依赖图
    // diagrams.push(this.generateArchitectureDiagram(analysis, entities));
    // 7.29 11:30 项目架构依赖图有些冗余，暂不生成
    diagrams.push({
      type: 'flowchart',
      title: '',
      content: '',
      description: ''
    });
    
    // 2. DDD数据流图 (如果是DDD项目)
    if (architectureInsights.dddAnalysis.isDDD) {
      diagrams.push(this.generateDDDDataFlowDiagram(architectureInsights.dddAnalysis));
    }
    
    // 3. 组件依赖图
    // diagrams.push(this.generateComponentDependencyDiagram(entities));
    // 7.29 11:30 组件依赖图有些冗余，暂不生成
    diagrams.push({
      type: 'flowchart',
      title: '',
      content: '',
      description: ''
    });
    
    // 4. 分层架构图
    diagrams.push(this.generateLayerDiagram(architectureInsights.layerStructure));
    
    // 5. 技术栈分布图
    diagrams.push(this.generateTechStackPieChart(analysis));
    
    return diagrams;
  }

  /**
   * 生成项目架构依赖图
   */
  generateArchitectureDiagram(analysis: ProjectAnalysis, entities: BaseEntity[]): MermaidDiagram {
    // 过滤出项目源码目录，排除 node_modules 等第三方库
    const directories = analysis.structure.directories
      .filter(d => 
        d.fileCount > 0 && 
        !d.path.includes('node_modules') && 
        !d.path.includes('dist') && 
        !d.path.includes('build') &&
        !d.path.includes('.git') &&
        (d.path.startsWith('src') || d.path.startsWith('packages') || d.path.startsWith('apps') || d.path.includes('components') || d.path.includes('pages') || d.path.includes('utils') || d.path.includes('services'))
      )
      .slice(0, 12); // 限制节点数量
    
    let content = 'flowchart TD\n';
    
    // 添加主要目录节点
    directories.forEach(dir => {
      const cleanId = this.sanitizeId(dir.path);
      const displayName = this.getDisplayName(dir.path);
      const icon = this.getDirectoryIcon(dir.path);
      content += `    ${cleanId}["${icon} ${displayName}<br/>📄 ${dir.fileCount} files"]\n`;
    });
    
    content += '\n';
    
    // 分析目录间的依赖关系
    const dependencies = this.analyzeDependenciesBetweenDirectories(directories, entities);
    
    // 添加依赖关系连接
    if (dependencies.length > 0) {
    dependencies.forEach(dep => {
        const fromId = this.sanitizeId(dep.from);
        const toId = this.sanitizeId(dep.to);
        content += `    ${fromId} --> ${toId}\n`;
    });
         } else {
       // 如果没有发现依赖关系，添加一些常见的架构关系
       content = this.addCommonArchitectureConnections(content, directories);
     }
    
    // 添加样式
    content += '\n';
    content += '    classDef presentation fill:#e3f2fd\n';
    content += '    classDef business fill:#fff3e0\n';
    content += '    classDef data fill:#f3e5f5\n';
    content += '    classDef infrastructure fill:#e8f5e8\n';
    content += '    classDef utility fill:#f1f8e9\n';
    
    // 应用样式
    directories.forEach(dir => {
      const cleanId = this.sanitizeId(dir.path);
      const category = this.categorizeDirectory(dir.path);
      content += `    class ${cleanId} ${category}\n`;
    });
    
    return {
      type: 'flowchart',
      title: '项目架构依赖图',
      content,
      description: '展示项目主要模块结构和它们之间的依赖关系'
    };
  }

  /**
   * 生成DDD数据流图
   */
  generateDDDDataFlowDiagram(dddAnalysis: DDDAnalysis): MermaidDiagram {
    let content = 'flowchart LR\n';
    
    // 用户界面层
    content += '    subgraph UI["🖥️ 用户界面层"]\n';
    content += '        Controller["Controller"]\n';
    content += '        View["View"]\n';
    content += '    end\n\n';
    
    // 应用层
    content += '    subgraph APP["⚙️ 应用层"]\n';
    dddAnalysis.services.slice(0, 5).forEach(service => {
      const serviceId = this.sanitizeId(service);
      content += `        ${serviceId}["${service}"]\n`;
    });
    content += '    end\n\n';
    
    // 领域层
    content += '    subgraph DOMAIN["🏢 领域层"]\n';
    dddAnalysis.entities.slice(0, 5).forEach(entity => {
      const entityId = this.sanitizeId(entity);
      content += `        ${entityId}["${entity}"]\n`;
    });
    
    dddAnalysis.aggregates.slice(0, 3).forEach(aggregate => {
      const aggregateId = this.sanitizeId(aggregate);
      content += `        ${aggregateId}["${aggregate}"]\n`;
    });
    content += '    end\n\n';
    
    // 基础设施层
    content += '    subgraph INFRA["🔧 基础设施层"]\n';
    dddAnalysis.repositories.slice(0, 5).forEach(repo => {
      const repoId = this.sanitizeId(repo);
      content += `        ${repoId}["${repo}"]\n`;
    });
    content += '        Database[("💾 数据库")]\n';
    content += '    end\n\n';
    
    // 添加数据流连接
    content += '    Controller --> View\n';
    if (dddAnalysis.services.length > 0) {
      content += `    Controller --> ${this.sanitizeId(dddAnalysis.services[0])}\n`;
    }
    
    // 服务到实体的流向
    if (dddAnalysis.services.length > 0 && dddAnalysis.entities.length > 0) {
      content += `    ${this.sanitizeId(dddAnalysis.services[0])} --> ${this.sanitizeId(dddAnalysis.entities[0])}\n`;
    }
    
    // 仓储到数据库的流向
    if (dddAnalysis.repositories.length > 0) {
      content += `    ${this.sanitizeId(dddAnalysis.repositories[0])} --> Database\n`;
    }
    
    // 添加样式
    content += '\n';
    content += '    classDef ui fill:#e3f2fd\n';
    content += '    classDef app fill:#fff3e0\n';
    content += '    classDef domain fill:#e8f5e8\n';
    content += '    classDef infra fill:#fce4ec\n';
    
    return {
      type: 'flowchart',
      title: 'DDD架构数据流图',
      content,
      description: '展示领域驱动设计(DDD)架构中各层之间的数据流转关系'
    };
  }

  /**
   * 生成组件依赖图
   */
  generateComponentDependencyDiagram(entities: BaseEntity[]): MermaidDiagram {
    const components = entities.filter(e => 
      e.type === 'component' || e.file.endsWith('.vue') || e.file.endsWith('.tsx') || e.file.endsWith('.jsx')
    ).slice(0, 12); // 限制数量
    
    let content = 'flowchart TD\n';
    
    // 为组件生成更好的显示名称和ID
    const componentMap = new Map<string, {
      id: string;
      displayName: string;
      file: string;
      entity: BaseEntity;
    }>();
    
    components.forEach(comp => {
      const displayName = this.getComponentDisplayName(comp);
      const compId = this.sanitizeId(comp.file.replace(/[./]/g, '_'));
      componentMap.set(comp.file, {
        id: compId,
        displayName,
        file: comp.file,
        entity: comp
      });
    });
    
    // 添加组件节点
    componentMap.forEach(({ id, displayName, entity }) => {
      const compType = this.getComponentType(entity);
      const icon = this.getComponentIcon(compType, displayName);
      content += `    ${id}["${icon} ${displayName}"]\n`;
    });
    
    content += '\n';
    
    // 分析并添加依赖关系
    let hasConnections = false;
    componentMap.forEach(({ id: sourceId, entity: sourceEntity, file: sourceFile }) => {
      
      // 1. 分析模板组件依赖（Vue 特有）
      if (sourceEntity.TEMPLATE_COMPONENTS && Array.isArray(sourceEntity.TEMPLATE_COMPONENTS)) {
        sourceEntity.TEMPLATE_COMPONENTS.forEach(templateCompName => {
          // 查找对应的组件
          const targetComponent = this.findComponentByName(templateCompName, componentMap);
          if (targetComponent) {
            content += `    ${sourceId} --> ${targetComponent.id}\n`;
            hasConnections = true;
            console.log(`✅ 发现模板依赖: ${sourceFile} -> ${targetComponent.file}`);
          }
        });
      }
      
      // 2. 分析导入依赖
      if (sourceEntity.IMPORTS && Array.isArray(sourceEntity.IMPORTS)) {
        sourceEntity.IMPORTS.forEach(importPath => {
          const targetComponent = this.findComponentByImportPath(importPath, componentMap);
          if (targetComponent && targetComponent.id !== sourceId) {
            content += `    ${sourceId} --> ${targetComponent.id}\n`;
            hasConnections = true;
            console.log(`✅ 发现导入依赖: ${sourceFile} -> ${targetComponent.file}`);
          }
        });
      }
    });
    
         // 如果没有发现任何连接，添加一些常见的架构连接
     if (!hasConnections) {
       console.log('⚠️ 未发现组件间依赖关系，生成基于文件结构的推测关系');
       content = this.addInferredComponentConnections(content, componentMap);
     }
    
    // 添加样式
    content += '\n';
    content += '    classDef business fill:#e8f5e8\n';
    content += '    classDef ui fill:#e3f2fd\n';
    content += '    classDef utility fill:#fff3e0\n';
    content += '    classDef page fill:#fce4ec\n';
    
    // 应用样式
    componentMap.forEach(({ id, entity }) => {
      const compType = this.getComponentType(entity);
      content += `    class ${id} ${compType}\n`;
    });
    
    return {
      type: 'flowchart',
      title: '组件依赖关系图',
      content,
      description: '展示项目中主要组件之间的依赖关系和数据流向'
    };
  }

  /**
   * 生成分层架构图
   */
  generateLayerDiagram(layerStructure: any): MermaidDiagram {
    let content = 'flowchart TD\n';
    
    // 表现层
    if (layerStructure.presentation.length > 0) {
      content += '    subgraph PRES["🖥️ 表现层 (Presentation)"]\n';
      layerStructure.presentation.slice(0, 5).forEach((item: string, index: number) => {
        const itemId = `pres${index}`;
        const displayName = item.split('/').pop() || item;
        content += `        ${itemId}["${displayName}"]\n`;
      });
      content += '    end\n\n';
    }
    
    // 业务层
    if (layerStructure.business.length > 0) {
      content += '    subgraph BIZ["🏢 业务层 (Business)"]\n';
      layerStructure.business.slice(0, 5).forEach((item: string, index: number) => {
        const itemId = `biz${index}`;
        const displayName = item.split('/').pop() || item;
        content += `        ${itemId}["${displayName}"]\n`;
      });
      content += '    end\n\n';
    }
    
    // 数据层
    if (layerStructure.data.length > 0) {
      content += '    subgraph DATA["💾 数据层 (Data)"]\n';
      layerStructure.data.slice(0, 5).forEach((item: string, index: number) => {
        const itemId = `data${index}`;
        const displayName = item.split('/').pop() || item;
        content += `        ${itemId}["${displayName}"]\n`;
      });
      content += '    end\n\n';
    }
    
    // 基础设施层
    if (layerStructure.infrastructure.length > 0) {
      content += '    subgraph INFRA["🔧 基础设施层 (Infrastructure)"]\n';
      layerStructure.infrastructure.slice(0, 5).forEach((item: string, index: number) => {
        const itemId = `infra${index}`;
        const displayName = item.split('/').pop() || item;
        content += `        ${itemId}["${displayName}"]\n`;
      });
      content += '    end\n\n';
    }
    
    // 添加层间依赖
    if (layerStructure.presentation.length > 0 && layerStructure.business.length > 0) {
      content += '    PRES --> BIZ\n';
    }
    if (layerStructure.business.length > 0 && layerStructure.data.length > 0) {
      content += '    BIZ --> DATA\n';
    }
    if (layerStructure.data.length > 0 && layerStructure.infrastructure.length > 0) {
      content += '    DATA --> INFRA\n';
    }
    
    // 添加样式
    content += '\n';
    content += '    classDef presentation fill:#e3f2fd\n';
    content += '    classDef business fill:#e8f5e8\n';
    content += '    classDef data fill:#fff3e0\n';
    content += '    classDef infrastructure fill:#fce4ec\n';
    
    return {
      type: 'flowchart',
      title: '分层架构图',
      content,
      description: '展示项目的分层架构结构和各层之间的依赖关系'
    };
  }

  /**
   * 生成技术栈分布饼图
   */
  generateTechStackPieChart(analysis: ProjectAnalysis): MermaidDiagram {
    const techStack = analysis.technologies.slice(0, 8);
    
    let content = 'pie title 技术栈分布\n';
    
    // 模拟各技术栈的使用比例（实际项目中应基于文件数量或代码行数）
    const totalFiles = analysis.structure.totalFiles;
    
    techStack.forEach((tech, index) => {
      // 简单的比例分配逻辑，实际项目应该基于真实数据
      const percentage = Math.max(5, Math.floor((100 / techStack.length) + (Math.random() * 10 - 5)));
      content += `    "${tech}" : ${percentage}\n`;
    });
    
    return {
      type: 'pie',
      title: '技术栈分布图',
      content,
      description: '展示项目中各种技术栈的使用比例分布'
    };
  }

  /**
   * 获取目录显示名称
   */
  private getDisplayName(path: string): string {
    const segments = path.split('/');
    if (segments.length >= 2) {
      return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    }
    return segments[segments.length - 1] || path;
  }

  /**
   * 获取目录图标
   */
  private getDirectoryIcon(path: string): string {
    const lowerPath = path.toLowerCase();
    
    if (lowerPath.includes('component')) return '🎨';
    if (lowerPath.includes('page') || lowerPath.includes('view')) return '📄';
    if (lowerPath.includes('service') || lowerPath.includes('api')) return '⚙️';
    if (lowerPath.includes('store') || lowerPath.includes('state')) return '💾';
    if (lowerPath.includes('util') || lowerPath.includes('helper')) return '🔧';
    if (lowerPath.includes('config')) return '⚙️';
    if (lowerPath.includes('hook')) return '🪝';
    if (lowerPath.includes('router')) return '🛣️';
    if (lowerPath.includes('style') || lowerPath.includes('css')) return '🎨';
    
    return '📁';
  }

  /**
   * 添加常见的架构连接关系
   */
  private addCommonArchitectureConnections(content: string, directories: any[]): string {
    const dirPaths = directories.map(d => d.path);
    
    // 页面 -> 组件
    const pages = directories.filter(d => d.path.includes('page') || d.path.includes('view'));
    const components = directories.filter(d => d.path.includes('component'));
    
    pages.forEach(page => {
      components.forEach(comp => {
        const pageId = this.sanitizeId(page.path);
        const compId = this.sanitizeId(comp.path);
        content += `    ${pageId} --> ${compId}\n`;
      });
    });
    
    // 组件 -> 服务
    const services = directories.filter(d => d.path.includes('service') || d.path.includes('api'));
    
    [...pages, ...components].forEach(ui => {
      services.forEach(service => {
        const uiId = this.sanitizeId(ui.path);
        const serviceId = this.sanitizeId(service.path);
        content += `    ${uiId} --> ${serviceId}\n`;
      });
    });
    
    // 服务 -> 状态管理
    const stores = directories.filter(d => d.path.includes('store') || d.path.includes('state'));
    
    services.forEach(service => {
      stores.forEach(store => {
        const serviceId = this.sanitizeId(service.path);
        const storeId = this.sanitizeId(store.path);
        content += `    ${serviceId} --> ${storeId}\n`;
      });
    });
    
    // 通用工具类被多个模块使用
    const utils = directories.filter(d => d.path.includes('util') || d.path.includes('helper'));
    
    [...pages, ...components, ...services].forEach(module => {
      utils.forEach(util => {
        const moduleId = this.sanitizeId(module.path);
        const utilId = this.sanitizeId(util.path);
        content += `    ${moduleId} --> ${utilId}\n`;
      });
    });
    
    return content;
  }

  /**
   * 分析目录间的依赖关系
   */
  private analyzeDependenciesBetweenDirectories(directories: any[], entities: BaseEntity[]): Array<{from: string, to: string}> {
    const dependencies: Array<{from: string, to: string}> = [];
    const dirPaths = new Set(directories.map(d => d.path));
    
    // 分析跨目录的导入关系
    entities.forEach(entity => {
      const entityDir = this.getEntityDirectory(entity.file);
      
      if (entity.IMPORTS && dirPaths.has(entityDir)) {
        entity.IMPORTS.forEach(imp => {
          // 查找导入的文件所属目录
          const targetDir = this.findImportDirectory(imp, entities, dirPaths);
          
          if (targetDir && entityDir !== targetDir) {
            const existing = dependencies.find(d => d.from === entityDir && d.to === targetDir);
            if (!existing) {
              dependencies.push({ from: entityDir, to: targetDir });
            }
          }
        });
      }
      
      // 分析模板组件依赖（Vue 特有）
      if (entity.TEMPLATE_COMPONENTS && dirPaths.has(entityDir)) {
        entity.TEMPLATE_COMPONENTS.forEach(comp => {
          const targetEntity = entities.find(e => e.rawName === comp || e.file.includes(comp));
          if (targetEntity) {
            const targetDir = this.getEntityDirectory(targetEntity.file);
            if (targetDir && entityDir !== targetDir && dirPaths.has(targetDir)) {
                const existing = dependencies.find(d => d.from === entityDir && d.to === targetDir);
                if (!existing) {
                  dependencies.push({ from: entityDir, to: targetDir });
                }
              }
            }
        });
      }
    });
    
    return dependencies;
  }

  /**
   * 获取实体所属目录
   */
  private getEntityDirectory(filePath: string): string {
    const parts = filePath.split('/');
    // 返回最后两级目录路径，如 "src/components"
    if (parts.length >= 2) {
      return parts.slice(0, -1).join('/');
    }
    return filePath.substring(0, filePath.lastIndexOf('/'));
  }

  /**
   * 查找导入文件所属的目录
   */
  private findImportDirectory(importPath: string, entities: BaseEntity[], dirPaths: Set<string>): string | null {
    // 直接路径匹配
    for (const entity of entities) {
      if (entity.file.includes(importPath) || entity.rawName === importPath || entity.file.endsWith(importPath)) {
        const dir = this.getEntityDirectory(entity.file);
        if (dirPaths.has(dir)) {
          return dir;
        }
      }
    }
    
    // 模糊匹配
    const cleanImport = importPath.replace(/['"@/]/g, '');
    for (const entity of entities) {
      if (entity.file.includes(cleanImport) || entity.rawName.includes(cleanImport)) {
        const dir = this.getEntityDirectory(entity.file);
        if (dirPaths.has(dir)) {
          return dir;
        }
      }
    }
    
    return null;
  }

  /**
   * 分类目录类型
   */
  private categorizeDirectory(path: string): string {
    const lowerPath = path.toLowerCase();
    
    if (lowerPath.includes('component') || lowerPath.includes('page') || lowerPath.includes('view')) {
      return 'presentation';
    } else if (lowerPath.includes('service') || lowerPath.includes('business') || lowerPath.includes('domain') || lowerPath.includes('api')) {
      return 'business';
    } else if (lowerPath.includes('data') || lowerPath.includes('model') || lowerPath.includes('entity') || lowerPath.includes('store') || lowerPath.includes('state')) {
      return 'data';
    } else if (lowerPath.includes('config') || lowerPath.includes('infrastructure')) {
      return 'infrastructure';
    } else if (lowerPath.includes('util') || lowerPath.includes('helper') || lowerPath.includes('hook') || lowerPath.includes('common')) {
      return 'utility';
    }
    
    return 'business';
  }

  /**
   * 获取组件的显示名称
   */
  private getComponentDisplayName(entity: BaseEntity): string {
    const fileName = entity.file.split('/').pop() || entity.file;
    const baseName = fileName.replace(/\.(vue|tsx|jsx|ts|js)$/, '');
    
    // 如果是 index 文件，使用父目录名
    if (baseName.toLowerCase() === 'index') {
      const pathParts = entity.file.split('/');
      return pathParts[pathParts.length - 2] || baseName;
    }
    
    return baseName;
  }

  /**
   * 获取组件图标
   */
  private getComponentIcon(compType: string, displayName: string): string {
    const lowerName = displayName.toLowerCase();
    
    if (lowerName.includes('page') || lowerName.includes('dashboard')) return '📄';
    if (lowerName.includes('form')) return '📝';
    if (lowerName.includes('modal') || lowerName.includes('dialog')) return '🗨️';
    if (lowerName.includes('button')) return '🔘';
    if (lowerName.includes('table') || lowerName.includes('list')) return '📊';
    if (lowerName.includes('toast') || lowerName.includes('notification')) return '🔔';
    if (lowerName.includes('status')) return '📊';
    
    return compType === 'business' ? '🏢' : compType === 'ui' ? '🎨' : compType === 'page' ? '📄' : '🔧';
  }

  /**
   * 根据组件名查找组件
   */
  private findComponentByName(componentName: string, componentMap: Map<string, any>): any {
    // 遍历所有组件，查找匹配的
    for (const [filePath, componentInfo] of componentMap.entries()) {
      const { displayName, entity } = componentInfo;
      
      // 精确匹配
      if (displayName === componentName) {
        return componentInfo;
      }
      
      // 文件名匹配
      const fileName = filePath.split('/').pop()?.replace(/\.(vue|tsx|jsx)$/, '');
      if (fileName === componentName) {
        return componentInfo;
      }
      
      // 模糊匹配（忽略大小写）
      if (displayName.toLowerCase() === componentName.toLowerCase()) {
        return componentInfo;
      }
    }
    
    return null;
  }

  /**
   * 根据导入路径查找组件
   */
  private findComponentByImportPath(importPath: string, componentMap: Map<string, any>): any {
    // 清理导入路径
    const cleanPath = importPath.replace(/['"@]/g, '').replace(/^\.\/|^\.\.\//, '');
    
    for (const [filePath, componentInfo] of componentMap.entries()) {
      // 路径包含匹配
      if (filePath.includes(cleanPath) || cleanPath.includes(filePath.replace('src/', ''))) {
        return componentInfo;
      }
      
      // 文件名匹配
      const fileName = filePath.split('/').pop()?.replace(/\.(vue|tsx|jsx)$/, '');
      if (cleanPath.includes(fileName || '')) {
        return componentInfo;
      }
    }
    
    return null;
  }

  /**
   * 添加推测的组件连接关系
   */
  private addInferredComponentConnections(content: string, componentMap: Map<string, any>): string {
    const components = Array.from(componentMap.values());
    
    // 页面组件连接到其他组件
    const pages = components.filter(c => 
      c.file.includes('/page') || c.displayName.toLowerCase().includes('page') || 
      c.file.includes('/dashboard') || c.displayName.toLowerCase().includes('dashboard')
    );
    
    const forms = components.filter(c => 
      c.displayName.toLowerCase().includes('form')
    );
    
    const modals = components.filter(c => 
      c.displayName.toLowerCase().includes('modal')
    );
    
    const status = components.filter(c => 
      c.displayName.toLowerCase().includes('status')
    );
    
    // 页面 -> 表单
    pages.forEach(page => {
      forms.forEach(form => {
        content += `    ${page.id} --> ${form.id}\n`;
      });
    });
    
    // 页面 -> 状态组件
    pages.forEach(page => {
      status.forEach(statusComp => {
        content += `    ${page.id} --> ${statusComp.id}\n`;
      });
    });
    
    // 状态组件 -> 模态框
    status.forEach(statusComp => {
      modals.forEach(modal => {
        content += `    ${statusComp.id} --> ${modal.id}\n`;
      });
    });
    
    return content;
  }

  /**
   * 获取组件类型
   */
  private getComponentType(entity: BaseEntity): string {
    const fileName = entity.file.toLowerCase();
    const displayName = this.getComponentDisplayName(entity).toLowerCase();
    
    // 页面组件特征
    const pageKeywords = ['page', 'dashboard', 'view'];
    if (pageKeywords.some(keyword => fileName.includes(keyword) || displayName.includes(keyword))) {
      return 'page';
    }
    
    // 业务组件特征
    const businessKeywords = ['form', 'table', 'list', 'detail', 'chart', 'modal', 'status'];
    if (businessKeywords.some(keyword => fileName.includes(keyword) || displayName.includes(keyword))) {
      return 'business';
    }
    
    // UI组件特征
    const uiKeywords = ['button', 'input', 'select', 'dialog', 'tooltip', 'icon', 'layout', 'toast', 'notification'];
    if (uiKeywords.some(keyword => fileName.includes(keyword) || displayName.includes(keyword))) {
      return 'ui';
    }
    
    return 'utility';
  }

  /**
   * 清理ID，确保Mermaid语法兼容
   */
  private sanitizeId(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }
} 