export type DayRecord = {
  gregorian: string;
  hebrew_date: string;
  hebrew_day: number;
  hebrew_month: string;
  hebrew_year: string;
  moon: { illumination: number; age: number; waxing: boolean; };
  sun: { sunrise: string|null; sunset: string|null; };
  moon_times: { moonrise: string|null; moonset: string|null; };
}
export type YearData = Record<string, DayRecord>; 