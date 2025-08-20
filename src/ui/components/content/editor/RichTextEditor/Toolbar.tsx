'use client'
import { Editor } from '@tiptap/react'
import { 
  Bold, Italic, List, ListOrdered, Quote, Undo, Redo,
  Link as LinkIcon, Image as ImageIcon, Eye, Upload
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
  isPreview: boolean
  showPreview: boolean
  onTogglePreview: () => void
  onAddImage: () => void
  onAddLink: () => void
  onUploadImage: (file: File) => void
}

export function Toolbar({ editor, isPreview, showPreview, onTogglePreview, onAddImage, onAddLink, onUploadImage }: ToolbarProps) {
  if (!editor) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadImage(file)
  }

  return (
    <div className="border-b bg-gray-50 p-2 flex flex-wrap items-center gap-1">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-300' : ''}`} title="Bold">
        <Bold size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-300' : ''}`} title="Italic">
        <Italic size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-300' : ''}`} title="Bullet List">
        <List size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-300' : ''}`} title="Numbered List">
        <ListOrdered size={16} />
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('blockquote') ? 'bg-gray-300' : ''}`} title="Quote">
        <Quote size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button onClick={onAddLink} className="p-2 rounded hover:bg-gray-200" title="Add Link">
        <LinkIcon size={16} />
      </button>
      <button onClick={onAddImage} className="p-2 rounded hover:bg-gray-200" title="Add Image">
        <ImageIcon size={16} />
      </button>
      <label className="p-2 rounded hover:bg-gray-200 cursor-pointer" title="Upload Image">
        <Upload size={16} />
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </label>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 rounded hover:bg-gray-200 disabled:opacity-50" title="Undo">
        <Undo size={16} />
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 rounded hover:bg-gray-200 disabled:opacity-50" title="Redo">
        <Redo size={16} />
      </button>

      <div className="flex-1" />

      {showPreview && (
        <button onClick={onTogglePreview} className={`p-2 rounded hover:bg-gray-200 ${isPreview ? 'bg-gray-300' : ''}`} title="Toggle Preview">
          <Eye size={16} />
        </button>
      )}
    </div>
  )
}
