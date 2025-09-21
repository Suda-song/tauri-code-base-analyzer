/**
 * 用于测试的模拟数据
 */

const mockMrResult = {
  mrId: "mr_test_123456",
  sourceBranch: "feature/add-mr-stats",
  targetBranch: "master",
  totalMRFiles: 10,
  includeAiCodeFiles: 7,
  mrFileAcceptanceRate: 70,
  totalMRCodeLines: 500,
  includeAiCodeLines: 320,
  mrCodeAcceptanceRate: 64,
  relatedCommits: [
    {
      hash: "abc123def456",
      summary: "添加MR统计基础功能",
      timestamp: new Date()
    },
    {
      hash: "def456ghi789",
      summary: "修复文件匹配算法",
      timestamp: new Date()
    }
  ],
  createdAt: new Date(),
  mergedAt: new Date()
};

module.exports = {
  mockMrResult
};