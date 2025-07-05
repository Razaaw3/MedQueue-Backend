import { DateTime } from "luxon";

// Set the timezone for the entire application
const TIMEZONE = "Asia/Karachi";

/**
 * Convert a date to the application's timezone
 * @param {Date|string} date - The date to convert
 * @returns {Date} - The date in the application's timezone
 */
export const toAppTimezone = (date) => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone(TIMEZONE).toJSDate();
};

/**
 * Format a date in the application's timezone
 * @param {Date|string} date - The date to format
 * @param {string} formatStr - The format string (using Luxon format)
 * @returns {string} - The formatted date string
 */
export const formatInAppTimezone = (date, formatStr = "yyyy-MM-dd HH:mm") => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone(TIMEZONE).toFormat(formatStr);
};

/**
 * Get the current date in the application's timezone
 * @returns {Date} - The current date in the application's timezone
 */
export const getCurrentAppTime = () => {
  return DateTime.now().setZone(TIMEZONE).toJSDate();
};

/**
 * Convert a date to UTC for storage
 * @param {Date|string} date - The date to convert
 * @returns {Date} - The date in UTC
 */
export const toUTC = (date) => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone(TIMEZONE).toUTC().toJSDate();
};

/**
 * Convert a UTC date back to the application's timezone
 * @param {Date|string} date - The UTC date to convert
 * @returns {Date} - The date in the application's timezone
 */
export const fromUTC = (date) => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone("UTC").setZone(TIMEZONE).toJSDate();
};

/**
 * Get the start of day in the application's timezone
 * @param {Date|string} date - The date to get start of day for
 * @returns {Date} - The start of day in the application's timezone
 */
export const getStartOfDay = (date) => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone(TIMEZONE).startOf("day").toJSDate();
};

/**
 * Get the end of day in the application's timezone
 * @param {Date|string} date - The date to get end of day for
 * @returns {Date} - The end of day in the application's timezone
 */
export const getEndOfDay = (date) => {
  if (!date) return null;

  let dateTime;
  if (date instanceof Date) {
    dateTime = DateTime.fromJSDate(date);
  } else if (typeof date === "string") {
    dateTime = DateTime.fromISO(date);
  } else {
    return null;
  }

  if (!dateTime.isValid) return null;

  return dateTime.setZone(TIMEZONE).endOf("day").toJSDate();
};
