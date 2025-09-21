import { DB } from "./index";
import { dbConfig } from "./config";
// 数据库配置（使用auroraflow的配置）

async function testDatabase() {
  try {
    // 1. 初始化数据库
    await DB.initDB(dbConfig, true); // true表示启用SQL日志

    // 2. 简单查询
    const count = await DB.query(
      "SELECT COUNT(*) as total FROM modular_dev_flow_relation_entities"
    );
    console.log("表中总记录数:", count);
    const res = await DB.searchFlowNode("fulfillment-order-moon");
    console.log("res的长度", res.length);
    console.log("查询结果:", res);
  } catch (error) {
    console.error("数据库操作失败:", error);
  } finally {
    // 5. 关闭连接
    await DB.close();
  }
}

// 运行测试
testDatabase();
