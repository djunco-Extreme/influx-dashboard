import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ChevronLeft } from 'lucide-react'
import Spinner from './Spinner'
import ErrorNotice from './ErrorNotice'
import MeasurementPanel from './MeasurementPanel'

export default function BucketDetail({ bucketName, refreshKey }) {
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchMeasurements = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get(`/api/buckets/${bucketName}/measurements`)
        setMeasurements(res.data.measurements || [])
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch measurements')
      } finally {
        setLoading(false)
      }
    }

    fetchMeasurements()
  }, [bucketName, refreshKey])

  return (
    <div className="h-full overflow-auto">
      {error && <ErrorNotice message={error} />}

      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-2">{bucketName}</h2>
        <p className="text-gray-400 mb-6">
          {measurements.length} measurement{measurements.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : measurements.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-8 text-center">
            <p className="text-gray-400">No measurements found in this bucket</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {measurements.map((measurement) => (
              <MeasurementPanel
                key={measurement}
                bucketName={bucketName}
                measurement={measurement}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
