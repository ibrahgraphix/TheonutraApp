import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * Creates a notification for a distributor.
 * Called from other services when events occur.
 */
export async function createNotification(distributorId, type, title, body, data) {
    const { data: notificationId, error } = await supabase.rpc('create_notification', {
        p_distributor_id: distributorId,
        p_type: type,
        p_title: title,
        p_body: body,
        p_data: data || null,
    });
    if (error) {
        throw new ApiError(500, `Failed to create notification: ${error.message}`);
    }
    return notificationId;
}
/**
 * Gets paginated notifications for a distributor.
 * Can filter by read/unread status.
 */
export async function getMyNotifications(distributorId, page = 1, limit = 20, unreadOnly = false) {
    const offset = (page - 1) * limit;
    // Build query
    let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('distributor_id', distributorId);
    if (unreadOnly) {
        query = query.eq('is_read', false);
    }
    // Get total count
    const { count, error: countError } = await query;
    if (countError) {
        throw new ApiError(500, `Failed to count notifications: ${countError.message}`);
    }
    // Get paginated notifications
    query = supabase
        .from('notifications')
        .select('*')
        .eq('distributor_id', distributorId);
    if (unreadOnly) {
        query = query.eq('is_read', false);
    }
    const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        throw new ApiError(500, `Failed to fetch notifications: ${error.message}`);
    }
    return {
        notifications: (data ?? []),
        total: count ?? 0,
        page,
        limit,
    };
}
/**
 * Marks a specific notification as read.
 */
export async function markAsRead(distributorId, notificationId) {
    const { error } = await supabase.rpc('mark_notification_read', {
        p_distributor_id: distributorId,
        p_notification_id: notificationId,
    });
    if (error) {
        throw new ApiError(500, `Failed to mark notification as read: ${error.message}`);
    }
}
/**
 * Marks all notifications as read for a distributor.
 */
export async function markAllAsRead(distributorId) {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_distributor_id: distributorId,
    });
    if (error) {
        throw new ApiError(500, `Failed to mark all notifications as read: ${error.message}`);
    }
    return data;
}
/**
 * Gets the unread notification count for a distributor.
 */
export async function getUnreadCount(distributorId) {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_distributor_id: distributorId,
    });
    if (error) {
        throw new ApiError(500, `Failed to get unread count: ${error.message}`);
    }
    return data;
}
// Helper functions for creating specific notification types
/**
 * Creates a commission earned notification.
 */
export async function notifyCommissionEarned(distributorId, amount, sourceId) {
    await createNotification(distributorId, 'commission_earned', 'Commission Earned', `You earned ${amount.toFixed(2)} in commission.`, { amount, source_id: sourceId });
}
/**
 * Creates a team bonus earned notification.
 */
export async function notifyTeamBonusEarned(distributorId, amount, period) {
    await createNotification(distributorId, 'team_bonus_earned', 'Team Bonus Earned', `You earned ${amount.toFixed(2)} in team bonus for ${period}.`, { amount, period });
}
/**
 * Creates a withdrawal status notification.
 */
export async function notifyWithdrawalStatus(distributorId, status, amount, requestId, reason) {
    let title;
    let body;
    switch (status) {
        case 'approved':
            title = 'Withdrawal Approved';
            body = `Your withdrawal request of ${amount.toFixed(2)} has been approved.`;
            break;
        case 'rejected':
            title = 'Withdrawal Rejected';
            body = `Your withdrawal request of ${amount.toFixed(2)} has been rejected.${reason ? ` Reason: ${reason}` : ''}`;
            break;
        case 'paid':
            title = 'Withdrawal Paid';
            body = `Your withdrawal of ${amount.toFixed(2)} has been paid.`;
            break;
    }
    await createNotification(distributorId, 'withdrawal_status', title, body, { status, amount, request_id: requestId, reason });
}
/**
 * Creates a KYC status notification.
 */
export async function notifyKycStatus(distributorId, status, reason) {
    let title;
    let body;
    switch (status) {
        case 'approved':
            title = 'KYC Approved';
            body = 'Your KYC verification has been approved. You can now request withdrawals.';
            break;
        case 'rejected':
            title = 'KYC Rejected';
            body = `Your KYC verification has been rejected.${reason ? ` Reason: ${reason}` : ''}`;
            break;
        case 'resubmit_required':
            title = 'KYC Resubmission Required';
            body = `Your KYC verification requires resubmission.${reason ? ` Reason: ${reason}` : ''}`;
            break;
    }
    await createNotification(distributorId, 'kyc_status', title, body, { status, reason });
}
/**
 * Creates a new referral notification for the upline.
 */
export async function notifyNewReferral(uplineId, newDistributorName, newDistributorId) {
    await createNotification(uplineId, 'new_referral', 'New Team Member', `${newDistributorName} has joined your team!`, { new_distributor_name: newDistributorName, new_distributor_id: newDistributorId });
}
/**
 * Creates a manual bonus notification.
 */
export async function notifyManualBonus(distributorId, amount, reason) {
    await createNotification(distributorId, 'manual_bonus', 'Manual Bonus Awarded', `You have been awarded a manual bonus of ${amount.toFixed(2)}. Reason: ${reason}`, { amount, reason });
}
//# sourceMappingURL=notification.service.js.map