import rows from './country-currencies.json';

export type CountryCurrency = {
  id: string;
  country: string;
  code: string;
  name: string;
  symbol: string;
  flag: string;
};

export const COUNTRY_CURRENCIES = rows as CountryCurrency[];

const PREFERRED_OPTION_IDS: Record<string,string> = {
  USD:'US:USD',EUR:'EU:EUR',GBP:'GB:GBP',AUD:'AU:AUD',NZD:'NZ:NZD',CAD:'CA:CAD',
  CHF:'CH:CHF',NOK:'NO:NOK',DKK:'DK:DKK',XCD:'AG:XCD',XOF:'BJ:XOF',XAF:'CM:XAF',XPF:'PF:XPF',
};

export function currencyDetails(code: string) {
  const normalized = code.trim().toUpperCase();
  const preferredId = PREFERRED_OPTION_IDS[normalized];
  return COUNTRY_CURRENCIES.find(option => option.id === preferredId)
    || COUNTRY_CURRENCIES.find(option => option.code === normalized);
}

export function currencySymbol(code: string) {
  return currencyDetails(code)?.symbol || code.trim().toUpperCase();
}
