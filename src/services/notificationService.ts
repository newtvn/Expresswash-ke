import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

export interface Notification {
  id: string;
  userId: string;
  type: 'order_created' | 'driver_assigned' | 'pickup_scheduled' | 'picked_up' |
        'in_processing' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' |
        'price_updated' | 'general';
  title: string;
  message: string;
  orderId?: string;
  trackingCode?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationTemplate {
  type: Notification['type'];
  title: string;
  messageTemplate: string;
}

// Notification templates
const TEMPLATES: Record<Notification['type'], NotificationTemplate> = {
  order_created: {
    type: 'order_created',
    title: 'Order Confirmed',
    messageTemplate: 'Your order {{trackingCode}} has been created. Estimated delivery: {{eta}}',
  },
  driver_assigned: {
    type: 'driver_assigned',
    title: 'Driver Assigned',
    messageTemplate: '{{driverName}} has been assigned to your order {{trackingCode}}. They will contact you soon.',
  },
  pickup_scheduled: {
    type: 'pickup_scheduled',
    title: 'Pickup Scheduled',
    messageTemplate: 'Your items will be picked up on {{pickupDate}}. Please have them ready.',
  },
  picked_up: {
    type: 'picked_up',
    title: 'Items Picked Up',
    messageTemplate: 'Your items have been picked up and are on their way to our facility.',
  },
  in_processing: {
    type: 'in_processing',
    title: 'Processing Started',
    messageTemplate: 'We have started processing your order {{trackingCode}}.',
  },
  ready_for_delivery: {
    type: 'ready_for_delivery',
    title: 'Ready for Delivery',
    messageTemplate: 'Your order {{trackingCode}} is ready for delivery. Estimated delivery: {{deliveryDate}}',
  },
  out_for_delivery: {
    type: 'out_for_delivery',
    title: 'Out for Delivery',
    messageTemplate: '{{driverName}} is on the way with your order {{trackingCode}}.',
  },
  delivered: {
    type: 'delivered',
    title: 'Order Delivered',
    messageTemplate: 'Your order {{trackingCode}} has been delivered. Thank you for choosing ExpressWash!',
  },
  price_updated: {
    type: 'price_updated',
    title: 'Price Updated',
    messageTemplate: 'The price for order {{trackingCode}} has been updated based on actual measurements. New total: KES {{total}}',
  },
  general: {
    type: 'general',
    title: 'Notification',
    messageTemplate: '{{message}}',
  },
};

/**
 * Create a notification from template
 */
export async function createNotification(
  userId: string,
  type: Notification['type'],
  variables: Record<string, string>,
  orderId?: string,
): Promise<{ success: boolean; notification?: Notification }> {
  try {
    const template = TEMPLATES[type];
    let message = template.messageTemplate;

    // Replace variables in template (using replaceAll for multiple occurrences)
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replaceAll(`{{${key}}}`, value);
    });

    // Remove any unreplaced template variables
    message = message.replace(/\{\{.*?\}\}/g, '');

    const { data, error } = await retrySupabaseQuery(
      () => supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title: template.title,
          message,
          order_id: orderId,
          tracking_code: variables.trackingCode,
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single(),
      { maxRetries: 3 }
    );

    if (error || !data) {
      return { success: false };
    }

    return {
      success: true,
      notification: {
        id: data.id as string,
        userId: data.user_id as string,
        type: data.type as Notification['type'],
        title: data.title as string,
        message: data.message as string,
        orderId: (data.order_id as string) ?? undefined,
        trackingCode: (data.tracking_code as string) ?? undefined,
        read: data.read as boolean,
        createdAt: data.created_at as string,
      },
    };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return { success: false };
  }
}

/**
 * Send order status notifications
 */
export async function notifyOrderStatus(
  userId: string,
  orderId: string,
  trackingCode: string,
  type: Notification['type'],
  additionalData?: Record<string, string>,
): Promise<void> {
  await createNotification(
    userId,
    type,
    {
      trackingCode,
      ...additionalData,
    },
    orderId
  );
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 50,
): Promise<Notification[]> {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      type: row.type as Notification['type'],
      title: row.title as string,
      message: row.message as string,
      orderId: (row.order_id as string) ?? undefined,
      trackingCode: (row.tracking_code as string) ?? undefined,
      read: row.read as boolean,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<{ success: boolean }> {
  try {
    const { error } = await retrySupabaseQuery(
      () => supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId),
      { maxRetries: 2 }
    );

    return { success: !error };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Mark all user notifications as read
 */
export async function markAllAsRead(userId: string): Promise<{ success: boolean }> {
  try {
    const { error } = await retrySupabaseQuery(
      () => supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false),
      { maxRetries: 2 }
    );

    return { success: !error };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(
  notificationId: string,
): Promise<{ success: boolean }> {
  try {
    const { error } = await retrySupabaseQuery(
      () => supabase.from('notifications').delete().eq('id', notificationId),
      { maxRetries: 2 }
    );

    return { success: !error };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await retrySupabaseQuery(
      () => supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false),
      { maxRetries: 2 }
    );

    return error ? 0 : (count ?? 0);
  } catch (error) {
    return 0;
  }
}
