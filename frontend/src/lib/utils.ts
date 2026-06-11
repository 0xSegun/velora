import { clsx, type ClassValue } from 'clsx';
import {
  confidenceSentiment,
  riskSentiment,
  sentimentColorValue,
  sentimentTextClass,
} from '@/lib/financialColors';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercentage(num: number, decimals = 2): string {
  return `${num.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getRiskColor(level: string): string {
  return sentimentTextClass(riskSentiment(level));
}

export function getConfidenceColor(score: number): string {
  const pct = score <= 1 ? score * 100 : score;
  return sentimentTextClass(confidenceSentiment(pct));
}

/** Inline style color for charts and custom components */
export function getRiskColorValue(level: string): string {
  return sentimentColorValue(riskSentiment(level));
}

export function getConfidenceColorValue(score: number): string {
  const pct = score <= 1 ? score * 100 : score;
  return sentimentColorValue(confidenceSentiment(pct));
}

export {
  COUNTRY_DIRECTORY as countries,
  countryCodeToFlag,
  formatCountryLabel,
  getCountryMeta,
} from '@/lib/countries';
export type { CountryMeta } from '@/lib/countries';
