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

/**
 * Validate phone number (Kenyan format)
 * Accepts: 0712345678, +254712345678, 254712345678
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim().length === 0) {
    return { valid: false, error: 'Phone number is required' };
  }

  const sanitized = phone.trim().replace(/\s+/g, '');

  // Kenyan phone number patterns
  const patterns = [
    /^0[71]\d{8}$/, // 0712345678
    /^\+2547\d{8}$/, // +254712345678
    /^2547\d{8}$/, // 254712345678
  ];

  const isValid = patterns.some((pattern) => pattern.test(sanitized));

  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid phone number. Use format: 0712345678 or +254712345678',
    };
  }

  return { valid: true };
}

/**
 * Format phone number to standard Kenyan format (+254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  const sanitized = phone.trim().replace(/\s+/g, '');

  // Already in correct format
  if (sanitized.startsWith('+254')) {
    return sanitized;
  }

  // Convert 254XXXXXXXXX to +254XXXXXXXXX
  if (sanitized.startsWith('254')) {
    return `+${sanitized}`;
  }

  // Convert 0XXXXXXXXX to +254XXXXXXXXX
  if (sanitized.startsWith('0')) {
    return `+254${sanitized.substring(1)}`;
  }

  return sanitized;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  const sanitized = email.trim().toLowerCase();

  // RFC 5322 simplified email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(sanitized)) {
    return { valid: false, error: 'Invalid email address' };
  }

  if (sanitized.length > 254) {
    return { valid: false, error: 'Email address is too long' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters', strength: 'weak' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  const criteriaMet = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;

  if (criteriaMet >= 4 && password.length >= 12) {
    strength = 'strong';
  } else if (criteriaMet >= 3 && password.length >= 8) {
    strength = 'medium';
  }

  if (criteriaMet < 2) {
    return {
      valid: false,
      error: 'Password must contain at least uppercase, lowercase, and numbers',
      strength: 'weak',
    };
  }

  return { valid: true, strength };
}

/**
 * Validate name (first name or last name)
 */
export function validateName(name: string, fieldName = 'Name'): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length > MAX_LENGTHS.NAME) {
    return { valid: false, error: `${fieldName} must be ${MAX_LENGTHS.NAME} characters or less` };
  }

  if (sanitized.length < 2) {
    return { valid: false, error: `${fieldName} must be at least 2 characters` };
  }

  // Only allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(sanitized)) {
    return { valid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
  }

  return { valid: true };
}

/**
 * Validate amount/price
 */
export function validateAmount(value: string | number): { valid: boolean; error?: string } {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num) || num < 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }

  if (num > 10000000) {
    return { valid: false, error: 'Amount is too large' };
  }

  return { valid: true };
}

export const MAX_INPUT_LENGTHS = MAX_LENGTHS;
