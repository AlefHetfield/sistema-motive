import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-primary text-white shadow-sm hover:bg-[#4a637a] hover:shadow-md focus-visible:ring-primary/20',
  secondary: 'border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-300/40',
  primarySoft: 'border border-primary/20 bg-primary/5 text-primary hover:border-primary/30 hover:bg-primary/10 focus-visible:ring-primary/15',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md focus-visible:ring-emerald-500/20',
  successSoft: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 focus-visible:ring-emerald-500/15',
  warning: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md focus-visible:ring-amber-500/20',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md focus-visible:ring-red-500/20',
  dangerSoft: 'bg-red-50 text-red-600 hover:bg-red-100 focus-visible:ring-red-500/15',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-gray-300/40',
};

const sizes = {
  sm: 'h-9 rounded-lg px-3.5 text-xs',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-sm',
  icon: 'h-10 w-10 rounded-xl',
};

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
