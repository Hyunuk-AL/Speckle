'use client'

// 接続画面: サーバー URL + Personal Access Token を設定し、
// プロジェクト / モデルを選んでダッシュボードへ遷移する。

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchActiveUserName,
  fetchModels,
  fetchProjects,
  type SpeckleModel,
  type SpeckleProject
} from '@/lib/graphql'
import { loadSettings, saveSettings, clearSettings } from '@/lib/settings'

export default function ConnectPage() {
  const router = useRouter()
  const [serverUrl, setServerUrl] = useState('http://localhost')
  const [token, setToken] = useState('')
  const [userName, setUserName] = useState<string | null>(null)
  const [projects, setProjects] = useState<SpeckleProject[]>([])
  const [projectId, setProjectId] = useState('')
  const [models, setModels] = useState<SpeckleModel[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 保存済み設定があれば復元して自動接続
  useEffect(() => {
    const saved = loadSettings()
    if (saved) {
      setServerUrl(saved.serverUrl)
      setToken(saved.token)
      void connect(saved.serverUrl, saved.token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connect(url: string, tok: string) {
    setBusy(true)
    setError(null)
    try {
      const normalized = url.replace(/\/+$/, '')
      const name = await fetchActiveUserName(normalized, tok)
      saveSettings({ serverUrl: normalized, token: tok })
      setUserName(name)
      setProjects(await fetchProjects(normalized, tok))
    } catch (e) {
      setUserName(null)
      setProjects([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function selectProject(id: string) {
    setProjectId(id)
    setModels([])
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      setModels(await fetchModels(serverUrl.replace(/\/+$/, ''), token, id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function disconnect() {
    clearSettings()
    setUserName(null)
    setProjects([])
    setModels([])
    setProjectId('')
  }

  return (
    <main className="connect-page">
      <h1>Speckle PoC ダッシュボード</h1>
      <p className="hint">
        self-host した Speckle Server (例: http://localhost) に接続し、Revit から Publish
        したモデルの集計・色分け・3D 連携を行います。
      </p>

      <div className="card">
        <h2>1. サーバー接続</h2>
        <label className="field">
          <span>サーバー URL</span>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost"
          />
        </label>
        <label className="field">
          <span>Personal Access Token (Speckle の Developer Settings で発行)</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="トークンを貼り付け"
          />
        </label>
        <div className="button-row">
          <button className="primary" disabled={busy || !serverUrl || !token}
            onClick={() => void connect(serverUrl, token)}>
            {busy ? '接続中...' : '接続'}
          </button>
          {userName && (
            <button className="ghost" onClick={disconnect}>
              接続解除
            </button>
          )}
        </div>
        {userName && <p className="hint">接続済み: {userName}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      {projects.length > 0 && (
        <div className="card">
          <h2>2. プロジェクトとモデルを選択</h2>
          <label className="field">
            <span>プロジェクト</span>
            <select value={projectId} onChange={(e) => void selectProject(e.target.value)}>
              <option value="">-- 選択してください --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {projectId && models.length === 0 && !busy && (
            <p className="hint">このプロジェクトにはモデルがありません。</p>
          )}
          <ul className="model-list">
            {models.map((m) => (
              <li key={m.id}>
                <div>
                  <div>{m.name}</div>
                  <div className="hint">
                    {m.versions[0]
                      ? `最新バージョン: ${new Date(m.versions[0].createdAt).toLocaleString('ja-JP')} (${m.versions[0].sourceApplication ?? '不明'})`
                      : 'バージョンなし'}
                  </div>
                </div>
                <button
                  className="primary"
                  disabled={!m.versions[0]}
                  onClick={() => router.push(`/dashboard?project=${projectId}&model=${m.id}`)}
                >
                  開く
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
