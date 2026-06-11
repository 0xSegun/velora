export function getFirstName(fullName?: string | null): string {
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0];
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getPersonalizedGreeting(fullName?: string | null): string {
  const first = getFirstName(fullName);
  const time = getTimeGreeting();
  const hour = new Date().getHours();
  if (hour >= 17 || hour < 5) return `Welcome back, ${first}`;
  return `${time}, ${first}`;
}