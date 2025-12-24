'use client'

import { useState, useRef } from 'react'
import type { ImageAttachment } from '@/lib/types'

interface ImageUploaderProps {
  images: ImageAttachment[]
  onImagesChange: (images: ImageAttachment[]) => void
  maxImages?: number
  label?: string
}

export function ImageUploader({ images, onImagesChange, maxImages = 5, label = 'Attach Images' }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newImages: ImageAttachment[] = []
    const remainingSlots = maxImages - images.length

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue

      try {
        const base64 = await fileToBase64(file)
        newImages.push({
          data: base64,
          mediaType: file.type,
          source: file.name
        })
      } catch (error) {
        console.error('Failed to read image:', error)
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages])
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data:image/xxx;base64, prefix
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <label className="text-green-400 text-xs uppercase tracking-widest">
        {label} ({images.length}/{maxImages})
      </label>

      {/* Upload area */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded p-4 cursor-pointer transition-all
            ${isDragging
              ? 'border-green-400 bg-green-900/20'
              : 'border-green-800/50 bg-black/30 hover:border-green-600 hover:bg-green-900/10'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <div className="text-center">
            <div className="text-green-600 text-2xl mb-2">📎</div>
            <div className="text-xs text-green-700">
              Click or drag images here
            </div>
            <div className="text-[9px] text-gray-700 mt-1">
              PNG, JPG, GIF up to {maxImages} images
            </div>
          </div>
        </div>
      )}

      {/* Preview images */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative group border border-green-800/50 rounded overflow-hidden bg-black/50"
            >
              <img
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={img.source || `Image ${index + 1}`}
                className="w-full h-24 object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeImage(index)
                }}
                className="absolute top-1 right-1 bg-red-900/80 hover:bg-red-800 text-red-200 rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
              {img.source && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-green-400 text-[9px] px-1 py-0.5 truncate">
                  {img.source}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
