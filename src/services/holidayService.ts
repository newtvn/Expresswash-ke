import { supabase } from '@/lib/supabase';
import { retrySupabaseQuery } from '@/lib/retryUtils';

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  createdBy: string;
  createdAt: string;
}

// Kenyan public holidays (recurring annually)
// Note: month values are 0-indexed (0=January, 11=December) to match JavaScript Date
export const KENYAN_HOLIDAYS = [
  { name: 'New Year\'s Day', month: 0, day: 1 },      // January 1
  { name: 'Labour Day', month: 4, day: 1 },            // May 1
  { name: 'Madaraka Day', month: 5, day: 1 },          // June 1
  { name: 'Mashujaa Day', month: 9, day: 20 },         // October 20
  { name: 'Jamhuri Day', month: 11, day: 12 },         // December 12
  { name: 'Christmas Day', month: 11, day: 25 },       // December 25
  { name: 'Boxing Day', month: 11, day: 26 },          // December 26
];

/**
 * Check if a date is a holiday
 */
export async function isHoliday(date: Date | string): Promise<boolean> {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('holidays')
      .select('id')
      .eq('date', dateStr)
      .limit(1),
    { maxRetries: 2 }
  );

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Get all holidays
 */
export async function getHolidays(year?: number): Promise<Holiday[]> {
  try {
    let query = supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await retrySupabaseQuery(() => query, { maxRetries: 2 });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      date: row.date as string,
      isRecurring: row.is_recurring as boolean,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return [];
  }
}

/**
 * Add a holiday
 */
export async function addHoliday(
  name: string,
  date: string,
  isRecurring: boolean,
  createdBy: string,
): Promise<{ success: boolean; holiday?: Holiday; message?: string }> {
  try {
    // Check if holiday already exists for this date
    const existing = await isHoliday(date);
    if (existing) {
      return { success: false, message: `A holiday is already configured for ${date}. Please choose a different date.` };
    }

    const { data, error } = await retrySupabaseQuery(
      () => supabase
        .from('holidays')
        .insert({
          name,
          date,
          is_recurring: isRecurring,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        })
        .select()
        .single(),
      { maxRetries: 3 }
    );

    if (error || !data) {
      return {
        success: false,
        message: error?.message ?? 'Failed to save holiday to database. Please check your connection and try again.',
      };
    }

    return {
      success: true,
      holiday: {
        id: data.id as string,
        name: data.name as string,
        date: data.date as string,
        isRecurring: data.is_recurring as boolean,
        createdBy: data.created_by as string,
        createdAt: data.created_at as string,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'An unexpected error occurred while adding holiday. Please try again.',
    };
  }
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(holidayId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await retrySupabaseQuery(
      () => supabase.from('holidays').delete().eq('id', holidayId),
      { maxRetries: 2 }
    );

    if (error) {
      return { success: false, message: `Failed to delete holiday: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: 'An unexpected error occurred while deleting holiday. Please try again.',
    };
  }
}

/**
 * Get all holidays in a date range as Date objects
 */
export async function getHolidayDates(startDate: Date, endDate: Date): Promise<Date[]> {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  const { data, error } = await retrySupabaseQuery(
    () => supabase
      .from('holidays')
      .select('date')
      .gte('date', start)
      .lte('date', end),
    { maxRetries: 2 }
  );

  if (error || !data) return [];

  return data.map((row) => new Date(row.date as string));
}

/**
 * Initialize default Kenyan holidays for a year
 */
export async function initializeKenyanHolidays(
  year: number,
  createdBy: string,
): Promise<{ success: boolean; added: number }> {
  let added = 0;

  for (const holiday of KENYAN_HOLIDAYS) {
    const date = new Date(year, holiday.month, holiday.day).toISOString().split('T')[0];

    const result = await addHoliday(holiday.name, date, true, createdBy);
    if (result.success) added++;
  }

  return { success: true, added };
}
