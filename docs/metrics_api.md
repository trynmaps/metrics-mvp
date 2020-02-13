# Backend API Documentation

The backend API uses GraphQL. There is one endpoint, `/api/graphql`, that accepts a query string containing the necessary parameters for the query and the fields to be returned in the response.

The GraphQL API is available publicly at https://muni.opentransit.city/api/graphql . (In a development environment, the URL is http://localhost:5000/api/graphql .) This endpoint can be called via either GET or POST. When making a GET request, the GraphQL query should be passed as a URL-encoded parameter named `query`. Variables may optionally be passed as a URL-encoded JSON-encoded object in a parameter named `variables`.

For example, the following GraphQL query would return some statistics about headways and wait times for a particular stop on one day:

```
query($agencyId: String!, $routeId:String!, $startStopId:String!, $date:String) {
  agency(agencyId:$agencyId) {
    route(agencyId:$agencyId, routeId:$routeId) {
      trip(startStopId:$startStopId) {
        interval(dates:[$date]) {
          headways { median max }
          waitTimes { median }
        }
      }
    }
  }
}
```

To run the above query with the variables `$routeId` = "1", `$startStopId` = "16307", and `$date` = "2019-12-10", you can make a GET request to the URL below:

http://localhost:5000/api/graphql?query=query(%24agencyId%3AString!%2C+%24routeId%3AString!%2C+%24startStopId%3AString!%2C+%24date%3AString)+%7B+agency(agencyId%3A%24agencyId)+%7B+route(routeId%3A%24routeId)+%7B+trip(startStopId%3A%24startStopId)+%7B+interval(dates%3A%5B%24date%5D)+%7B+headways+%7B+median+max+%7D+waitTimes+%7B+median+%7D+%7D+%7D+%7D+%7D+%7D&variables=%7B%22agencyId%22:%22muni%22,%22routeId%22:%221%22,%22startStopId%22:%2216307%22,%22date%22:%222019-12-10%22%7D

Queries can also be sent via POST, with the Content-Type `application/json`, and a request body like this:

```
{
  "query": "...",
  "variables": { "myVariable": "someValue", ... }
}
```

For ease of testing the GraphQL API, there is another endpoint, `/api/graphiql`, that provides a web user interface for making GraphQL queries from your browser.
In a development environment, the URL is http://localhost:5000/api/graphiql .

For more information about calling GraphQL APIs over HTTP, see https://graphql.org/learn/serving-over-http/ . For more information about GraphQL in general, see https://graphql.org/learn/ .

# Structure of a GraphQL Query

OpenTransit's data is organized as a nested structure of objects. Each object represents a subset of the data (data about a route, data about a stop, data about bus arrivals, etc). This data is divided into fields, which are either other objects or primitive types (the relevant primitive types for this API are `String`, `Int` and `Float`).

The structure of a GraphQL query reflects this nested structure - in a query, the client must specify which fields it wants the server to return in the response. Nested fields are contained in nested brackets.
Note that all the innermost elements of the query have to be primitive types.

### Parameters in Queries

Querying information about a particular route or stop requires input parameters. For instance, to fetch the summary statistics for wait times at stop `14015` on route `1` for agency `muni` on the date `2019-12-11`, the query would need to pass in `agencyId`, `routeId`, `startStopId` and `dates` parameters:

```graphql
query {
  agency(agencyId:"muni") {
    route(routeId:"1") {
      trip(startStopId:"14015") {
        interval(dates:["2019-12-11"]) {
          waitTimes {
            avg median max
          }
        }
      }
    }
  }
}
```

This query returns the following response:

```
{
  "data": {
    "agency": {
      "route": {
        "trip": {
          "interval": {
            "waitTimes": {
              "avg": 4.819,
              "median": 3.194,
              "max": 28.417
            }
          }
        }
      }
    }
  }
}
```

# Example Queries

### Return metrics data for a pair of stops on a route

```graphql
query {
  agency(agencyId:"muni") {
    route(routeId:"1") {
      trip(startStopId:"14015", endStopId:"16304") {
        interval(dates:["2019-12-11"], startTime:"08:00", endTime:"20:00") {
          waitTimes {
            min avg median max
          }
          tripTimes {
            min avg median max std
            histogram(binSize:10) { count binStart binEnd }
          }
          headways {
            min avg median max
            percentiles(percentiles:[10,90]) { percentile value }
          }
        }
      }
    }
  }
}
```

Response:

```
{
  "data": {
    "agency": {
      "route": {
        "trip": {
          "interval": {
            "waitTimes": {
              "min": 0,
              "avg": 2.724,
              "median": 2.209,
              "max": 12.317
            },
            "tripTimes": {
              "min": 9.767,
              "avg": 13.315,
              "median": 13.083,
              "max": 19.583,
              "std": 1.822,
              "histogram": [
                {
                  "count": 2,
                  "binStart": 0,
                  "binEnd": 10
                },
                {
                  "count": 154,
                  "binStart": 10,
                  "binEnd": 20
                }
              ]
            },
            "headways": {
              "min": 0,
              "avg": 2.324,
              "median": 0.717,
              "max": 12.317,
              "percentiles": [
                {
                  "percentile": 10,
                  "value": 0.167
                },
                {
                  "percentile": 90,
                  "value": 5.817
                }
              ]
            }
          }
        }
      }
    }
  }
}
```

### Return metrics data for multiple time intervals in one day

```graphql
query {
  agency(agencyId:"muni") {
    route(routeId:"1") {
      trip(startStopId:"14015", endStopId:"16304") {
        timeRanges(dates:["2019-12-11"]) {
          startTime
          endTime
          waitTimes {
            median max
          }
          tripTimes {
            median max
          }
        }
      }
    }
  }
}
```

Response:

```
{
  "data": {
    "agency": {
      "route": {
        "trip": {
          "timeRanges": [
            {
              "startTime": "03:00",
              "endTime": "07:00",
              "waitTimes": {
                "median": 9.318,
                "max": 28.417
              },
              "tripTimes": {
                "median": 10.733,
                "max": 11.633
              }
            },
            {
              "startTime": "07:00",
              "endTime": "10:00",
              "waitTimes": {
                "median": 2.092,
                "max": 9.45
              },
              "tripTimes": {
                "median": 12.125,
                "max": 17.067
              }
            },
            {
              "startTime": "10:00",
              "endTime": "16:00",
              "waitTimes": {
                "median": 2.383,
                "max": 12.317
              },
              "tripTimes": {
                "median": 13.017,
                "max": 17.833
              }
            },
            {
              "startTime": "16:00",
              "endTime": "19:00",
              "waitTimes": {
                "median": 1.88,
                "max": 10.95
              },
              "tripTimes": {
                "median": 13.367,
                "max": 18.083
              }
            },
            {
              "startTime": "19:00",
              "endTime": "03:00+1",
              "waitTimes": {
                "median": 6.864,
                "max": 21.9
              },
              "tripTimes": {
                "median": 13.233,
                "max": 19.583
              }
            }
          ]
        }
      }
    }
  }
}
```

### Return metrics data for range of dates

```graphql
query {
  agency(agencyId:"muni") {
    route(routeId:"1") {
      trip(startStopId:"13547", endStopId:"13549" directionId:"0") {
        byDay(startTime:"03:00", endTime:"07:00", dates:["2019-12-10","2019-12-11"]) {
          dates
          startTime
          endTime
          tripTimes {
            percentiles(percentiles:[90]) {
              percentile
              value
            }
          }
          waitTimes {
            median
          }
        }
      }
    }
  }
}
```

Response:

```
{
  "data": {
    "agency": {
      "route": {
        "trip": {
          "byDay": [
            {
              "dates": [
                "2019-12-10"
              ],
              "startTime": "03:00",
              "endTime": "07:00",
              "tripTimes": {
                "percentiles": [
                  {
                    "percentile": 90,
                    "value": 0.467
                  }
                ]
              },
              "waitTimes": {
                "median": 5.374
              }
            },
            {
              "dates": [
                "2019-12-11"
              ],
              "startTime": "03:00",
              "endTime": "07:00",
              "tripTimes": {
                "percentiles": [
                  {
                    "percentile": 90,
                    "value": 0.483
                  }
                ]
              },
              "waitTimes": {
                "median": 5.34
              }
            }
          ]
        }
      }
    }
  }
}
```

### Returning statistics for multiple sets of parameters in a single query

You can create aliases of any property in order to return data e.g. multiple pairs of stops, multiple date ranges in a single GraphQL query. You can also create reusable fragments to reduce duplication in queries:

```graphql
fragment intervalFields on TripIntervalMetrics {
   waitTimes { median }
}
query {
  agency(agencyId:"muni") {
    route(routeId:"1") {
      trip1: trip(startStopId:"14015", endStopId:"16304") {
        allDay: interval(dates:["2019-12-11"]) {
          ...intervalFields
        }
        morning: interval(dates:["2019-12-11"], startTime:"06:00", endTime:"10:00") {
          ...intervalFields
        }
      }
      trip2: trip(startStopId:"16307", endStopId:"16311") {
        allDay: interval(dates:["2019-12-11"]) {
          ...intervalFields
        }
        morning: interval(dates:["2019-12-11"], startTime:"06:00", endTime:"10:00") {
          ...intervalFields
        }
      }
    }
  }
}
```

Response:

```
{
  "data": {
    "agency": {
      "route": {
        "trip1": {
          "allDay": {
            "waitTimes": {
              "median": 3.194
            }
          },
          "morning": {
            "waitTimes": {
              "median": 2.763
            }
          }
        },
        "trip2": {
          "allDay": {
            "waitTimes": {
              "median": 3.641
            }
          },
          "morning": {
            "waitTimes": {
              "median": 3.372
            }
          }
        }
      }
    }
  }
}
```

# Structure of the Backend API

Complex objects contain fields that are themselves complex objects or are primitive types (`String`, `Int` or `Float`). `String!` denotes a required parameter field, and `[String]` denotes a list of `String` objects.

### Query

The root query object for the API.

| Field Name | Type | Description |
| --- | --- | --- |
| `agency` | [`AgencyMetrics`](#agencymetrics) | Returns metrics for a particular transit agency. |

#### Parameters for `agency`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `agencyId` | `String!` | ID of the transit agency to return metrics for. |

### AgencyMetrics

Metrics for a particular transit agency.

| Field Name | Type | Description |
| --- | --- | --- |
| `agencyId` | `String` | ID of the transit agency. |
| `route` | [`RouteMetrics`](#routemetrics) | Returns metrics for a particular route in this transit agency. |
| `interval` | [`AgencyIntervalMetrics`](#agencyintervalmetrics) | Returns high-level statistics for all routes in this transit agency over a given time interval. |

#### Parameters for `route`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `routeId` | `String!` | ID of the route to return metrics data for. |

#### Parameters for `interval`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]!` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format with an optional suffix "+1" to indicate times after midnight that are associated with the previous day;  e.g. `00:00`, `23:59`, `03:00+1`. |
| `endTime` | `String` | End time for each date to return metrics data from. |

### AgencyIntervalMetrics

| Field Name | Type | Description |
| --- | --- | --- |
| `routes` | [`[RouteIntervalMetrics]`](#routeintervalmetrics) | High-level statistics for each route in this agency. |

### RouteIntervalMetrics

| Field Name | Type | Description |
| --- | --- | --- |
| `routeId` | `String` | ID of the route. |
| `directions` | [`[DirectionIntervalMetrics]`](#directionintervalmetrics) | High-level statistics for each direction on this route. |

### DirectionIntervalMetrics

| Field Name | Type | Description |
| --- | --- | --- |
| `directionId` | `String` | ID of the direction. |
| `medianWaitTime` | `Float` | Median wait time for the median stop on this direction for the given interval, in minutes. |
| `averageSpeed` | `Float` | Average speed corresponding to the the median end-to-end trip time for this direction for the given interval. |
| `travelTimeVariability` | `Float` | Difference between 90th percentile end-to-end trip time and 10th percentile end-to-end trip time, in minutes. |
| `onTimeRate` | `Float` | Fraction of scheduled trips for the median stop for which a vehicle departed within a specified interval of the scheduled departure time. |
| `numCompletedTrips` | `Float` | Total number of completed trips for this direction in the given interval. |
| `segments` | [`[SegmentIntervalMetrics]`](#segmentintervalmetrics) | Contains metrics data for each pair of adjacent stops in this direction for the given time interval. |
| `cumulativeSegments` | [`[SegmentIntervalMetrics]`](#segmentintervalmetrics) | Contains metrics data between the first stop in this direction and each subsequent stop on the route for the given time interval. For some routes, the "first" stop may another stop near the beginning of the route with more representative data than the actual first stop. |

Note: If the interval spans multiple dates, the `medianWaitTime`, `averageSpeed`, `travelTimeVariability`, and `onTimeRate` stats are the median of the statistics for each date.

#### Parameters for `averageSpeed`

| Parameter Name | Type | Default | Description |
| --- | --- | --- | --- |
| `units` | `String!` | mph | Units for speed (km/h or mph). |

### SegmentIntervalMetrics

Contains metrics for a pair of stops in one direction of a route for a particular time interval.

| Field Name | Type | Description |
| --- | --- | --- |
| `fromStopId` | `String` | ID of the origin stop. |
| `toStopId` | `String` | ID of the destination stop. |
| `medianTripTime` | `Float` | Median travel time in minutes between the two stops. If the interval spans multiple days, this is the median of the median travel times for each day. |
| `numTrips` | `Int` | Total number of completed trips between the two stops. |

### RouteMetrics

Allows querying metrics data for a stop (or a pair of stops) on one route.

| Field Name | Type | Description |
| --- | --- | --- |
| `trip` | [`TripMetrics`](#tripmetrics) | Contains data for trips starting at stop `startStopId` and ending at stop `endStopId`. |
| `interval` | [`RouteIntervalMetrics`](#routeintervalmetrics) | Contains metrics data for this route for a given time interval. |

#### Parameters for `trip`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `startStopId` | `String!` | The first stop to return metrics data from. For trip time metrics, return metrics data from trips starting at this stop. |
| `endStopId` | `String` | Only used for trip time metrics. Return metrics data from trips ending at this stop. |
| `directionId` | `String` | ID of the direction to return metrics data from. |

#### Parameters for `interval`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format with an optional suffix "+1" to indicate times after midnight that are associated with the previous day;  e.g. `00:00`, `23:59`, `03:00+1`. |
| `endTime` | `String` | End time for each date to return metrics data from. |

### TripMetrics

Given a stop or pair of stops, allows querying metrics data for a date/time range.

| Field Name | Type | Description |
| --- | --- | --- |
| `interval` | [`TripIntervalMetrics`](#tripintervalmetrics) | Contains metrics data for a given time interval. |
| `timeRanges` | [`[TripIntervalMetrics]`](#tripintervalmetrics) | Returns metrics data for multiple time ranges on the given days. |
| `byDay` | [`[TripIntervalMetrics]`](#tripintervalmetrics) | Returns metrics data for multiple dates at the given start and end time. |

#### Parameters for `interval`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format with an optional suffix "+1" to indicate times after midnight that are associated with the previous day;  e.g. `00:00`, `23:59`, `03:00+1`. |
| `endTime` | `String` | End time for each date to return metrics data from. |

#### Parameters for `timeRanges`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |

#### Parameters for `byDay`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format with an optional suffix "+1" to indicate times after midnight that are associated with the previous day;  e.g. `00:00`, `23:59`, `03:00+1`. |
| `endTime` | `String` | End time for each date to return metrics data from. |

### TripIntervalMetrics

Contains metrics data for a particular pair of stops on a single route in a particular time range.

| Field Name | Type | Description |
| --- | --- | --- |
| `startTime` | `String` | Start time of interval. |
| `endTime` | `String` | End time of interval. |
| `waitTimes` | [`WaitTimeStats`](#waittimestats) | Contains metrics for actual wait times at the start stop (in minutes). |
| `scheduledWaitTimes` | [`WaitTimeStats`](#waittimestats) | Contains metrics for scheduled wait times at the start stop (in minutes). |
| `headways` | [`BasicStats`](#basicstats) | Contains metrics for actual departure time headways at the start stop (in minutes). |
| `scheduledHeadways` | [`BasicStats`](#basicstats) | Contains metrics for scheduled departure time headways at the start stop (in minutes). |
| `tripTimes` | [`BasicStats`](#basicstats) | Contains metrics for actual trip times from the start stop to the end stop (in minutes). Will be null if `endStopId` isn't given. |
| `scheduledTripTimes` | [`BasicStats`](#basicstats) | Contains metrics for scheduled trip times from the start stop to the end stop (in minutes). Will be null if `endStopId` isn't given. |
| `departures` | `Int` | The number of actual departures from the start stop. |
| `scheduledDepartures` | `Int` | The number of scheduled departures from the start stop. |
| `arrivals` | `Int` | The number of actual arrivals at the end stop. Will be null if `endStopId` isn't given. |
| `scheduledArrivals` | `Int` | The number of scheduled arrivals at the end stop. Will be null if `endStopId` isn't given. |
| `departureScheduleAdherence` | [`ScheduleAdherence`](#scheduleadherence) | Contains metrics for schedule adherence, comparing the scheduled departure times at the start stop with the actual departure times. |
| `arrivalScheduleAdherence` | [`ScheduleAdherence`](#scheduleadherence) | Contains metrics for schedule adherence, comparing the scheduled arrival times at the end stop with the actual arrival times. |
| `headwayScheduleDeltas` | [`BasicStats`](#basicstats) | Contains metrics for the difference between the actual headway and the scheduled headway (in minutes). |

#### Parameters for `departureScheduleAdherence` and `arrivalScheduleAdherence`

| Parameter Name | Type | Description | Default Value |
| --- | --- | --- | --- |
| `earlySec` | `Int` | The maximum number of seconds before the scheduled time that is still considered "on time. | 60 |
| `lateSec` | `Int` | The maximum number of seconds after the scheduled time that is still considered "on time". | 300 |

### ScheduleAdherence

Contains metrics data that shows how well the actual arrival or departure times matched the schedule.

| Field Name | Type | Description |
| --- | --- | --- |
| `onTimeCount` | `Int` | The number of scheduled arrival or departure times that matched at least one actual time within the "on time" interval (defined by earlySec and lateSec). |
| `lateCount` | `Int` | The number of scheduled arrivals or departure times that matched at least one actual time after the "on time" interval. |
| `earlyCount` | `Int` | The number of scheduled arrival or departure times that matched at least one actual time before the "on time" interval. |
| `missingCount` | `Int` | The number of scheduled arrival or departure times that did not match any actual times. (A "missing" time may indicate that the scheduled service did not occur, or it could have been so early/late that it was closer to another scheduled time, which may have matched a different actual time.) |
| `scheduledCount` | `Int` | The total number of scheduled arrival/departure times. This should be used as the denominator when computing the rate of on-time/late/early/missing arrivals. |
| `closestDeltas` | [`BasicStats`](#basicstats) | Contains metrics for the difference between the closest actual time and the scheduled time (in minutes), for each scheduled time. Positive values indicate that the actual arrival or departure occurred after the scheduled time. (Each scheduled time is counted once, although the closest deltas for different scheduled times may correspond to the same actual arrival/departure time.) |

### WaitTimeStats

Contains statistics about wait times at a stop within one or more intervals.
For each interval, these statistics are computed assuming that a rider has an equal probability of arriving at the stop any time in that interval,
but not before the first departure of the day or after the last departure of the day.
If statistics are computed over multiple intervals, each interval will be weighted equally (not weighted by the length of the interval).
These statistics assume that the rider arrives at the stop at a "random" time without using schedules or predictions.

| Field Name | Type | Description |
| --- | --- | --- |
| `avg` | `Float` | The average wait time. |
| `min` | `Float` | The minimum wait time (will be 0 if there are any arrivals in the interval). |
| `median` | `Float` | The median wait time. |
| `max` | `Float` | The maximum wait time. |
| `percentiles` | [`[PercentileData]`](#percentiledata) | Data for percentile values of wait times. |
| `histogram` | [`[HistogramBin]`](#histogrambin) | Data for rendering histograms on the frontend. |

#### Parameters for `percentiles`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `percentiles` | `[Float]` | List of percentiles to return. |

#### Parameters for `histogram`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `min` | `Float` | Start of first histogram bin. |
| `max` | `Float` | End of last histogram bin. |
| `binSize` | `Float` | Size of histogram bins. |

### BasicStats

Contains summary statistics for a single metric.

| Field Name | Type | Description |
| --- | --- | --- |
| `count` | `Int` | The number of observations in the interval. |
| `avg` | `Float` | The average of the computed metric. |
| `min` | `Float` | The minimum value of the computed metric. |
| `median` | `Float` | The median value of the computed metric. |
| `max` | `Float` | The maximum value of the computed metric. |
| `std` | `Float` | The standard deviation of the computed metric. |
| `percentiles` | [`[PercentileData]`](#percentiledata) | Data for percentile values of the computed metric. |
| `histogram` | [`[HistogramBin]`](#histogrambin) | Data for rendering histograms on the frontend. |

#### Parameters for `percentiles`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `percentiles` | `[Float]` | List of percentiles to return. |

#### Parameters for `histogram`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `min` | `Float` | Start of first histogram bin. |
| `max` | `Float` | End of last histogram bin. |
| `binSize` | `Float` | Size of histogram bins. |

### PercentileData

Contains data for a single percentile value.

| Field Name | Type | Description |
| --- | --- | --- |
| `percentile` | `Int` | The percentile. |
| `value` | `Float` | The value of the percentile. |

### HistogramBin

Contains data for a single bin for the histogram.

| Field Name | Type | Description |
| --- | --- | --- |
| `count` | `Int` | Number of data points in the bin. |
| `binStart` | `Float` | Lower bound for the bin. |
| `binEnd` | `Float` | Upper bound for the bin. |
