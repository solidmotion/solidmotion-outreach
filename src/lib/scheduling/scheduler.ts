/**
 * Scheduling helper for the SolidMotion outreach app.
 * All times are in CET (Europe/Amsterdam).
 */

const TIMEZONE = "Europe/Amsterdam";
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

/**
 * Get the current date/time in CET timezone.
 */
function nowInCET(): Date {
  const nowUtc = new Date();
  const cetString = nowUtc.toLocaleString("en-US", { timeZone: TIMEZONE });
  return new Date(cetString);
}

/**
 * Calculate evenly spaced time slots between 9:00-17:00 CET.
 *
 * @param count - Number of slots to generate
 * @param date - The date to generate slots for (defaults to today)
 * @returns Array of Date objects representing the time slots
 */
export function getNextSlots(count: number, date?: Date): Date[] {
  if (count <= 0) return [];

  const targetDate = date ?? nowInCET();
  const slots: Date[] = [];

  // Total working minutes: 9:00 to 17:00 = 480 minutes
  const totalMinutes = (WORK_END_HOUR - WORK_START_HOUR) * 60;

  // Evenly space slots across the work window
  // If count is 1, place it in the middle; otherwise distribute evenly
  const interval = totalMinutes / (count + 1);

  for (let i = 1; i <= count; i++) {
    const minutesFromStart = Math.round(interval * i);
    const hour = WORK_START_HOUR + Math.floor(minutesFromStart / 60);
    const minute = minutesFromStart % 60;

    const slot = new Date(targetDate);
    slot.setHours(hour, minute, 0, 0);
    slots.push(slot);
  }

  return slots;
}

/**
 * Check if the current time is within working hours (9:00-17:00 CET, Monday-Friday).
 *
 * @param date - Optional date to check (defaults to current time)
 * @returns true if within working hours
 */
export function isWithinWorkHours(date?: Date): boolean {
  const checkDate = date ?? nowInCET();

  // Get day and time in CET
  const cetString = checkDate.toLocaleString("en-US", { timeZone: TIMEZONE });
  const cetDate = new Date(cetString);

  const day = cetDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = cetDate.getHours();

  // Check if it's a weekday (Monday=1 through Friday=5)
  if (day === 0 || day === 6) return false;

  // Check if within work hours
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

/**
 * Get the count of businesses processed today.
 * Placeholder implementation — returns 0 for now.
 *
 * TODO: Query the database to count businesses processed today.
 */
export function getTodayProcessedCount(): number {
  return 0;
}
