"use client"
import { useState, useEffect } from "react"

export function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (value === 0) return
    let current = 0
    const totalSteps = 40
    const stepValue = Math.max(1, Math.ceil(value / totalSteps))
    const intervalTime = Math.floor(duration / totalSteps)

    // Small delay before starting
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        current += stepValue
        if (current >= value) {
          current = value
          clearInterval(interval)
        }
        setCount(current)
      }, intervalTime)
      return () => clearInterval(interval)
    }, 200)

    return () => clearTimeout(timeout)
  }, [value, duration])

  return <span>{count.toLocaleString()}</span>
}