/**
 * 业务组件分析器 - 识别和分析项目中的业务组件
 */

import { BaseEntity, BusinessComponent } from './types';

export class BusinessComponentAnalyzer {
  private entities: BaseEntity[];

  constructor(entities: BaseEntity[]) {
    this.entities = entities;
  }

  /**
   * 分析业务组件
   */
  analyze(): {
    businessComponents: BusinessComponent[];
    componentStats: {
      totalComponents: number;
      businessComponents: number;
      uiComponents: number;
      utilityComponents: number;
      mostUsedComponent: string;
    };
    documentation: string;
  } {
    const components = this.identifyComponents();
    const componentStats = this.generateComponentStats(components);
    const documentation = this.generateDocumentation(components);

    return {
      businessComponents: components,
      componentStats,
      documentation
    };
  }

  private identifyComponents(): BusinessComponent[] {
    const components: BusinessComponent[] = [];
    const componentUsage = new Map<string, string[]>(); // 组件名 -> 使用它的文件列表

    // 首先识别所有可能的组件
    const componentEntities = this.entities.filter(entity => 
      this.isComponent(entity.file) || this.isComponentEntity(entity)
    );

    console.log(`找到 ${componentEntities.length} 个组件实体`);

    // 分析组件使用关系
    this.entities.forEach(entity => {
      if (entity.TEMPLATE_COMPONENTS && Array.isArray(entity.TEMPLATE_COMPONENTS)) {
        entity.TEMPLATE_COMPONENTS.forEach(componentName => {
          // 忽略内置组件
          if (this.isBuiltinComponent(componentName)) {
            return;
          }
          
          if (!componentUsage.has(componentName)) {
            componentUsage.set(componentName, []);
          }
          componentUsage.get(componentName)!.push(entity.file);
          console.log(`发现模板组件依赖: ${componentName} 被 ${entity.file} 使用`);
        });
      }

      // 分析导入的组件
      if (entity.IMPORTS && Array.isArray(entity.IMPORTS)) {
        entity.IMPORTS.forEach(importPath => {
          if (this.isLocalComponentImport(importPath)) {
            const componentName = this.extractComponentNameFromPath(importPath);
            if (!componentUsage.has(componentName)) {
              componentUsage.set(componentName, []);
            }
            componentUsage.get(componentName)!.push(entity.file);
            console.log(`发现导入组件依赖: ${componentName} 被 ${entity.file} 使用`);
          }
        });
      }
    });

    console.log(`组件使用关系映射:`, componentUsage);

    // 为每个组件创建 BusinessComponent 对象
    componentEntities.forEach(entity => {
      const componentName = this.extractComponentNameFromEntity(entity);
      
      // 多种方式匹配组件使用
      const consumers = this.findComponentConsumers(componentName, componentUsage, entity.file);
      
      const component: BusinessComponent = {
        name: componentName,
        path: entity.file,
        type: this.classifyComponentType(entity),
        consumers: [...new Set(consumers)], // 去重
        dependencies: this.analyzeDependencies(entity),
        description: this.generateComponentDescription(entity, componentName),
        functionality: this.analyzeFunctionality(entity)
      };

      console.log(`组件 ${componentName} 被使用了 ${component.consumers.length} 次:`, component.consumers);
      components.push(component);
    });

    // 按使用次数排序
    return components.sort((a, b) => b.consumers.length - a.consumers.length);
  }

  private isComponent(filePath: string): boolean {
    const componentPatterns = [
      /\/components?\//i,
      /\/component\//i,
      /\/widgets?\//i,
      /\/views?\//i,
      /\/pages?\//i,
      /\.vue$/i,
      /\.component\.(ts|tsx|js|jsx)$/i,
      /Component\.(ts|tsx|js|jsx)$/i
    ];

    return componentPatterns.some(pattern => pattern.test(filePath));
  }

  private isComponentEntity(entity: BaseEntity): boolean {
    const componentTypes = ['component', 'vue-component', 'react-component', 'directive'];
    return componentTypes.includes(entity.type.toLowerCase()) ||
           entity.rawName.endsWith('Component') ||
           entity.rawName.endsWith('View') ||
           entity.rawName.endsWith('Page') ||
           entity.rawName.endsWith('Widget');
  }

  private isLocalComponentImport(importPath: string): boolean {
    return (importPath.startsWith('./') || importPath.startsWith('../')) &&
           (importPath.includes('component') || importPath.endsWith('.vue') || 
            importPath.includes('page') || importPath.includes('view'));
  }

  private extractComponentNameFromPath(importPath: string): string {
    const parts = importPath.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.(vue|tsx?|jsx?)$/, '');
  }

  private extractComponentNameFromEntity(entity: BaseEntity): string {
    if (entity.file.endsWith('.vue')) {
      const parts = entity.file.split('/');
      return parts[parts.length - 1].replace('.vue', '');
    }
    return entity.rawName;
  }

  private classifyComponentType(entity: BaseEntity): 'business' | 'ui' | 'utility' {
    const path = entity.file.toLowerCase();
    const name = entity.rawName.toLowerCase();

    // 业务组件特征
    const businessKeywords = [
      'form', 'list', 'detail', 'dashboard', 'report', 'table',
      'order', 'user', 'product', 'payment', 'login', 'register',
      'profile', 'setting', 'search', 'cart', 'checkout'
    ];

    // UI 组件特征
    const uiKeywords = [
      'button', 'input', 'modal', 'dialog', 'alert', 'toast',
      'dropdown', 'tooltip', 'pagination', 'card', 'tab',
      'menu', 'navigation', 'header', 'footer', 'sidebar'
    ];

    // 工具组件特征
    const utilityKeywords = [
      'layout', 'wrapper', 'container', 'provider', 'hook',
      'util', 'helper', 'service', 'guard', 'interceptor'
    ];

    if (businessKeywords.some(keyword => name.includes(keyword) || path.includes(keyword))) {
      return 'business';
    }
    
    if (uiKeywords.some(keyword => name.includes(keyword) || path.includes(keyword))) {
      return 'ui';
    }
    
    if (utilityKeywords.some(keyword => name.includes(keyword) || path.includes(keyword))) {
      return 'utility';
    }

    // 默认判断：如果在 pages 或 views 目录下，认为是业务组件
    if (path.includes('/page') || path.includes('/view')) {
      return 'business';
    }

    return 'ui'; // 默认为 UI 组件
  }

  /**
   * 判断是否为内置组件
   */
  private isBuiltinComponent(componentName: string): boolean {
    const builtinComponents = [
      'router-view', 'router-link', 'transition', 'keep-alive',
      'slot', 'template', 'component', 'teleport', 'suspense'
    ];
    return builtinComponents.includes(componentName.toLowerCase());
  }

  /**
   * 查找组件的消费者（多种匹配方式）
   */
  private findComponentConsumers(componentName: string, componentUsage: Map<string, string[]>, componentFile: string): string[] {
    const consumers: string[] = [];
    
    // 1. 直接名称匹配
    const directMatch = componentUsage.get(componentName);
    if (directMatch) {
      consumers.push(...directMatch);
    }
    
    // 2. 不同命名格式的匹配
    const variations = this.getComponentNameVariations(componentName);
    variations.forEach(variation => {
      const variationMatch = componentUsage.get(variation);
      if (variationMatch) {
        consumers.push(...variationMatch);
      }
    });
    
    // 3. 基于文件名的反向匹配
    const fileName = componentName.toLowerCase();
    componentUsage.forEach((files, usedComponentName) => {
      if (usedComponentName.toLowerCase() === fileName || 
          usedComponentName.toLowerCase().includes(fileName) ||
          fileName.includes(usedComponentName.toLowerCase())) {
        consumers.push(...files);
      }
    });
    
    return consumers.filter(consumer => consumer !== componentFile); // 排除自己
  }

  /**
   * 获取组件名称的不同变体
   */
  private getComponentNameVariations(componentName: string): string[] {
    const variations: string[] = [];
    
    // PascalCase 转 kebab-case
    const kebabCase = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    variations.push(kebabCase);
    
    // 移除常见后缀
    const withoutSuffix = componentName.replace(/(Component|Form|Modal|Dialog|Page|View)$/, '');
    if (withoutSuffix !== componentName) {
      variations.push(withoutSuffix);
      variations.push(withoutSuffix.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1));
    }
    
    return [...new Set(variations)];
  }

  private analyzeDependencies(entity: BaseEntity): string[] {
    const dependencies: string[] = [];

    if (entity.IMPORTS && Array.isArray(entity.IMPORTS)) {
      entity.IMPORTS.forEach(importPath => {
        if (this.isLocalComponentImport(importPath)) {
          dependencies.push(this.extractComponentNameFromPath(importPath));
        }
      });
    }

    if (entity.TEMPLATE_COMPONENTS && Array.isArray(entity.TEMPLATE_COMPONENTS)) {
      dependencies.push(...entity.TEMPLATE_COMPONENTS);
    }

    return [...new Set(dependencies)]; // 去重
  }

  private generateComponentDescription(entity: BaseEntity, componentName: string): string {
    const type = this.classifyComponentType(entity);
    const path = entity.file.toLowerCase();
    
    // 基于路径和名称生成描述
    if (path.includes('form')) {
      return `${componentName} - 表单组件，用于数据收集和提交`;
    } else if (path.includes('list') || path.includes('table')) {
      return `${componentName} - 列表/表格组件，用于数据展示`;
    } else if (path.includes('detail') || path.includes('info')) {
      return `${componentName} - 详情组件，用于详细信息展示`;
    } else if (path.includes('dashboard')) {
      return `${componentName} - 仪表盘组件，用于数据概览`;
    } else if (path.includes('login') || path.includes('auth')) {
      return `${componentName} - 认证组件，用于用户登录验证`;
    } else if (path.includes('modal') || path.includes('dialog')) {
      return `${componentName} - 弹窗组件，用于交互式对话`;
    } else if (path.includes('header') || path.includes('nav')) {
      return `${componentName} - 导航组件，用于页面导航`;
    } else if (path.includes('footer')) {
      return `${componentName} - 页脚组件，用于页面底部信息展示`;
    }

    // 基于类型的通用描述
    switch (type) {
      case 'business':
        return `${componentName} - 业务组件，实现特定业务逻辑`;
      case 'ui':
        return `${componentName} - UI组件，提供用户界面元素`;
      case 'utility':
        return `${componentName} - 工具组件，提供通用功能支持`;
      default:
        return `${componentName} - 自定义组件`;
    }
  }

  private analyzeFunctionality(entity: BaseEntity): string {
    const functionalities: string[] = [];

    // 基于实体信息分析功能
    if (entity.EMITS && Array.isArray(entity.EMITS)) {
      functionalities.push(`发出事件: ${entity.EMITS.join(', ')}`);
    }

    if (entity.CALLS && Array.isArray(entity.CALLS)) {
      const apiCalls = entity.CALLS.filter(call => 
        call.includes('api') || call.includes('request') || call.includes('fetch')
      );
      if (apiCalls.length > 0) {
        functionalities.push('执行API调用');
      }
    }

    if (entity.TEMPLATE_COMPONENTS && Array.isArray(entity.TEMPLATE_COMPONENTS)) {
      functionalities.push(`包含子组件: ${entity.TEMPLATE_COMPONENTS.length}个`);
    }

    return functionalities.length > 0 ? functionalities.join('；') : '基础组件功能';
  }

  private generateComponentStats(components: BusinessComponent[]) {
    const businessComponents = components.filter(c => c.type === 'business').length;
    const uiComponents = components.filter(c => c.type === 'ui').length;
    const utilityComponents = components.filter(c => c.type === 'utility').length;
    
    const mostUsedComponent = components.length > 0 ? components[0].name : '无';

    return {
      totalComponents: components.length,
      businessComponents,
      uiComponents,
      utilityComponents,
      mostUsedComponent
    };
  }

  private generateDocumentation(components: BusinessComponent[]): string {
    if (components.length === 0) {
      return '## 业务组件\n\n项目中未检测到组件。\n';
    }

    let doc = '## 业务组件分析\n\n';
    doc += '项目中识别到的组件及其使用情况：\n\n';

    // 按类型分组
    const componentsByType = {
      business: components.filter(c => c.type === 'business'),
      ui: components.filter(c => c.type === 'ui'),
      utility: components.filter(c => c.type === 'utility')
    };

    const typeNames = {
      business: '业务组件',
      ui: 'UI组件',
      utility: '工具组件'
    };

    Object.entries(componentsByType).forEach(([type, typeComponents]) => {
      if (typeComponents.length > 0) {
        doc += `### ${typeNames[type as keyof typeof typeNames]} (${typeComponents.length}个)\n\n`;
        
        typeComponents.forEach(component => {
          doc += `#### ${component.name}\n`;
          doc += `- **路径**: \`${component.path}\`\n`;
          doc += `- **描述**: ${component.description}\n`;
          doc += `- **功能**: ${component.functionality}\n`;
          doc += `- **被使用次数**: ${component.consumers.length}\n`;
          
          if (component.consumers.length > 0) {
            doc += '- **使用页面**:\n';
            component.consumers.forEach(consumer => {
              doc += `  - \`${consumer}\`\n`;
            });
          }
          
          if (component.dependencies.length > 0) {
            doc += '- **依赖组件**:\n';
            component.dependencies.forEach(dep => {
              doc += `  - ${dep}\n`;
            });
          }
          
          doc += '\n';
        });
      }
    });

    return doc;
  }
} 