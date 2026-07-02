import React from 'react'
import { Database, Home, BarChart3 } from 'lucide-react'

export default function Sidebar({ onNavigate }) {
  return (
    <div className="w-64 bg-dark-800 border-r border-dark-700 p-6 hidden md:flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Database size={20} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-white">InfluxDB</h1>
      </div>

      <nav className="space-y-2 flex-1">
        <a
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
        >
          <Home size={20} />
          <span>Dashboard</span>
        </a>
        <a
          href="/report"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-dark-700 text-gray-300 hover:text-white transition-colors"
        >
          <BarChart3 size={20} />
          <span>Report</span>
        </a>
      </nav>

      <div className="pt-6 border-t border-dark-700 text-xs text-gray-500">
        <p>Monitoring & Analytics</p>
      </div>
    </div>
  )
}
