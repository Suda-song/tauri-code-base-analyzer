/**
 * 测试getEntityCommitHistory函数
 */

const { getEntitiesCommitHistory } = require('./dist/commit-generator/index');

async function testEntityCommitHistory() {
  console.log("🧪 开始测试getEntityCommitHistory函数...\n");

  try {
    // 测试的实体ID列表
    const entityIds = ["Component:ItemTableCell", "Function:useTableColumns"];

    console.log(`📋 查询的实体ID列表:`);
    entityIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log("");

    // 调用函数（使用默认参数）
    const startTime = Date.now();
    const results = await getEntitiesCommitHistory(entityIds);
    
    const endTime = Date.now();

    console.log(`⏱️ 查询耗时: ${endTime - startTime}ms\n`);

    // 打印结果
    console.log("📊 查询结果:");
    console.log("=".repeat(80));

    for (const entityId of entityIds) {
      const records = results[entityId] || [];

      console.log(`\n🔍 实体: ${entityId}`);
      console.log(`📈 变更记录数量: ${records.length}`);

      if (records.length === 0) {
        console.log("  💡 暂无变更记录");
        continue;
      }

      // 显示最近的几条记录
      const recentRecords = records.slice(0, 5); // 显示最近5条
      console.log(
        `\n📝 最近的变更记录 (显示前${Math.min(5, records.length)}条):`
      );

      recentRecords.forEach((record, index) => {
        console.log(
          `\n  ${index + 1}. Commit: ${record.commit_hash.substring(0, 8)}`
        );
        console.log(
          `     📅 时间: ${new Date(record.commit_at).toLocaleString()}`
        );
        console.log(
          `     👤 作者: ${record.author_name} <${record.author_email}>`
        );
        console.log(`     🏷️ 类型: ${record.commit_type}`);
        console.log(`     📄 描述: ${record.commit_summary}`);
        console.log(`     🌿 分支: ${record.branch_name}`);

        if (record.commit_project_name) {
          console.log(`     📦 项目: ${record.commit_project_name}`);
        }
        if (record.commit_version) {
          console.log(`     🔖 版本: ${record.commit_version}`);
        }

        console.log(
          `     📊 代码变更: +${record.code_lines_added || 0} -${
            record.code_lines_deleted || 0
          }`
        );

        if (record.entity_file_path) {
          console.log(`     🎯 实体文件: ${record.entity_file_path}`);
        }

        // 显示实体特定的变更内容
        if (record.entity_related_changes && record.entity_related_changes.trim()) {
          console.log(`     🔄 实体变更内容:`);
          const changes = record.entity_related_changes.split('\n').slice(0, 5); // 只显示前5行
          changes.forEach(line => {
            if (line.trim()) {
              console.log(`       ${line}`);
            }
          });
          if (record.entity_related_changes.split('\n').length > 5) {
            console.log(`       ... (还有更多变更内容)`);
          }
        } else {
          console.log(`     🔄 实体变更内容: 无相关变更内容`);
        }
      });

      if (records.length > 5) {
        console.log(`\n  ... 还有 ${records.length - 5} 条历史记录`);
      }
    }

    // 统计信息
    console.log("\n" + "=".repeat(80));
    console.log("📈 统计信息:");

    const totalRecords = Object.values(results).reduce(
      (sum, records) => sum + records.length,
      0
    );
    const entitiesWithRecords = Object.keys(results).filter(
      (id) => results[id].length > 0
    ).length;

    console.log(`  📋 查询实体数量: ${entityIds.length}`);
    console.log(`  ✅ 有记录的实体: ${entitiesWithRecords}`);
    console.log(`  📊 总记录数: ${totalRecords}`);

    if (totalRecords > 0) {
      console.log("\n🎉 测试成功完成！");
    } else {
      console.log("\n⚠️ 未找到任何记录，请检查:");
      console.log("  1. 数据库文件是否存在");
      console.log("  2. 实体ID是否正确");
      console.log("  3. 是否已运行过post-commit hook");
    }
  } catch (error) {
    console.error("\n❌ 测试失败:", error.message);
    console.error("\n详细错误信息:");
    console.error(error);

    console.log("\n🔍 调试建议:");
    console.log("  1. 检查数据库文件是否存在于 data/ 目录下");
    console.log("  2. 确认当前目录是正确的项目根目录");
    console.log("  3. 检查实体ID格式是否正确");
    console.log("  4. 确保之前已执行过post-commit操作生成了数据");

    process.exit(1);
  }
}

// 执行测试
if (require.main === module) {
  testEntityCommitHistory()
    .then(() => {
      console.log("\n✅ 测试脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { testEntityCommitHistory };
