import React from 'react'
import { Database, ChevronRight } from 'lucide-react'

export default function BucketList({ buckets, onSelectBucket }) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Available Buckets</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map((bucket) => (
          <button
            key={bucket.id}
            onClick={() => onSelectBucket(bucket.name)}
            className="p-6 bg-dark-800 border border-dark-700 rounded-lg hover:border-blue-500 hover:bg-dark-700 transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <Database className="text-blue-400 group-hover:text-blue-300" size={24} />
              <ChevronRight className="text-gray-600 group-hover:text-gray-400" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
              {bucket.name}
            </h3>
            <p className="text-sm text-gray-400 mt-2">
              {bucket.type === 'user' ? 'User Bucket' : 'System Bucket'}
            </p>
            {bucket.retentionRules && bucket.retentionRules.length > 0 && (
              <p className="text-xs text-gray-500 mt-3">
                Retention: {bucket.retentionRules[0].everySeconds
                  ? `${Math.floor(bucket.retentionRules[0].everySeconds / 86400)} days`
                  : 'Unlimited'}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
