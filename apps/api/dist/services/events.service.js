import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function createEvent(staffId, input) {
    const { data, error } = await supabase
        .from('events')
        .insert({
        title: input.title,
        description: input.description || null,
        event_type: input.eventType,
        location: input.isVirtual ? null : input.location,
        is_virtual: input.isVirtual,
        virtual_link: input.isVirtual ? input.virtualLink : null,
        start_at: input.startAt,
        end_at: input.endAt,
        banner_image_url: input.bannerImageUrl || null,
        created_by: staffId,
    })
        .select('*')
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to create event: ${error?.message}`);
    }
    return data;
}
export async function updateEvent(eventId, staffId, input) {
    const updatePayload = {};
    if (input.title !== undefined)
        updatePayload.title = input.title;
    if (input.description !== undefined)
        updatePayload.description = input.description;
    if (input.eventType !== undefined)
        updatePayload.event_type = input.eventType;
    if (input.isVirtual !== undefined)
        updatePayload.is_virtual = input.isVirtual;
    if (input.location !== undefined)
        updatePayload.location = input.location;
    if (input.virtualLink !== undefined)
        updatePayload.virtual_link = input.virtualLink;
    if (input.startAt !== undefined)
        updatePayload.start_at = input.startAt;
    if (input.endAt !== undefined)
        updatePayload.end_at = input.endAt;
    if (input.bannerImageUrl !== undefined)
        updatePayload.banner_image_url = input.bannerImageUrl;
    if (Object.keys(updatePayload).length === 0) {
        throw new ApiError(400, 'At least one field is required to update an event');
    }
    const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', eventId)
        .select('*')
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to update event: ${error?.message}`);
    }
    return data;
}
export async function deactivateEvent(eventId) {
    const { error } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('id', eventId);
    if (error) {
        throw new ApiError(500, `Failed to deactivate event: ${error.message}`);
    }
}
export async function getEvent(eventId) {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('is_active', true)
        .single();
    if (error || !data) {
        throw new ApiError(404, 'Event not found');
    }
    return data;
}
export async function listUpcomingEvents(filters, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const now = new Date().toISOString();
    let query = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .gte('start_at', now)
        .order('start_at', { ascending: true });
    if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
    }
    if (filters.dateFrom) {
        query = query.gte('start_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('start_at', filters.dateTo);
    }
    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
        throw new ApiError(500, `Failed to fetch upcoming events: ${error.message}`);
    }
    return {
        events: (data ?? []),
        total: count ?? 0,
        page,
        limit,
    };
}
export async function listPastEvents(filters, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const now = new Date().toISOString();
    let query = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .lt('end_at', now)
        .order('start_at', { ascending: false });
    if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
    }
    if (filters.dateFrom) {
        query = query.gte('end_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('end_at', filters.dateTo);
    }
    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
        throw new ApiError(500, `Failed to fetch past events: ${error.message}`);
    }
    return {
        events: (data ?? []),
        total: count ?? 0,
        page,
        limit,
    };
}
//# sourceMappingURL=events.service.js.map