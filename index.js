
// Fix Object Value Types for a Flat object
function fixObjectValueTypes (o) {
    for (let k in o) {
        if (!o.hasOwnProperty(k)) continue;

        let v = o[k];

        if (v === 'undefined') o[k] = undefined;
        if (v === 'false') o[k] = false;
        if (v === 'null') o[k] = null;
        if (v === 'true') o[k] = true;
        if (v === 'NaN') o[k] = NaN;

        // DO NOT SWITCH TO DOUBLE EQUALS!
        if ((+v) == v && v !== '') o[k] = (+v);
    }
    return o;
}

// Last n items
function last (n, a) {
    if (a.length <= n) return a;
    return a.slice(Math.max(a.length - n, 0));
}

// Flat object to array by property value (simplistic)
function obj2arr (o) {
    let a = [];

    for (let k in o) {
        if (o.hasOwnProperty(k)) a.push(o[k]);
    }

    return a;
}

// Used to filter unique arrays
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

/**
 * Change data resolution
 */
function formatTimeseriesData (d, r, m) {
    // Expects an array of data objects, with timestamps, a resolution (int, ms), and a model object
    // which describes the aggregation of each item

    // Sort d
    d.sort((a, b) => (a.ts > b.ts) ? 1 : -1);

    // Default resolution of 1h
    if (!r) r = 60 * 60 * 1000;
    if (!m) m = {};

    // Output as object
    let all = {};

    // Reset for each group
    let datapoints = 0;
    let counts = {};
    let groupTs = 0;
    let outs = {};

    d.forEach(item => {
        let { ts } = item;

        if (!groupTs) {
            groupTs = ts;
            groupTs = Math.floor(groupTs / r) * r;
        }

        // Create a new entry if outside time range
        if (ts > groupTs + r) {
            datapoints = 0;
            groupTs = ts;
            counts = {};
            outs = {};
        }

        // Accumulate (SUM) / Average / Count / Min / Max / Distributions
        for (let k in item) {
            if (!item.hasOwnProperty(k)) continue;

            let val = item[k];

            if (k === 'ts') continue;

            if (typeof val === 'number') {
                if (m[k] === 'sum') {
                    // Aggregate values (SUM)
                    if (!outs[k]) outs[k] = val;
                    else outs[k] += val;

                } else if (m[k] === 'min') {
                    outs[k] = Math.min(outs[k], val);

                } else if (m[k] === 'max') {
                    outs[k] = Math.max(outs[k], val);

                } else {
                    // Average (Default operation for numbers)
                    if (!counts[k]) counts[k] = 0;
                    if (!outs[k]) outs[k] = val;
                    else outs[k] = ((outs[k] * counts[k]) + val) / ++counts[k];
                }

            } else if (m[k] === 'count') {
                // Todo: I'm not sure how this would work yet, it might just be SUM all over again without a where clause


            } else if (m[k] === 'unique') {
                // Count/list unique distribution values
                outs[k].push(val);
                outs[k] = outs[k].filter(onlyUnique);

            } else if (Array.isArray(val)) {
                // Merge arrays (unique)
                outs[k] = val.concat(outs[k] || []);
                outs[k] = outs[k].filter(onlyUnique);

            } else if (typeof val === 'string' || (m[k] === 'dist' && typeof val !== 'object')) {
                // Distribution (strings to object)
                if (typeof val !== 'string') val += "";

                if (!outs[k]) outs[k] = {};
                if (!outs[k][val]) outs[k][val] = 0;
                outs[k][val]++;

            } else if (typeof val === 'object') {
                // Distribution merging (merge objects by summing distribution counts)
                // to sum two distributions when aggregating
                for (let l in val) {
                    if (!val.hasOwnProperty(l)) continue;

                    if (!outs[k]) outs[k] = {};
                    if (!outs[k][l]) outs[k][l] = val[l];
                    else outs[k][l] += val[l];
                }
            }

            if (typeof outs[k] === 'number') {
                // Max 2 decimal place precision
                let b = outs[k].toFixed(2);
                if (b.length < (outs[k] + '').length) outs[k] = parseFloat(b);
            }
        }

        outs.ts = Math.floor(groupTs / r) * r; // Flatten timestamp by resolution
        outs._datapoints = ++datapoints; // Count of number of datapoints summed or averaged
        all[groupTs] = outs;
    });

    let output = obj2arr(all);

    return output;
}

/**
 * Initializes a given object with a nested `timeseries` object, if not present
 */
function initializeTimeseriesData (o) {
    if (!o.timeseries) o.timeseries = {
        aggregates: { hourly: {}, daily: {}, monthly: {} },
        all: []
    };

    if (o.timeseries) {
        if (!o.timeseries.all) o.timeseries.all = [];
        if (!o.timeseries.aggregates) o.timeseries.aggregates = {};
        if (!o.timeseries.aggregates.monthly) o.timeseries.aggregates.monthly = {};
        if (!o.timeseries.aggregates.hourly) o.timeseries.aggregates.hourly = {};
        if (!o.timeseries.aggregates.daily) o.timeseries.aggregates.daily = {};
    }

    return o;
}

/**
 * An opinionated, but ready-to-use helper function to transform timeseries data into
 * hourly, daily, and monthly aggregates or averages
 */
function processTimeseriesData (o) {
    let thirtyTwoDaysAgo = (+ new Date()) - (32 * 24 * 60 * 60 * 1000);
    let fourtyEightHoursAgo = (+ new Date()) - (48 * 60 * 60 * 1000);
    let twentyFourHoursAgo = (+ new Date()) - (24 * 60 * 60 * 1000);

    if (!o.timeseries) o = initializeTimeseriesData(o);

    /**
     * Create aggregates in alternate time resolutions
     */
    let hourlyData = formatTimeseriesData(o.timeseries.all, (60 * 60 * 1000));

    // hourlyData.pop(); // Try not popping so we get results faster. Also, if we always pop, dailyAggregates will never exceed 23 hours of data.

    let hourlyDataFromAggregate = obj2arr(o.timeseries.aggregates.hourly);

    let dailyData = formatTimeseriesData(hourlyDataFromAggregate, (24 * 60 * 60 * 1000));

    // dailyData.pop(); Do not pop dailyData, since we only collect 24h & each component is complete

    // Get daily data from previous aggregates, not volatile data
    let dailyDataFromAggregate = obj2arr(o.timeseries.aggregates.daily);

    let monthlyData = formatTimeseriesData(dailyDataFromAggregate, Math.floor(30.43685 * 24 * 60 * 60 * 1000));

    // monthlyData.pop(); Do not pop monthlyData

    hourlyData.forEach(item => {
        o.timeseries.aggregates.hourly[item.ts] = item;
    });

    dailyData.forEach(item => {
        o.timeseries.aggregates.daily[item.ts] = item;
    });

    monthlyData.forEach(item => {
        o.timeseries.aggregates.monthly[item.ts] = item;
    });


    /**
     * Cleanup old data over 24h old
     */
    o.timeseries.all.forEach((item, i) => {
        if (item.ts < twentyFourHoursAgo) o.timeseries.all.splice(i, 1);
    });

    // Cleanup hourly aggregates older than two days
    for (let k in o.timeseries.aggregates.hourly) {
        if (!o.timeseries.aggregates.hourly.hasOwnProperty(k)) continue;

        if (k < fourtyEightHoursAgo) delete o.timeseries.aggregates.hourly[k];
    }

    // Cleanup daily aggregates older than 32 days
    for (let k in o.timeseries.aggregates.daily) {
        if (!o.timeseries.aggregates.daily.hasOwnProperty(k)) continue;

        if (k < thirtyTwoDaysAgo) delete o.timeseries.aggregates.daily[k];
    }

    return o;
}

module.exports = {
    initializeTimeseriesData: initializeTimeseriesData,
    processTimeseriesData: processTimeseriesData,
    formatTimeseriesData: formatTimeseriesData,
    fixObjectValueTypes: fixObjectValueTypes,
    obj2arr: obj2arr,
    last: last
}
