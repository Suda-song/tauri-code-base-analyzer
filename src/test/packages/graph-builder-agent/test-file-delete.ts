// @ts-nocheck
import { NebulaClient, QueryResult } from "@xhs/nebula-client";
import { remove } from "./src/crud";
import { EntityType } from "./src/types";
import "dotenv/config";

async function simpleTest(): Promise<void> {
  const client = new NebulaClient();

  try {
    // 连接数据库
    await client.connect();
    console.log("✅ 数据库连接成功");

    // 使用图空间
    await client.executeNgql("USE code_graph");

    // 查询一个实体ID
    const query: string =
      "LOOKUP ON CodeEntity YIELD id(vertex) as entity_id | LIMIT 1";
    console.log("🔍 查询实体ID...");

    const result: QueryResult = await client.executeNgql(query);
    console.log("📊 查询结果:", JSON.stringify(result, null, 2));

    const entityId = "Class:test1234324324";
    console.log("🔧 测试CRUD read函数...");

    const entity = await remove(entityId, undefined, client);
    console.log("entityentityentity", entity);
    if (entity) {
      console.log("✅ 成功读取到实体数据!");
      console.log("📖 实体详情:", JSON.stringify(entity, null, 2));
    } else {
      console.log("❌ 未找到实体数据");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ 测试失败:", errorMessage);
  } finally {
    await client.disconnect();
    console.log("🔌 数据库连接已断开");
  }
}

// 运行测试
simpleTest().catch(console.error);
