// @ts-nocheck
import { NebulaClient, QueryResult } from "@xhs/nebula-client";
import { read, remove, readAllSummary, getEntitiesInFile } from "./src/crud";
import { ENTITY_TAG } from "./src/schema";
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
    // const query: string = `MATCH (v:${ENTITY_TAG}) RETURN v.description as summary, id(v) as id`;
    const result: QueryResult = await client.executeNgql(query);
    console.log("📊 查询结果:", JSON.stringify(result, null, 2));

    const entityId = "Component:RemittanceModal";
    console.log("🔧 测试CRUD read函数...");
    // const entity = await getEntitiesInFile(entityId, client);
    const entity = await read(entityId, EntityType.ENRICHED_ENTITY, client);
    // const entity = await readAllSummary(client);
    // const entity = await remove(entityId, undefined, client);
    console.log("entityentityentity", entity);

    if (entity) {
      console.log("✅ 成功读取到实体数据!");
      console.log("📖 实体详情:", JSON.stringify(entity, null, 2));

      // 显示实体类型
      // if ("path" in entity && "extension" in entity) {
      //   console.log("📁 实体类型: 文件实体");
      // } else {
      //   console.log("⚙️ 实体类型: 代码实体");
      // }
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
