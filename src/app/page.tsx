'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

interface CodeEntity {
  id: string
  type: string
  file: string
  loc?: {
    start: number
    end: number
  }
  rawName: string
  isWorkspace: boolean
  isDDD: boolean
}

interface WorkspaceInfo {
  root_directory: string
  package_names: string[]
  package_paths: string[]
  is_monorepo: boolean
}

interface AnalysisResult {
  entities: CodeEntity[]
  total_files: number
  total_entities: number
  analysis_timestamp: string
  workspace_info: WorkspaceInfo
}

export default function Home() {
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [savedFilePath, setSavedFilePath] = useState<string>('')
  const [projectRoot, setProjectRoot] = useState<string>('')
  const [generatedFileName, setGeneratedFileName] = useState<string>('')
  const [analysisHistory, setAnalysisHistory] = useState<string[]>([])

  const selectDirectory = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
      })

      if (result) {
        setSelectedPath(result as string)
        setError('')
        // 添加到历史记录
        setAnalysisHistory(prev => {
          const newHistory = [result as string, ...prev.filter(p => p !== result)]
          return newHistory.slice(0, 5) // 只保留最近5条记录
        })
      }
    } catch (err) {
      setError(`Failed to select directory: ${err}`)
    }
  }

  const analyzeRepository = async () => {
    if (!selectedPath) {
      setError('Please select a directory first')
      return
    }

    setIsAnalyzing(true)
    setError('')
    setSuccess('')

    try {
      const result = await invoke<AnalysisResult>('analyze_repository', {
        repoPath: selectedPath
      })

      setAnalysisResult(result)
      setSuccess(`✅ 分析完成！\n\n📊 统计信息:\n  • 总文件数: ${result.total_files}\n  • 总实体数: ${result.total_entities}\n  • 工作区包: ${result.workspace_info.package_names.length}\n  • 是否单体仓库: ${result.workspace_info.is_monorepo ? '是' : '否'}`)
    } catch (err) {
      setError(`Analysis failed: ${err}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveResults = async () => {
    if (!analysisResult || !selectedPath) return

    try {
      const result = await invoke<string>('save_analysis_result', {
        analysis: analysisResult,
        inputPath: selectedPath
      })

      // 解析返回的结果：文件路径|项目根目录|文件名
      const [filePath, root, filename] = result.split('|')
      setSavedFilePath(filePath)
      setProjectRoot(root)
      setGeneratedFileName(filename)

      setSuccess(`✅ 分析结果已保存!\n\n📁 文件位置: ${filePath}\n🏠 项目根目录: ${root}\n📄 文件名: ${filename}\n\n💡 点击下方按钮打开文件所在目录`)
    } catch (err) {
      setError(`Failed to save results: ${err}`)
    }
  }

  const openFileLocation = async () => {
    if (!savedFilePath) return

    try {
      // 获取文件所在目录
      const directory = savedFilePath.substring(0, savedFilePath.lastIndexOf('/'))
      await invoke('open_file_location', { path: directory })
    } catch (err) {
      setError(`Failed to open file location: ${err}`)
    }
  }

  return (
    <main className="container">
      <div className="card">
        <h1 style={{ marginBottom: '24px', color: '#333' }}>
          Tauri Code Base Analyzer
        </h1>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>选择前端项目目录</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={selectDirectory} className="button">
              选择目录
            </button>
            <span style={{ color: '#666', fontSize: '14px' }}>
              {selectedPath || '未选择目录'}
            </span>
          </div>

          {/* 分析历史记录 */}
          {analysisHistory.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>最近分析的目录:</h4>
              <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                {analysisHistory.map((path, index) => (
                  <div
                    key={index}
                    style={{
                      fontSize: '12px',
                      color: '#888',
                      padding: '4px 8px',
                      backgroundColor: path === selectedPath ? '#e3f2fd' : '#f5f5f5',
                      marginBottom: '2px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedPath(path)}
                  >
                    {path}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={analyzeRepository}
            disabled={!selectedPath || isAnalyzing}
            className="button"
            style={{ width: '200px' }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Repository'}
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {analysisResult && (
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Analysis Results</h3>

            <div className="stats">
              <div className="stat-item">
                <div className="stat-number">{analysisResult.total_files}</div>
                <div className="stat-label">总文件数</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisResult.total_entities}</div>
                <div className="stat-label">总实体数</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisResult.workspace_info.package_names.length}</div>
                <div className="stat-label">Workspace包</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisResult.workspace_info.is_monorepo ? '是' : '否'}</div>
                <div className="stat-label">单体仓库</div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button onClick={saveResults} className="button" style={{ marginRight: '12px' }}>
                Save base_entity.json
              </button>
              {savedFilePath && (
                <button onClick={openFileLocation} className="button" style={{ backgroundColor: '#28a745' }}>
                  📂 打开文件位置
                </button>
              )}
            </div>

            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '16px', fontWeight: 'bold' }}>
                查看实体详情 ({analysisResult.entities.length} 个实体)
              </summary>

              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '16px' }}>
                {analysisResult.entities.map((entity) => (
                  <div key={entity.id} style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{entity.rawName}</span>
                      <span style={{ fontSize: '12px', padding: '2px 6px', backgroundColor: '#007acc', color: 'white', borderRadius: '4px' }}>
                        {entity.type}
                      </span>
                      {entity.isWorkspace && (
                        <span style={{ fontSize: '11px', padding: '2px 4px', backgroundColor: '#28a745', color: 'white', borderRadius: '3px' }}>
                          WS
                        </span>
                      )}
                      {entity.isDDD && (
                        <span style={{ fontSize: '11px', padding: '2px 4px', backgroundColor: '#dc3545', color: 'white', borderRadius: '3px' }}>
                          DDD
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      📄 {entity.file}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      ID: {entity.id}
                    </div>
                    {entity.loc && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        位置: 第 {entity.loc.start} 行 - 第 {entity.loc.end} 行
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  )
}