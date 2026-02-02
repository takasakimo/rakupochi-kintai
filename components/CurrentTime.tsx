'use client'

import { useState, useEffect } from 'react'

interface CurrentTimeProps {
  format?: 'time' | 'datetime'
  updateInterval?: number
  className?: string
}

export default function CurrentTime({ 
  format = 'time', 
  updateInterval = 1000,
  className = '' 
}: CurrentTimeProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, updateInterval)

    return () => clearInterval(timer)
  }, [updateInterval])

  const formatTime = () => {
    if (format === 'datetime') {
      return currentTime.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }
    return currentTime.toTimeString().slice(0, 5)
  }

  return <span className={className}>{formatTime()}</span>
}
