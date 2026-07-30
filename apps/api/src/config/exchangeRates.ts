/**
 * Exchange rates for converting local currencies to USD
 * Rates are expressed as: 1 USD = X local currency units
 * Example: 1 USD = 2500 TSH means TSH rate is 2500
 */
export const EXCHANGE_RATES: Record<string, number> = {
  TZS: 2500, // Tanzanian Shilling
  KES: 130,  // Kenyan Shilling
  UGX: 3800, // Ugandan Shilling
  RWF: 1300, // Rwandan Franc
  BIF: 2800, // Burundian Franc
  ZMW: 25,   // Zambian Kwacha
  MWK: 1700, // Malawian Kwacha
  NGN: 1600, // Nigerian Naira
  GHS: 15,   // Ghanaian Cedi
  XOF: 650,  // West African CFA Franc
  XAF: 650,  // Central African CFA Franc
  USD: 1,    // US Dollar
  EUR: 0.92, // Euro
  GBP: 0.79, // British Pound
};

/**
 * Converts an amount from local currency to USD
 * @param amount Amount in local currency
 * @param currencyCode Local currency code (e.g., 'TZS', 'KES')
 * @returns Amount in USD
 */
export function convertToUSD(amount: number, currencyCode: string): number {
  const rate = EXCHANGE_RATES[currencyCode] || 1;
  return amount / rate;
}

/**
 * Converts an amount from USD to local currency
 * @param amount Amount in USD
 * @param currencyCode Target local currency code (e.g., 'TZS', 'KES')
 * @returns Amount in local currency
 */
export function convertFromUSD(amount: number, currencyCode: string): number {
  const rate = EXCHANGE_RATES[currencyCode] || 1;
  return amount * rate;
}

/**
 * Gets the exchange rate for a currency
 * @param currencyCode Currency code (e.g., 'TZS', 'KES')
 * @returns Exchange rate (1 USD = X currency units)
 */
export function getExchangeRate(currencyCode: string): number {
  return EXCHANGE_RATES[currencyCode] || 1;
}
