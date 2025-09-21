import { BaseEntity, StaticAnalysisResult } from './interfaces';
export declare class StaticAnalyzer {
    private project;
    private rootDir;
    private entityExportsCache;
    private fileEntityTypeCache;
    private tempFiles;
    private entities;
    private entityMap;
    private workspaceInfo;
    private pathAliases;
    private monoRepoRoot;
    constructor(rootDir: string, entities: BaseEntity[]);
    /**
     * 设置新的实体列表并重新初始化相关映射
     * @param entities 新的实体列表
     */
    setEntities(entities: BaseEntity[]): void;
    /**
     * 查找大仓根目录（向上查找包含pnpm-workspace.yaml的目录）
     */
    private findMonoRepoRoot;
    /**
     * 初始化实体查找Map
     */
    private initEntityMap;
    /**
     * 初始化workspace信息
     */
    private initWorkspaceInfo;
    /**
     * 获取项目实际依赖的workspace包信息
     */
    private getWorkspaceInfo;
    /**
     * 获取工作区模式配置
     */
    private getWorkspacePatterns;
    /**
     * 解析工作区模式到实际路径
     */
    private resolveWorkspacePattern;
    /**
     * 展开glob模式（支持 *, **, /\*\*\/* 等复杂模式）
     */
    private expandGlobPattern;
    /**
     * 展开递归模式（包含 ** 的模式）
     */
    private expandRecursivePattern;
    /**
     * 展开简单模式（只包含单层通配符 * 的模式）
     */
    private expandSimplePattern;
    /**
     * 递归查找目录下的所有子目录
     */
    private findAllDirectories;
    /**
     * 检查是否应该跳过某个目录
     */
    private shouldSkipDirectory;
    /**
     * 过滤出有效的workspace包
     */
    private filterValidWorkspacePackages;
    /**
     * 检查目录是否为有效的workspace包
     */
    private isValidWorkspacePackage;
    /**
     * 检查目录是否包含源代码文件
     */
    private hasSourceFiles;
    /**
     * 检查模块是否为workspace包
     */
    private isWorkspaceModule;
    /**
     * 添加临时文件到项目中用于分析
     */
    private addTempSourceFile;
    /**
     * 生成唯一的临时文件名
     */
    private generateTempFileName;
    /**
     * 清理分析过程中创建的临时文件
     */
    private cleanupTempFiles;
    /**
     * 提取实体相关的注释
     */
    private extractAnnotation;
    /**
     * 提取JS/TS注释
     */
    private extractJSComments;
    /**
     * 格式化注释范围
     */
    private formatComments;
    /**
     * 格式化注释文本
     */
    private formatCommentText;
    /**
     * 分析实体并提取静态信息
     */
    analyzeEntity(entity: BaseEntity): Promise<StaticAnalysisResult>;
    /**
     * 分析Vue文件
     */
    private analyzeVueFile;
    /**
     * 分析TSX文件
     */
    private analyzeTSXFile;
    /**
     * 分析TS文件
     */
    private analyzeTSFile;
    /**
     * 根据文件路径和导出名称生成实体ID
     */
    private generateEntityId;
    /**
     * 解析TypeScript路径别名（通用版本）
     */
    private resolveTypeScriptAlias;
    /**
     * 检查模块是否为第三方库
     */
    private isThirdPartyModule;
    /**
     * 提取导入声明
     */
    private extractImports;
    /**
     * 查找workspace包的真实路径
     */
    private findWorkspaceRealPath;
    /**
     * 解析重新导出的模块路径
     */
    private resolveReExportModulePath;
    /**
     * 解析模块路径，获取绝对路径
     */
    private resolveModulePath;
    /**
     * 分析模块导出的实体
     */
    private analyzeModuleExports;
    /**
     * 从源文件中提取导出的实体
     */
    private extractExports;
    /**
     * 提取 CommonJS 格式的导出
     */
    private extractCommonJSExports;
    /**
     * 提取函数调用
     */
    private extractCalls;
    /**
     * 提取Vue中的emit调用
     */
    private extractEmits;
    /**
     * 提取JSX/TSX中的emit调用(props.onXxx())
     */
    private extractJsxEmits;
    /**
     * 提取模板中的组件引用
     */
    private extractTemplateComponents;
    /**
     * 初始化TypeScript路径别名配置
     */
    private initPathAliases;
    /**
     * 加载TypeScript路径别名配置
     */
    private loadPathAliases;
    /**
     * 从 tsconfig.json 加载路径别名
     */
    private loadTsConfigAliases;
    /**
     * 从 vue.config.js 加载路径别名
     */
    private loadVueConfigAliases;
    /**
     * 从 vite.config.js/ts 加载路径别名
     */
    private loadViteConfigAliases;
    /**
     * 从 webpack.config.js 加载路径别名
     */
    private loadWebpackConfigAliases;
    /**
     * 查找 tsconfig.json 文件
     */
    private findTsConfig;
    /**
     * 解析 tsconfig.json 文件（支持 extends）
     */
    private parseTsConfig;
}
