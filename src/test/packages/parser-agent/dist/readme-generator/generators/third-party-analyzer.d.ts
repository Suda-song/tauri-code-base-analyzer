/**
 * 三方组件分析器 - 识别和分析项目中使用的组件库
 */
import { BaseEntity, ThirdPartyComponent } from './types';
export declare class ThirdPartyAnalyzer {
    private entities;
    constructor(entities: BaseEntity[]);
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
    };
    private extractLibraryName;
    private isThirdPartyLibrary;
    private extractComponentName;
    private getComponentDescription;
    private generateStatistics;
    private generateDocumentation;
}
