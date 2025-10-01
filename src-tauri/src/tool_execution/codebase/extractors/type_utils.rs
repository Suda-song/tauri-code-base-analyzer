//! 类型判断工具
//! 
//! 提供统一的类型判断逻辑，判断代码实体是组件、函数、类还是变量

use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    // 非组件函数名模式（以动词开头或特定关键字）
    static ref NON_COMPONENT_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"^(get|set|create|build|make|do|run|execute|process|handle|manage|validate|parse|format|transform|convert|generate|load|save|fetch|send|post|put|delete|update|find|search|filter|sort|map|reduce|forEach|some|every|has|is|can|should|will|add|remove|insert|append|prepend|clear|reset|init|start|stop|pause|resume|toggle|enable|disable|activate|deactivate|register|unregister|subscribe|unsubscribe|emit|on|off|once|use|apply|call|bind|extend|mixin|clone|copy|merge|assign|compare|equals|toString|valueOf|collect|calculate|normalize|resolve|analyze|extract|combine|compile|decode|encode|log|debug|warn|error|test|mock|stub|spy|watch|listen|notify|trigger|dispatch)").unwrap(),
        Regex::new(r"(Prompt|Util|Utils|Helper|Helpers|Handler|Handlers|Service|Services|Manager|Managers|Config|Configuration|Factory|Builder|Adapter|Strategy|Provider|Repository|Store|Cache|Logger|Router|Middleware|Plugin|Tool|Tools)$").unwrap(),
    ];
    
    // 业务类模式
    static ref BUSINESS_CLASS_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(Handler|Service|Manager|Controller|Provider|Repository|Store|Model|Entity|DTO|DAO|Util|Utils|Helper|Config|Configuration|Builder|Factory|Strategy|Adapter|Interceptor|Middleware|Analyzer|Processor|Generator|Validator|Transformer|Converter|Extractor|Loader|Monitor|Client|Base[A-Z])$").unwrap(),
    ];
    
    // UI 组件继承模式
    static ref UI_COMPONENT_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"extends\s+\w*(Component|Widget|Element|View|Page|Dialog|Modal|Panel|Card|Button|Input|Form|Table|List|Grid|Menu|Tab|Tooltip|Popup|Overlay)").unwrap(),
    ];
    
    // 常量命名模式（全大写下划线）
    static ref CONSTANT_NAME_PATTERN: Regex = Regex::new(r"^[A-Z_][A-Z0-9_]*$").unwrap();
    
    // 组件命名模式（大写开头）
    static ref COMPONENT_NAME_PATTERN: Regex = Regex::new(r"^[A-Z][a-zA-Z0-9]*$").unwrap();
    
    // 组件关键字
    static ref COMPONENT_KEYWORDS: Vec<&'static str> = vec![
        "Component", "Button", "Card", "Modal", "Icon", "Form", "Input", 
        "Dialog", "Panel", "Header", "Footer", "Menu", "List", "Table"
    ];
}

/// 实体类型信息
#[derive(Debug, Clone)]
pub struct TypeInfo {
    pub entity_type: String,
    pub id_prefix: String,
}

impl TypeInfo {
    pub fn new(entity_type: &str, id_prefix: &str) -> Self {
        Self {
            entity_type: entity_type.to_string(),
            id_prefix: id_prefix.to_string(),
        }
    }
    
    pub fn component() -> Self {
        Self::new("component", "Component")
    }
    
    pub fn function() -> Self {
        Self::new("function", "Function")
    }
    
    pub fn class() -> Self {
        Self::new("class", "Class")
    }
    
    pub fn variable() -> Self {
        Self::new("variable", "Variable")
    }
}

pub struct TypeUtils;

impl TypeUtils {
    /// 检查函数是否是组件
    /// 
    /// # 参数
    /// - `name`: 函数名
    /// - `content`: 函数内容
    /// - `is_jsx_context`: 是否在 JSX/TSX 上下文中
    pub fn is_component_function(name: &str, content: &str, is_jsx_context: bool) -> bool {
        // 排除明显的非组件函数名
        for pattern in NON_COMPONENT_PATTERNS.iter() {
            if pattern.is_match(name) {
                return false;
            }
        }
        
        // 在 JSX 上下文中，检查是否返回 JSX
        if is_jsx_context {
            let has_jsx_return = content.contains("return <") 
                || content.contains("=> <")
                || content.contains("=>(<");
            if has_jsx_return {
                return true;
            }
        }
        
        // 检查函数名是否以大写字母开头（组件命名规范）
        let has_component_name = COMPONENT_NAME_PATTERN.is_match(name);
        
        // 检查是否有明确的组件装饰器或注释
        let has_component_decorator = content.contains("@Component") 
            || content.contains("@component");
        
        // 只有在 JSX 上下文中或有明确的组件指示符时，才根据函数名判断
        has_component_name && (is_jsx_context || has_component_decorator)
    }
    
    /// 检查类是否是组件
    pub fn is_component_class(name: &str, content: &str, is_jsx_context: bool) -> bool {
        // 在 JSX 上下文中，检查 React 组件特征
        if is_jsx_context {
            // 检查是否继承自 React.Component
            if content.contains("extends React.Component") 
                || content.contains("extends Component") {
                return true;
            }
            // 检查是否有 render 方法
            if content.contains("render()") || content.contains("render ()") {
                return true;
            }
        }
        
        // 排除业务类名模式
        for pattern in BUSINESS_CLASS_PATTERNS.iter() {
            if pattern.is_match(name) {
                return false;
            }
        }
        
        // 排除业务类继承
        if content.contains("extends") {
            for keyword in ["Domain", "Service", "Base", "Manager", "Handler", "Controller"].iter() {
                if content.contains(keyword) {
                    return false;
                }
            }
        }
        
        // 明确的 UI 组件继承模式
        for pattern in UI_COMPONENT_PATTERNS.iter() {
            if pattern.is_match(content) {
                return true;
            }
        }
        
        // 检查是否有明确的组件装饰器
        let has_component_decorator = content.contains("@Component") 
            || content.contains("@component");
        
        // 检查是否有 UI 相关方法
        let has_ui_method = content.contains("render(") 
            || content.contains("paint(")
            || content.contains("draw(");
        
        let is_ui_context = is_jsx_context && has_ui_method && COMPONENT_NAME_PATTERN.is_match(name);
        
        has_component_decorator || is_ui_context
    }
    
    /// 检查变量是否是组件
    pub fn is_component_variable(name: &str, initializer: &str, is_jsx_context: bool) -> bool {
        // 如果是常量命名，优先判断为非组件
        if Self::is_constant_variable(name, initializer) {
            return false;
        }
        
        // 排除明显的非组件函数名
        for pattern in NON_COMPONENT_PATTERNS.iter() {
            if pattern.is_match(name) {
                return false;
            }
        }
        
        // 在 JSX 上下文中，检查 JSX 特征
        if is_jsx_context {
            let has_jsx_return = initializer.contains("=> <")
                || initializer.contains("=>(<")
                || initializer.contains("return <");
            if has_jsx_return {
                return true;
            }
        }
        
        // 检查是否是组件（大写开头的变量且有明确的组件特征）
        let has_component_name = COMPONENT_NAME_PATTERN.is_match(name);
        
        // 检查是否包含组件相关的特征
        let has_component_decorator = initializer.contains("@Component") 
            || initializer.contains("@component");
        
        has_component_name && (is_jsx_context || has_component_decorator)
    }
    
    /// 检查变量是否是函数
    pub fn is_function_variable(initializer: &str) -> bool {
        // 检查是否是箭头函数或函数表达式
        let is_arrow_function = initializer.contains("=> {") 
            || initializer.contains("=>")
            || Regex::new(r"=>\s*\(").unwrap().is_match(initializer);
        let is_function_expression = initializer.contains("function(") 
            || initializer.contains("function (");
        
        is_arrow_function || is_function_expression
    }
    
    /// 检查变量是否是常量
    pub fn is_constant_variable(name: &str, initializer: &str) -> bool {
        // 检查是否是常量命名规范（全大写下划线）
        let has_constant_name = CONSTANT_NAME_PATTERN.is_match(name);
        
        // 检查是否是简单的常量值
        let has_constant_value = Regex::new(r#"^(['"`].*['"`]|[\d.]+|true|false|null|undefined)$"#)
            .unwrap()
            .is_match(initializer.trim());
        
        // 检查是否是对象字面量
        let is_object_literal = initializer.trim().starts_with('{') 
            && initializer.trim().ends_with('}');
        
        // 检查是否是数组字面量
        let is_array_literal = initializer.trim().starts_with('[') 
            && initializer.trim().ends_with(']');
        
        has_constant_name || has_constant_value || is_object_literal || is_array_literal
    }
    
    /// 根据判断结果获取实体类型信息
    pub fn get_entity_type_info(
        is_component: bool,
        is_function: bool,
        is_constant: bool,
    ) -> TypeInfo {
        if is_component {
            TypeInfo::component()
        } else if is_constant {
            TypeInfo::variable()
        } else if is_function {
            TypeInfo::function()
        } else {
            TypeInfo::variable()
        }
    }
    
    /// 获取类实体类型信息
    pub fn get_class_type_info(is_component: bool) -> TypeInfo {
        if is_component {
            TypeInfo::component()
        } else {
            TypeInfo::class()
        }
    }
    
    /// 回退类型生成（基于命名规范）
    pub fn fallback_type_generation(
        file_path: &str,
        entity_name: &str,
        is_default_export: bool,
    ) -> TypeInfo {
        // 基于文件类型和命名规范判断
        if file_path.ends_with(".vue") {
            return TypeInfo::component();
        }
        
        // 常量命名规范（全大写下划线）
        if CONSTANT_NAME_PATTERN.is_match(entity_name) {
            return TypeInfo::variable();
        }
        
        // 组件命名规范（大写开头）
        if COMPONENT_NAME_PATTERN.is_match(entity_name) {
            if file_path.ends_with(".tsx") || file_path.ends_with(".jsx") {
                return TypeInfo::component();
            } else {
                // 对于 TS 文件中的大写开头名称，根据上下文判断
                let is_likely_component = COMPONENT_KEYWORDS.iter()
                    .any(|keyword| entity_name.contains(keyword));
                
                if is_likely_component {
                    return TypeInfo::component();
                } else {
                    return TypeInfo::class();
                }
            }
        }
        
        // 默认为函数
        TypeInfo::function()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_is_component_function() {
        // 应该是组件
        assert!(TypeUtils::is_component_function("Button", "return <div>", true));
        assert!(TypeUtils::is_component_function("UserProfile", "=> <div>", true));
        
        // 不应该是组件
        assert!(!TypeUtils::is_component_function("getUserData", "", false));
        assert!(!TypeUtils::is_component_function("handleClick", "", false));
        assert!(!TypeUtils::is_component_function("createService", "", false));
    }
    
    #[test]
    fn test_is_constant_variable() {
        assert!(TypeUtils::is_constant_variable("API_URL", ""));
        assert!(TypeUtils::is_constant_variable("MAX_COUNT", ""));
        assert!(TypeUtils::is_constant_variable("config", "{ a: 1 }"));
        assert!(!TypeUtils::is_constant_variable("userData", ""));
    }
    
    #[test]
    fn test_fallback_type_generation() {
        let result = TypeUtils::fallback_type_generation("test.vue", "Test", false);
        assert_eq!(result.entity_type, "component");
        
        let result = TypeUtils::fallback_type_generation("test.ts", "API_URL", false);
        assert_eq!(result.entity_type, "variable");
        
        let result = TypeUtils::fallback_type_generation("test.tsx", "Button", false);
        assert_eq!(result.entity_type, "component");
    }
}
