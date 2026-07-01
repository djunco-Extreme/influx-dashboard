export default function Spinner({ size = 'md' }) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size]

  return (
    <div className={`${sizeClass} border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin`} />
  )
}
