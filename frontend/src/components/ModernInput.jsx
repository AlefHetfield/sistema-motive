import React from 'react';
import { controlClass, formLabelClass, textAreaClass } from './ui/styles';

// ModernInput + ModernTextArea
// Props: id, label, Icon, type, value, onChange, placeholder, required, maxLength

export function ModernInput({
  id,
  label,
  Icon,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  maxLength,
  disabled = false,
  className = '',
  ...rest
}) {
  return (
    <label htmlFor={id} className={`block ${className}`}>
      {label && <div className={formLabelClass}>{label}{required ? ' *' : ''}</div>}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          className={`${controlClass} ${Icon ? 'pl-10' : ''}`}
          {...rest}
        />
      </div>
    </label>
  );
}

export function ModernTextArea({
  id,
  label,
  Icon,
  value,
  onChange,
  placeholder = '',
  required = false,
  maxLength,
  rows = 4,
  disabled = false,
  className = '',
  ...rest
}) {
  return (
    <label htmlFor={id} className={`block ${className}`}>
      {label && <div className={formLabelClass}>{label}{required ? ' *' : ''}</div>}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-3 flex items-start pt-2 text-gray-400 pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          className={`${textAreaClass} ${Icon ? 'pl-10' : ''}`}
          {...rest}
        />
      </div>
    </label>
  );
}

export default ModernInput;
