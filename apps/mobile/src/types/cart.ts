export interface CartItem {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  /** Product PV at add-to-cart time (wholesale Total PV = Σ qty × pv). */
  pv: number;
  imageUrl?: string;
}
