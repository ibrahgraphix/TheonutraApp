import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as auditLogService from './auditLog.service.js';

export type EventType = 'general' | 'health_education' | 'training' | 'product_launch';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  location: string | null;
  is_virtual: boolean;
  virtual_link: string | null;
  start_at: string;
  end_at: string;
  banner_image_url: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_type: EventType;
  location?: string;
  is_virtual?: boolean;
  virtual_link?: string;
  start_at: string;
  end_at: string;
  banner_image_url?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  event_type?: EventType;
  location?: string;
  is_virtual?: boolean;
  virtual_link?: string;
  start_at?: string;
  end_at?: string;
  banner_image_url?: string;
}

/**
 * Creates a new event (staff only).
 */
export async function createEvent(
  createdBy: string,
  data: CreateEventInput,
): Promise<Event> {
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      title: data.title,
      description: data.description || null,
      event_type: data.event_type,
      location: data.location || null,
      is_virtual: data.is_virtual || false,
      virtual_link: data.virtual_link || null,
      start_at: data.start_at,
      end_at: data.end_at,
      banner_image_url: data.banner_image_url || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !event) {
    throw new ApiError(500, `Failed to create event: ${error?.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    createdBy,
    'event_created',
    'event',
    event.id,
    {
      title: data.title,
      event_type: data.event_type,
      start_at: data.start_at,
      end_at: data.end_at,
    },
  );

  return event as Event;
}

/**
 * Updates an existing event (staff only).
 */
export async function updateEvent(
  eventId: string,
  data: UpdateEventInput,
): Promise<Event> {
  // Fetch current event for audit log
  const { data: currentEvent, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchError || !currentEvent) {
    throw new ApiError(404, 'Event not found');
  }

  const { data: event, error } = await supabase
    .from('events')
    .update({
      title: data.title,
      description: data.description,
      event_type: data.event_type,
      location: data.location,
      is_virtual: data.is_virtual,
      virtual_link: data.virtual_link,
      start_at: data.start_at,
      end_at: data.end_at,
      banner_image_url: data.banner_image_url,
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error || !event) {
    throw new ApiError(500, `Failed to update event: ${error?.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    currentEvent.created_by,
    'event_updated',
    'event',
    eventId,
    {
      previous: {
        title: currentEvent.title,
        event_type: currentEvent.event_type,
        start_at: currentEvent.start_at,
        end_at: currentEvent.end_at,
      },
      new: {
        title: data.title,
        event_type: data.event_type,
        start_at: data.start_at,
        end_at: data.end_at,
      },
    },
  );

  return event as Event;
}

/**
 * Deactivates an event (soft delete via is_active flag) (staff only).
 */
export async function deactivateEvent(eventId: string): Promise<void> {
  // Fetch current event for audit log
  const { data: currentEvent, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchError || !currentEvent) {
    throw new ApiError(404, 'Event not found');
  }

  const { error } = await supabase
    .from('events')
    .update({ is_active: false })
    .eq('id', eventId);

  if (error) {
    throw new ApiError(500, `Failed to deactivate event: ${error.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    currentEvent.created_by,
    'event_deactivated',
    'event',
    eventId,
    {
      title: currentEvent.title,
      event_type: currentEvent.event_type,
    },
  );
}

/**
 * Lists upcoming events with optional filters.
 * Filters: event_type, date range (start_from, start_to)
 */
export async function listUpcomingEvents(
  filters?: {
    event_type?: EventType;
    start_from?: string;
    start_to?: string;
  },
): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true });

  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }
  if (filters?.start_from) {
    query = query.gte('start_at', filters.start_from);
  }
  if (filters?.start_to) {
    query = query.lte('start_at', filters.start_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, `Failed to fetch upcoming events: ${error.message}`);
  }

  return (data ?? []) as Event[];
}

/**
 * Lists past events.
 */
export async function listPastEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false });

  if (error) {
    throw new ApiError(500, `Failed to fetch past events: ${error.message}`);
  }

  return (data ?? []) as Event[];
}

/**
 * Gets a specific event by ID.
 */
export async function getEvent(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Event not found');
  }

  return data as Event;
}
