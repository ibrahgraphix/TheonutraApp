export interface CartItem {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
}
