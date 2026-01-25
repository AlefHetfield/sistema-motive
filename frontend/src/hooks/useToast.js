import { toast } from 'sonner';

/**
 * Hook customizado para notificações (Toast)
 * 
 * Uso:
 * const notify = useToast();
 * notify.success('Salvo com sucesso!');
 * notify.error('Erro ao carregar');
 * notify.warning('Atenção!');
 * notify.info('Informação');
 * notify.loading('Carregando...');
 * notify.promise(promise, { loading, success, error });
 */

export const useToast = () => {
  return {
    // ✅ Sucesso - Verde
    success: (message, options = {}) => {
      toast.success(message, {
        description: options.description,
        duration: options.duration || 3000,
        ...options
      });
    },

    // ❌ Erro - Vermelho
    error: (message, options = {}) => {
      toast.error(message, {
        description: options.description,
        duration: options.duration || 4000,
        ...options
      });
    },

    // ⚠️ Aviso - Amarelo
    warning: (message, options = {}) => {
      toast.warning(message, {
        description: options.description,
        duration: options.duration || 3000,
        ...options
      });
    },

    // ℹ️ Informação - Azul
    info: (message, options = {}) => {
      toast.info(message, {
        description: options.description,
        duration: options.duration || 3000,
        ...options
      });
    },

    // ⏳ Loading - Cinza
    loading: (message, options = {}) => {
      return toast.loading(message, {
        description: options.description,
        ...options
      });
    },

    // 🔄 Promise - Espera resolução
    promise: (promise, messages = {}) => {
      return toast.promise(promise, {
        loading: messages.loading || 'Carregando...',
        success: messages.success || 'Sucesso!',
        error: messages.error || 'Erro ao processar',
      });
    },

    // Fechar um toast específico
    dismiss: (toastId) => {
      toast.dismiss(toastId);
    },

    // Fechar todos os toasts
    dismissAll: () => {
      toast.dismiss();
    },

    // 🎉 Customizado
    custom: (message, options = {}) => {
      return toast.custom((t) => (
        <div className="flex items-center gap-3 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
          <div className="flex-1">
            <p className="font-medium text-gray-900">{message}</p>
            {options.description && (
              <p className="text-sm text-gray-600">{options.description}</p>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      ), {
        duration: options.duration || 3000
      });
    },
  };
};

/**
 * Funções diretas (sem hook)
 * Útil para usar fora de componentes React
 */
export const notify = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, options),
  warning: (message, options) => toast.warning(message, options),
  info: (message, options) => toast.info(message, options),
  loading: (message, options) => toast.loading(message, options),
  promise: (promise, messages) => toast.promise(promise, messages),
  dismiss: (id) => toast.dismiss(id),
  dismissAll: () => toast.dismiss(),
};

/**
 * Atalhos rápidos para casos comuns
 */
export const toastNotifications = {
  // Ações bem-sucedidas
  saved: () => toast.success('Salvo com sucesso!'),
  deleted: () => toast.success('Deletado com sucesso!'),
  updated: () => toast.success('Atualizado com sucesso!'),
  created: () => toast.success('Criado com sucesso!'),

  // Erros comuns
  errorSaving: () => toast.error('Erro ao salvar dados'),
  errorDeleting: () => toast.error('Erro ao deletar'),
  errorUpdating: () => toast.error('Erro ao atualizar'),
  errorLoading: () => toast.error('Erro ao carregar dados'),
  errorNetwork: () => toast.error('Erro de conexão. Verifique sua internet.'),

  // Validações
  requiredField: (fieldName) => toast.warning(`Campo ${fieldName} é obrigatório`),
  invalidEmail: () => toast.warning('Email inválido'),
  passwordTooShort: () => toast.warning('Senha deve ter no mínimo 6 caracteres'),

  // Confirmações
  confirmDelete: () => toast.warning('Tem certeza? Esta ação não pode ser desfeita.'),
  sessionExpired: () => toast.info('Sua sessão expirou. Faça login novamente.'),
  sessionInvalid: () => toast.info('Sua sessão não é válida. Faça login novamente.'),

  // Loading
  saving: () => toast.loading('Salvando...'),
  deleting: () => toast.loading('Deletando...'),
  updating: () => toast.loading('Atualizando...'),
  loading: () => toast.loading('Carregando...'),
};
