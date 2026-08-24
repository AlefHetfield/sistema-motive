import { Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Carregando...', description, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 py-12 text-center ${className}`} role="status" aria-live="polite">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
      <p className="mt-3 text-sm font-bold text-gray-700">{label}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">{description}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className = '' }) {
  const IconComponent = icon;
  return (
    <div className={`rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center ${className}`}>
      {IconComponent && (
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
          <IconComponent className="h-5 w-5" />
        </span>
      )}
      <p className="mt-3 text-sm font-bold text-gray-700">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
