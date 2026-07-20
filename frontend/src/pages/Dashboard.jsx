import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import BucketList from '../components/BucketList'
import BucketDetail from '../components/BucketDetail'
import XIQCPanel from '../components/XIQCPanel'
import Spinner from '../components/Spinner'
import ErrorNotice from '../components/ErrorNotice'

export default function Dashboard() {
  const [buckets, setBuckets] = useState([])
  const [selectedBucket, setSelectedBucket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState('buckets') // 'buckets' or 'xiqc'

  useEffect(() => {
    const fetchBuckets = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get('/api/buckets')
        setBuckets(res.data.buckets || [])
        if (res.data.buckets && res.data.buckets.length > 0 && !selectedBucket) {
          setSelectedBucket(res.data.buckets[0].name)
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch buckets')
      } finally {
        setLoading(false)
      }
    }

    fetchBuckets()
  }, [refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <Sidebar onNavigate={() => {}} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top navbar */}
        <Navbar onRefresh={handleRefresh} />

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {error && <ErrorNotice message={error} />}

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : buckets.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-400 mb-4">No buckets found</p>
                <p className="text-sm text-gray-500">
                  Make sure InfluxDB is running and has data.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* View tabs and bucket selector */}
              <div className="bg-dark-800 border-b border-dark-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  {/* Tabs */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setViewMode('buckets')
                        setSelectedBucket(null)
                      }}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        viewMode === 'buckets'
                          ? 'bg-blue-600 text-white'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      }`}
                    >
                      All Buckets
                    </button>
                    <button
                      onClick={() => setViewMode('xiqc')}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        viewMode === 'xiqc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      }`}
                    >
                      XIQ-C Wireless
                    </button>
                  </div>

                  {/* Bucket selector (only for buckets view) */}
                  {viewMode === 'buckets' && (
                    <select
                      value={selectedBucket || ''}
                      onChange={(e) => setSelectedBucket(e.target.value)}
                      className="px-4 py-2 bg-dark-700 text-white border border-dark-600 rounded hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">-- Select a bucket --</option>
                      {buckets.map((bucket) => (
                        <option key={bucket.id} value={bucket.name}>
                          {bucket.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Content */}
              {viewMode === 'xiqc' ? (
                <div className="p-6 overflow-auto">
                  <XIQCPanel bucketName="florida" />
                </div>
              ) : selectedBucket ? (
                <BucketDetail bucketName={selectedBucket} refreshKey={refreshKey} />
              ) : (
                <BucketList buckets={buckets} onSelectBucket={setSelectedBucket} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
