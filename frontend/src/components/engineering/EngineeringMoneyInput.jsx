import { useLayoutEffect, useRef } from 'react';
import { maskEngineeringMoney } from './engineeringForm';

export default function EngineeringMoneyInput({ value, onValueChange, ...props }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  useLayoutEffect(() => {
    if (caretRef.current === null) return;
    inputRef.current?.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  }, [value]);

  const update = (raw, cursor) => {
    const formatted = maskEngineeringMoney(raw);
    if (formatted === null) return;
    let remaining = raw.slice(cursor).replace(/\D/g, '').length;
    let caret = formatted.length;
    while (caret > 0 && remaining > 0) {
      caret--;
      if (/\d/.test(formatted[caret])) remaining--;
    }
    if (formatted === value) inputRef.current?.setSelectionRange(caret, caret);
    else caretRef.current = caret;
    onValueChange(formatted);
  };

  return <input {...props} ref={inputRef} type="text" inputMode="numeric" value={value}
    onChange={event => update(event.target.value, event.target.selectionStart ?? event.target.value.length)}
    onKeyDown={event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
      const input = event.currentTarget;
      const cursor = input.selectionStart;
      if (cursor !== input.selectionEnd || cursor === null) return;
      // Delete the adjacent digit when the caret meets a grouping/decimal separator.
      if (event.key === 'Backspace' && cursor > 0 && /[.,]/.test(value[cursor - 1])) {
        event.preventDefault();
        let index = cursor - 1;
        while (index > 0 && /[.,]/.test(value[index])) index--;
        update(value.slice(0, index) + value.slice(index + 1), index);
      } else if (event.key === 'Delete' && /[.,]/.test(value[cursor] || '')) {
        event.preventDefault();
        let index = cursor;
        while (index < value.length && /[.,]/.test(value[index])) index++;
        update(value.slice(0, index) + value.slice(index + 1), cursor);
      }
    }} />;
}
