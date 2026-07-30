//newsServices
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { deleteCloudinaryAsset } from './uploads.service.js';
import * as notificationService from './notification.service.js';
// Map database row to NewsPost interface
function mapNews(row) {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        coverImageUrl: row.cover_image_url,
        authorId: row.author_id,
        isPublished: row.is_published,
        createdAt: row.created_at,
        authorName: row.profiles?.full_name,
    };
}
/**
 * Lists published news, newest first, paginated.
 */
export async function listNews(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error } = await supabase
        .from('news')
        .select(`
      *,
      profiles (
        full_name
      )
    `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(from, to);
    if (error) {
        throw new ApiError(500, `Failed to list news: ${error.message}`);
    }
    return (data ?? []).map(mapNews);
}
/**
 * Retrieves a single news item by ID.
 * If is_published = false and the requester isn't staff, treats as not found (404).
 */
export async function getNewsById(id, isStaff) {
    const { data, error } = await supabase
        .from('news')
        .select(`
      *,
      profiles (
        full_name
      )
    `)
        .eq('id', id)
        .maybeSingle();
    if (error) {
        throw new ApiError(500, `Failed to fetch news: ${error.message}`);
    }
    if (!data) {
        throw new ApiError(404, 'News item not found');
    }
    // If unpublished and requester is not staff, treat as 404
    if (!data.is_published && !isStaff) {
        throw new ApiError(404, 'News item not found');
    }
    return mapNews(data);
}
/**
 * Creates a new news item. Staff only.
 */
export async function createNews(input, authorId) {
    const { data, error } = await supabase
        .from('news')
        .insert({
        title: input.title,
        body: input.body,
        cover_image_url: input.coverImageUrl ?? null,
        is_published: input.isPublished ?? true,
        author_id: authorId,
    })
        .select(`
      *,
      profiles (
        full_name
      )
    `)
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to create news item: ${error?.message}`);
    }
    try {
        await notificationService.notifyNewNews(data.id, data.title);
    }
    catch (notifError) {
        console.error(`❌ Failed to send new news notification: ${notifError}`);
    }
    return mapNews(data);
}
/**
 * Updates a news item. Staff only.
 */
export async function updateNews(id, input) {
    // 1. Fetch existing news to get old coverImageUrl before updating
    const { data: existingNews, error: fetchError } = await supabase
        .from('news')
        .select('id, title, body, cover_image_url, is_published, created_at')
        .eq('id', id)
        .maybeSingle();
    if (fetchError) {
        throw new ApiError(500, `Failed to fetch news: ${fetchError.message}`);
    }
    if (!existingNews) {
        throw new ApiError(404, 'News item not found');
    }
    const oldCoverImageUrl = existingNews.cover_image_url;
    // 2. Construct update patch
    const patch = {};
    if (input.title !== undefined)
        patch.title = input.title;
    if (input.body !== undefined)
        patch.body = input.body;
    if (input.coverImageUrl !== undefined)
        patch.cover_image_url = input.coverImageUrl;
    if (input.isPublished !== undefined)
        patch.is_published = input.isPublished;
    if (Object.keys(patch).length === 0) {
        throw new ApiError(422, 'No fields to update');
    }
    const { data, error } = await supabase
        .from('news')
        .update(patch)
        .eq('id', id)
        .select(`
      *,
      profiles (
        full_name
      )
    `)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            throw new ApiError(404, 'News item not found');
        }
        throw new ApiError(500, `Failed to update news: ${error.message}`);
    }
    if (!data) {
        throw new ApiError(404, 'News item not found');
    }
    // 3. Delete old Cloudinary asset if coverImageUrl changed
    if (input.coverImageUrl !== undefined && input.coverImageUrl !== oldCoverImageUrl) {
        // Delete the old image after successful DB update
        await deleteCloudinaryAsset(oldCoverImageUrl);
    }
    return mapNews(data);
}
/**
 * Deletes a news item. Staff only.
 */
export async function deleteNews(id) {
    // 1. Check if news exists and get coverImageUrl
    const { data, error: checkError } = await supabase
        .from('news')
        .select('id, cover_image_url')
        .eq('id', id)
        .maybeSingle();
    if (checkError) {
        throw new ApiError(500, `Failed to fetch news item: ${checkError.message}`);
    }
    if (!data) {
        throw new ApiError(404, 'News item not found');
    }
    const oldCoverImageUrl = data.cover_image_url;
    // 2. Delete the news item
    const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);
    if (error) {
        throw new ApiError(500, `Failed to delete news item: ${error.message}`);
    }
    // 3. Delete Cloudinary asset after successful deletion
    await deleteCloudinaryAsset(oldCoverImageUrl);
}
//# sourceMappingURL=news.service.js.map