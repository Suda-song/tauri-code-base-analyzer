import os from "os";
import path from "path";
import fs from "fs/promises";

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) =>
  hasOwnProperty.call(object, key);

/**
 * 配置验证错误
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const parseAssert = (name: string, condition: any, message: string) => {
  if (!condition) {
    throw new ConfigError(`Invalid config property ${name}: ${message}`);
  }
};

/**
 * 配置解析器（简化版）
 */
const configParsers = {
  locale(locale?: string) {
    if (!locale) return "zh";
    parseAssert("locale", ["zh", "en"].includes(locale), "Must be zh or en");
    return locale;
  },

  generate(count?: string) {
    if (!count) return 1;
    parseAssert("generate", /^\d+$/.test(count), "Must be an integer");
    const parsed = Number(count);
    parseAssert("generate", parsed > 0 && parsed <= 5, "Must be between 1-5");
    return parsed;
  },

  timeout(timeout?: string) {
    if (!timeout) return 10000;
    parseAssert("timeout", /^\d+$/.test(timeout), "Must be an integer");
    const parsed = Number(timeout);
    parseAssert("timeout", parsed >= 500, "Must be greater than 500ms");
    return parsed;
  },

  "max-length"(maxLength?: string) {
    if (!maxLength) return 50;
    parseAssert("max-length", /^\d+$/.test(maxLength), "Must be an integer");
    const parsed = Number(maxLength);
    parseAssert(
      "max-length",
      parsed >= 20,
      "Must be greater than 20 characters"
    );
    return parsed;
  },

  type(type?: string) {
    if (!type) return "conventional";
    parseAssert(
      "type",
      type === "conventional",
      "Only conventional type is supported"
    );
    return type;
  },
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
  [key in ConfigKeys]?: string;
};

export type ValidConfig = {
  [Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

/**
 * 配置文件路径: ~/.ai-commit
 */
const configPath = path.join(os.homedir(), ".ai-commit");

/**
 * 读取配置文件（简化版 - 使用JSON格式）
 */
const readConfigFile = async (): Promise<RawConfig> => {
  try {
    const configString = await fs.readFile(configPath, "utf8");
    return JSON.parse(configString);
  } catch (error) {
    // 配置文件不存在或读取失败，返回空配置
    return {};
  }
};

/**
 * 写入配置文件
 */
const writeConfigFile = async (config: RawConfig) => {
  // 确保配置目录存在
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  // 写入配置文件（使用JSON格式）
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
};

/**
 * 获取解析后的配置
 */
export const getConfig = async (
  cliConfig?: RawConfig,
  suppressErrors?: boolean
): Promise<ValidConfig> => {
  const config = await readConfigFile();
  const parsedConfig: Record<string, unknown> = {};

  for (const key of Object.keys(configParsers) as ConfigKeys[]) {
    const parser = configParsers[key];
    const value = cliConfig?.[key] ?? config[key];

    if (suppressErrors) {
      try {
        parsedConfig[key] = parser(value);
      } catch {
        // 忽略解析错误，使用默认值
        parsedConfig[key] = parser(undefined);
      }
    } else {
      parsedConfig[key] = parser(value);
    }
  }

  return parsedConfig as unknown as ValidConfig;
};

/**
 * 设置配置项（简化版）
 */
export const setConfigs = async (keyValues: [key: string, value: string][]) => {
  const config = await readConfigFile();

  for (const [key, value] of keyValues) {
    if (!hasOwn(configParsers, key)) {
      throw new ConfigError(`Invalid config property: ${key}`);
    }

    // 验证并解析配置值
    const parsed = configParsers[key as ConfigKeys](value);
    config[key as ConfigKeys] = String(parsed);
  }

  await writeConfigFile(config);
};
