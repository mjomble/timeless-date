const MS_PER_DAY = 86400000

/**
 * Represents the abstract notion of a date without a specific time of day.
 * Does not correspond to a specific physical time range due to the lack of a timezone.
 */
export class TimelessDate {
    /**
     * 0 = 1970-01-01
     * 1 = 1970-01-02
     * etc
     */
    readonly unixDay: number

    /** Derivable from unixDay, but we store both for convenience */
    readonly ymdStr: string

    private constructor(unixDay: number) {
        if (!Number.isInteger(unixDay)) {
            throw new Error('Non-integer unix day: ' + unixDay)
        }

        this.unixDay = unixDay
        this.ymdStr = new Date(unixDay * MS_PER_DAY).toISOString().substring(0, 10)
    }

    public static fromUtcMidnightTimestamp(timestamp: number): TimelessDate {
        return new TimelessDate(timestamp / MS_PER_DAY)
    }

    /** @param ymd A string in YYYY-MM-DD format */
    public static fromYmd(ymd: string): TimelessDate {
        const ms = new Date(ymd + 'T00:00:00Z').getTime()
        const date = TimelessDate.fromUtcMidnightTimestamp(ms)

        if (date.ymdStr !== ymd) {
            throw new Error('Invalid date: ' + ymd)
        }

        return date
    }

    /** The month parameter is 1-based: 1 = January, ..., 12 = December */
    public static fromNumeric(year: number, month: number, dayOfMonth: number): TimelessDate {
        const ms = Date.UTC(year, month - 1, dayOfMonth)
        const date = TimelessDate.fromUtcMidnightTimestamp(ms)

        if (date.dayOfMonth() !== dayOfMonth || date.month() !== month || date.year() !== year) {
            throw new Error('Invalid date: ' + year + '-' + month + '-' + dayOfMonth)
        }

        return date
    }

    public static fromUtcMidnightDate(date: Date): TimelessDate {
        return TimelessDate.fromUtcMidnightTimestamp(date.getTime())
    }

    /**
     * @param date
     *   A physical point in time which may correspond to different dates in different time zones.
     * @param timeZone
     *   e.g. 'UTC', 'CET', 'Europe/Helsinki'...
     *   See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#timezone
     */
    public static fromDate(date: Date, timeZone: string): TimelessDate {
        const ymd = TimelessDate.dateToYmd(date, timeZone)
        return TimelessDate.fromYmd(ymd)
    }

    /** @param timeZone See TimelessDate.fromDate() */
    public static today(timeZone: string): TimelessDate {
        return TimelessDate.fromDate(new Date(), timeZone)
    }

    /** @param timeZone See TimelessDate.fromDate() */
    private static dateToYmd(date: Date, timeZone: string): string {
        // The Intl API does not give us a simple way to get the timezone offset,
        // it mainly just uses timezone data for formatting dates to strings.
        // It also doesn't have a simple way of reliably using the YYYY-MM-DD format,
        // so we need to use formatToParts and assemble them on our own.

        const namedParts = { year: '', month: '', day: '' }
        const parts = new Intl.DateTimeFormat('en', { timeZone }).formatToParts(date)

        for (const part of parts) {
            if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
                namedParts[part.type] = part.value
            }
        }

        const pad = (s: string) => s.padStart(2, '0')

        return `${namedParts.year}-${pad(namedParts.month)}-${pad(namedParts.day)}`
    }

    public static min(date1: TimelessDate, date2: TimelessDate): TimelessDate {
        return date1.unixDay < date2.unixDay ? date1 : date2
    }

    public static max(date1: TimelessDate, date2: TimelessDate): TimelessDate {
        return date1.unixDay > date2.unixDay ? date1 : date2
    }

    public static countDays(date1: TimelessDate, date2: TimelessDate): number {
        if (date1.unixDay > date2.unixDay) {
            throw new Error(`date1 (${date1.toYmdString()}) must be <= date2 (${date2.toYmdString()})`)
        }

        return date2.unixDay - date1.unixDay + 1
    }

    /**
     * Number of milliseconds (not seconds) between the Unix epoch (1970-01-01 00:00:00 UTC)
     * and 00:00:00 UTC on this day.
     */
    public toUtcMidnightTimestamp(): number {
        return this.unixDay * MS_PER_DAY
    }

    /**
     * Returns a Date object representing the physical point in time for 00:00:00 UTC on this day
     */
    public toUtcMidnightDate(): Date {
        return new Date(this.toUtcMidnightTimestamp())
    }

    public year(): number {
        return this.toUtcMidnightDate().getUTCFullYear()
    }

    /** 1-based: 1 = January, ..., 12 = December */
    public month(): number {
        return this.toUtcMidnightDate().getUTCMonth() + 1
    }

    public dayOfMonth(): number {
        return this.toUtcMidnightDate().getUTCDate()
    }

    public toYmdString(): string {
        return this.ymdStr // YYYY-MM-DD
    }

    /** Used by JSON.stringify() */
    public toJSON(): string {
        return this.ymdStr // YYYY-MM-DD
    }

    public addDays(days: number): TimelessDate {
        if (!Number.isInteger(days)) {
            throw new Error('Non-integer number of days: ' + days)
        }

        return new TimelessDate(this.unixDay + days)
    }

    public addMonths(months: number): TimelessDate {
        if (!Number.isInteger(months)) {
            throw new Error('Non-integer number of months: ' + months)
        }

        const date = this.toUtcMidnightDate()
        date.setUTCMonth(date.getUTCMonth() + months)
        return TimelessDate.fromUtcMidnightDate(date)
    }

    public withDayOfMonth(newDayOfMonth: number): TimelessDate {
        const currentDayOfMonth = this.dayOfMonth()

        if (newDayOfMonth === currentDayOfMonth) {
            return this
        }

        const newDate = this.addDays(newDayOfMonth - currentDayOfMonth)

        if (newDate.dayOfMonth() === newDayOfMonth) {
            return newDate
        } else {
            // Can happen if the parameter is less than 1, more than 31, etc
            throw new Error('Invalid day of month')
        }
    }

    public firstOfMonth(): TimelessDate {
        return this.withDayOfMonth(1)
    }

    public firstOfNextMonth(): TimelessDate {
        // Adding 31 days to the first of month will give us a day between the 1st and the
        // 4th of the next month.
        return this.firstOfMonth().addDays(31).firstOfMonth()
    }

    public lastOfMonth(): TimelessDate {
        return this.firstOfNextMonth().addDays(-1)
    }

    public isSame(other: TimelessDate): boolean {
        return this.unixDay === other.unixDay
    }

    public isBefore(other: TimelessDate): boolean {
        return this.unixDay < other.unixDay
    }

    public isAfter(other: TimelessDate): boolean {
        return this.unixDay > other.unixDay
    }

    public isSameOrBefore(other: TimelessDate): boolean {
        return this.unixDay <= other.unixDay
    }

    public isSameOrAfter(other: TimelessDate): boolean {
        return this.unixDay >= other.unixDay
    }
}
