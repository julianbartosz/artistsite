'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Toolbar } from './Toolbar'
import { StatsBar } from './StatsBar'

export interface RichTextEditorProps {
  content?: string
  onChange?: (content: string) => void
  placeholder?: string
  maxLength?: number
  showPreview?: boolean
  className?: string
  readOnly?: boolean
}

export default function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  maxLength = 5000,
  showPreview = false,
  className = '',
  readOnly = false
}: RichTextEditorProps) {
  const [isPreview, setIsPreview] = useState(showPreview)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 hover:text-blue-800 underline' } }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxLength })
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML())
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const addImage = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.prompt('Enter image URL:') : null
    if (url && editor) editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const addLink = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.prompt('Enter URL:') : null
    if (url && editor) editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    try {
      const response = await fetch('/api/upload/image', { method: 'POST', body: formData })
      if (response.ok) {
        const { url } = await response.json()
        editor?.chain().focus().setImage({ src: url }).run()
      }
    } catch {}
  }, [editor])

  if (!editor) {
    return (
      <div className={`border rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {!readOnly && (
        <Toolbar
          editor={editor}
          isPreview={isPreview}
          showPreview={showPreview}
          onTogglePreview={() => setIsPreview((v) => !v)}
          onAddImage={addImage}
          onAddLink={addLink}
          onUploadImage={uploadImage}
        />
      )}

      <div className="relative">
        {isPreview ? (
          <div className="prose prose-sm max-w-none p-4 min-h-[200px]" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
        ) : (
          <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 min-h-[200px] focus-within:outline-none" />
        )}
      </div>

      {!readOnly && <StatsBar editor={editor} maxLength={maxLength} />}
    </div>
  )
}
