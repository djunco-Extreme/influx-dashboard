import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import Spinner from './Spinner'
import { Wifi, Users, Activity } from 'lucide-react'

export default function XIQCPanel({ availableBuckets = [] }) {
  const [selectedBucket, setSelectedBucket] = useState('florida')
  const [throughputData, setThroughputData] = useState([])
  const [clientStats, setClientStats] = useState({ peak: 0, unique: 0 })
  const [ssidOptions, setSsidOptions] = useState([])
  const [selectedSSID, setSelectedSSID] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch SSID options and initial data
  useEffect(() => {
    const fetchSSIDs = async () => {
      try {
        // First get measurement metadata - with timeout to prevent hanging
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const metaRes = await axios.get(`/api/buckets/${selectedBucket}/measurements/MuStats/metadata`, { signal: controller.signal })
        clearTimeout(timeoutId)
        console.log('Measurement metadata:', metaRes.data)

        // Extract unique SSIDs from tags
        const tags = metaRes.data.tags || []
        const ssidTag = tags.find(t => t.includes('SSID'))
        if (ssidTag) {
          setSsidOptions(['all', ...ssidTag.split(',').filter(Boolean)])
        } else {
          setSsidOptions(['all'])
        }
        setSelectedSSID('all')
      } catch (err) {
        console.error('Failed to fetch SSIDs:', err)
        setError('Could not load SSID options')
        setSsidOptions(['all'])
        setSelectedSSID('all')
      }
    }
    fetchSSIDs()
  }, [selectedBucket])

  // Fetch throughput data
  useEffect(() => {
    if (!selectedSSID) return

    const fetchThroughputData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Request very small dataset to prevent memory issues
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

        const dataRes = await axios.get(`/api/buckets/${selectedBucket}/measurements/MuStats/data?limit=20`, { signal: controller.signal })
        clearTimeout(timeoutId)
        const rawData = dataRes.data.data || []

        // Filter by SSID if selected
        let filtered = rawData
        if (selectedSSID !== 'all') {
          filtered = rawData.filter(d => d.tags?.SSID === selectedSSID)
        }

        // Group by time and aggregate upload/download
        const grouped = {}
        filtered.forEach(point => {
          try {
            const time = new Date(point.time).toLocaleTimeString()
            if (!grouped[time]) {
              grouped[time] = { time, upload: 0, download: 0, clientCount: 0 }
            }

            const numValue = typeof point.value === 'number' ? point.value : 0
            if (!isFinite(numValue)) return

            if (point.field === 'RxBytesDelta') {
              grouped[time].download = (grouped[time].download || 0) + numValue
            } else if (point.field === 'TxBytesDelta') {
              grouped[time].upload = (grouped[time].upload || 0) + numValue
            } else if (point.field === 'MAC') {
              grouped[time].clientCount = (grouped[time].clientCount || 0) + 1
            }
          } catch (e) {
            console.warn('Error processing data point:', e)
          }
        })

        const chartData = Object.values(grouped).reverse().slice(0, 50)
        setThroughputData(chartData)

        // Calculate peak and unique clients
        const uniqueClients = new Set(filtered.map(d => d.value).filter(v => v))
        const peakClients = Math.max(...filtered.map(d => d.value || 0))

        setClientStats({
          peak: peakClients || 0,
          unique: uniqueClients.size || 0,
        })
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error('Request timeout - data taking too long to load:', err)
          setError('Data loading timed out - the MuStats measurement is too large. Try selecting a different bucket.')
        } else if (err.response?.status >= 500) {
          console.error('Server error loading data:', err)
          setError('Server error - unable to load throughput data. Please try again later.')
        } else {
          console.error('Failed to fetch throughput data:', err)
          setError('Could not load throughput data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchThroughputData()
  }, [selectedBucket, selectedSSID])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wifi size={24} className="text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">XIQ-C Wireless Statistics</h2>
            <p className="text-xs text-gray-500 mt-1">Real-time network performance from InfluxDB</p>
          </div>
        </div>

        {/* Bucket and SSID Selectors */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Bucket Selector */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Select Bucket</label>
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {availableBuckets.length > 0 ? (
                availableBuckets.map(bucket => (
                  <option key={bucket.id || bucket.name} value={bucket.name}>
                    {bucket.name}
                  </option>
                ))
              ) : (
                <option value="florida">florida</option>
              )}
            </select>
          </div>

          {/* SSID Selector */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Select Network (SSID)</label>
            <select
              value={selectedSSID}
              onChange={(e) => setSelectedSSID(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {ssidOptions.map(ssid => (
                <option key={ssid} value={ssid}>
                  {ssid === 'all' ? 'All Networks' : ssid}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-12 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          {/* Client Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Users size={20} className="text-green-400" />
                <h3 className="font-semibold text-gray-300">Peak Clients</h3>
              </div>
              <p className="text-3xl font-bold text-white">{clientStats.peak}</p>
              <p className="text-xs text-gray-500 mt-2">Maximum concurrent connections</p>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Users size={20} className="text-purple-400" />
                <h3 className="font-semibold text-gray-300">Unique Clients</h3>
              </div>
              <p className="text-3xl font-bold text-white">{clientStats.unique}</p>
              <p className="text-xs text-gray-500 mt-2">Distinct device count</p>
            </div>
          </div>

          {/* Throughput Chart */}
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity size={20} className="text-blue-400" />
              <h3 className="font-semibold text-white">Network Throughput</h3>
            </div>

            {throughputData.length > 0 ? (
              <div className="h-64 bg-dark-700 rounded p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      interval={Math.max(0, Math.floor(throughputData.length / 4) - 1)}
                    />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} label={{ value: 'Bytes/sec', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                      }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value, name) => {
                        if (typeof value !== 'number' || !isFinite(value)) return 'N/A'
                        return `${(value / 1024).toFixed(2)} KB/s`
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="upload"
                      stroke="#10b981"
                      name="Upload"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="download"
                      stroke="#3b82f6"
                      name="Download"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-dark-700 rounded">
                <p className="text-gray-500 text-sm">No throughput data available</p>
              </div>
            )}

            {/* Data Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
              <div className="bg-dark-700 rounded p-3">
                <p className="text-gray-500">Avg Upload</p>
                <p className="text-white font-semibold mt-1">
                  {throughputData.length > 0
                    ? `${(throughputData.reduce((sum, d) => sum + (d.upload || 0), 0) / throughputData.length / 1024).toFixed(1)} KB/s`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <p className="text-gray-500">Avg Download</p>
                <p className="text-white font-semibold mt-1">
                  {throughputData.length > 0
                    ? `${(throughputData.reduce((sum, d) => sum + (d.download || 0), 0) / throughputData.length / 1024).toFixed(1)} KB/s`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="bg-dark-700 rounded p-3">
                <p className="text-gray-500">Data Points</p>
                <p className="text-white font-semibold mt-1">{throughputData.length}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
