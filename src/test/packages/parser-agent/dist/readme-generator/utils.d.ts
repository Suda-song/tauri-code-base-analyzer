/**
 * README 生成器工具函数
 */
/**
 * 文件和目录分析工具类
 */
export declare class FileAnalysisUtils {
    /**
     * 判断是否为关键文件
     */
    static isKeyFile(filename: string): boolean;
    /**
     * 获取文件类型
     */
    static getFileType(filename: string): string;
    /**
     * 获取文件用途
     */
    static getFilePurpose(filename: string): string;
    /**
     * 推断文件用途
     */
    static inferFilePurpose(filename: string): string;
    /**
     * 获取目录用途
     */
    static getDirectoryPurpose(dirPath: string, mainFileTypes: string[]): string;
    /**
     * 计算目录重要性
     */
    static calculateDirectoryImportance(dirPath: string, fileCount: number): number;
    /**
     * 计算文件重要性
     */
    static calculateFileImportance(filename: string): number;
    /**
     * 判断是否为测试文件
     */
    static isTestFile(filename: string): boolean;
}
/**
 * 依赖分析工具类
 */
export declare class DependencyUtils {
    /**
     * 判断是否为框架
     */
    static isFramework(dep: string): boolean;
    /**
     * 判断是否为构建工具
     */
    static isBuildTool(dep: string): boolean;
    /**
     * 判断是否为测试框架
     */
    static isTestingFramework(dep: string): boolean;
    /**
     * 判断是否为UI库
     */
    static isUILibrary(dep: string): boolean;
    /**
     * 判断是否为状态管理库
     */
    static isStateManagement(dep: string): boolean;
    /**
     * 判断是否为路由库
     */
    static isRouting(dep: string): boolean;
    /**
     * 将依赖映射到技术栈
     */
    static mapDependencyToTechnology(dep: string): string | null;
    /**
     * 将文件扩展名映射到技术栈
     */
    static mapFileExtensionToTechnology(ext: string): string | null;
}
/**
 * 代码分析工具类
 */
export declare class CodeAnalysisUtils {
    /**
     * 分析文件内容
     */
    static analyzeFileContent(content: string): {
        codeLines: number;
        commentLines: number;
        blankLines: number;
        complexity: number;
    };
    /**
     * 计算文件复杂度
     */
    static calculateFileComplexity(filePath: string): number;
    /**
     * 识别技术栈从实体
     */
    static identifyTechnologyFromEntity(entity: any): string[];
}
/**
 * 项目结构工具类
 */
export declare class ProjectUtils {
    /**
     * 查找主入口文件
     */
    static findMainEntries(projectPath: string): string[];
    /**
     * 查找配置文件
     */
    static findConfigFiles(projectPath: string): string[];
    /**
     * 查找文档文件
     */
    static findDocumentation(projectPath: string): string[];
    /**
     * 读取 package.json 信息
     */
    static readPackageInfo(projectPath: string): any;
    /**
     * 检查是否有良好的文件夹结构
     */
    static hasGoodFolderStructure(projectPath: string): boolean;
    /**
     * 检查是否有基本的配置文件
     */
    static hasEssentialConfigFiles(projectPath: string): boolean;
}
/**
 * API 分析工具类
 */
export declare class APIAnalysisUtils {
    /**
     * 判断是否为API函数
     */
    static isApiFunction(entity: any): boolean;
    /**
     * 判断是否为HTTP调用
     */
    static isHttpCall(call: string): boolean;
    /**
     * 提取HTTP方法
     */
    static extractHttpMethod(call: string): string;
    /**
     * 提取API路径
     */
    static extractApiPath(call: string): string;
    /**
     * 判断是否为数据模型
     */
    static isDataModel(imp: string): boolean;
}
