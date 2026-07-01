import React, { createContext, useState, useEffect } from 'react'
import axios from 'axios'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    authenticated: false,
    user: null,
    loading: true,
    error: null,
  })

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get('/api/auth/session')
        setAuth({
          authenticated: res.data.authenticated,
          user: res.data.user || null,
          loading: false,
          error: null,
        })
      } catch (err) {
        setAuth(prev => ({ ...prev, loading: false }))
      }
    }
    checkSession()
  }, [])

  const login = async (username, password) => {
    setAuth(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await axios.post('/api/login', { username, password })
      setAuth({
        authenticated: true,
        user: res.data.user,
        loading: false,
        error: null,
      })
      return true
    } catch (err) {
      const message = err.response?.data?.message || 'Authentication failed'
      setAuth(prev => ({
        ...prev,
        authenticated: false,
        user: null,
        loading: false,
        error: message,
      }))
      return false
    }
  }

  const logout = async () => {
    try {
      await axios.post('/api/logout')
    } catch (err) {
      console.error('Logout error:', err)
    }
    setAuth({
      authenticated: false,
      user: null,
      loading: false,
      error: null,
    })
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
