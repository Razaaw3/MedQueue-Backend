import {format, parseISO, addHours} from 'date-fns';
import moment from 'moment-timezone';

// Set the timezone for the entire application
const TIMEZONE = 'Asia/Karachi';

/**
 * Convert a date to the application's timezone
 * @param {Date|string} date - The date to convert
 * @returns {Date} - The date in the application's timezone
 */
export const toAppTimezone = (date) => {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return moment.tz(dateObj, TIMEZONE).toDate();
};

/**
 * Format a date in the application's timezone
 * @param {Date|string} date - The date to format
 * @param {string} formatStr - The format string (using date-fns format)
 * @returns {string} - The formatted date string
 */
export const formatInAppTimezone = (date, formatStr = 'yyyy-MM-dd HH:mm') => {
  if (!date) return null;
  const dateObj = toAppTimezone(date);
  return format(dateObj, formatStr);
};

/**
 * Get the current date in the application's timezone
 * @returns {Date} - The current date in the application's timezone
 */
export const getCurrentAppTime = () => {
  return moment.tz(TIMEZONE).toDate();
};

/**
 * Convert a date to UTC for storage
 * @param {Date|string} date - The date to convert
 * @returns {Date} - The date in UTC
 */
export const toUTC = (date) => {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return moment.tz(dateObj, TIMEZONE).utc().toDate();
};

/**
 * Convert a UTC date back to the application's timezone
 * @param {Date|string} date - The UTC date to convert
 * @returns {Date} - The date in the application's timezone
 */
export const fromUTC = (date) => {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  return moment.utc(dateObj).tz(TIMEZONE).toDate();
};

/**
 * Get the start of day in the application's timezone
 * @param {Date|string} date - The date to get start of day for
 * @returns {Date} - The start of day in the application's timezone
 */
export const getStartOfDay = (date) => {
  if (!date) return null;
  const dateObj = toAppTimezone(date);
  return moment.tz(dateObj, TIMEZONE).startOf('day').toDate();
};

/**
 * Get the end of day in the application's timezone
 * @param {Date|string} date - The date to get end of day for
 * @returns {Date} - The end of day in the application's timezone
 */
export const getEndOfDay = (date) => {
  if (!date) return null;
  const dateObj = toAppTimezone(date);
  return moment.tz(dateObj, TIMEZONE).endOf('day').toDate();
};
