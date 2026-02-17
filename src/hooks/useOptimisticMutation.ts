/**
 * Optimistic UI Updates Hook - Makes the app feel instant like Uber
 * Updates UI immediately while request is in flight, rolls back on error
 *
 * Usage:
 * const updateOrder = useOptimisticMutation({
 *   mutationFn: (data) => updateOrderStatus(data),
 *   onOptimistic: (variables) => {
 *     // Update local state immediately
 *     queryClient.setQueryData(['order', variables.id], (old) => ({
 *       ...old,
 *       status: variables.status
 *     }))
 *   },
 *   onSuccess: () => {
 *     // Invalidate and refetch
 *     queryClient.invalidateQueries(['orders'])
 *   }
 * })
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

interface OptimisticMutationOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  onOptimistic?: (variables: TVariables) => void;
  undoable?: boolean;
  undoDelay?: number;
}

export function useOptimisticMutation<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>({
  onOptimistic,
  undoable = false,
  undoDelay = 3000,
  ...options
}: OptimisticMutationOptions<TData, TError, TVariables, TContext>) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onMutate: async (variables) => {
      // Apply optimistic update immediately
      if (onOptimistic) {
        onOptimistic(variables);
      }

      // Call user's onMutate if provided
      const context = await options.onMutate?.(variables);

      // Handle undoable actions
      if (undoable) {
        const toastId = toast.success('Action completed', {
          action: {
            label: 'Undo',
            onClick: () => {
              mutation.reset();
              queryClient.invalidateQueries();
              toast.success('Action undone');
            },
          },
          duration: undoDelay,
        });

        setPendingAction(() => () => toast.dismiss(toastId));
      }

      return context;
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      queryClient.invalidateQueries();

      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }

      toast.error(error instanceof Error ? error.message : 'Action failed');

      // Call user's onError if provided
      options.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      if (pendingAction) {
        setPendingAction(null);
      }

      // Call user's onSuccess if provided
      options.onSuccess?.(data, variables, context);
    },
  });

  return mutation;
}

// Pre-configured optimistic mutations for common operations

/**
 * Optimistic update for order status changes
 */
export function useOptimisticOrderUpdate() {
  const queryClient = useQueryClient();

  return useOptimisticMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: number }) => {
      // Your API call here
      const { updateOrderStatus } = await import('@/services/orderService');
      return updateOrderStatus(orderId, status);
    },
    onOptimistic: ({ orderId, status }) => {
      // Update the order in cache immediately
      queryClient.setQueryData(['order', orderId], (old: any) => ({
        ...old,
        status,
      }));

      // Update in orders list if present
      queryClient.setQueryData(['orders'], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((order: any) =>
            order.id === orderId ? { ...order, status } : order
          ),
        };
      });
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    undoable: true,
  });
}

/**
 * Optimistic delete for items
 */
export function useOptimisticDelete<T extends { id: string }>(queryKey: string[]) {
  const queryClient = useQueryClient();

  return useOptimisticMutation({
    mutationFn: async (id: string) => {
      // Your delete API call here
      return id;
    },
    onOptimistic: (id) => {
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        return old?.filter((item) => item.id !== id) || [];
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Deleted successfully');
    },
    undoable: true,
  });
}

/**
 * Optimistic create for new items
 */
export function useOptimisticCreate<T extends { id?: string }>(queryKey: string[]) {
  const queryClient = useQueryClient();

  return useOptimisticMutation({
    mutationFn: async (newItem: Omit<T, 'id'>) => {
      // Your create API call here
      return { ...newItem, id: crypto.randomUUID() } as T;
    },
    onOptimistic: (newItem) => {
      const tempItem = { ...newItem, id: `temp-${Date.now()}` } as T;

      queryClient.setQueryData<T[]>(queryKey, (old) => {
        return [...(old || []), tempItem];
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Created successfully');
    },
  });
}

export default useOptimisticMutation;
