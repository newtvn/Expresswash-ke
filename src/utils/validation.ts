/**
 * Input validation utilities
 * Provides validation functions for user inputs across the application
 */

import DOMPurify from 'isomorphic-dompurify';

const MAX_LENGTHS = {
  HOLIDAY_NAME: 100,
  ITEM_NAME: 200,
  ADDRESS: 500,
  NOTES: 1000,
  PHONE: 15,
  NAME: 100,
} as const;

/**
 * Sanitize string input to prevent XSS
 * Uses DOMPurify for industry-standard HTML sanitization
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  // Remove all HTML tags and potentially malicious content
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No HTML attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });

  return clean.trim();
}

/**
 * Sanitize HTML content (for rich text fields)
 * Allows safe HTML tags only
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';

  // Allow only safe HTML tags
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [], // No attributes to prevent event handlers
    KEEP_CONTENT: true,
  });
}

/**
 * Validate holiday name
 */
export function validateHolidayName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Holiday name is required' };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length > MAX_LENGTHS.HOLIDAY_NAME) {
    return { valid: false, error: `Holiday name must be ${MAX_LENGTHS.HOLIDAY_NAME} characters or less` };
  }

  if (sanitized.length < 2) {
    return { valid: false, error: 'Holiday name must be at least 2 characters' };
  }

  return { valid: true };
}

/**
 * Validate date string (YYYY-MM-DD format)
 */
export function validateDate(dateStr: string, options?: { minYear?: number; maxYear?: number }): { valid: boolean; error?: string } {
  if (!dateStr || dateStr.trim().length === 0) {
    return { valid: false, error: 'Date is required' };
  }

  // Check format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  // Check year range
  const year = date.getFullYear();
  const minYear = options?.minYear ?? new Date().getFullYear();
  const maxYear = options?.maxYear ?? new Date().getFullYear() + 5;

  if (year < minYear || year > maxYear) {
    return { valid: false, error: `Date must be between ${minYear} and ${maxYear}` };
  }

  return { valid: true };
}

/**
 * Validate item name
 */
export function validateItemName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Item name is required' };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length > MAX_LENGTHS.ITEM_NAME) {
    return { valid: false, error: `Item name must be ${MAX_LENGTHS.ITEM_NAME} characters or less` };
  }

  if (sanitized.length < 2) {
    return { valid: false, error: 'Item name must be at least 2 characters' };
  }

  return { valid: true };
}

/**
 * Validate address
 */
export function validateAddress(address: string): { valid: boolean; error?: string } {
  if (!address || address.trim().length === 0) {
    return { valid: false, error: 'Address is required' };
  }

  const sanitized = sanitizeString(address);

  if (sanitized.length > MAX_LENGTHS.ADDRESS) {
    return { valid: false, error: `Address must be ${MAX_LENGTHS.ADDRESS} characters or less` };
  }

  if (sanitized.length < 10) {
    return { valid: false, error: 'Please provide a more detailed address (at least 10 characters)' };
  }

  return { valid: true };
}

/**
 * Validate notes/comments
 */
export function validateNotes(notes: string): { valid: boolean; error?: string } {
  if (!notes || notes.trim().length === 0) {
    return { valid: true }; // Notes are optional
  }

  const sanitized = sanitizeString(notes);

  if (sanitized.length > MAX_LENGTHS.NOTES) {
    return { valid: false, error: `Notes must be ${MAX_LENGTHS.NOTES} characters or less` };
  }

  return { valid: true };
}

/**
 * Validate measurement value (length/width in inches)
 */
export function validateMeasurement(value: string | number): { valid: boolean; error?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Measurement must be a positive number' };
  }

  if (num > 1000) {
    return { valid: false, error: 'Measurement seems too large (max 1000 inches)' };
  }

  if (num < 0.5) {
    return { valid: false, error: 'Measurement is too small (min 0.5 inches)' };
  }

  return { valid: true };
}

/**
 * Validate quantity
 */
export function validateQuantity(value: string | number): { valid: boolean; error?: string } {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Quantity must be a positive number' };
  }

  if (num > 100) {
    return { valid: false, error: 'Quantity seems too large (max 100 items)' };
  }

  return { valid: true };
}

export const MAX_INPUT_LENGTHS = MAX_LENGTHS;
