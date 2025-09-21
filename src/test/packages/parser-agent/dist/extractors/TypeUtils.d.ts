import { FunctionDeclaration, ClassDeclaration } from 'ts-morph';
/**
 * 公共的类型判断工具类
 * 提供一致的类型判断逻辑给所有提取器使用
 */
export declare class TypeUtils {
    /**
     * 检查函数是否是组件（适用于TS和TSX）
     */
    static isComponentFunction(funcNode: FunctionDeclaration, isJSXContext?: boolean): boolean;
    /**
     * 检查类是否是组件（适用于TS和TSX）
     */
    static isComponentClass(classNode: ClassDeclaration, isJSXContext?: boolean): boolean;
    /**
     * 检查变量是否是组件（适用于TS和TSX）
     */
    static isComponentVariable(declaration: any, isJSXContext?: boolean): boolean;
    /**
     * 检查变量是否是函数
     */
    static isFunctionVariable(declaration: any): boolean;
    /**
     * 检查变量是否是常量
     */
    static isConstantVariable(declaration: any): boolean;
    /**
     * 根据判断结果获取实体类型和ID前缀
     */
    static getEntityTypeInfo(isComponent: boolean, isFunction: boolean, isConstant: boolean): {
        type: string;
        idPrefix: string;
    };
    /**
     * 获取类实体类型和ID前缀
     */
    static getClassTypeInfo(isComponent: boolean): {
        type: string;
        idPrefix: string;
    };
}
