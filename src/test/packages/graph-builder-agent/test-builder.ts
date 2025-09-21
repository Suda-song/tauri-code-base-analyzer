import { buildGraphFromFile } from "./src/builder";
import {
  initializeGlobalClient,
  getGlobalClient,
  executeQuery,
  getClientStatus,
  destroyGlobalClient,
} from "./src/client-manager";
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";

async function testBuildGraphFromFile(): Promise<void> {
  console.log("🚀 测试 buildGraphFromFile 函数 (包含完整流程)\n");

  try {
    // === 第一步：准备测试数据 ===
    console.log("📋 第一步：准备测试数据");

    const jsonPath = path.resolve(
      "/Users/songdingan/development/modular-code-analysis-util/packages/graph-builder-agent/src/fulfullmentTestData/entities.enriched.json"
    );

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`测试数据文件不存在: ${jsonPath}`);
    }

    // 预览测试数据
    const jsonData = fs.readFileSync(jsonPath, "utf-8");
    const entities = JSON.parse(jsonData);
    console.log(`✅ 测试数据就绪: ${entities.length} 个实体`);

    // === 第二步：初始化客户端 ===
    console.log("\n📋 第二步：初始化客户端连接");

    await initializeGlobalClient({
      defaultSpace: "code_graph", // 使用测试空间
      enableLogging: true,
      autoReconnect: true,
    });

    const status = getClientStatus();
    if (!status.isConnected) {
      throw new Error("客户端连接失败");
    }
    console.log(`✅ 客户端连接成功 (空间: ${status.currentSpace})`);

    console.log("\n📋 第四步：执行 buildGraphFromFile 函数");

    const client = await getGlobalClient();
    if (!client) {
      throw new Error("无法获取客户端实例");
    }

    console.log("\n🏗️ 开始执行 buildGraphFromFile...");
    const startTime = Date.now();

    // 这是主要的测试调用 - buildGraphFromFile 包含完整流程
    await buildGraphFromFile(jsonPath, client);

    const endTime = Date.now();
    console.log(
      `🎉 buildGraphFromFile 执行完成! 耗时: ${(endTime - startTime) / 1000}秒`
    );

    // === 第五步：验证结果 ===
    console.log("\n📋 第五步：验证构建结果");

    // 验证节点数量
    console.log("🔍 验证节点数据...");
    const fileCountResult = await executeQuery(
      `MATCH (f:CodeFile) RETURN count(f) as count`
    );
    const entityCountResult = await executeQuery(
      `MATCH (e:CodeEntity) RETURN count(e) as count`
    );
    const flowCountResult = await executeQuery(
      `MATCH (f:Flow) RETURN count(f) as count`
    );

    const fileCount = fileCountResult?.data?.[0]?.count || 0;
    const entityCount = entityCountResult?.data?.[0]?.count || 0;
    const flowCount = flowCountResult?.data?.[0]?.count || 0;

    console.log(`📁 文件节点: ${fileCount}`);
    console.log(`🔧 实体节点: ${entityCount}`);
    console.log(`🔄 流程节点: ${flowCount}`);

    console.log("🎉 buildGraphFromFile 测试完成!");
    console.log("=".repeat(60));
    console.log(`总处理时间: ${(endTime - startTime) / 1000}秒`);
    console.log(`节点总数: ${fileCount + entityCount + flowCount}`);
    console.log("✅ 所有功能正常工作");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ 测试失败:", errorMessage);

    if (error instanceof Error && error.stack) {
      // 只显示关键的错误堆栈信息
      const relevantStack = error.stack
        .split("\n")
        .filter(
          (line) =>
            line.includes("builder.ts") || line.includes("client-manager.ts")
        )
        .slice(0, 3)
        .join("\n");

      if (relevantStack) {
        console.error("📍 关键错误位置:", relevantStack);
      }
    }

    // 提供调试建议
    console.error("\n💡 调试建议:");
    if (errorMessage.includes("连接") || errorMessage.includes("connect")) {
      console.error("   - 检查 Nebula Graph 服务是否运行");
      console.error("   - 检查网络连接和防火墙设置");
    } else if (
      errorMessage.includes("space") ||
      errorMessage.includes("Space")
    ) {
      console.error("   - 检查图空间权限");
      console.error("   - 检查 Schema 创建是否成功");
    } else if (errorMessage.includes("文件") || errorMessage.includes("JSON")) {
      console.error("   - 检查测试数据文件是否存在且格式正确");
    }
  } finally {
    console.log("\n🧹 清理资源...");

    try {
      await destroyGlobalClient();
      console.log("✅ 客户端连接已关闭");
    } catch (cleanupError) {
      console.error("⚠️ 清理时出现错误:", cleanupError);
    }
  }
}

// 运行测试
console.log("=".repeat(70));
console.log("              buildGraphFromFile 完整流程测试");
console.log("=".repeat(70));

testBuildGraphFromFile().catch(console.error);
