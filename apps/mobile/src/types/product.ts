export interface ProductCountryPrice {
  country: string;
  price: number;
  currency: string;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  category: string;
  pricing: ProductCountryPrice[];
}

export interface ProductListing extends Product {
  price: number;
  currency: string;
  available: boolean;
}
