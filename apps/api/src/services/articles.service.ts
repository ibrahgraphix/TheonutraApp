//articlesServices
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { CreateContentInput, UpdateContentInput } from '../schemas/content.schema.js';
import { deleteCloudinaryAsset } from './uploads.service.js';
import * as notificationService from './notification.service.js';

export interface Article {
  id:             string;
  title:          string;
  body:           string;
  coverImageUrl:  string | null;
  authorId:       string | null;
  isPublished:    boolean;
  createdAt:      string;
  authorName?:    string;
}

// Map database row to Article interface
function mapArticle(row: Record<string, any>): Article {
  return {
    id:             row.id as string,
    title:          row.title as string,
    body:           row.body as string,
    coverImageUrl:  row.cover_image_url as string | null,
    authorId:       row.author_id as string | null,
    isPublished:    row.is_published as boolean,
    createdAt:      row.created_at as string,
    authorName:     row.profiles?.full_name as string | undefined,
  };
}

/**
 * Lists published articles, newest first, paginated.
 */
export async function listArticles(
  page: number = 1,
  limit: number = 20,
): Promise<Article[]> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from('articles')
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
    throw new ApiError(500, `Failed to list articles: ${error.message}`);
  }

  return (data ?? []).map(mapArticle);
}

/**
 * Retrieves a single article by ID.
 * If is_published = false and the requester isn't staff, treats as not found (404).
 */
export async function getArticleById(
  id: string,
  isStaff: boolean,
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      profiles (
        full_name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, `Failed to fetch article: ${error.message}`);
  }

  if (!data) {
    throw new ApiError(404, 'Article not found');
  }

  // If unpublished and requester is not staff, treat as 404
  if (!data.is_published && !isStaff) {
    throw new ApiError(404, 'Article not found');
  }

  return mapArticle(data);
}

/**
 * Creates a new article. Staff only.
 */
export async function createArticle(
  input: CreateContentInput,
  authorId: string,
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      title:            input.title,
      body:             input.body,
      cover_image_url:  input.coverImageUrl ?? null,
      is_published:     input.isPublished ?? true,
      author_id:        authorId,
    })
    .select(`
      *,
      profiles (
        full_name
      )
    `)
    .single();

  if (error || !data) {
    throw new ApiError(500, `Failed to create article: ${error?.message}`);
  }

  try {
    await notificationService.notifyNewArticle(data.id, data.title);
  } catch (notifError) {
    console.error(`❌ Failed to send new article notification: ${notifError}`);
  }

  return mapArticle(data);
}

/**
 * Updates an article. Staff only.
 */
export async function updateArticle(
  id: string,
  input: UpdateContentInput,
): Promise<Article> {
  // 1. Fetch existing article to get old coverImageUrl before updating
  const { data: existingArticle, error: fetchError } = await supabase
    .from('articles')
    .select('id, title, body, cover_image_url, is_published, created_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError(500, `Failed to fetch article: ${fetchError.message}`);
  }

  if (!existingArticle) {
    throw new ApiError(404, 'Article not found');
  }

  const oldCoverImageUrl = existingArticle.cover_image_url as string | null;

  // 2. Construct update patch
  const patch: Record<string, any> = {};
  if (input.title !== undefined)         patch.title = input.title;
  if (input.body !== undefined)          patch.body = input.body;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.isPublished !== undefined)   patch.is_published = input.isPublished;

  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, 'No fields to update');
  }

  const { data, error } = await supabase
    .from('articles')
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
      throw new ApiError(404, 'Article not found');
    }
    throw new ApiError(500, `Failed to update article: ${error.message}`);
  }

  if (!data) {
    throw new ApiError(404, 'Article not found');
  }

  // 3. Delete old Cloudinary asset if coverImageUrl changed
  if (input.coverImageUrl !== undefined && input.coverImageUrl !== oldCoverImageUrl) {
    // Delete the old image after successful DB update
    await deleteCloudinaryAsset(oldCoverImageUrl);
  }

  return mapArticle(data);
}

/**
 * Deletes an article. Staff only.
 */
export async function deleteArticle(id: string): Promise<void> {
  // 1. Check if article exists and get coverImageUrl
  const { data, error: checkError } = await supabase
    .from('articles')
    .select('id, cover_image_url')
    .eq('id', id)
    .maybeSingle();

  if (checkError) {
    throw new ApiError(500, `Failed to fetch article: ${checkError.message}`);
  }

  if (!data) {
    throw new ApiError(404, 'Article not found');
  }

  const oldCoverImageUrl = data.cover_image_url as string | null;

  // 2. Delete the article
  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new ApiError(500, `Failed to delete article: ${error.message}`);
  }

  // 3. Delete Cloudinary asset after successful deletion
  await deleteCloudinaryAsset(oldCoverImageUrl);
}
