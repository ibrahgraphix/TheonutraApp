export interface Country {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCountryInput {
  name: string;
  isoCode: string;
  currencyCode: string;
}
