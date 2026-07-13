import { z } from 'zod';

const OrderItemSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID'),
  quantity:  z.number().int('quantity must be an integer').positive('quantity must be greater than 0'),
});

export const CreateOrderSchema = z.object({
  countryId: z.string().uuid('countryId must be a valid UUID'),
  items:     z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
