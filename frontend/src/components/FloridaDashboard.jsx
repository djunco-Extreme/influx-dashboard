import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, GaugeChart, Gauge
} from 'recharts'
import Spinner from './Spinner'
import { Wifi, Users, Activity, TrendingUp } from 'lucide-react'

export default function FloridaDashboard() {
  const [timeRange, setTimeRange] = useState('3h')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [startDate, setStartDate] = useState(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 16))
  const [selectedSSID, setSelectedSSID] = useState('all')
  const [ssidOptions, setSsidOptions] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch available SSIDs
  useEffect(() => {
    const fetchSSIDs = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await axios.get(
          `/api/buckets/florida/ssids`,
          { signal: controller.signal }
        )
        clearTimeout(timeoutId)

        const ssids = response.data.ssids || []
        setSsidOptions(['all', ...ssids])
      } catch (err) {
        console.warn('Failed to fetch SSIDs:', err)
        setSsidOptions(['all'])
      }
    }

    fetchSSIDs()
  }, [])

  // Fetch dashboard data when timeRange, custom dates, or SSID changes
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      setError(null)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        let url = '/api/buckets/florida/xiqc-dashboard?'

        if (useCustomRange) {
          url += `startTime=${encodeURIComponent(startDate)}&endTime=${encodeURIComponent(endDate)}`
        } else {
          url += `timeRange=${timeRange}`
        }

        if (selectedSSID && selectedSSID !== 'all') {
          url += `&ssid=${encodeURIComponent(selectedSSID)}`
        }

        const response = await axios.get(url, { signal: controller.signal })
        clearTimeout(timeoutId)

        setDashboardData(response.data)
      } catch (err) {
        if (err.name === 'AbortError') {
          setError('Dashboard loading timed out. Try a shorter time range.')
        } else {
          setError('Failed to load dashboard data')
        }
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [timeRange, useCustomRange, startDate, endDate, selectedSSID])

  if (loading) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-12 flex items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200">
        {error}
      </div>
    )
  }

  const data = dashboardData || {}

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wifi size={24} className="text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">XIQ-C Dashboard</h1>
              <p className="text-sm text-gray-400 mt-1">Florida Bucket - Network Analytics</p>
            </div>
          </div>
        </div>

        {/* Controls Row 1: SSID and Time Range */}
        <div className="flex gap-4 mb-4">
          {/* SSID Selector */}
          <div className="flex-1">
            <label className="text-sm text-gray-400 block mb-2">Select Network (SSID)</label>
            <select
              value={selectedSSID}
              onChange={(e) => setSelectedSSID(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {ssidOptions.map((ssid) => (
                <option key={ssid} value={ssid}>
                  {ssid === 'all' ? 'All Networks' : ssid}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selector */}
          <div className="flex-1">
            <label className="text-sm text-gray-400 block mb-2">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value)
                setUseCustomRange(false)
              }}
              disabled={useCustomRange}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="1h">Last 1 Hour</option>
              <option value="3h">Last 3 Hours</option>
              <option value="6h">Last 6 Hours</option>
              <option value="12h">Last 12 Hours</option>
              <option value="24h">Last 24 Hours</option>
            </select>
          </div>
        </div>

        {/* Controls Row 2: Custom Date Range Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="customRange"
            checked={useCustomRange}
            onChange={(e) => setUseCustomRange(e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700 cursor-pointer"
          />
          <label htmlFor="customRange" className="text-sm text-gray-400 cursor-pointer">
            Use Custom Date Range
          </label>
        </div>

        {/* Controls Row 3: Custom Date Inputs */}
        {useCustomRange && (
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-400 block mb-2">Start Date & Time</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-400 block mb-2">End Date & Time</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          icon={<Users size={20} className="text-green-400" />}
          title="Peak Clients"
          value={data.peakClients || 0}
          subtitle="Maximum concurrent connections"
        />
        <MetricCard
          icon={<Users size={20} className="text-purple-400" />}
          title="Unique Clients"
          value={data.uniqueClients || 0}
          subtitle="Distinct devices"
        />
        <MetricCard
          icon={<TrendingUp size={20} className="text-blue-400" />}
          title="Total Traffic"
          value={formatBytes(data.totalTraffic?.total || 0)}
          subtitle="Upload + Download"
        />
      </div>

      {/* Throughput Chart */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-blue-400" />
          Throughput
        </h3>
        {data.throughput && data.throughput.length > 0 ? (
          <div className="h-64 bg-dark-700 rounded p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} label={{ value: 'Bytes/s', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Line type="monotone" dataKey="upload" stroke="#10b981" name="Upload" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="download" stroke="#3b82f6" name="Download" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
        )}
      </div>

      {/* Clients Over Time */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Clients Over Time</h3>
        {data.clientsOverTime && data.clientsOverTime.length > 0 ? (
          <div className="h-64 bg-dark-700 rounded p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.clientsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" name="Clients" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
        )}
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Protocol Distribution */}
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Clients by Protocol</h3>
          {data.protocolDistribution && data.protocolDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.protocolDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.protocolDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
          )}
        </div>

        {/* Device Type Distribution */}
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Clients by Device Type</h3>
          {data.deviceTypeDistribution && data.deviceTypeDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.deviceTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#82ca9d"
                    dataKey="value"
                  >
                    {data.deviceTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#82ca9d'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
          )}
        </div>
      </div>

      {/* Clients by SSID */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Clients by SSID</h3>
        {data.clientsBySSID && data.clientsBySSID.length > 0 ? (
          <div className="h-64 bg-dark-700 rounded p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.clientsBySSID}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Client Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
        )}
      </div>

      {/* Clients by AP */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Clients by Access Point</h3>
        {data.clientsByAP && data.clientsByAP.length > 0 ? (
          <div className="h-64 bg-dark-700 rounded p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.clientsByAP}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Legend />
                <Bar dataKey="count" fill="#10b981" name="Client Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-dark-700 rounded text-gray-500">No data</div>
        )}
      </div>

      {/* Top Clients */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Top 10 Clients by Throughput</h3>
        {data.topClients && data.topClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-300">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="text-left py-2 px-3 font-semibold">Hostname</th>
                  <th className="text-left py-2 px-3 font-semibold">MAC Address</th>
                  <th className="text-right py-2 px-3 font-semibold">Throughput</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((client, idx) => (
                  <tr key={idx} className="border-b border-dark-700 hover:bg-dark-700">
                    <td className="py-2 px-3">{client.hostname || 'N/A'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{client.mac}</td>
                    <td className="text-right py-2 px-3">{formatBytes(client.throughput)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">No data</div>
        )}
      </div>

      {/* Events */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Events</h3>
        {data.events && data.events.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.events.map((event, idx) => (
              <div key={idx} className="bg-dark-700 rounded p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-gray-300">{event.component}</span>
                  <span className="text-xs text-gray-500">{new Date(event.time).toLocaleString()}</span>
                </div>
                <p className="text-gray-400">{event.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">No events</div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, title, value, subtitle }) {
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="font-semibold text-gray-300">{title}</h3>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
