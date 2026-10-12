/**
 * Computes a time-aware greeting based on local device time:
 * - "Good morning" for 5:00 AM through 11:59 AM (hours 5 to 11)
 * - "Good afternoon" for 12:00 PM through 4:59 PM (hours 12 to 16)
 * - "Good evening" for 5:00 PM through 4:59 AM (hours 17 to 23, and 0 to 4)
 */
export function getTimeAwareGreeting(name?: string): string {
  const hour = new Date().getHours();
  let salutation: string;

  if (hour >= 5 && hour < 12) {
    salutation = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    salutation = 'Good afternoon';
  } else {
    salutation = 'Good evening';
  }

  const cleanName = name?.trim();
  return cleanName ? `${salutation}, ${cleanName}` : salutation;
}
