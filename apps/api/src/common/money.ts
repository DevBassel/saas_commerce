/**
 * Shared money helpers.
 *
 * Major units = the value stored in `numeric(10,2)` columns and shown to users
 * (e.g. dollars). Minor units = the smallest currency unit expected by payment
 * providers such as Stripe (e.g. cents).
 */

/** Rounds a major-unit amount to two decimal places. */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Converts a major-unit amount to minor units (cents). */
export const toMinorUnit = (major: number): number => Math.round(major * 100);

/** Converts a minor-unit amount (cents) to major units. */
export const toMajorUnit = (minor: number): number => minor / 100;
