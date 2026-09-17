'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/lib/utils'

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  onValueCommit,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const externalValues = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  )

  // Keep pointer movement local to the slider. Marketplace filtering can be
  // expensive, so updating the parent on every pointer event makes the thumb
  // visibly lag behind the finger/cursor. We commit the selected values when
  // the interaction ends, while the thumb itself remains fully responsive.
  const [visualValues, setVisualValues] = React.useState<number[]>(externalValues)
  const isInteractingRef = React.useRef(false)

  React.useEffect(() => {
    if (!isInteractingRef.current) {
      setVisualValues(externalValues)
    }
  }, [externalValues])

  const handleValueChange = React.useCallback((nextValues: number[]) => {
    isInteractingRef.current = true
    setVisualValues(nextValues)
  }, [])

  const handleValueCommit = React.useCallback(
    (nextValues: number[]) => {
      isInteractingRef.current = false
      setVisualValues(nextValues)
      onValueChange?.(nextValues)
      onValueCommit?.(nextValues)
    },
    [onValueChange, onValueCommit],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={visualValues}
      min={min}
      max={max}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={
          'bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        }
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={
            'bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
          }
        />
      </SliderPrimitive.Track>
      {Array.from({ length: visualValues.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
