type Greeting = (name: string) => string;

const greetingOptions: Record<'morning' | 'afternoon' | 'evening' | 'night', Greeting[]> = {
  morning: [
    (name) => `Good morning${name}. Ready to learn something new?`,
    (name) => `Morning${name}. What are we working on?`,
    (name) => `Fresh day, fresh ideas${name}.`,
    (name) => `Good morning${name}. Let's get started.`,
  ],
  afternoon: [
    (name) => `Good afternoon${name}. What are we working on?`,
    (name) => `Back to learning${name}?`,
    (name) => `Let's keep the momentum going${name}.`,
    (name) => `Afternoon${name}. Ready to dive in?`,
  ],
  evening: [
    (name) => `Good evening${name}. Ready for another study session?`,
    (name) => `Evening${name}. What are we tackling?`,
    (name) => `Still learning${name}? Let's get into it.`,
    (name) => `Good evening${name}. Let's make this session count.`,
  ],
  night: [
    (name) => `Late-night study session${name}?`,
    (name) => `Still up${name}? What are we tackling?`,
    (name) => `Night session${name}. Let's get into it.`,
    (name) => `A little more studying${name}?`,
  ],
};

/** Uses local device time; callers can retain hour and variation for a stable visit. */
export function getTimeAwareGreeting(
  name?: string,
  hour = new Date().getHours(),
  variation = 0
): string {
  const period = hour >= 5 && hour < 12
    ? 'morning'
    : hour >= 12 && hour < 17
      ? 'afternoon'
      : hour >= 17 && hour < 21
        ? 'evening'
        : 'night';
  const options = greetingOptions[period];
  const nameSuffix = name?.trim() ? `, ${name.trim()}` : '';
  return options[variation % options.length](nameSuffix);
}
