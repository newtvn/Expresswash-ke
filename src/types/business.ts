export interface Business {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  isNative: boolean;
}

/** Sentinel for the consolidated (all businesses) view. Maps to a NULL p_business. */
export const BUSINESS_ALL = 'all';

/** Coerce a selection to the slug an RPC expects: 'all' -> null (consolidated). */
export function toBusinessParam(selected: string | null | undefined): string | null {
  return !selected || selected === BUSINESS_ALL ? null : selected;
}
