"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Download, Eye, File, Image, FileText, Archive, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileAttachment {
  id: string
  file_name: string
  file_size: number
  file_type: string
  file_url: string
  created_at: string
}

interface FilePreviewProps {
  file: FileAttachment
  showDelete?: boolean
  onDelete?: (fileId: string) => void
  className?: string
}

export function FilePreview({ file, showDelete = false, onDelete, className }: FilePreviewProps) {
  const [isImageOpen, setIsImageOpen] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />
    if (fileType.includes('zip') || fileType.includes('rar')) return <Archive className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const isImage = file.file_type.startsWith('image/')

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.file_url
    link.download = file.file_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={cn("flex items-center gap-3 p-3 border rounded-lg bg-muted/50", className)}>
      <div className="flex-shrink-0">
        {getFileIcon(file.file_type)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.file_name}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {formatFileSize(file.file_size)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(file.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isImage ? (
          <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <div className="relative">
                <img
                  src={file.file_url}
                  alt={file.file_name}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setIsImageOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>

        {showDelete && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(file.id)}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number
  className?: string
}

export function FileUpload({ onFileSelect, accept, maxSize = 10 * 1024 * 1024, className }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.size <= maxSize) {
        onFileSelect(file)
      }
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size <= maxSize) {
        onFileSelect(file)
      }
    }
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <File className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Drag and drop a file here, or click to select
      </p>
      <p className="text-xs text-muted-foreground">
        Max file size: {formatFileSize(maxSize)}
      </p>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileInput}
        id="file-upload"
      />
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        Choose File
      </Button>
    </div>
  )
}