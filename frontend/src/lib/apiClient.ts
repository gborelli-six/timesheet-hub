import { queryClient } from '@/lib/queryClient'

async function request(url: string, options: Parameters<typeof fetch>[1] = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401) {
    queryClient.clear()
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

export const apiClient = {
  get: (url: string) => request(url),
  post: (url: string, body: unknown) =>
    request(url, { method: 'POST', body: JSON.stringify(body) }),
}
