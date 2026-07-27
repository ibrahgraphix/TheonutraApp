//orders.controller
import { Request, Response, NextFunction } from 'express';
import * as ordersService from '../services/orders.service.js';
import { CreateOrderInput } from '../schemas/orders.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * POST /api/orders
 * Creates an order.
 */
export async function createOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as CreateOrderInput;
    const order = await ordersService.createOrder(req.user.id, input);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/:id
 * Fetches single order details if authorized (owner or staff).
 */
export async function getOrderByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const id = req.params['id'];
    if (!id) {
      throw new ApiError(400, 'Order ID is required');
    }

    const isStaff = req.user.role === 'admin' || req.user.role === 'company_staff';
    const order = await ordersService.getOrderById(id, req.user.id, isStaff);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders
 * Lists the authenticated user's own orders.
 */
export async function listMyOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const orders = await ordersService.listMyOrders(req.user.id);
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/awaiting-payment
 * Lists 'pending' orders with no payment record at all — i.e. "Pay Later"
 * orders. Staff only.
 */
export async function listAwaitingPaymentOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orders = await ordersService.listAwaitingPaymentOrders();
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
}
