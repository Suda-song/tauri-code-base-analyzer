/**
 * 三方组件分析器 - 识别和分析项目中使用的组件库
 */

import { BaseEntity, ThirdPartyComponent } from './types';

export class ThirdPartyAnalyzer {
  private entities: BaseEntity[];

  constructor(entities: BaseEntity[]) {
    this.entities = entities;
  }

  /**
   * 分析三方组件使用情况
   */
  analyze(): {
    components: ThirdPartyComponent[];
    statistics: {
      totalLibraries: number;
      totalComponents: number;
      mostUsedLibrary: string;
      componentLibraries: string[];
    };
    documentation: string;
  } {
    const libraryMap = new Map<string, Map<string, ThirdPartyComponent>>();
    
    // 常见组件库映射
    const knownLibraries = {
      '@vue/composition-api': 'Vue Composition API',
      'vue-router': 'Vue Router',
      'vuex': 'Vuex',
      'pinia': 'Pinia',
      'element-plus': 'Element Plus',
      'element-ui': 'Element UI',
      'ant-design-vue': 'Ant Design Vue',
      'vant': 'Vant',
      'view-design': 'View Design',
      'quasar': 'Quasar',
      'naive-ui': 'Naive UI',
      '@headlessui/vue': 'Headless UI Vue',
      'primevue': 'PrimeVue',
      'bootstrap-vue': 'Bootstrap Vue',
      'vue-material': 'Vue Material',
      'vuetify': 'Vuetify',
      'buefy': 'Buefy',
      'chakra-ui': 'Chakra UI',
      'tailwindcss': 'Tailwind CSS',
      'lodash': 'Lodash',
      'moment': 'Moment.js',
      'dayjs': 'Day.js',
      'date-fns': 'Date-fns',
      'axios': 'Axios',
      'fetch': 'Fetch API',
      'socket.io': 'Socket.IO',
      'three': 'Three.js',
      'd3': 'D3.js',
      'echarts': 'ECharts',
      'chart.js': 'Chart.js'
    };

    // 分析导入语句
    this.entities.forEach(entity => {
      if (entity.IMPORTS && Array.isArray(entity.IMPORTS)) {
        entity.IMPORTS.forEach(importPath => {
          const library = this.extractLibraryName(importPath);
          if (library && this.isThirdPartyLibrary(library)) {
            const libraryDisplayName = (library in knownLibraries) 
              ? knownLibraries[library as keyof typeof knownLibraries] 
              : library;
            
            if (!libraryMap.has(libraryDisplayName)) {
              libraryMap.set(libraryDisplayName, new Map());
            }

            const componentName = this.extractComponentName(importPath);
            const componentMap = libraryMap.get(libraryDisplayName)!;
            
            if (componentMap.has(componentName)) {
              const component = componentMap.get(componentName)!;
              component.usageCount++;
              if (!component.files.includes(entity.file)) {
                component.files.push(entity.file);
              }
            } else {
              componentMap.set(componentName, {
                name: componentName,
                library: libraryDisplayName,
                usageCount: 1,
                files: [entity.file],
                description: this.getComponentDescription(library, componentName)
              });
            }
          }
        });
      }
    });

    // 转换为数组格式
    const components: ThirdPartyComponent[] = [];
    libraryMap.forEach((componentMap, library) => {
      componentMap.forEach(component => {
        components.push(component);
      });
    });

    // 排序：按使用次数降序
    components.sort((a, b) => b.usageCount - a.usageCount);

    const statistics = this.generateStatistics(components);
    // const documentation = this.generateDocumentation(components);

    return { components, statistics, documentation: '' };
  }

  private extractLibraryName(importPath: string): string {
    // 移除相对路径和本地导入
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return '';
    }

    // 提取库名
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
    }

    return importPath.split('/')[0];
  }

  private isThirdPartyLibrary(library: string): boolean {
    // 排除内建模块和相对路径
    const builtinModules = ['fs', 'path', 'http', 'https', 'url', 'crypto', 'os'];
    return !builtinModules.includes(library) && 
           !library.startsWith('.') && 
           library.length > 0;
  }

  private extractComponentName(importPath: string): string {
    // 简单提取组件名
    const parts = importPath.split('/');
    return parts[parts.length - 1] || importPath;
  }

  private getComponentDescription(library: string, componentName: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      'element-plus': {
        'Button': 'Element Plus 按钮组件',
        'Input': 'Element Plus 输入框组件',
        'Form': 'Element Plus 表单组件',
        'Table': 'Element Plus 表格组件',
        'Dialog': 'Element Plus 对话框组件',
        'Message': 'Element Plus 消息提示组件'
      },
      'ant-design-vue': {
        'Button': 'Ant Design Vue 按钮组件',
        'Input': 'Ant Design Vue 输入框组件',
        'Form': 'Ant Design Vue 表单组件',
        'Table': 'Ant Design Vue 表格组件',
        'Modal': 'Ant Design Vue 模态框组件'
      },
      'vue-router': {
        'router': 'Vue Router 路由实例',
        'useRouter': 'Vue Router Composition API 钩子',
        'useRoute': 'Vue Router 路由信息钩子'
      },
      'axios': {
        'axios': 'HTTP 客户端库',
        'default': 'Axios 默认实例'
      }
    };

    return descriptions[library]?.[componentName] || `${library} 中的 ${componentName} 组件`;
  }

  private generateStatistics(components: ThirdPartyComponent[]) {
    const libraryCount = new Map<string, number>();
    
    components.forEach(component => {
      const count = libraryCount.get(component.library) || 0;
      libraryCount.set(component.library, count + component.usageCount);
    });

    const mostUsedLibrary = Array.from(libraryCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '无';

    return {
      totalLibraries: libraryCount.size,
      totalComponents: components.length,
      mostUsedLibrary,
      componentLibraries: Array.from(libraryCount.keys())
    };
  }

  private generateDocumentation(components: ThirdPartyComponent[]): string {
    if (components.length === 0) {
      return '## 三方组件库\n\n项目中未检测到使用的第三方组件库。\n';
    }

    let doc = '## 三方组件库\n\n';
    doc += '项目中使用的第三方组件库及其组件详情：\n\n';

    // 按库分组
    const libraryGroups = new Map<string, ThirdPartyComponent[]>();
    components.forEach(component => {
      if (!libraryGroups.has(component.library)) {
        libraryGroups.set(component.library, []);
      }
      libraryGroups.get(component.library)!.push(component);
    });

    libraryGroups.forEach((libraryComponents, libraryName) => {
      doc += `### ${libraryName}\n\n`;
      
      libraryComponents.forEach(component => {
        doc += `#### ${component.name}\n`;
        doc += `- **描述**: ${component.description}\n`;
        doc += `- **使用次数**: ${component.usageCount}\n`;
        doc += `- **使用文件**: \n`;
        component.files.forEach(file => {
          doc += `  - \`${file}\`\n`;
        });
        doc += '\n';
      });
    });

    return doc;
  }
} 