import { NebulaClient } from "@xhs/nebula-client";
import { getEntityDependencyChain } from "./src/crud";
import { GlobalClientManager } from "./src/client-manager";

// 在测试开始前添加这个函数来找实体
async function findTestEntities(client: NebulaClient): Promise<string[]> {
  try {
    const query = `LOOKUP ON CodeEntity YIELD id(vertex) | LIMIT 5`;
    const result = await client.executeNgql(query);
    console.log("查找可用实体", result);
    // @ts-ignore
    if (result?.data?.tables?.length > 0) {
      // @ts-ignore
      console.log("result.data.tables", result.data.tables);
      // @ts-ignore
      return result.data.tables.map(
        (row: any) => row.VertexID || row["id(vertex)"]
      );
    }
    return [];
  } catch (error) {
    console.warn("查找测试实体失败:", error);
    return [];
  }
}

async function testRelationshipQueries(): Promise<void> {
  const client = new NebulaClient({
    gatewayHost: "http://192.168.132.44:8080",
    nebulaHost: "10.4.44.78",
    nebulaPort: 9669,
    username: "root",
    password: "nebula",
  });

  try {
    const client = new GlobalClientManager();

    // // 测试 1: getRelatedEntities
    // console.log("=== 测试 getRelatedEntities ===");
    // try {
    //   const relatedEntities = await getRelatedEntities(
    //     testEntityId,
    //     "ALL",
    //     "OUT",
    //     client
    //   );
    //   console.log(`✅ 找到 ${relatedEntities.length} 个相关实体:`);
    //   relatedEntities.forEach((entity, index) => {
    //     console.log(
    //       `  ${index + 1}. ${entity.entityId} (${entity.relationshipType})`
    //     );
    //   });
    // } catch (error) {
    //   console.error("❌ getRelatedEntities 测试失败:", error);
    // }

    // 测试 2: getEntityDependencyChain
    await client.initialize({
      gatewayHost: "http://192.168.132.44:8080",
      nebulaHost: "10.4.44.78",
      nebulaPort: 9669,
      username: "root",
      password: "nebula",
    });

    await client.useSpace("code_graph_fulfillment_order_moon_84c06675");
    const testEntityId = "Component:StatusOperateV2";
    const actualClient = await client.getClient();
    if (!actualClient) {
      throw new Error("Failed to get Nebula client");
    }
    console.log("\n=== 测试 getEntityDependencyChain ===");
    try {
      const dependencyChain = await getEntityDependencyChain(
        testEntityId,
        4, // 最大跳数
        ["IMPORTS", "CALLS"], // 边类型
        actualClient
      );
      console.log(`✅ 找到 ${dependencyChain.length} 条依赖链:`);
      console.log(JSON.stringify(dependencyChain, null, 2));
    } catch (error) {
      console.error("❌ getEntityDependencyChain 测试失败:", error);
    }

    // // 测试 3: findRelationshipPath (如果有两个实体)
    // console.log("\n=== 测试 findRelationshipPath ===");
    // try {
    //   // 你需要提供第二个实体ID
    //   const targetEntityId = "Function:submitRemittance"; // 替换为实际ID
    //   const path = await findRelationshipPath(
    //     testEntityId,
    //     targetEntityId,
    //     3,
    //     client
    //   );

    //   if (path.found) {
    //     console.log(`✅ 找到路径，长度: ${path.length}`);
    //     console.log(`  路径: ${path.path?.join(" -> ") || "待解析"}`);
    //   } else {
    //     console.log("❌ 未找到路径");
    //   }
    // } catch (error) {
    //   console.error("❌ findRelationshipPath 测试失败:", error);
    // }
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
  } finally {
    // 🔥 Step 4: 清理连接
    try {
      await client.disconnect();
      console.log("\n🔌 数据库连接已关闭");
    } catch (error) {
      console.error("关闭连接时出错:", error);
    }
  }
}

// 运行测试
testRelationshipQueries().catch(console.error);
