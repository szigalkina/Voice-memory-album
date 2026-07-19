// Month N of life: month 1 spans birthdate .. day before the first monthly
// anniversary. All math on UTC calendar dates to avoid timezone drift.
export function monthNumber(birthdate: string, recordedAt: Date): number {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const ry = recordedAt.getUTCFullYear();
  const rm = recordedAt.getUTCMonth() + 1;
  const rd = recordedAt.getUTCDate();
  let months = (ry - by) * 12 + (rm - bm);
  if (rd < bd) months -= 1;
  return Math.max(1, months + 1);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(birthdate: string, monthNum: number): string {
  const [, bm] = birthdate.split("-").map(Number);
  const calendarMonth = (bm - 1 + (monthNum - 1)) % 12;
  return `Month ${monthNum} — ${MONTH_NAMES[calendarMonth]}`;
}
