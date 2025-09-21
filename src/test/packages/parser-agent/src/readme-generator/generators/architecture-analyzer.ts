/**
 * 架构分析器 - 专门负责项目架构模式分析
 */

import { ProjectAnalysis } from '../types';
import { BaseEntity } from './types';

export interface ArchitectureInsights {
  pattern: string;
  dddAnalysis: DDDAnalysis;
  frontendArchitecture: FrontendArchitecture;
  formArchitecture: FormArchitecture;
  layerStructure: LayerStructure;
  codeOrganization: CodeOrganization;
}

export interface DDDAnalysis {
  isDDD: boolean;
  domains: string[];
  entities: string[];
  valueObjects: string[];
  repositories: string[];
  services: string[];
  aggregates: string[];
  dataFlow: DataFlowNode[];
}

export interface FrontendArchitecture {
  type: 'MVC' | 'MVVM' | 'Component-Based' | 'Micro-Frontend' | 'Layered';
  stateManagement: string[];
  routingPattern: string;
  componentStructure: ComponentStructure;
}

export interface FormArchitecture {
  formLibraries: string[];
  validationPatterns: string[];
  formComponents: string[];
  formManagement: string;
}

export interface LayerStructure {
  presentation: string[];
  business: string[];
  data: string[];
  infrastructure: string[];
}

export interface CodeOrganization {
  byFeature: boolean;
  byLayer: boolean;
  byType: boolean;
  modularityScore: number;
}

export interface ComponentStructure {
  businessComponents: ComponentInfo[];
  uiComponents: ComponentInfo[];
  utilityComponents: ComponentInfo[];
}

export interface ComponentInfo {
  name: string;
  path: string;
  type: 'business' | 'ui' | 'utility';
  consumers: string[];
  dependencies: string[];
}

export interface DataFlowNode {
  from: string;
  to: string;
  type: 'data' | 'control' | 'dependency';
  description: string;
}

export class ArchitectureAnalyzer {
  
  /**
   * 分析项目架构模式
   */
  analyzeArchitecture(analysis: ProjectAnalysis, entities: BaseEntity[]): ArchitectureInsights {
    return {
      pattern: this.detectArchitecturePattern(analysis, entities),
      dddAnalysis: this.analyzeDDD(entities),
      frontendArchitecture: this.analyzeFrontendArchitecture(analysis, entities),
      formArchitecture: this.analyzeFormArchitecture(entities),
      layerStructure: this.analyzeLayerStructure(analysis, entities),
      codeOrganization: this.analyzeCodeOrganization(analysis, entities)
    };
  }

  /**
   * 检测架构模式
   */
  private detectArchitecturePattern(analysis: ProjectAnalysis, entities: BaseEntity[]): string {
    const directoryStructure = analysis.structure.directories.map(d => d.path);
    
    // 检测微前端
    if (directoryStructure.some(path => path.includes('micro-') || path.includes('subapp'))) {
      return 'Micro-Frontend';
    }
    
    // 检测分层架构
    const hasLayers = ['presentation', 'business', 'data', 'infrastructure']
      .some(layer => directoryStructure.some(path => path.toLowerCase().includes(layer)));
    
    if (hasLayers) {
      return 'Layered Architecture';
    }
    
    // 检测组件化架构
    const componentDirs = directoryStructure.filter(path => 
      path.includes('components') || path.includes('widgets')
    );
    
    if (componentDirs.length > 3) {
      return 'Component-Based Architecture';
    }
    
    // 检测MVC/MVVM
    const hasMVC = ['models', 'views', 'controllers'].every(pattern =>
      directoryStructure.some(path => path.toLowerCase().includes(pattern))
    );
    
    if (hasMVC) {
      return 'MVC Architecture';
    }
    
    const hasMVVM = ['viewmodels', 'views', 'models'].every(pattern =>
      directoryStructure.some(path => path.toLowerCase().includes(pattern))
    );
    
    if (hasMVVM) {
      return 'MVVM Architecture';
    }
    
    return 'Modular Architecture';
  }

  /**
   * 分析DDD模式
   */
  private analyzeDDD(entities: BaseEntity[]): DDDAnalysis {
    const domains: string[] = [];
    const entityNames: string[] = [];
    const valueObjects: string[] = [];
    const repositories: string[] = [];
    const services: string[] = [];
    const aggregates: string[] = [];
    
    entities.forEach(entity => {
      const fileName = entity.file.toLowerCase();
      const entityName = entity.rawName.toLowerCase();
      
      // 检测领域
      if (fileName.includes('domain') || fileName.includes('entity')) {
        const pathParts = entity.file.split('/');
        const domainName = pathParts.find(part => 
          !['src', 'domain', 'entities', 'models'].includes(part.toLowerCase())
        );
        if (domainName && !domains.includes(domainName)) {
          domains.push(domainName);
        }
      }
      
      // 检测实体
      if (entityName.endsWith('entity') || entity.type === 'class' && entity.isDDD) {
        entityNames.push(entity.rawName);
      }
      
      // 检测值对象
      if (entityName.endsWith('vo') || entityName.endsWith('valueobject')) {
        valueObjects.push(entity.rawName);
      }
      
      // 检测仓储
      if (entityName.endsWith('repository') || entityName.endsWith('repo')) {
        repositories.push(entity.rawName);
      }
      
      // 检测服务
      if (entityName.endsWith('service') || entityName.endsWith('domainservice')) {
        services.push(entity.rawName);
      }
      
      // 检测聚合根
      if (entityName.endsWith('aggregate') || entityName.endsWith('aggregateroot')) {
        aggregates.push(entity.rawName);
      }
    });
    
    const isDDD = domains.length > 0 || repositories.length > 0 || aggregates.length > 0;
    
    return {
      isDDD,
      domains,
      entities: entityNames,
      valueObjects,
      repositories,
      services,
      aggregates,
      dataFlow: this.generateDataFlow(entities)
    };
  }

  /**
   * 分析前端架构
   */
  private analyzeFrontendArchitecture(analysis: ProjectAnalysis, entities: BaseEntity[]): FrontendArchitecture {
    const stateManagement: string[] = [];
    let routingPattern = 'Unknown';
    
    // 检测状态管理
    const stateLibs = ['vuex', 'pinia', 'redux', 'mobx', 'zustand'];
    analysis.dependencies.frameworksAndLibraries.forEach(dep => {
      stateLibs.forEach(lib => {
        if (dep.toLowerCase().includes(lib)) {
          stateManagement.push(lib);
        }
      });
    });
    
    // 检测路由模式
    const routerFiles = entities.filter(e => 
      e.file.includes('router') || e.file.includes('route')
    );
    
    if (routerFiles.length > 0) {
      routingPattern = 'File-based Routing';
    }
    
    const componentStructure = this.analyzeComponentStructure(entities);
    
    return {
      type: this.detectFrontendType(analysis, entities),
      stateManagement,
      routingPattern,
      componentStructure
    };
  }

  /**
   * 检测前端架构类型
   */
  private detectFrontendType(analysis: ProjectAnalysis, entities: BaseEntity[]): FrontendArchitecture['type'] {
    const directories = analysis.structure.directories.map(d => d.path.toLowerCase());
    
    // 检测微前端
    if (directories.some(path => path.includes('micro') || path.includes('subapp'))) {
      return 'Micro-Frontend';
    }
    
    // 检测分层架构
    const layers = ['presentation', 'business', 'data'];
    if (layers.every(layer => directories.some(path => path.includes(layer)))) {
      return 'Layered';
    }
    
    // 检测组件化架构
    const componentPaths = directories.filter(path => path.includes('component'));
    if (componentPaths.length > 2) {
      return 'Component-Based';
    }
    
    return 'Component-Based';
  }

  /**
   * 分析组件结构
   */
  private analyzeComponentStructure(entities: BaseEntity[]): ComponentStructure {
    const businessComponents: ComponentInfo[] = [];
    const uiComponents: ComponentInfo[] = [];
    const utilityComponents: ComponentInfo[] = [];
    
    const componentEntities = entities.filter(e => 
      e.type === 'component' || e.file.includes('component') || e.file.endsWith('.vue') || e.file.endsWith('.tsx')
    );
    
    componentEntities.forEach(entity => {
      const componentInfo: ComponentInfo = {
        name: entity.rawName,
        path: entity.file,
        type: this.classifyComponent(entity),
        consumers: this.findComponentConsumers(entity, entities),
        dependencies: entity.IMPORTS || []
      };
      
      switch (componentInfo.type) {
        case 'business':
          businessComponents.push(componentInfo);
          break;
        case 'ui':
          uiComponents.push(componentInfo);
          break;
        case 'utility':
          utilityComponents.push(componentInfo);
          break;
      }
    });
    
    return {
      businessComponents,
      uiComponents,
      utilityComponents
    };
  }

  /**
   * 分类组件类型
   */
  private classifyComponent(entity: BaseEntity): 'business' | 'ui' | 'utility' {
    const fileName = entity.file.toLowerCase();
    const entityName = entity.rawName.toLowerCase();
    
    // 业务组件特征
    const businessKeywords = ['form', 'table', 'list', 'detail', 'dashboard', 'chart', 'modal'];
    if (businessKeywords.some(keyword => fileName.includes(keyword) || entityName.includes(keyword))) {
      return 'business';
    }
    
    // UI组件特征
    const uiKeywords = ['button', 'input', 'select', 'dialog', 'tooltip', 'icon', 'layout'];
    if (uiKeywords.some(keyword => fileName.includes(keyword) || entityName.includes(keyword))) {
      return 'ui';
    }
    
    // 工具组件特征
    const utilityKeywords = ['utils', 'helper', 'common', 'shared', 'hook', 'composable'];
    if (utilityKeywords.some(keyword => fileName.includes(keyword) || entityName.includes(keyword))) {
      return 'utility';
    }
    
    // 根据路径判断
    if (fileName.includes('business') || fileName.includes('feature')) {
      return 'business';
    }
    
    if (fileName.includes('ui') || fileName.includes('common')) {
      return 'ui';
    }
    
    return 'business'; // 默认为业务组件
  }

  /**
   * 查找组件消费者
   */
  private findComponentConsumers(component: BaseEntity, entities: BaseEntity[]): string[] {
    const consumers: string[] = [];
    const componentName = component.rawName;
    
    entities.forEach(entity => {
      if (entity.id !== component.id) {
        // 检查导入关系
        if (entity.IMPORTS?.some(imp => imp.includes(componentName))) {
          consumers.push(entity.file);
        }
        
        // 检查模板组件关系
        if (entity.TEMPLATE_COMPONENTS?.includes(componentName)) {
          consumers.push(entity.file);
        }
      }
    });
    
    return consumers;
  }

  /**
   * 分析表单架构
   */
  private analyzeFormArchitecture(entities: BaseEntity[]): FormArchitecture {
    const formLibraries: string[] = [];
    const validationPatterns: string[] = [];
    const formComponents: string[] = [];
    let formManagement = 'Unknown';
    
    entities.forEach(entity => {
      const fileName = entity.file.toLowerCase();
      const entityName = entity.rawName.toLowerCase();
      
      // 检测表单组件
      if (fileName.includes('form') || entityName.includes('form')) {
        formComponents.push(entity.rawName);
      }
      
      // 检测验证模式
      if (entity.IMPORTS) {
        entity.IMPORTS.forEach(imp => {
          if (imp.includes('validator') || imp.includes('validate')) {
            if (!validationPatterns.includes('Custom Validation')) {
              validationPatterns.push('Custom Validation');
            }
          }
          
          if (imp.includes('yup') || imp.includes('joi') || imp.includes('zod')) {
            const lib = imp.split('/')[0];
            if (!formLibraries.includes(lib)) {
              formLibraries.push(lib);
            }
          }
        });
      }
    });
    
    // 检测表单管理模式
    if (formLibraries.length > 0) {
      formManagement = 'Schema-based';
    } else if (validationPatterns.length > 0) {
      formManagement = 'Custom Validation';
    } else {
      formManagement = 'Native';
    }
    
    return {
      formLibraries,
      validationPatterns,
      formComponents,
      formManagement
    };
  }

  /**
   * 分析分层结构
   */
  private analyzeLayerStructure(analysis: ProjectAnalysis, entities: BaseEntity[]): LayerStructure {
    const presentation: string[] = [];
    const business: string[] = [];
    const data: string[] = [];
    const infrastructure: string[] = [];
    
    analysis.structure.directories.forEach(dir => {
      const path = dir.path.toLowerCase();
      
      if (path.includes('component') || path.includes('page') || path.includes('view')) {
        presentation.push(dir.path);
      } else if (path.includes('service') || path.includes('business') || path.includes('domain')) {
        business.push(dir.path);
      } else if (path.includes('data') || path.includes('model') || path.includes('entity')) {
        data.push(dir.path);
      } else if (path.includes('config') || path.includes('util') || path.includes('infrastructure')) {
        infrastructure.push(dir.path);
      }
    });
    
    return {
      presentation,
      business,
      data,
      infrastructure
    };
  }

  /**
   * 分析代码组织方式
   */
  private analyzeCodeOrganization(analysis: ProjectAnalysis, entities: BaseEntity[]): CodeOrganization {
    const directories = analysis.structure.directories.map(d => d.path);
    
    // 检测按功能组织
    const featureBasedKeywords = ['feature', 'module', 'domain'];
    const byFeature = directories.some(path => 
      featureBasedKeywords.some(keyword => path.toLowerCase().includes(keyword))
    );
    
    // 检测按层组织
    const layerKeywords = ['controller', 'service', 'repository', 'model'];
    const byLayer = layerKeywords.every(layer =>
      directories.some(path => path.toLowerCase().includes(layer))
    );
    
    // 检测按类型组织
    const typeKeywords = ['components', 'services', 'utils', 'types'];
    const byType = typeKeywords.some(type =>
      directories.some(path => path.toLowerCase().includes(type))
    );
    
    // 计算模块化分数
    const modularityScore = this.calculateModularityScore(analysis, entities);
    
    return {
      byFeature,
      byLayer,
      byType,
      modularityScore
    };
  }

  /**
   * 计算模块化分数
   */
  private calculateModularityScore(analysis: ProjectAnalysis, entities: BaseEntity[]): number {
    let score = 0;
    
    // 基于目录深度
    const avgDepth = analysis.structure.directories.reduce((sum, dir) => 
      sum + dir.path.split('/').length, 0) / analysis.structure.directories.length;
    
    if (avgDepth > 2 && avgDepth < 5) score += 25;
    
    // 基于文件分布
    const filesPerDir = analysis.structure.totalFiles / analysis.structure.directories.length;
    if (filesPerDir > 3 && filesPerDir < 15) score += 25;
    
    // 基于实体分布
    const entitiesPerFile = entities.length / analysis.structure.totalFiles;
    if (entitiesPerFile > 0.5 && entitiesPerFile < 3) score += 25;
    
    // 基于依赖关系
    const avgImports = entities.reduce((sum, e) => sum + (e.IMPORTS?.length || 0), 0) / entities.length;
    if (avgImports > 2 && avgImports < 10) score += 25;
    
    return score;
  }

  /**
   * 生成数据流图
   */
  private generateDataFlow(entities: BaseEntity[]): DataFlowNode[] {
    const dataFlow: DataFlowNode[] = [];
    
    entities.forEach(entity => {
      if (entity.IMPORTS) {
        entity.IMPORTS.forEach(imp => {
          // 只关注内部依赖
          if (imp.startsWith('./') || imp.startsWith('../')) {
            dataFlow.push({
              from: imp,
              to: entity.file,
              type: 'dependency',
              description: `${entity.rawName} depends on ${imp}`
            });
          }
        });
      }
      
      if (entity.CALLS) {
        entity.CALLS.forEach(call => {
          dataFlow.push({
            from: entity.file,
            to: call,
            type: 'control',
            description: `${entity.rawName} calls ${call}`
          });
        });
      }
    });
    
    return dataFlow;
  }
} 