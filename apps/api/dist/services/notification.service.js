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
 * Creates the same 'system'-type notification for every staff member
 * (admin + company_staff). Used for events relevant to the whole team
 * rather than one specific distributor — new products, articles, news,
 * training materials, events, and payment submissions.
 */
export async function broadcastToStaff(title, body, data) {
    const { data: staffProfiles, error } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'company_staff']);
    if (error) {
        throw new ApiError(500, `Failed to fetch staff for broadcast: ${error.message}`);
    }
    for (const staff of staffProfiles ?? []) {
        try {
            await createNotification(staff.id, 'system', title, body, data);
        }
        catch (err) {
            console.error(`❌ Failed to notify staff ${staff.id}: ${err}`);
            // Continue notifying the rest of staff even if one insert fails
        }
    }
}
/**
 * Gets paginated notifications for a distributor.
 * Can filter by read/unread status.
 */
export async function getMyNotifications(distributorId, page = 1, limit = 20, unreadOnly = false) {
    const offset = (page - 1) * limit;
    let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('distributor_id', distributorId);
    if (unreadOnly) {
        query = query.eq('is_read', false);
    }
    const { count, error: countError } = await query;
    if (countError) {
        throw new ApiError(500, `Failed to count notifications: ${countError.message}`);
    }
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
export async function markAsRead(distributorId, notificationId) {
    const { error } = await supabase.rpc('mark_notification_read', {
        p_distributor_id: distributorId,
        p_notification_id: notificationId,
    });
    if (error) {
        throw new ApiError(500, `Failed to mark notification as read: ${error.message}`);
    }
}
export async function markAllAsRead(distributorId) {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_distributor_id: distributorId,
    });
    if (error) {
        throw new ApiError(500, `Failed to mark all notifications as read: ${error.message}`);
    }
    return data;
}
export async function getUnreadCount(distributorId) {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_distributor_id: distributorId,
    });
    if (error) {
        throw new ApiError(500, `Failed to get unread count: ${error.message}`);
    }
    return data;
}
// ── Distributor-targeted notification helpers ──────────────────────────────
export async function notifyCommissionEarned(distributorId, amount, sourceId) {
    await createNotification(distributorId, 'commission_earned', 'Commission Earned', `You earned ${amount.toFixed(2)} in commission.`, { amount, source_id: sourceId });
}
export async function notifyTeamBonusEarned(distributorId, amount, period) {
    await createNotification(distributorId, 'team_bonus_earned', 'Team Bonus Earned', `You earned ${amount.toFixed(2)} in team bonus for ${period}.`, { amount, period });
}
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
export async function notifyNewReferral(uplineId, newDistributorName, newDistributorId) {
    await createNotification(uplineId, 'new_referral', 'New Team Member', `${newDistributorName} has joined your team!`, { new_distributor_name: newDistributorName, new_distributor_id: newDistributorId });
}
export async function notifyManualBonus(distributorId, amount, reason) {
    await createNotification(distributorId, 'manual_bonus', 'Manual Bonus Awarded', `You have been awarded a manual bonus of ${amount.toFixed(2)}. Reason: ${reason}`, { amount, reason });
}
// ── Staff broadcast helpers (new content / payments) ────────────────────────
export async function notifyNewProduct(productId, productName) {
    await broadcastToStaff('New Product Added', `"${productName}" was added to the catalog.`, { product_id: productId });
}
export async function notifyNewArticle(articleId, title) {
    await broadcastToStaff('New Article Published', `"${title}" was published.`, { article_id: articleId });
}
export async function notifyNewNews(newsId, title) {
    await broadcastToStaff('News Posted', `"${title}" was posted.`, { news_id: newsId });
}
export async function notifyNewTraining(materialId, title) {
    await broadcastToStaff('Training Material Added', `"${title}" was uploaded to the Training Academy.`, { material_id: materialId });
}
export async function notifyNewEvent(eventId, title, eventType) {
    await broadcastToStaff('New Event Created', `"${title}" (${eventType.replace('_', ' ')}) was added to the events calendar.`, { event_id: eventId });
}
export async function notifyPaymentSubmitted(orderId, distributorName, amount, method) {
    await broadcastToStaff('Payment Submitted', `${distributorName} submitted a ${method.replace('_', ' ')} payment of ${amount.toFixed(2)} awaiting confirmation.`, { order_id: orderId });
}
//# sourceMappingURL=notification.service.js.map