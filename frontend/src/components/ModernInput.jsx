import React from 'react';

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
      {label && <div className="text-xs text-gray-600 mb-1">{label}{required ? ' *' : ''}</div>}
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
          className="w-full pl-10 pr-3 py-2 rounded-2xl bg-gray-50 focus:bg-white border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition"
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
      {label && <div className="text-xs text-gray-600 mb-1">{label}{required ? ' *' : ''}</div>}
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
          className="w-full pl-10 pr-3 py-2 rounded-2xl bg-gray-50 focus:bg-white border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition resize-vertical"
          {...rest}
        />
      </div>
    </label>
  );
}

export default ModernInput;
