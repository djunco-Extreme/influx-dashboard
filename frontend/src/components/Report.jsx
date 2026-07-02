import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import Spinner from './Spinner'
import ErrorNotice from './ErrorNotice'

export default function Report({ bucketName, refreshKey }) {
  const [data, setData] = useState({
    throughput: [],
    clients: [],
    peakClients: 0,
    uniqueClients: 0,
    totalTraffic: { upload: 0, download: 0, total: 0 },
    clientsByProtocol: [],
    clientsByDeviceType: [],
    clientsBySSID: [],
    topClientsByThroughput: [],
    events: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSSIDs, setSelectedSSIDs] = useState([])
  const [allSSIDs, setAllSSIDs] = useState([
    'AU_Guest', 'AU_POS', 'AU_Tickets', 'eduroam', 'VerizonWiFiAccess'
  ])
  const [timeRange, setTimeRange] = useState('12h')
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [showCustomRange, setShowCustomRange] = useState(false)

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Build query parameters
        const params = new URLSearchParams()
        if (selectedSSIDs.length > 0) {
          params.append('ssids', selectedSSIDs.join(','))
        }
        params.append('timeRange', timeRange)

        const res = await axios.get(`/api/buckets/${bucketName}/report?${params.toString()}`)
        setData(res.data || data)
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('Report endpoint not available, using sample data')
          setData(getSampleData())
        } else {
          setError(err.response?.data?.message || 'Failed to fetch report data')
        }
      } finally {
        setLoading(false)
      }
    }

    if (bucketName) {
      fetchReportData()
    }
  }, [bucketName, selectedSSIDs, timeRange, refreshKey])

  const getSampleData = () => ({
    throughput: Array.from({ length: 16 }, (_, i) => ({
      time: `${11 + Math.floor(i / 2)}:${(i % 2) * 30}0`,
      mbps: Math.random() * 150
    })),
    clients: Array.from({ length: 16 }, (_, i) => ({
      time: `${11 + Math.floor(i / 2)}:${(i % 2) * 30}0`,
      count: 100 + Math.random() * 30
    })),
    peakClients: 149,
    uniqueClients: 208,
    totalTraffic: { upload: 4.97, download: 25.4, total: 30.4 },
    clientsByProtocol: [
      { name: '11ax', value: 67, color: '#3b82f6' },
      { name: '11ac', value: 23, color: '#ef4444' },
      { name: '11n', value: 13, color: '#f59e0b' }
    ],
    clientsByDeviceType: [
      { name: 'Apple iOS', value: 50, color: '#3b82f6' },
      { name: 'Windows', value: 25, color: '#10b981' },
      { name: 'Android', value: 15, color: '#f59e0b' },
      { name: 'Mac', value: 10, color: '#8b5cf6' }
    ],
    clientsBySSID: [
      { name: 'VisionWiFiAccess', value: 77 },
      { name: 'BTU Cougars WiFi', value: 56 },
      { name: 'BTU Staff', value: 45 },
      { name: 'TICKETS', value: 30 }
    ],
    topClientsByThroughput: [
      { name: 'iPhone', value: 35, color: '#3b82f6' },
      { name: 'iPad', value: 28, color: '#10b981' },
      { name: 'StoryPhoneS', value: 22, color: '#f59e0b' }
    ],
    events: [
      { time: '2026-06-29 13:57:26', type: 'Radius Accounting', description: 'New session for client [AR-08-56-E5-80 on Network {VisionWiFiAccess}]' },
      { time: '2026-06-29 13:57:24', type: 'Radius Accounting', description: 'New session for client [24-55-9A-9A-FE-70] on Network {VisionWiFiAccess}' }
    ]
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  const timeRangePresets = [
    { label: 'Last 5 minutes', value: '5m' },
    { label: 'Last 15 minutes', value: '15m' },
    { label: 'Last 30 minutes', value: '30m' },
    { label: 'Last 1 hour', value: '1h' },
    { label: 'Last 3 hours', value: '3h' },
    { label: 'Last 6 hours', value: '6h' },
    { label: 'Last 12 hours', value: '12h' },
    { label: 'Last 24 hours', value: '24h' },
    { label: 'Last 2 days', value: '2d' }
  ]

  const toggleSSID = (ssid) => {
    if (selectedSSIDs.includes(ssid)) {
      setSelectedSSIDs(selectedSSIDs.filter(s => s !== ssid))
    } else {
      setSelectedSSIDs([...selectedSSIDs, ssid])
    }
  }

  const handleApplyCustomRange = () => {
    if (customFromDate && customToDate) {
      setShowCustomRange(false)
      // In a real implementation, fetch data with custom date range
    }
  }

  const handleRefresh = () => {
    // Trigger data refetch by using the existing useEffect dependency
    window.location.reload()
  }

  const getTimeRangeLabel = () => {
    const preset = timeRangePresets.find(p => p.value === timeRange)
    return preset ? preset.label : timeRange
  }

  return (
    <div className="h-full overflow-auto bg-gray-900">
      {error && <ErrorNotice message={error} />}

      <div className="p-6 space-y-6">
        {/* Header & Controls */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Network Performance Report</h1>
            <p className="text-gray-400 text-sm">Bucket: {bucketName}</p>
          </div>

          {/* SSID & Time Range Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* SSID Selector */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-semibold text-gray-300">SSID</label>
                {selectedSSIDs.length > 0 && (
                  <button
                    onClick={() => setSelectedSSIDs([])}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allSSIDs.map((ssid) => (
                  <button
                    key={ssid}
                    onClick={() => toggleSSID(ssid)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedSSIDs.includes(ssid)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {ssid}
                  </button>
                ))}
              </div>
              {selectedSSIDs.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">{selectedSSIDs.length} selected</p>
              )}
            </div>

            {/* Time Range Selector */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <label className="block text-sm font-semibold text-gray-300 mb-3">Time Range</label>

                {!showCustomRange ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {timeRangePresets.slice(0, 6).map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => setTimeRange(preset.value)}
                          className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                            timeRange === preset.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {timeRangePresets.slice(6).map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => setTimeRange(preset.value)}
                          className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                            timeRange === preset.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowCustomRange(true)}
                      className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-medium transition-colors"
                    >
                      Custom Range
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">From</label>
                      <input
                        type="datetime-local"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">To</label>
                      <input
                        type="datetime-local"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleApplyCustomRange}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setShowCustomRange(false)}
                        className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Bar - Applied Filters */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                <span>Time Range: <span className="text-gray-200 font-medium">{getTimeRangeLabel()}</span></span>
                {selectedSSIDs.length > 0 && (
                  <>
                    {' • '}
                    <span>SSIDs: <span className="text-gray-200 font-medium">{selectedSSIDs.length} selected</span></span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 1: Throughput & Clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Throughput */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Throughput</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.throughput} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMbps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#999" tick={{ fontSize: 12 }} />
                <YAxis stroke="#999" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px' }} />
                <Area type="monotone" dataKey="mbps" stroke="#10b981" fillOpacity={1} fill="url(#colorMbps)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Clients */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Clients</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.clients} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#999" tick={{ fontSize: 12 }} />
                <YAxis stroke="#999" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px' }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2: Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Peak Clients */}
          <StatCard label="Peak Clients" value={data.peakClients} color="bg-red-500" />

          {/* Unique Clients */}
          <StatCard label="Unique Clients" value={data.uniqueClients} color="bg-green-500" />

          {/* Total Upload */}
          <GaugeCard label="Upload" value={data.totalTraffic.upload} unit="GB" color="#10b981" />

          {/* Total Download */}
          <GaugeCard label="Download" value={data.totalTraffic.download} unit="GB" color="#3b82f6" />
        </div>

        {/* Row 3: Traffic Gauge */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-6">Total Traffic</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GaugeChartComponent label="Upload" value={data.totalTraffic.upload} max={10} color="#10b981" />
            <GaugeChartComponent label="Download" value={data.totalTraffic.download} max={30} color="#3b82f6" />
            <GaugeChartComponent label="Total" value={data.totalTraffic.total} max={40} color="#f59e0b" />
          </div>
        </div>

        {/* Row 4: Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clients by Protocol */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Clients per Protocol</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.clientsByProtocol}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name} ${percent.toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.clientsByProtocol.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} clients`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Clients by Device Type */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Clients per Device Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.clientsByDeviceType}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name} ${percent.toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.clientsByDeviceType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} clients`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 5: Client Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clients by SSID */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Total Unique Clients by SSID</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.clientsBySSID}
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis type="number" stroke="#999" />
                <YAxis dataKey="name" type="category" stroke="#999" width={190} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '4px' }} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Clients by Throughput */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Top 10 Clients by Throughput</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.topClientsByThroughput}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {data.topClientsByThroughput.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} Mbps`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 6: Events Table */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 overflow-x-auto">
          <h2 className="text-lg font-semibold text-white mb-4">Events</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Time</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Component</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-3 px-4 text-gray-300 whitespace-nowrap">{event.time}</td>
                  <td className="py-3 px-4 text-gray-300">{event.type}</td>
                  <td className="py-3 px-4 text-gray-400">{event.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      <div className={`text-4xl font-bold ${color === 'bg-red-500' ? 'text-red-400' : 'text-green-400'}`}>
        {value}
      </div>
    </div>
  )
}

function GaugeCard({ label, value, unit, color }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <p className="text-gray-400 text-sm mb-4">{label}</p>
      <div className="text-center">
        <div style={{ color }} className="text-3xl font-bold">
          {value.toFixed(2)} {unit}
        </div>
      </div>
    </div>
  )
}

function GaugeChartComponent({ label, value, max, color }) {
  const percentage = (value / max) * 100

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 mb-4">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 20,50 A 30,30 0 0,1 80,50"
            fill="none"
            stroke="#444"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 20,50 A 30,30 0 0,1 80,50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 94.25} 94.25`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div style={{ color }} className="text-xl font-bold">
              {value.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
