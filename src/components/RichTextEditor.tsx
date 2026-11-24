'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import MediaPickerModal from '@/components/admin/MediaPickerModal';

export type RichTextMergeField = { token: string; label: string };

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Personalization tokens offered in an "Insert field" toolbar menu. */
  mergeFields?: RichTextMergeField[];
}

export function RichTextEditorInner({ value, onChange, mergeFields }: RichTextEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const extensions = useMemo(() => [
    StarterKit.configure({ link: { openOnClick: false } }),
    Image,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ], []);

  const editor = useEditor({
    extensions,
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-64 rounded-b-md border border-t-0 border-gray-300 bg-white p-4 focus:outline-none',
      },
    },
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    const normalized = value || '<p></p>';
    if (editor && normalized !== editor.getHTML()) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const addImage = () => {
    setPickerOpen(true);
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    const raw = window.prompt('Link URL (https://..., mailto:..., or /path)', previousUrl);
    if (raw === null) return;
    const url = raw.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const isRelative = url.startsWith('/') && !url.startsWith('//');
    let isSafeAbsolute = false;
    if (!isRelative) {
      try {
        const parsed = new URL(url);
        isSafeAbsolute = parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
      } catch {
        isSafeAbsolute = false;
      }
    }
    if (!isRelative && !isSafeAbsolute) {
      window.alert('Please enter a valid http://, https://, mailto:, or site-relative (/...) URL.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const buttonClass = (active = false) =>
    `px-3 py-1 text-sm border rounded transition-colors ${
      active
        ? 'border-gray-900 bg-gray-900 text-white'
        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
    }`;

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-t-md border border-gray-300 bg-gray-50 p-2">
        <button type="button" aria-pressed={editor.isActive('bold')} className={buttonClass(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" aria-pressed={editor.isActive('italic')} className={buttonClass(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" aria-pressed={editor.isActive('heading', { level: 2 })} className={buttonClass(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
        <span className="inline-flex overflow-hidden rounded border border-gray-300 bg-white" role="group" aria-label="Text alignment">
          <button
            type="button"
            aria-label="Align left"
            title="Align left"
            aria-pressed={editor.isActive({ textAlign: 'left' })}
            className={`px-2 py-1 text-sm transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'}`}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Align center"
            title="Align center"
            aria-pressed={editor.isActive({ textAlign: 'center' })}
            className={`border-x border-gray-300 px-2 py-1 text-sm transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'}`}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Align right"
            title="Align right"
            aria-pressed={editor.isActive({ textAlign: 'right' })}
            className={`px-2 py-1 text-sm transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'}`}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight size={15} aria-hidden="true" />
          </button>
        </span>
        <button type="button" aria-pressed={editor.isActive('bulletList')} className={buttonClass(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" aria-pressed={editor.isActive('link')} className={buttonClass(editor.isActive('link'))} onClick={setLink}>Link</button>
        <button type="button" className={buttonClass()} onClick={addImage}>Image</button>
        <button type="button" disabled={!editor.can().undo()} className={`${buttonClass()} disabled:opacity-40`} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" disabled={!editor.can().redo()} className={`${buttonClass()} disabled:opacity-40`} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
        {mergeFields && mergeFields.length > 0 && (
          <select
            aria-label="Insert personalization field"
            className={`${buttonClass()} ml-auto`}
            value=""
            onChange={(event) => {
              if (event.target.value) editor.chain().focus().insertContent(event.target.value).run();
            }}
          >
            <option value="">Insert field…</option>
            {mergeFields.map((field) => (
              <option key={field.token} value={field.token}>{field.label}</option>
            ))}
          </select>
        )}
      </div>
      <EditorContent editor={editor} />
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        showAltInput
        onSelect={(url, alt) => {
          editor.chain().focus().setImage({ src: url, alt: alt || '' }).run();
        }}
      />
    </div>
  );
}

const RichTextEditorClient = dynamic<RichTextEditorProps>(
  () => Promise.resolve({ default: RichTextEditorInner }),
  {
    ssr: false,
    loading: () => <div className="min-h-64 rounded-md border border-gray-300 bg-gray-50" aria-hidden="true" />,
  }
);

export function RichTextEditor(props: RichTextEditorProps) {
  return <RichTextEditorClient {...props} />;
}

export default RichTextEditor;