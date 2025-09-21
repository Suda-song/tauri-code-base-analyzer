import { FunctionDeclaration, ClassDeclaration } from 'ts-morph';

/**
 * 公共的类型判断工具类
 * 提供一致的类型判断逻辑给所有提取器使用
 */
export class TypeUtils {
  
  /**
   * 检查函数是否是组件（适用于TS和TSX）
   */
  static isComponentFunction(funcNode: FunctionDeclaration, isJSXContext = false): boolean {
    const funcText = funcNode.getText();
    const funcName = funcNode.getName() || '';
    
    // 排除明显的非组件函数名（以动词开头或包含特定关键字的函数）
    const nonComponentPatterns = [
      /^(get|set|create|build|make|do|run|execute|process|handle|manage|validate|parse|format|transform|convert|generate|load|save|fetch|send|post|put|delete|update|find|search|filter|sort|map|reduce|forEach|some|every|has|is|can|should|will|add|remove|insert|append|prepend|clear|reset|init|start|stop|pause|resume|toggle|enable|disable|activate|deactivate|register|unregister|subscribe|unsubscribe|emit|on|off|once|use|apply|call|bind|extend|mixin|clone|copy|merge|assign|compare|equals|toString|valueOf|render(?!Component)|collect|calculate|normalize|resolve|analyze|extract|combine|compile|decode|encode|log|debug|warn|error|test|mock|stub|spy|watch|listen|notify|trigger|dispatch|handle|process|schedule|queue|retry|timeout|delay|throttle|debounce|cache|store|retrieve|remove|destroy|release|close|open|connect|disconnect|authenticate|authorize|login|logout|signup|signout|check|verify|confirm|cancel|reject|approve|deny|block|unblock|lock|unlock)/i,
      /Prompt$/i,
      /Util$/i,
      /Utils$/i,
      /Helper$/i,
      /Helpers$/i,
      /Handler$/i,
      /Handlers$/i,
      /Service$/i,
      /Services$/i,
      /Manager$/i,
      /Managers$/i,
      /Config$/i,
      /Configuration$/i,
      /Factory$/i,
      /Builder$/i,
      /Adapter$/i,
      /Strategy$/i,
      /Provider$/i,
      /Repository$/i,
      /Store$/i,
      /Cache$/i,
      /Logger$/i,
      /Router$/i,
      /Middleware$/i,
      /Plugin$/i,
      /Tool$/i,
      /Tools$/i
    ];
    
    // 如果函数名匹配非组件模式，直接排除
    if (nonComponentPatterns.some(pattern => pattern.test(funcName))) {
      return false;
    }
    
    // 在JSX上下文中，检查是否返回JSX
    if (isJSXContext) {
      const hasJSXReturn = /return\s*</.test(funcText);
      if (hasJSXReturn) return true;
    }
    
    // 检查函数名是否以大写字母开头（组件命名规范）
    const hasComponentName = /^[A-Z]/.test(funcName);
    
    // 检查是否有明确的组件装饰器或注释
    const hasComponentDecorator = /(@Component|@component)/i.test(funcText);
    const hasExplicitComponentKeyword = /\b(组件|UI组件|界面组件)\b/i.test(funcText);
    
    // 只有在JSX上下文中或有明确的组件指示符时，才根据函数名判断
    return hasComponentName && (isJSXContext || hasComponentDecorator || hasExplicitComponentKeyword);
  }
  
  /**
   * 检查类是否是组件（适用于TS和TSX）
   */
  static isComponentClass(classNode: ClassDeclaration, isJSXContext = false): boolean {
    const classText = classNode.getText();
    const className = classNode.getName() || '';
    
    // 在JSX上下文中，检查React组件特征
    if (isJSXContext) {
      // 检查是否继承自React.Component或Component
      const extendsReactComponent = /extends\s+(React\.)?Component(?![\w])/i.test(classText);
      // 检查是否有render方法
      const hasRenderMethod = /render\s*\(\s*\)\s*\{/.test(classText);
      if (extendsReactComponent || hasRenderMethod) return true;
    }
    
    // 严格排除业务类名模式
    const businessClassPatterns = [
      /Handler$/,
      /Service$/,
      /Manager$/,
      /Controller$/,
      /Provider$/,
      /Repository$/,
      /Store$/,
      /Model$/,
      /Entity$/,
      /DTO$/,
      /DAO$/,
      /Util$/,
      /Utils$/,
      /Helper$/,
      /Config$/,
      /Configuration$/,
      /Builder$/,
      /Factory$/,
      /Strategy$/,
      /Adapter$/,
      /Interceptor$/,
      /Middleware$/,
      /Analyzer$/,
      /Processor$/,
      /Generator$/,
      /Validator$/,
      /Transformer$/,
      /Converter$/,
      /Extractor$/,
      /Loader$/,
      /Monitor$/,
      /Client$/,
      /Base[A-Z]/
    ];
    
    // 如果类名匹配业务类模式，直接排除
    if (businessClassPatterns.some(pattern => pattern.test(className))) {
      return false;
    }
    
    // 排除业务类相关的继承
    const extendsDomainClass = /extends\s+\w*(Domain|Service|Base|Manager|Handler|Controller|Provider|Repository|Store|Model|Entity|Util|Helper|Config|Builder|Factory|Strategy|Adapter|Interceptor|Middleware|Analyzer|Processor|Generator|Validator|Transformer|Converter|Extractor|Loader|Monitor|Client)(?![\w])/i.test(classText);
    
    if (extendsDomainClass) {
      return false;
    }
    
    // 明确的UI组件继承模式
    const extendsUIComponent = /extends\s+\w*(Component|Widget|Element|View|Page|Dialog|Modal|Panel|Card|Button|Input|Form|Table|List|Grid|Menu|Tab|Tooltip|Popup|Overlay)(?![\w])/i.test(classText);
    
    // 检查是否有明确的组件装饰器（不包括class名中的Component）
    const hasComponentDecorator = /(@Component|@component)\b/i.test(classText);
    
    // 检查是否有明确的UI相关方法
    const hasUIMethod = /\b(render|paint|draw|show|hide|toggle|focus|blur|click|hover|resize|scroll)\s*\(/i.test(classText);
    
    // 只有满足以下条件之一才算组件：
    // 1. 明确继承UI组件基类
    // 2. 有明确的组件装饰器
    // 3. JSX上下文 + 有UI相关方法 + 类名以大写开头
    const isUIContext = isJSXContext && hasUIMethod && /^[A-Z]/.test(className);
    
    return extendsUIComponent || hasComponentDecorator || isUIContext;
  }
  
  /**
   * 检查变量是否是组件（适用于TS和TSX）
   */
  static isComponentVariable(declaration: any, isJSXContext = false): boolean {
    const varName = declaration.getName();
    const initText = declaration.getInitializer()?.getText() || '';
    
    // 如果是常量命名（全大写下划线），优先判断为非组件
    if (this.isConstantVariable(declaration)) {
      return false;
    }
    
    // 排除明显的非组件函数名（以动词开头或包含特定关键字的函数）
    const nonComponentPatterns = [
      /^(get|set|create|build|make|do|run|execute|process|handle|manage|validate|parse|format|transform|convert|generate|load|save|fetch|send|post|put|delete|update|find|search|filter|sort|map|reduce|forEach|some|every|has|is|can|should|will|add|remove|insert|append|prepend|clear|reset|init|start|stop|pause|resume|toggle|enable|disable|activate|deactivate|register|unregister|subscribe|unsubscribe|emit|on|off|once|use|apply|call|bind|extend|mixin|clone|copy|merge|assign|compare|equals|toString|valueOf|render(?!Component)|collect|calculate|normalize|resolve|analyze|extract|combine|compile|decode|encode|log|debug|warn|error|test|mock|stub|spy|watch|listen|notify|trigger|dispatch|handle|process|schedule|queue|retry|timeout|delay|throttle|debounce|cache|store|retrieve|remove|destroy|release|close|open|connect|disconnect|authenticate|authorize|login|logout|signup|signout|check|verify|confirm|cancel|reject|approve|deny|block|unblock|lock|unlock)/i,
      /Prompt$/i,
      /Util$/i,
      /Utils$/i,
      /Helper$/i,
      /Helpers$/i,
      /Handler$/i,
      /Handlers$/i,
      /Service$/i,
      /Services$/i,
      /Manager$/i,
      /Managers$/i,
      /Config$/i,
      /Configuration$/i,
      /Factory$/i,
      /Builder$/i,
      /Adapter$/i,
      /Strategy$/i,
      /Provider$/i,
      /Repository$/i,
      /Store$/i,
      /Cache$/i,
      /Logger$/i,
      /Router$/i,
      /Middleware$/i,
      /Plugin$/i,
      /Tool$/i,
      /Tools$/i
    ];
    
    // 如果函数名匹配非组件模式，直接排除
    if (nonComponentPatterns.some(pattern => pattern.test(varName))) {
      return false;
    }
    
    // 在JSX上下文中，检查JSX特征
    if (isJSXContext) {
      // 检查是否是函数组件（箭头函数返回JSX）
      const hasJSXReturn = /=>\s*</.test(initText) || /=>\s*\([\s\S]*</.test(initText) || /return\s*</.test(initText);
      if (hasJSXReturn) return true;
    }
    
    // 对于非JSX上下文，需要更严格的条件
    // 检查是否是组件（大写开头的变量且有明确的组件特征）
    const hasComponentName = /^[A-Z][a-zA-Z0-9]*$/.test(varName);
    
    // 检查是否包含组件相关的特征（但排除函数名中的Component）
    const hasComponentDecorator = /(@Component|@component)/i.test(declaration.getText());
    const hasExplicitComponentKeyword = /\b(组件|UI组件|界面组件)\b/i.test(declaration.getText());
    
    // 在JSX上下文中，大写开头 + JSX特征即可；非JSX上下文需要明确的组件装饰器或关键字
    return hasComponentName && (isJSXContext || hasComponentDecorator || hasExplicitComponentKeyword);
  }
  
  /**
   * 检查变量是否是函数
   */
  static isFunctionVariable(declaration: any): boolean {
    const initText = declaration.getInitializer()?.getText() || '';
    
    // 检查是否是箭头函数或函数表达式
    const isArrowFunction = /=>\s*\{/.test(initText) || /=>\s*[^{]/.test(initText);
    const isFunctionExpression = /function\s*\(/.test(initText);
    
    return isArrowFunction || isFunctionExpression;
  }
  
  /**
   * 检查变量是否是常量
   */
  static isConstantVariable(declaration: any): boolean {
    const varName = declaration.getName();
    const initText = declaration.getInitializer()?.getText() || '';
    
    // 检查是否是常量命名规范（全大写下划线）
    const hasConstantName = /^[A-Z_][A-Z0-9_]*$/.test(varName);
    
    // 检查是否是简单的常量值
    const hasConstantValue = /^(['"`].*['"`]|[\d.]+|true|false|null|undefined)$/.test(initText.trim());
    
    // 检查是否是对象字面量（配置对象）
    const isObjectLiteral = /^\s*\{[\s\S]*\}\s*$/.test(initText.trim());
    
    // 检查是否是数组字面量
    const isArrayLiteral = /^\s*\[[\s\S]*\]\s*$/.test(initText.trim());
    
    return hasConstantName || hasConstantValue || isObjectLiteral || isArrayLiteral;
  }
  
  /**
   * 根据判断结果获取实体类型和ID前缀
   */
  static getEntityTypeInfo(isComponent: boolean, isFunction: boolean, isConstant: boolean): { type: string; idPrefix: string } {
    if (isComponent) {
      return { type: 'component', idPrefix: 'Component' };
    } else if (isConstant) {
      return { type: 'variable', idPrefix: 'Variable' };
    } else if (isFunction) {
      return { type: 'function', idPrefix: 'Function' };
    } else {
      return { type: 'variable', idPrefix: 'Variable' };
    }
  }
  
  /**
   * 获取类实体类型和ID前缀
   */
  static getClassTypeInfo(isComponent: boolean): { type: string; idPrefix: string } {
    return isComponent 
      ? { type: 'component', idPrefix: 'Component' }
      : { type: 'class', idPrefix: 'Class' };
  }
} 