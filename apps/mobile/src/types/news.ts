export interface NewsPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  isFeatured?: boolean;
}
