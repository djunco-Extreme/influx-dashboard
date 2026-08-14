import React from 'react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import FloridaDashboard from '../components/FloridaDashboard'

export default function FloridaDashboardPage() {
  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top navbar */}
        <Navbar />

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">
          <FloridaDashboard />
        </div>
      </div>
    </div>
  )
}
