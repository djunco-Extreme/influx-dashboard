import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import BucketList from '../components/BucketList'
import BucketDetail from '../components/BucketDetail'
import Spinner from '../components/Spinner'
import ErrorNotice from '../components/ErrorNotice'

export default function Dashboard() {
  const [buckets, setBuckets] = useState([])
  const [selectedBucket, setSelectedBucket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
          ) : selectedBucket ? (
            <BucketDetail bucketName={selectedBucket} refreshKey={refreshKey} />
          ) : (
            <BucketList buckets={buckets} onSelectBucket={setSelectedBucket} />
          )}
        </div>
      </div>
    </div>
  )
}
