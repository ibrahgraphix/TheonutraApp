//article.ts type
export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  category: string;
  author: string;
}
