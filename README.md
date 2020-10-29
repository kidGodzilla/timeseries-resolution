# timeseries-resolution
A tiny helper for converting timeseries data between arbitrary resolutions (i.e. from an hourly interval to daily, or monthly)

Mostly useful for making nice line charts over multiple relevant resolutions, for a trivial stream of "smalldata" ™ 

For example, buttons to switch between latest data, hourly data, daily data, and monthly data.

This helper library also comes with a useful set of presets for formatting timeseries data into hourly, daily, and monthly averages (which should work for most trivial datasets, if your goal is just to make useful line charts). 

## Installation

Run `npm i -s timeseries-resolution` then require or import:

```js
let { initializeTimeseriesData, processTimeseriesData } = require('timeseries-resolution')
```

## Basic Usage

### Scaffolding a timeseries object inside a document

First, we scaffold a new `timeseries` object inside of our document, to contain our timeseries data.

We do that with:

```js
// Initialize an Existing object to handle timeseries data:
object = initializeTimeseriesData(object);

// or create a New object:
let object = initializeTimeseriesData({});
```

By default it looks like this:

```
{
  timeseries: {
    all: [],
    hourly: {},
    daily: {},
    monthly: {},
  }
}
```

You push your new data objects into `object.timeseries.all`. Each time you run the helper function `processTimeseriesData(object)` it computes `object.timeseries.hourly`, `object.timeseries.daily`, etc.

Note: you aren't required to use this. As long as you push your data to `object.timeseries.all`, the other object properties will be created lazily when they're required.


### Pushing Timeseries data

Each timeseries datapoint should have a property for each value you wish to measure, and a special `ts` value for the javascript timestamp of the snapshot.

For example:

```js
object.timeseries.all.push({
    ts: 1603951000000,
    temperature: 32,
    humidity: 0.78,
    wind: 14
})
```

You can have as many datapoints as you like. By default, datapoints are averaged, since this is the most common usage. You can create a custom implementation of `processTimeseriesData()` to use SUMs (see **Advanced usage**). Min, max, and count not yet implemented (see **Todo** in `index.js`)


### Computing Timeseries averages and aggregates 

Finally, you would call `processTimeseriesData(object)` to compute hourly, daily, and monthly resolutions, based on data already in your `timeseries` object.

So, the data in `object.timeseries.all` is used to produce hourly data, which is merged in with existing hourly data, and used to compute daily data, and so forth.

Data outside of expected ranges is also "cleaned up" (removed), since we expect a constant stream of data, after this operation.

The result is four sets of data based on a continuous stream of measurements over time, which can be rendered as a chart containing:

* The latest data (the last 24 hours of data)
* Hourly data (48 hours)
* Daily data (32 days)
* Monthly data (no cleanup)

### Last n helper

We suggest pulling the last 20 datapoints from each before rendering a chart, but you do you :)

A helper for that has been included. You can just use your favorite charting library to render:

```
render(last(o.timeseries.all, 20))
```

## Advanced usage

You can use the underlying helper `formatTimeseriesData` to calculate your new resolution from any array of data to any arbitrary resolution.

You can make a copy of `processTimeseriesData` and use this as a template to adjust the number of datapoints retained, the resolution, or anything else you would like to modify.

`formatTimeseriesData` takes an array of timestamped datapoints, a resolution (in **ms**), and an optional data model, to produce a new array of datapoints at a new resolution.

For example, here is how we convert incoming datapoints to an hourly resolution in `processTimeseriesData`:

```js
formatTimeseriesData(o.timeseries.all, (60 * 60 * 1000))
```
