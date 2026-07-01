import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, LogOut } from 'lucide-react'

export default function Navbar({ onRefresh }) {
  const navigate = useNavigate()
  const { auth, logout } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      onRefresh()
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="bg-dark-800 border-b border-dark-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-white">InfluxDB Dashboard</h2>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-dark-700">
          <span className="text-sm text-gray-400">{auth.user || 'Guest'}</span>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
