import { Request, Response, NextFunction } from 'express';
import * as newsService from '../services/news.service.js';
import { CreateContentInput, UpdateContentInput } from '../schemas/content.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function listNewsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
    const limit = req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10)) : 20;

    const news = await newsService.listNews(page, limit);
    res.status(200).json(news);
  } catch (err) {
    next(err);
  }
}

export async function getNewsByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'News ID is required');
    }

    const isStaff = req.user.role === 'admin' || req.user.role === 'company_staff';
    const news = await newsService.getNewsById(id, isStaff);
    res.status(200).json(news);
  } catch (err) {
    next(err);
  }
}

export async function createNewsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as CreateContentInput;
    const authorId = req.user.id;

    const news = await newsService.createNews(input, authorId);
    res.status(201).json(news);
  } catch (err) {
    next(err);
  }
}

export async function updateNewsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'News ID is required');
    }

    const input = req.body as UpdateContentInput;
    const news = await newsService.updateNews(id, input);
    res.status(200).json(news);
  } catch (err) {
    next(err);
  }
}

export async function deleteNewsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'News ID is required');
    }

    await newsService.deleteNews(id);
    res.status(200).json({ message: 'News item deleted successfully' });
  } catch (err) {
    next(err);
  }
}
