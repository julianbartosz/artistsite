'use client';

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function RichTextEditorInner({ value, onChange }: RichTextEditorProps) {
  const extensions = useMemo(() => [
    StarterKit.configure({ link: { openOnClick: false } }),
    Image,
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
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const url = window.prompt('Link URL');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const buttonClass = 'px-3 py-1 text-sm border border-gray-300 bg-white hover:bg-gray-50 rounded';

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-t-md border border-gray-300 bg-gray-50 p-2">
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
        <button type="button" className={buttonClass} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</button>
        <button type="button" className={buttonClass} onClick={setLink}>Link</button>
        <button type="button" className={buttonClass} onClick={addImage}>Image</button>
      </div>
      <EditorContent editor={editor} />
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