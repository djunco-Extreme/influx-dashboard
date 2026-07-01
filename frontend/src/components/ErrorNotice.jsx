import React from 'react'
import { AlertCircle, X } from 'lucide-react'

export default function ErrorNotice({ message }) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) return null

  return (
    <div className="bg-red-900/20 border-l-4 border-red-600 p-4 m-4 rounded flex items-start gap-4">
      <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <p className="text-red-200 text-sm">{message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-red-400 hover:text-red-300"
      >
        <X size={18} />
      </button>
    </div>
  )
}
