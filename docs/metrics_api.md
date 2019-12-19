# Backend API Documentation

The backend API uses GraphQL. There is one endpoint, `/api/graphql`, that accepts a query string containing the necessary parameters for the query and the fields to be returned in the response.

The GraphQL API is available publicly at https://muni.opentransit.city/api/graphql . (In a development environment, the URL is http://localhost:5000/api/graphql .) This endpoint can be called via either GET or POST. When making a GET request, the GraphQL query should be passed as a URL-encoded parameter named `query`. Variables may optionally be passed as a URL-encoded JSON-encoded object in a parameter named `variables`.

For example, the following GraphQL query would return some statistics about headways and wait times for a particular stop on one day:

```
query($agencyId: String!, $routeId:String!, $startStopId:String!, $date:String) {
  routeMetrics(agencyId:$agencyId, routeId:$routeId) {
    trip(startStopId:$startStopId) {
      interval(dates:[$date]) {
        headways { median max }
        waitTimes { median }
      }
    }
  }
}
```

To run the above query with the variables `$routeId` = "1", `$startStopId` = "16307", and `$date` = "2019-12-10", you can make a GET request to the URL below:

http://muni.opentransit.city/api/graphql?query=query(%24agencyId%3AString!%2C+%24routeId%3AString!%2C+%24startStopId%3AString!%2C+%24date%3AString)+%7B+routeMetrics(agencyId%3A%24agencyId%2C+routeId%3A%24routeId)+%7B+trip(startStopId%3A%24startStopId)+%7B+interval(dates%3A%5B%24date%5D)+%7B+headways+%7B+median+max+%7D+waitTimes+%7B+median+%7D+%7D+%7D+%7D+%7D&variables=%7B"agencyId":"muni","routeId":"1","startStopId":"16307","date":"2019-12-10"%7D

Queries can also be sent via POST, with the Content-Type `application/json`, and a request body like this:

```
{
  "query": "...",
  "variables": { "myVariable": "someValue", ... }
}
```

For more information about calling GraphQL APIs over HTTP, see https://graphql.org/learn/serving-over-http/ . For more information about GraphQL in general, see https://graphql.org/learn/ .

# Structure of a GraphQL Query

OpenTransit's data is organized as a nested structure of objects. Each object represents a subset of the data (data about a route, data about a stop, data about bus arrivals, etc). This data is divided into fields, which are either other objects or primitive types (the relevant primitive types for this API are `String`, `Int` and `Float`). For instance, to fetch information about every route, we would start by querying `routes`, which returns a `[RouteInfo]`, a list of routes.

RouteInfo has the following properties:
```
id: String
title: String
config: RouteConfig
```

The structure of a GraphQL query reflects this nested structure - in a query, the client must specify which fields it wants the server to return in the response. Nested fields are contained in nested brackets - for instance, the query:

```graphql
query {
  routes(agencyId:"muni") {
    id
    title
  }
}
```

returns only the `id` and `title` of every route, but not the `config` property:

```
{
  "data": {
    "routes": [
      {
        "id": "E",
        "title": "E-Embarcadero"
      },
      {
        "id": "F",
        "title": "F-Market & Wharves"
      },
      {
        "id": "J",
        "title": "J-Church"
      },
      ...
```

Note that all the innermost elements of the query have to be primitive types. Since RouteConfig is not a primitive type, the query

```graphql
query {
  routes(agencyId:"muni") {
    id
    title
    config
  }
}
```

will return an error. This query **doesn't** work because it isn't requesting any fields from `config` that are primitive types. But the query

```graphql
query {
  routes(agencyId:"muni") {
    id
    title
    config {
      stops { id title lat lon }
      directions { id stopIds }
    }
  }
}
```

**does** work, since `title`, `lat`, `lon`, `stopIds`, etc. are all primitive types:

```
{
  "data": {
    "routes": [
      {
        "id": "E",
        "title": "E-Embarcadero",
        "config": {
          "stops": [
            {
              "id": "15184",
              "title": "Jones St & Beach St",
              "lat": 37.80713,
              "lon": -122.41732
            },
            {
              "id": "13092",
              "title": "Beach St & Mason St",
              "lat": 37.80741,
              "lon": -122.41412
            },
            {
              "id": "13095",
              "title": "Beach St & Stockton St",
              "lat": 37.80784,
              "lon": -122.41081
            },
            ...
```

### Parameters in Queries

Querying information about a particular route or stop requires input parameters. For instance, to fetch the summary statistics for wait times at stop `14015` on route `1` on the date `2019-12-11`, the query would need to pass in `routeId`, `startStopId` and `dates` parameters:

```graphql
query {
  routeMetrics(agencyId:"muni",routeId:"1") {
    trip(startStopId:"14015") {
      interval(dates:["2019-12-11"]) {
        waitTimes {
          avg median max
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
    "routeMetrics": {
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
```

A list of parameters for the `routeConfig` and `routeMetrics` fields is given [below](#query).

# Example Queries

### Return configuration of all routes

```graphql
query {
  routes(agencyId:"muni") {
    id
    title
    config {
      directions { id title stopIds }
      stops { id title lat lon }
    }
  }
}
```

Response:

```
{
  "data": {
    "routes": [
      {
        "id": "E",
        "title": "E-Embarcadero",
        "config": {
          "directions": [
            {
              "id": "0",
              "title": "Outbound to King St & 4th St",
              "stopIds": [
                "15184",
                "13092",
                "13095",
                "14502",
                "14529",
            ...
```

### Return configuration for one route

```graphql
query {
  routeConfig(agencyId:"muni", routeId:"12") {
    id
    title
    directions { id title stopIds }
    stops { id title lat lon }
  }
}
```

Response:

```
{
  "data": {
    "routeConfig": {
      "id": "12",
      "title": "12-Folsom-Pacific",
      "directions": [
        {
          "id": "0",
          "title": "Outbound to 24th St & Mission St",
          "stopIds": [
            "17941",
            "15859",
            "15851",
            "15844",
            "15839",
            ...
```

### Return metrics data for a pair of stops on a route

```graphql
query {
  routeMetrics(agencyId:"muni", routeId:"1") {
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
```

Response:

```
{
  "data": {
    "routeMetrics": {
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
            "avg": 13.275,
            "median": 13.067,
            "max": 18.367,
            "std": 1.757,
            "histogram": [
              {
                "count": 2,
                "binStart": 0,
                "binEnd": 10
              },
              {
                "count": 153,
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
```

### Return metrics data for multiple time intervals in one day

```graphql
query {
  routeMetrics(agencyId:"muni", routeId:"1") {
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
```

Response:

```
{
  "data": {
    "routeMetrics": {
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
              "median": 13.15,
              "max": 18.367
            }
          }
        ]
      }
    }
  }
}
```

### Return metrics data for range of dates

```graphql
query {
  routeMetrics(routeId:"1", agencyId:"muni") {
    trip(startStopId:"13547", endStopId:"13549" directionId:"0") {
      byDay(startTime:"03:00", endTime:"07:00", dates:["2019-12-10","2019-12-11"]) {
        dates
        startTime
        endTime
        tripTimes {
          percentile(percentile:90)
        }
        waitTimes {
          median
          probabilityLessThan(minutes:5)
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
    "routeMetrics": {
      "trip": {
        "byDay": [
          {
            "dates": [
              "2019-12-10"
            ],
            "startTime": "03:00",
            "endTime": "07:00",
            "tripTimes": {
              "percentile": 0.5
            },
            "waitTimes": {
              "median": 5.3,
              "probabilityLessThan": 0.48
            }
          },
          {
            "dates": [
              "2019-12-11"
            ],
            "startTime": "03:00",
            "endTime": "07:00",
            "tripTimes": {
              "percentile": 0.5
            },
            "waitTimes": {
              "median": 5.4,
              "probabilityLessThan": 0.47
            }
          }
        ]
      }
    }
  }
}
```

### Returning statistics for multiple sets of parameters in a single query

You can create aliases of any property in order to return data e.g. multiple pairs of stops, multiple date ranges in a single GraphQL query. You can also create reusable fragments to reduce duplication in queries:

```graphql
fragment intervalFields on IntervalMetrics {
   waitTimes { median }
}
query {
  routeMetrics(agencyId:"muni", routeId:"1") {
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
```

Response:

```
{
  "data": {
    "routeMetrics": {
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
```

# Structure of the Backend API

Complex objects contain fields that are themselves complex objects or are primitive types (`String`, `Int` or `Float`). `String!` denotes a required parameter field, and `[String]` denotes a list of `String` objects.

### Query

The root query object for the API. The `routeConfig` and `routeMetrics` fields require input parameters.

| Field Name | Type | Description |
| --- | --- | --- |
| `routes` | [`[RouteInfo]`](#routeinfo) | Returns data about every route. |
| `routeConfig` | [`RouteConfig`](#routeconfig) | Returns data for a particular route. |
| `routeMetrics` | [`RouteMetrics`](#routemetrics) | Returns metrics data for a particular route.

#### Parameters for `routes`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `agencyId` | `String!` | ID of the transit agency to return routes from. |

#### Parameters for `routeConfig`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `agencyId` | `String!` | ID of the transit agency associated with this route. |
| `routeId` | `String!` | ID of the route to return data from. |

#### Parameters for `routeMetrics`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `agencyId` | `String!` | ID of the transit agency to return metrics data from. |
| `routeId` | `String!` | ID of the route to return metrics data from. |

### RouteInfo

Contains basic data about a route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the route. |
| `title` | `String` | Title of the route. |
| `config` | [`[RouteConfig]`](#routeconfig) | Current configuration of the route. |

### RouteConfig

Contains detailed configuration about a single route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the route. |
| `title` | `String` | Title of the route. |
| `directions` | [`[DirectionInfo]`](#directioninfo) | List of directions on the route. |
| `stops` | [`[StopInfo]`](#stopinfo) | List of stops on the route (in any direction). |

### DirectionInfo

Contains data about a direction on a route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the direction. |
| `title` | `String` | Title of the direction (`Outbound to Mission Bay`). |
| `name` | `String` | Name of the direction (`Inbound` or `Outbound`). |
| `stopIds` | `[String]` | List of IDs for stops on the route. |

### StopInfo

Contains information about one stop.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | Title of the stop. |
| `title` | `String` | Title of the stop. |
| `lat` | `Float` | Latitude of the stop. |
| `lon` | `Float` | Longitude of the stop. |

### RouteMetrics

Allows querying metrics data for a stop (or a pair of stops) on one route.

| Field Name | Type | Description |
| --- | --- | --- |
| `trip` | [`TripMetrics`](#tripmetrics) | Contains data for trips starting at stop `startStopId` and ending at stop `endStopId`. |

#### Parameters for `trip`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `startStopId` | `String!` | The first stop to return metrics data from. For trip time metrics, return metrics data from trips starting at this stop. |
| `endStopId` | `String` | Only used for trip time metrics. Return metrics data from trips ending at this stop. |
| `directionId` | `String` | ID of the direction to return metrics data from. |

### TripMetrics

Given a stop or pair of stops, allows querying metrics data for a date/time range

| Field Name | Type | Description |
| --- | --- | --- |
| `interval` | [`IntervalMetrics`](#intervalmetrics) | Contains metrics data for a given time interval. |
| `timeRanges` | [`[IntervalMetrics]`](#intervalmetrics) | Returns metrics data for multiple time ranges on the given days. |
| `byDay` | [`[BasicIntervalMetrics]`](#basicIntervalmetrics) | Returns metrics data for multiple dates at the given start and end time. |

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

### IntervalMetrics

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

### BasicIntervalMetrics

Contains metrics data at a particular pair of stops on a single route at a particular time range and list of dates.

| Field Name | Type | Description |
| --- | --- | --- |
| `dates` | `[String]` | List of dates to return metrics data from. Dates use `MMMM-DD-YY` format.  |
| `startTime` | `String` | Start time of interval. |
| `endTime` | `String` | End time of interval. |
| `waitTimes` | [`BasicWaitTimeStats`](#basicwaittimestats) | Contains metrics data for wait times. |
| `tripTimes` | [`BasicTripTimeStats`](#basictriptimestats) | Contains metrics data for trip times. |

### BasicWaitTimeStats

Contains summary statistics for a single metric for wait times on a certain date, start time, and stop time.

| Field Name | Type | Description |
| --- | --- | --- |
| `median` | `Float` | The median value of the wait time. |
| `percentile` | `Float` | Percentile value of the trip time. Currently percentile one of: 10, 50, or 90. |
| `probabilityLessThan` | `Float` | Data for probability wait time will be less than passed minute value. Currently minutes one of: 5, 10, 15, 20, 25, 30. |

#### Parameters for `percentiles`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `percentiles` | `[Float]` | List of percentiles to return. |

#### Parameters for `probabilityLessThan`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `minutes` | `Int` | The minute value, gives cumulative probability from 0 to minute. |

### BasicTripTimeStats

Contains summary statistics for a single metric for trip times on a certain date, start time, and stop time.

| Field Name | Type | Description |
| --- | --- | --- |
| `median` | `Float` | The median value of the trip time. |
| `percentile` | `Float` | Percentile value of the trip time. Currently percentile one of: 10, 50, or 90. |

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

### ComparisonStats

Contains metrics data for comparisons between scheduled arrivals and arrival data.

| Field Name | Type | Description |
| --- | --- | --- |
| `closestDeltaStats` | [`[BasicStats]`](#basicstats) | Metrics data for differences between each arrival and the closest scheduled arrival. |
| `nextDeltaStats` | [`[BasicStats]`](#basicstats) | Metrics data for differences between each arrival and the next scheduled arrival (closest scheduled arrival that occurs after the actual arrival). |
