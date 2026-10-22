import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextSelection } from '@tiptap/pm/state';

export const NoteTaskItem = TaskItem.extend({
  addNodeView() {
    const parent = this.parent();
    return props => {
      const view = parent(props);
      view.dom.dataset.type = 'taskItem';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'note-task-remove';
      remove.contentEditable = 'false';
      remove.textContent = '×';
      const refresh = node => {
        remove.hidden = !props.editor.isEditable;
        remove.setAttribute('aria-label', `Remover item: ${node.textContent || 'vazio'}`);
      };
      refresh(props.node);
      remove.addEventListener('mousedown', event => event.preventDefault());
      remove.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const position = props.getPos();
        if (!props.editor.isEditable || typeof position !== 'number') return;
        const node = props.editor.state.doc.nodeAt(position);
        props.editor.chain().focus().deleteRange({ from: position, to: position + node.nodeSize }).run();
      });
      view.dom.append(remove);
      view.dom.addEventListener('change', event => {
        if (event.target !== view.dom.querySelector('input[type=checkbox]') || !props.editor.isEditable) return;
        const position = props.getPos();
        if (typeof position !== 'number') return;
        const { state } = props.editor;
        const resolved = state.doc.resolve(position);
        const list = resolved.parent;
        if (list.type.name !== 'taskList') return;
        const items = [];
        list.forEach(item => items.push(item));
        const sorted = [...items.filter(item => !item.attrs.checked), ...items.filter(item => item.attrs.checked)];
        if (items.every((item, index) => item === sorted[index])) return;
        const selected = state.doc.nodeAt(position);
        const start = resolved.start();
        let caret = start;
        for (const item of sorted) { if (item === selected) break; caret += item.nodeSize; }
        const transaction = state.tr.replaceWith(start, start + list.content.size, sorted);
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(caret + 2)));
        props.editor.view.dispatch(transaction);
      });
      const update = view.update;
      view.update = (node, ...args) => { const result = update(node, ...args); if (result) refresh(node); return result; };
      return view;
    };
  },
}).configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } });

export const NoteTaskList = TaskList.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'note-task-group';
      const content = document.createElement('ul');
      content.dataset.type = 'taskList';
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'note-task-add'; add.contentEditable = 'false';
      add.textContent = '+  Item da lista';
      const completed = document.createElement('button');
      completed.type = 'button'; completed.className = 'note-task-completed'; completed.contentEditable = 'false';
      let collapsed = false;
      let current = node;
      const refresh = () => {
        let count = 0;
        current.forEach(item => { if (item.attrs.checked) count++; });
        add.hidden = !editor.isEditable;
        completed.hidden = !count;
        completed.textContent = `${collapsed ? '›' : '⌄'}  ${count} ${count === 1 ? 'item concluído' : 'itens concluídos'}`;
        completed.setAttribute('aria-expanded', String(!collapsed));
        wrapper.classList.toggle('note-task-collapsed', collapsed);
      };
      add.addEventListener('mousedown', event => event.preventDefault());
      add.addEventListener('click', event => {
        event.preventDefault();
        const position = getPos();
        if (!editor.isEditable || typeof position !== 'number') return;
        // Insert after pending items so the new field also follows them in keyboard order.
        let offset = 0;
        for (let index = 0; index < current.childCount; index++) {
          const item = current.child(index);
          if (item.attrs.checked) break;
          offset += item.nodeSize;
        }
        const at = position + 1 + offset;
        editor.chain().insertContentAt(at, { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }).focus(at + 2).run();
      });
      completed.addEventListener('mousedown', event => event.preventDefault());
      completed.addEventListener('click', () => { collapsed = !collapsed; refresh(); });
      wrapper.append(content, add, completed);
      refresh();
      return {
        dom: wrapper, contentDOM: content,
        update: next => { if (next.type !== current.type) return false; current = next; refresh(); return true; },
        stopEvent: event => add.contains(event.target) || completed.contains(event.target),
        ignoreMutation: mutation => mutation.target === wrapper || add.contains(mutation.target) || completed.contains(mutation.target),
      };
    };
  },
});
