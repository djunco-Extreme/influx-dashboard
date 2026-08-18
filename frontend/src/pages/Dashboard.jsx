import React from 'react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <Sidebar onNavigate={() => {}} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top navbar */}
        <Navbar onRefresh={() => {}} />

        {/* Content area */}
        <div className="flex-1 overflow-auto flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg">Welcome to Dashboard</p>
            <p className="text-sm text-gray-500 mt-2">
              Navigate using the sidebar to access other sections.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
