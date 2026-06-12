// Speckle GraphQL API の薄いクライアント。
// PoC では Apollo 等は使わず fetch で十分 (クエリ数が少ないため)。

export type SpeckleProject = {
  id: string
  name: string
}

export type SpeckleModel = {
  id: string
  name: string
  versions: { id: string; createdAt: string; sourceApplication: string | null }[]
}

export async function speckleQuery<T>(
  serverUrl: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${serverUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }
  if (!json.data) throw new Error('GraphQL: empty response')
  return json.data
}

export async function fetchActiveUserName(serverUrl: string, token: string): Promise<string> {
  const data = await speckleQuery<{ activeUser: { name: string } | null }>(
    serverUrl,
    token,
    `query { activeUser { name } }`
  )
  if (!data.activeUser) throw new Error('トークンが無効です (activeUser が取得できません)')
  return data.activeUser.name
}

export async function fetchProjects(serverUrl: string, token: string): Promise<SpeckleProject[]> {
  const data = await speckleQuery<{
    activeUser: { projects: { items: SpeckleProject[] } } | null
  }>(
    serverUrl,
    token,
    `query {
      activeUser {
        projects(limit: 50) {
          items { id name }
        }
      }
    }`
  )
  return data.activeUser?.projects.items ?? []
}

export async function fetchModels(
  serverUrl: string,
  token: string,
  projectId: string
): Promise<SpeckleModel[]> {
  const data = await speckleQuery<{
    project: {
      models: {
        items: {
          id: string
          name: string
          versions: {
            items: { id: string; createdAt: string; sourceApplication: string | null }[]
          }
        }[]
      }
    }
  }>(
    serverUrl,
    token,
    `query ($projectId: String!) {
      project(id: $projectId) {
        models(limit: 100) {
          items {
            id
            name
            versions(limit: 1) {
              items { id createdAt sourceApplication }
            }
          }
        }
      }
    }`,
    { projectId }
  )
  return data.project.models.items.map((m) => ({
    id: m.id,
    name: m.name,
    versions: m.versions.items
  }))
}
