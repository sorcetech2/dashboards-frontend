import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TeamStats, CompanyStats } from './sorce_data';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function rmpColor(rmp: string): string {
  if (rmp.toLocaleUpperCase() === 'RECOVER') {
    return '#24CEAA';
  }
  if (rmp.toLocaleUpperCase() === 'MAINTAIN') {
    return '#C6AEFF';
  }
  if (rmp.toLocaleUpperCase() === 'PUSH') {
    return '#4B92FF';
  }
  return '#FFFFFF';
}
