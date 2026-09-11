export const ageFromBirthDate = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const born = new Date(birthDate);
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
};

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);

export const STATUS_TTL_HOURS = 24;
export const statusExpiry = (from = new Date()) =>
  new Date(new Date(from).getTime() + STATUS_TTL_HOURS * 60 * 60 * 1000);
