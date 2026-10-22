import { parseNoteDocument } from '../../utils/noteContent.js';

export default function NoteFormattedText({ value }) {
  const document = parseNoteDocument(value);
  if (!document) return value;
  const render = (node, key) => {
    const children = node.content?.map((child, index) => render(child, index));
    if (node.type === 'text') return (node.marks || []).reduce((text, mark) => {
      if (mark.type === 'bold') return <strong key={key}>{text}</strong>;
      if (mark.type === 'italic') return <em key={key}>{text}</em>;
      if (mark.type === 'underline') return <u key={key}>{text}</u>;
      return <s key={key}>{text}</s>;
    }, node.text);
    if (node.type === 'hardBreak') return <br key={key} />;
    if (node.type === 'paragraph') return <p key={key}>{children?.length ? children : <br />}</p>;
    if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
    if (node.type === 'orderedList') return <ol key={key} start={node.attrs?.start}>{children}</ol>;
    if (node.type === 'taskList') return <ul data-type="taskList" key={key}>{children}</ul>;
    if (node.type === 'taskItem') return <li key={key} data-type="taskItem"><span aria-hidden="true">{node.attrs?.checked ? '☑' : '☐'}</span><div>{children}</div></li>;
    if (node.type === 'listItem') return <li key={key}>{children}</li>;
    return children;
  };
  return <div className="note-formatted-text">{render(document, 'doc')}</div>;
}
