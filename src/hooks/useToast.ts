'use client';

import { toast } from 'sonner';
import type { ExternalToast } from 'sonner';

export function useToast() {
  return {
    toast,
    success: (message: string, options?: ExternalToast) => toast.success(message, options),
    error: (message: string, options?: ExternalToast) => toast.error(message, options),
    warning: (message: string, options?: ExternalToast) => toast.warning(message, options),
    info: (message: string, options?: ExternalToast) => toast.info(message, options),
    loading: (message: string, options?: ExternalToast) => toast.loading(message, options),
    promise: toast.promise,
    dismiss: toast.dismiss,
    custom: toast.custom,
  };
}
