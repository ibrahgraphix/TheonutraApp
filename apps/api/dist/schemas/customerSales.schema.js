import { z } from 'zod';
// ── Customer Sales ─────────────────────────────────────────────────────────────
const CustomerSaleItemSchema = z.object({
    productId: z.string().uuid('productId must be a valid UUID'),
    quantity: z.number().int().positive('quantity must be a positive integer'),
});
export const LogCustomerSaleSchema = z.object({
    customerName: z.string().trim().min(1, 'customerName is required').optional(),
    customerPhone: z.string().trim().min(1, 'customerPhone is required').optional(),
    countryId: z.string().uuid('countryId must be a valid UUID'),
    items: z.array(CustomerSaleItemSchema).min(1, 'At least one item is required'),
}).refine((data) => data.customerName || data.customerPhone, { message: 'At least one of customerName or customerPhone must be provided' });
//# sourceMappingURL=customerSales.schema.js.map