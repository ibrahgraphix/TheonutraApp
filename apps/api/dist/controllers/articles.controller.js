import * as articlesService from '../services/articles.service.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function listArticlesHandler(req, res, next) {
    try {
        const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
        const limit = req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10)) : 20;
        const articles = await articlesService.listArticles(page, limit);
        res.status(200).json(articles);
    }
    catch (err) {
        next(err);
    }
}
export async function getArticleByIdHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const id = req.params.id;
        if (!id) {
            throw new ApiError(400, 'Article ID is required');
        }
        const isStaff = req.user.role === 'admin' || req.user.role === 'company_staff';
        const article = await articlesService.getArticleById(id, isStaff);
        res.status(200).json(article);
    }
    catch (err) {
        next(err);
    }
}
export async function createArticleHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const authorId = req.user.id;
        const article = await articlesService.createArticle(input, authorId);
        res.status(201).json(article);
    }
    catch (err) {
        next(err);
    }
}
export async function updateArticleHandler(req, res, next) {
    try {
        const id = req.params.id;
        if (!id) {
            throw new ApiError(400, 'Article ID is required');
        }
        const input = req.body;
        const article = await articlesService.updateArticle(id, input);
        res.status(200).json(article);
    }
    catch (err) {
        next(err);
    }
}
export async function deleteArticleHandler(req, res, next) {
    try {
        const id = req.params.id;
        if (!id) {
            throw new ApiError(400, 'Article ID is required');
        }
        await articlesService.deleteArticle(id);
        res.status(200).json({ message: 'Article deleted successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=articles.controller.js.map