const BASE_URL = ''

let isRefreshing = false
let refreshPromise = null

function getTokens() {
  return { token: localStorage.getItem('token'), refreshToken: localStorage.getItem('refreshToken') }
}

function setTokens(token, refreshToken) {
  localStorage.setItem('token', token)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
}

async function refreshAccessToken() {
  const { refreshToken } = getTokens()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  if (!res.ok) {
    clearTokens()
    throw new Error('Refresh failed')
  }

  const data = await res.json()
  setTokens(data.token, data.refreshToken)
  return data
}

async function api(method, url, body = null, opts = {}) {
  const { token } = getTokens()
  const headers = { ...opts.headers }

  if (token) headers['Authorization'] = `Bearer ${token}`

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const config = { method, headers }
  if (body) config.body = body instanceof FormData ? body : JSON.stringify(body)

  let res = await fetch(`${BASE_URL}${url}`, config)

  if (res.status === 401 && getTokens().refreshToken) {
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccessToken().finally(() => { isRefreshing = false; refreshPromise = null })
    }

    try {
      await refreshPromise
      const { token: newToken } = getTokens()
      headers['Authorization'] = `Bearer ${newToken}`
      const retryConfig = { method, headers }
      if (body) retryConfig.body = config.body
      res = await fetch(`${BASE_URL}${url}`, retryConfig)
    } catch {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export function get(url, opts) { return api('GET', url, null, opts) }
export function post(url, body, opts) { return api('POST', url, body, opts) }
export function put(url, body, opts) { return api('PUT', url, body, opts) }
export function del(url, opts) { return api('DELETE', url, null, opts) }

export { setTokens, clearTokens, getTokens }
