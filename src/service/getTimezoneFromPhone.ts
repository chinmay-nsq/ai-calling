// service/getTimezoneFromPhone.ts
import { parsePhoneNumber } from "libphonenumber-js";

const countryTimezoneMap: Record<string, string> = {
  IN: "Asia/Kolkata",
  US: "America/New_York",
  GB: "Europe/London",
  AE: "Asia/Dubai",
  SG: "Asia/Singapore",
  AU: "Australia/Sydney",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  JP: "Asia/Tokyo",
  CA: "America/Toronto",
  PK: "Asia/Karachi",
  BD: "Asia/Dhaka",
  LK: "Asia/Colombo",
  NP: "Asia/Kathmandu",
  MY: "Asia/Kuala_Lumpur",
  PH: "Asia/Manila",
  ID: "Asia/Jakarta",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  KR: "Asia/Seoul",
  SA: "Asia/Riyadh",
  QA: "Asia/Riyadh",
  KW: "Asia/Riyadh",
  BH: "Asia/Bahrain",
  OM: "Asia/Muscat",
  NZ: "Pacific/Auckland",
  ZA: "Africa/Johannesburg",
  NG: "Africa/Lagos",
  KE: "Africa/Nairobi",
  EG: "Africa/Cairo",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  NL: "Europe/Amsterdam",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  RU: "Europe/Moscow",
  TR: "Europe/Istanbul",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  BE: "Europe/Brussels",
  IL: "Asia/Jerusalem",
};

export const getTimezoneFromPhone = (phoneNumber: string): string => {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    const country = parsed.country;
    return countryTimezoneMap[country ?? ""] ?? "UTC";
  } catch (err) {
    console.error("Failed to get timezone for phone:", phoneNumber, err);
    return "UTC";
  }
};

export const getCurrentDateTimeForTimezone = (timezone: string): string => {
  const now = new Date();

  // Get formatted local time
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  // Get UTC offset for this timezone (e.g. "+05:30")
  const offsetFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "shortOffset", // returns "GMT+5:30"
  });

  const offsetPart =
    offsetFormatter.formatToParts(now).find((p) => p.type === "timeZoneName")
      ?.value ?? "GMT+0";

  const utcOffset = offsetPart.replace("GMT", ""); // "+5:30" or "-4:00"

  return `${formatted} (UTC${utcOffset})`;
};
