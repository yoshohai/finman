/**
 * DateFilterUtil — Elasticsearch-style date filtering utility.
 * Supports absolute dates, relative dates, and "now".
 */
const DateFilterUtil = (() => {
    /**
     * Parse a date filter string and return a Date object
     * 
     * Format:
     *  - "now" -> current system date
     *  - "2024-02-16" or "2024/02/16" -> absolute date
     *  - "30d" or "30 days ago" -> 30 days ago
     *  - "2w" or "2 weeks ago" -> 2 weeks ago
     *  - "3m" or "3 months ago" -> 3 months ago
     *  - "1y" or "1 year ago" -> 1 year ago
     *  - "30d from now" -> 30 days from now
     *  - "2w from now" -> 2 weeks from now
     *  - etc.
     */
    function parseDate(filterStr) {
        if (!filterStr || filterStr.trim() === '') {
            return null;
        }

        const str = filterStr.trim().toLowerCase();

        // "now" - current system date
        if (str === 'now') {
            return new Date();
        }

        // Absolute date: "2024-02-16" or "2024/02/16"
        const absoluteDateMatch = str.match(/^(\d{4}[-\/]\d{2}[-\/]\d{2})$/);
        if (absoluteDateMatch) {
            const date = new Date(absoluteDateMatch[1]);
            // Validate that it's a valid date
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Relative date parsing: "30d", "30 days ago", "30 days from now"
        // Supported units: d/day, w/week, m/month, y/year
        const relativeMatch = str.match(/^(\d+)\s*(d|day|w|week|m|month|y|year)s?\s*(ago|from\s+now)?$/);
        if (relativeMatch) {
            const amount = parseInt(relativeMatch[1], 10);
            const unit = relativeMatch[2];
            const direction = relativeMatch[3] || 'ago'; // default to 'ago'

            const isFromNow = direction.includes('from now');
            const multiplier = isFromNow ? 1 : -1;

            const now = new Date();
            let date = new Date(now);

            // Normalize unit to single letter
            const unitMap = {
                'd': 'd',
                'day': 'd',
                'w': 'w',
                'week': 'w',
                'm': 'm',
                'month': 'm',
                'y': 'y',
                'year': 'y',
            };

            const normalizedUnit = unitMap[unit];

            switch (normalizedUnit) {
                case 'd':
                    date.setDate(date.getDate() + (amount * multiplier));
                    break;
                case 'w':
                    date.setDate(date.getDate() + (amount * 7 * multiplier));
                    break;
                case 'm':
                    date.setMonth(date.getMonth() + (amount * multiplier));
                    break;
                case 'y':
                    date.setFullYear(date.getFullYear() + (amount * multiplier));
                    break;
            }

            return date;
        }

        throw new Error(`Invalid date filter format: "${filterStr}"`);
    }

    /**
     * Parse filter config object and return date range
     * @param {Object} config - { startDate: string, endDate: string }
     * @returns {Object} - { start: Date|null, end: Date|null }
     */
    function parseDateRange(config) {
        const result = {
            start: null,
            end: null,
        };

        if (!config) {
            return result;
        }

        try {
            if (config.startDate) {
                result.start = parseDate(config.startDate);
            }
        } catch (err) {
            console.warn(`Invalid start date: ${config.startDate}`, err);
        }

        try {
            if (config.endDate) {
                result.end = parseDate(config.endDate);
            }
        } catch (err) {
            console.warn(`Invalid end date: ${config.endDate}`, err);
        }

        return result;
    }

    /**
     * Check if a date falls within the range
     * @param {Date} date - date to check
     * @param {Date} start - range start (inclusive)
     * @param {Date} end - range end (inclusive)
     * @returns {boolean}
     */
    function isDateInRange(date, start, end) {
        if (!date) {
            return false;
        }

        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        if (start) {
            const s = new Date(start);
            s.setHours(0, 0, 0, 0);
            if (d < s) {
                return false;
            }
        }

        if (end) {
            const e = new Date(end);
            e.setHours(23, 59, 59, 999);
            if (d > e) {
                return false;
            }
        }

        return true;
    }

    /**
     * Filter records by date field
     * @param {Array} records
     * @param {string} dateField - field name to check (e.g., 'date', 'createdAt')
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {Array} filtered records
     */
    function filterByDateRange(records, dateField, startDate, endDate) {
        if (!records || !Array.isArray(records)) {
            return [];
        }

        if (!startDate && !endDate) {
            return records;
        }

        return records.filter(record => {
            const recordDate = record[dateField];
            return isDateInRange(recordDate, startDate, endDate);
        });
    }

    /**
     * Format a date for display
     * @param {Date|string} date
     * @returns {string}
     */
    function formatDate(date) {
        if (!date) {
            return '';
        }

        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return '';
        }

        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Get date range label for display
     * @param {Date} start
     * @param {Date} end
     * @returns {string}
     */
    function getDateRangeLabel(start, end) {
        const startStr = start ? formatDate(start) : '';
        const endStr = end ? formatDate(end) : '';

        if (startStr && endStr) {
            return `${startStr} to ${endStr}`;
        } else if (startStr) {
            return `From ${startStr}`;
        } else if (endStr) {
            return `Until ${endStr}`;
        }

        return '';
    }

    return {
        parseDate,
        parseDateRange,
        isDateInRange,
        filterByDateRange,
        formatDate,
        getDateRangeLabel,
    };
})();
