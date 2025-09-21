import { NebulaClient, QueryResult } from "@xhs/nebula-client";
import { create } from "./src/crud";
import { EnrichedEntity, FileEntity } from "./src/types";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getCurrentSpace, createSchemaStatements } from "./src/schema";

async function simpleTest(): Promise<void> {
  const client = new NebulaClient();
  let entities: EnrichedEntity[];
  let files: FileEntity[];

  try {
    await client.connect();
    console.log("✅ 数据库连接成功");

    // 使用图空间
    await client.executeNgql("USE code_graph");

    const entity = {
      id: "Function:test123321",
      type: "test",
      file: "test",
      loc: {
        start: 1536,
        end: 1544,
      },
      rawName: "test",
      isWorkspace: true,
      isDDD: false,
      IMPORTS: ["Class:test1234324324"],
      CALLS: ["Function:test1234324"],
      EMITS: ["Function:test1234324"],
      ANNOTATION: "简便的函数接口，用于快速调用关系查询功能",
      summary:
        "提供快速调用代码实体关系查询功能的接口，接收实体ID、实体文件路径等参数，创建RagInlineTool实例并调用其getRelatedEntities方法获取相关代码实体",
      tags: ["代码关系查询", "实体关联分析", "RAG工具", "代码导航", "辅助函数"],
    };

    await create(entity, client);
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
