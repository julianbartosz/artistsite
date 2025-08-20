'use client'
import { Editor } from '@tiptap/react'

export function StatsBar({ editor, maxLength }: { editor: Editor | null; maxLength: number }) {
  if (!editor) return null
  const chars = editor.storage.characterCount.characters()
  const words = editor.storage.characterCount.words()
  return (
    <div className="border-t bg-gray-50 px-4 py-2 flex justify-between items-center text-sm text-gray-600">
      <div>
        {chars}/{maxLength} characters
      </div>
      <div>{words} words</div>
    </div>
  )
}
