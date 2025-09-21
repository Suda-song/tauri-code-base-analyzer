import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface UserInfo {
  email: string;
  name: string;
  name_alias: string;
  deactivated: boolean;
  account_no: string;
  mobile: string;
  email_alias: string;
  thumb_avatar: string;
}/**
 * @description 从本地REDpass应用配置文件中读取用户信息
 * @returns {Promise<UserInfo | null>} 成功时返回用户信息对象，失败时返回null
 * @business 获取REDpass应用的用户配置信息，包括用户邮箱、姓名、账号等个人数据
 * @example
 * const userInfo = await readLocalConfig();
 * if (userInfo) {
 *   console.log(`当前用户: ${userInfo.name}`);
 * }
 */
export async function readLocalConfig(): Promise<UserInfo | null> {
  console.log("Starting readLocalConfig function");

  try {
    // Get home directory (equivalent to dirs::home_dir() in Rust)
    const homeDir = os.homedir();
    if (!homeDir) {
      const error = "Could not find home directory";
      console.log("Error finding home directory:", error);
      return null;
    }

    console.log("Home directory found:", homeDir);

    // Construct config path (equivalent to home_dir.join("Library/Application Support/REDpass/config.json"))
    const configPath = path.join(
      homeDir,
      "Library",
      "Application Support",
      "REDpass",
      "config.json"
    );
    console.log("Config path:", configPath);

    // Read config file (equivalent to fs::read_to_string)
    const configContent = await fs.promises.readFile(configPath, "utf-8");
    console.log("Successfully read config file");

    // Parse JSON content
    const configData = JSON.parse(configContent);

    // Extract user information from config, prioritizing userInfo field
    const userInfoData = configData.userInfo || configData;
    console.log("userInfoData", userInfoData);
    return userInfoData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Error reading config file:", errorMessage);
    return null;
  }
}
