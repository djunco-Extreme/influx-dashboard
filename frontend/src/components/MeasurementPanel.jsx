import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Spinner from './Spinner'
import { Activity } from 'lucide-react'

export default function MeasurementPanel({ bucketName, measurement }) {
  const [metadata, setMetadata] = useState(null)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedField, setSelectedField] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [metaRes, dataRes] = await Promise.all([
          axios.get(`/api/buckets/${bucketName}/measurements/${measurement}/metadata`),
          axios.get(`/api/buckets/${bucketName}/measurements/${measurement}/data?limit=100`),
        ])
        setMetadata(metaRes.data)
        setData(dataRes.data.data || [])
        if (metaRes.data.fields && metaRes.data.fields.length > 0) {
          setSelectedField(metaRes.data.fields[0])
        }
      } catch (err) {
        console.error('Failed to fetch measurement data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [bucketName, measurement])

  const chartData = data
    .reverse()
    .filter(d => !selectedField || d.field === selectedField)
    .map(d => ({
      time: new Date(d.time).toLocaleTimeString(),
      value: typeof d.value === 'number' ? d.value : 0,
    }))

  const stats = data.filter(d => !selectedField || d.field === selectedField)
  const values = stats.map(d => typeof d.value === 'number' ? d.value : 0).filter(v => v !== 0)
  const latest = values.length > 0 ? values[0] : 0
  const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0
  const max = values.length > 0 ? Math.max(...values) : 0
  const min = values.length > 0 ? Math.min(...values) : 0

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-dark-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-blue-400" />
            {measurement}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {metadata?.fields?.length || 0} field{(metadata?.fields?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          {/* Field selector */}
          {metadata?.fields && metadata.fields.length > 0 && (
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Field</label>
              <select
                value={selectedField || ''}
                onChange={(e) => setSelectedField(e.target.value || null)}
                className="w-full px-2 py-1 text-sm bg-dark-700 border border-dark-600 rounded text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">All fields</option>
                {metadata.fields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 ? (
            <div className="mb-6 h-40 bg-dark-700 rounded p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    interval={Math.floor(chartData.length / 4)}
                  />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                    }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center bg-dark-700 rounded mb-6">
              <p className="text-gray-500 text-sm">No data available</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-dark-700 rounded p-2">
              <p className="text-gray-500">Latest</p>
              <p className="text-white font-semibold mt-1">{latest.toFixed(2)}</p>
            </div>
            <div className="bg-dark-700 rounded p-2">
              <p className="text-gray-500">Avg</p>
              <p className="text-white font-semibold mt-1">{avg}</p>
            </div>
            <div className="bg-dark-700 rounded p-2">
              <p className="text-gray-500">Max</p>
              <p className="text-white font-semibold mt-1">{max.toFixed(2)}</p>
            </div>
            <div className="bg-dark-700 rounded p-2">
              <p className="text-gray-500">Min</p>
              <p className="text-white font-semibold mt-1">{min.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
