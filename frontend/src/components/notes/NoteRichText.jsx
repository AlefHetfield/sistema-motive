import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { NoteTaskList, NoteTaskItem } from './noteTaskExtensions';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks, Undo2, Redo2 } from 'lucide-react';
import { encodeNoteDocument, noteContentText, plainNoteDocument } from '../../../../shared/noteContent';

const extensions = [StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, link: false }), NoteTaskList, NoteTaskItem];

export default function NoteRichText({ value, onChange, disabled, label = 'Conteúdo da nota', toolbarTarget, onCloseToolbar }) {
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  const editor = useEditor({
    extensions, content: plainNoteDocument(value), editable: !disabled,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'note-rich-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label } },
    onUpdate: ({ editor: instance }) => changeRef.current(encodeNoteDocument(instance.getJSON())),
  });
  const active = useEditorState({ editor, selector: ({ editor: instance }) => instance ? {
    bold: instance.isActive('bold'), italic: instance.isActive('italic'), underline: instance.isActive('underline'), strike: instance.isActive('strike'),
    bulletList: instance.isActive('bulletList'), orderedList: instance.isActive('orderedList'), taskList: instance.isActive('taskList'),
  } : {} });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    const current = encodeNoteDocument(editor.getJSON());
    if (encodeNoteDocument(plainNoteDocument(value)) !== current) editor.commands.setContent(plainNoteDocument(value), { emitUpdate: false });
  }, [editor, value]);
  const actions = [
    ['bold', 'Negrito (Ctrl+B)', Bold, 'toggleBold'], ['italic', 'Itálico (Ctrl+I)', Italic, 'toggleItalic'],
    ['underline', 'Sublinhado (Ctrl+U)', Underline, 'toggleUnderline'], ['strike', 'Tachado', Strikethrough, 'toggleStrike'],
    ['bulletList', 'Lista com marcadores', List, 'toggleBulletList'], ['orderedList', 'Lista numerada', ListOrdered, 'toggleOrderedList'],
    ['taskList', 'Caixas de seleção', ListChecks, 'toggleTaskList'],
  ];
  return <div className="note-rich-editor mt-4">
    {!disabled && toolbarTarget && createPortal(<div className="note-format-toolbar flex flex-wrap gap-0.5" role="group" aria-label="Formatação do texto" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseToolbar?.(); }
    }}>
      {actions.map(([key, title, icon, command]) => {
        const Icon = icon;
        return <button type="button" key={key} className="note-icon" title={title} aria-label={title} aria-pressed={Boolean(active?.[key])} disabled={!editor} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus()[command]().run()}><Icon size={17} /></button>;
      })}
      <button type="button" className="note-icon" aria-label="Desfazer formatação ou digitação" title="Desfazer" disabled={!editor} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></button>
      <button type="button" className="note-icon" aria-label="Refazer" title="Refazer" disabled={!editor} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></button>
    </div>, toolbarTarget)}
    <EditorContent editor={editor} />
    {!disabled && noteContentText(value).length > 20000 && <p role="alert" className="text-xs text-red-600">O texto ultrapassa o limite de 20.000 caracteres. Reduza o conteúdo para salvar.</p>}
  </div>;
}
