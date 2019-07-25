# Backend API Documentation

The backend API uses graphQL. There is one endpoint, `/metrics_api`, that accepts a query string containing the necessary parameters for the query and the fields to be returned in the response. 

# Structure of a graphQL Query 

OpenTransit's data is organized as a nested structure of objects. Each object represents a subset of the data (data about a route, data about a stop, data about bus arrivals, etc). This data is divided into fields, which are either other objects or primitive types (the relevant primitive types for this API are `String`, `Int` and `Float`). For instance, to fetch information about every route, we would start by querying `routes`, which is a [`RouteList`](#routelist), an object that contains information about each route:

```py
class RouteList(ObjectType):
    routeInfos = List(RouteInfo)
```

[`RouteList`](#routelist) has one field, `routeInfos`, which is a list of [`RouteInfo`](#routeinfo) objects:

```py
class RouteInfo(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopDictionary)
```

`id` is a string that contains the route's ID, `title` is a string containing the route's title, and `directions` and `stops` are lists of [`DirectionInfo`](#directioninfo) and [`StopDictionary`](#stopdictionary) objects, which contain information about the route's directions and its stops, respectively.

The structure of a graphQL query reflects this nested structure - in a query, the client must specify which fields it wants the server to return in the response. Nested fields are contained in nested brackets - for instance, the query

```graphql
{
  routes {
    routeInfos {
      id
      title
    }
  }
}
```

returns only the `id` and `title` of every route:

```graphql
{
  "data": {
    "routes": {
      "routeInfos": [
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

Note that all the innermost elements of the query have to be primitive types. The query

```graphql
{
  routes {
    routeInfos {
      id
      title
      directions {
        id
      }
      stops {
        key
        value {}
      }
    }
  }
}
```

returns the following error:

```graphql
{
  "errors": [
    {
      "message": "Syntax Error GraphQL (11:16) Expected Name, found }\n\n10:         key\n11:         value {}\n                   ^\n12:       }\n",
      "locations": [
        {
          "line": 11,
          "column": 16
        }
      ]
    }
  ]
}
```

This query **doesn't** work because the it isn't requesting any fields from `value` that are primitive types. But the query

```graphql
{
  routes {
    routeInfos {
      id
      title
      directions {
        id
      } 
      stops {
        key
        value {
          title
          lat
          lon
        }
      }
    }
  }
}
```

**does** work, since `title`, `lat` and `lon` are all primitive types:

```graphql
{
  "data": {
    "routes": {
      "routeInfos": [
        {
          "id": "E",
          "title": "E-Embarcadero",
          "directions": [
            {
              "id": "E____O_F00"
            },
            {
              "id": "E____I_F00"
            }
          ],
          "stops": [
            {
              "key": 5184,
              "value": {
                "title": "Jones St & Beach St",
                "lat": 37.8071299,
                "lon": -122.41732
              }
            },
            {
              "key": 3092,
              "value": {
                "title": "Beach St & Mason St",
                "lat": 37.8074099,
                "lon": -122.41412
              }
            },
            ...
```

### Parameters in Queries

Querying information about a particular route or stop requires input parameters. For instance, to fetch the summary statistics for wait times at stop `3476` on route `12` on the date `2019-06-06`, the query would need to pass in `routeId`, `startStopId` and `date` parameters:

```graphql
{
  routeMetrics (routeId: "12", startStopId: "3476", date: "2019-06-06") {
    metrics {
      waitTimes {
        intervals {
          stats {
            count
            avg
            min
            median
            max
          }
        }
      }
    }
  }
}
```

This query returns the following response:

```graphql
{
  "data": {
    "routeMetrics": {
      "metrics": {
        "waitTimes": {
          "intervals": [
            {
              "stats": {
                "count": 100,
                "avg": 13.143,
                "min": 0.0,
                "median": 11.504,
                "max": 37.533
              }
            },
            {
              "stats": {
                "count": 100,
                "avg": 9.251,
                "min": 0.0,
                "median": 8.5,
                "max": 26.117
              }
            },
            ...
```

A list of parameters for the `routeInfo` and `routeMetrics` fields is given [below](#query).

# Example Queries

Each of these queries returns the same data as a particular endpoint from the old REST API.

### Return information for all routes

Equivalent to a call to `/api/routes`.

```graphql
{
  routes {
    routeInfos {
      id
      title
      directions {
        id
        title
        name
        stops
      }
      stops {
        key
        value {
          title
          lat 
          lon
        }
      }
    }
  }
}
```

Response: 

```graphql
{
  "data": {
    "routes": {
      "routeInfos": [
        {
          "id": "E",
          "title": "E-Embarcadero",
          "directions": [
            {
              "id": "E____O_F00",
              "title": "Outbound to Mission Bay",
              "name": "Outbound",
              "stops": [
                "5184",
                "3092",
                ...
                "5241"
              ]
            },
            {
              "id": "E____I_F00",
              "title": "Inbound to Fisherman's Wharf",
              "name": "Inbound",
              "stops": [
                "5240",
                "5237",
                ...
                "35184"
              ]
            }
          ],
          "stops": [
            {
              "key": 5184,
              "value": {
                "title": "Jones St & Beach St",
                "lat": 37.8071299,
                "lon": -122.41732
              }
            },
            {
              "key": 3092,
              "value": {
                "title": "Beach St & Mason St",
                "lat": 37.8074099,
                "lon": -122.41412
              }
            },
            ...
```

### Return information for one route

Equivalent to a call to `/api/route`.

```graphql
{
  routeInfo(routeId: "12") {
    id
    title
    directions {
      id
      title
      name
      stops
    }
    stops {
      key
      value {
        title
        lat
        lon
      }
    }
  }
}
```

Response: 

```graphql
{
  "data": {
    "routeInfo": {
      "id": "12",
      "title": "12-Folsom-Pacific",
      "directions": [
        {
          "id": "12___O_F00",
          "title": "Outbound to Mission District",
          "name": "Outbound",
          "stops": [
            "7941",
            "5859",
            ...
            "33476"
          ]
        },
        {
          "id": "12___I_F00",
          "title": "Inbound to Van Ness Avenue",
          "name": "Inbound",
          "stops": [
            "3476",
            "6877",
            ...
            "37941"
          ]
        }
      ],
      "stops": [
        {
          "key": 7941,
          "value": {
            "title": "Jackson St & Van Ness Av",
            "lat": 37.7939599,
            "lon": -122.42219
          }
        },
        {
          "key": 5859,
          "value": {
            "title": "Pacific Ave & Van Ness Ave",
            "lat": 37.79478,
            "lon": -122.4228999
          }
        },
        ...
```

### Return metrics data for a pair of stops on a route

Equivalent to a call to `/api/metrics-by-interval`.

```graphql
{
    routeMetrics(routeId: "12", startStopId: "3476", endStopId: "6877", date: "2019-06-06", directionId: "12___I_F00", startTime: "08:47:43", endTime: "23:26:33", intervalLengths: 3) {
      stopinfo {
        startStopTitle
        endStopTitle
      }
      metrics {
        waitTimes {
          intervals {
            intervalStart
            intervalEnd
            stats {
              count
              avg
              min
              median
              max
              percentiles {
                percentile
                value
              }
              histogram {
                value
                count
                binStart
                binEnd
              }
            }
          }
        }
        headways {
          intervals {
            intervalStart
            intervalEnd
            stats {
              count
              avg
              min
              median
              max
              percentiles {
                percentile
                value
              }
              histogram {
                value
                count
                binStart
                binEnd
              }
            }
          }
        }
        timetableHeadways {
          intervals {
            intervalStart
            intervalEnd
            stats {
              count
              avg
              min
              median
              max
              percentiles {
                percentile
                value
              }
              histogram {
                value
                count
                binStart
                binEnd
              }
            }
          }
        }
        timetableComparison {
          closestDeltaStats {
            intervalStart
            intervalEnd
            stats {
              count
              avg
              min
              median
              max
              percentiles {
                percentile
                value
              }
              histogram {
                value
                count
                binStart
                binEnd
              }
            }
          }
          nextDeltaStats{
            intervalStart
            intervalEnd
            stats {
              count
              avg
              min
              median
              max
              percentiles {
                percentile
                value
              }
              histogram {
                value
                count
                binStart
                binEnd
              }
            }
          }
        }
      }
    }
  }
```

Response:

```graphql
{
  "data": {
    "routeMetrics": {
      "stopinfo": {
        "startStopTitle": "24th St & Mission St",
        "endStopTitle": "Valencia St & 24th St"
      },
      "metrics": {
        "waitTimes": {
          "intervals": [
            {
              "intervalStart": "08:00:00",
              "intervalEnd": "11:00:00",
              "stats": {
                "count": 100,
                "avg": 8.676,
                "min": 0,
                "median": 8.118,
                "max": 24.883,
                "percentiles": [
                  {
                    "percentile": 0,
                    "value": 0
                  },
                  {
                    "percentile": 5,
                    "value": 0.755
                  },
                  ...
                  {
                    "percentile": 100,
                    "value": 24.883
                  }
                ],
                "histogram": [
                  {
                    "value": "0-5",
                    "count": 30,
                    "binStart": 0,
                    "binEnd": 5
                  },
                  {
                    "value": "5-10",
                    "count": 30,
                    "binStart": 5,
                    "binEnd": 10
                  },
                  ...
                  {
                    "value": "20-25",
                    "count": 4,
                    "binStart": 20,
                    "binEnd": 25
                  }
                ]
              }
            },
            ...
```

# Structure of the Backend API 

Complex objects contain fields that are themselves complex objects or are primitive types (`String`, `Int` or `Float`). `String!` denotes a required parameter field, and `[String]` denotes a list of `String` objects.

### Query

The root query object for the API. The `routeInfo` and `routeMetrics` fields require input parameters.

| Field Name | Type | Description |
| --- | --- | --- |
| `routes` | [`RouteList`](#routelist) | Returns data about every route. |
| `routeInfo` | [`RouteInfo`](#routeinfo) | Returns data for a particular route. |
| `routeMetrics` | [`RouteMetrics`](#routemetrics) | Returns metrics data for a stop (or pair of stops) on a single route.

#### Parameters for `routeInfo`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `routeId` | `String!` | ID of the route to return data from. |

#### Parameters for `routeMetrics`

| Parameter Name | Type | Description |
| --- | --- | --- |
| `routeId` | `String!` | ID of the route to return metrics data from. |
| `startStopId` | `String!` | The first stop to return metrics data from. For trip time metrics, return metrics data from trips starting at this stop. |
| `endStopId` | `String` | Only used for trip time metrics. Return metrics data from trips ending at this stop. |
| `date` | `String` | Single date to return metrics data from. Dates use `MMMM-DD-YY` format. Querying `RouteMetrics` requires either a `date` parameter or a `startDate` and `endDate` parameter. |
| `startDate` | `String` | Start date to return metrics data from. |
| `endDate` | `String` | End date to return metrics data from. |
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format. Valid times range between `00:00` and `23:59`. |
| `endTime` | `String` | End time for each date to return metrics data from. |
| `directionId` | `String` | ID of the direction to return metrics data from. |
| `intervalLengths` | `Int` | Option to aggregate arrival data over intervals of a fixed length before computing metrics data. This parameter gives the length of the interval, in hours. |

### RouteList

Contains data about every route.

| Field Name | Type | Description |
| --- | --- | --- |
| `routeInfos` | [`[RouteInfo]`](#routeinfo) | A list of [`RouteInfo`](#routeinfo) objects containing data about every route. |

### RouteInfo

Contains data about a single route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the route. |
| `title` | `String` | Title of the route. |
| `directions` | [`[DirectionInfo]`](#directioninfo) | List of directions on the route. |
| `stops` | [`[StopDictionary]`](#stopdictionary) | A list of data for every stop on the route, indexed by stop ID. |

### DirectionInfo

Contains data about a direction on a route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the direction. |
| `title` | `String` | Title of the direction (`Outbound to Mission Bay`). |
| `name` | `String` | Name of the direction (`Inbound` or `Outbound`). |
| `stops` | `[String]` | List of IDs for stops on the route. |

### StopDictionary

A key-value pair in the `stops` field of [`RouteInfo`](#routeinfo). Contains information about one stop.

| Field Name | Type | Description |
| --- | --- | --- |
| `key` | `Int` | The ID of the stop. Used to index the `stops` field in [`RouteInfo`](#routeinfo). |
| `value` | [`StopInfo`](#stopinfo) | Data about the stop. |

### StopInfo

Contains information about one stop.

| Field Name | Type | Description |
| --- | --- | --- |
| `title` | `String` | Title of the stop. |
| `lat` | `Float` | Latitude of the stop. |
| `lon` | `Float` | Longitude of the stop. |

### RouteMetrics

Contains metrics data for a stop (or a pair of stops) on one route on a particular date (or range of dates).

| Field Name | Type | Description |
| --- | --- | --- |
| `stopInfo` | [`MetricsStopInfo`](#metricsstopinfo) | Contains data for `startStopId` and `endStopId`. |
| `metrics` | [`StopMetrics`](#stopmetrics) | Contains metrics data. |

### MetricsStopInfo

Contains stop data for queries to [`RouteMetrics`](#routemetrics).

| Field Name | Type | Description |
| --- | --- | --- |
| `startStopTitle` | `String` | Title of the start stop. |
| `endStopTitle` | `String` | Title of the end stop. |

### StopMetrics

Contains metrics data for queries to [`RouteMetrics`](#routemetrics).

| Field Name | Type | Description |
| --- | --- | --- |
| `waitTimes` | [`MetricsStats`](#metricsstats) | Contains metrics data for wait times. |
| `headways` | [`MetricsStats`](#metricsstats) | Contains metrics data for headways. |
| `tripTimes` | [`MetricsStats`](#metricsstats) | Contains metrics data for trip times (will be `None` if `endStopId` isn't given). |
| `timetableHeadways` | [`MetricsStats`](#metricsstats) | Contains metrics data for timetable/scheduled headways. |
| `timetableComparison` | [`ComparisonStats`](#comparisonstats) | Contains metrics data for comparisons between scheduled arrivals and arrival data. |

### MetricsStats

Contains summary statistics for a single metric (wait times, headways, or trip times).

| Field Name | Type | Description |
| --- | --- | --- |
| `intervals` | [`[IntervalStats]`](#intervalstats) | A list of [`IntervalStats`](#intervalstats) objects containing summary statistics for arrivals aggregated into the intervals specified by `intervalLengths`. |

### IntervalStats

Contains summary statistics for a single metric from arrivals aggregated over a fixed time interval.

| Field Name | Type | Description |
| --- | --- | --- |
| `intervalStart` | `String` | The start of the interval. Times use `HH:MM` format. |
| `intervalEnd` | `String` | The end of the interval. |
| `stats` | [`ArrayStats`](#arraystats) | Contains summary statistics for arrivals from `intervalStart` to `intervalEnd`. |

### ArrayStats

Contains summary statistics for a single metric, computed from arrivals in a single interval.

| Field Name | Type | Description |
| --- | --- | --- |
| `count` | `Int` | The number of arrivals in the interval. |
| `avg` | `Float` | The average of the computed metric. |
| `min` | `Float` | The minimum value of the computed metric. |
| `median` | `Float` | The median value of the computed metric. |
| `max` | `Float` | The maximum value of the computed metric. |
| `percentiles` | [`[PercentileData]`](#percentiledata) | Data for percentile values of the computed metric. |
| `histogram` | [`[HistogramBin]`](#histogrambin) | Data for rendering histograms on the frontend. |

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
| `value` | `String` | Name of the bin to render on the frontend. (`0-5`, `5-10`, etc) |
| `count` | `Int` | Number of data points in the bin. |
| `binStart` | `Float` | Lower bound for the bin. |
| `binEnd` | `Float` | Upper bound for the bin. |

### ComparisonStats

Contains metrics data for comparisons between scheduled arrivals and arrival data.

| Field Name | Type | Description |
| --- | --- | --- |
| `closestDeltaStats` | [`[IntervalStats]`](#intervalstats) | Metrics data for differences between each arrival and the closest scheduled arrival. |
| `nextDeltaStats` | [`[IntervalStats]`](#intervalstats) | Metrics data for differences between each arrival and the next scheduled arrival (closest scheduled arrival that occurs after the actual arrival). |