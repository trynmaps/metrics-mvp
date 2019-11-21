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

To run the above query with the variables `$routeId` = "1", `$startStopId` = "6307", and `$date` = "2019-10-12", you can make a GET request to the URL below:

http://muni.opentransit.city/api/graphql?query=query(%24agencyId%3AString!%2C+%24routeId%3AString!%2C+%24startStopId%3AString!%2C+%24date%3AString)+%7B+routeMetrics(agencyId%3A%24agencyId%2C+routeId%3A%24routeId)+%7B+trip(startStopId%3A%24startStopId)+%7B+interval(dates%3A%5B%24date%5D)+%7B+headways+%7B+median+max+%7D+waitTimes+%7B+median+%7D+%7D+%7D+%7D+%7D&variables=%7B"agencyId":"muni","routeId":"1","startStopId":"6307","date":"2019-11-09"%7D

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
              "id": "5184",
              "title": "Jones St & Beach St",
              "lat": 37.8071299,
              "lon": -122.41732
            },
            {
              "id": "3092",
              "title": "Beach St & Mason St",
              "lat": 37.8074099,
              "lon": -122.41412
            },
            {
              "id": "3095",
              "title": "Beach St & Stockton St",
              "lat": 37.8078399,
              "lon": -122.41081
            },
            ...
```

### Parameters in Queries

Querying information about a particular route or stop requires input parameters. For instance, to fetch the summary statistics for wait times at stop `4015` on route `1` on the date `2019-10-11`, the query would need to pass in `routeId`, `startStopId` and `dates` parameters:

```graphql
query {
  routeMetrics(agencyId:"muni",routeId:"1") {
    trip(startStopId:"4015") {
      interval(dates:["2019-10-11"]) {
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
            "avg": 5.165,
            "median": 3.636,
            "max": 27.683
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
              "id": "E____O_F00",
              "title": "Outbound to Mission Bay",
              "stopIds": [
                "5184",
                "3092",
                "3095",
                "4502",
                "4529",
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
          "id": "12___O_F00",
          "title": "Outbound to Mission District",
          "name": "Outbound",
          "stopIds": [
            "7941",
            "5859",
            "5851",
            "5844",
            ...
```

### Return metrics data for a pair of stops on a route

```graphql
query {
  routeMetrics(agencyId:"muni", routeId:"1") {
    trip(startStopId:"4015", endStopId:"6304") {
      interval(dates:["2019-10-11"], startTime:"08:00", endTime:"20:00") {
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
            "avg": 3.366,
            "median": 2.693,
            "max": 18.5
          },
          "tripTimes": {
            "min": 9.1,
            "avg": 12.715,
            "median": 12.533,
            "max": 18.217,
            "std": 1.586,
            "histogram": [
              {
                "count": 5,
                "binStart": 0,
                "binEnd": 10
              },
              {
                "count": 142,
                "binStart": 10,
                "binEnd": 20
              }
            ]
          },
          "headways": {
            "min": 0.067,
            "avg": 4.902,
            "median": 4.617,
            "max": 18.5,
            "percentiles": [
              {
                "percentile": 10,
                "value": 1.763
              },
              {
                "percentile": 90,
                "value": 7.763
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
    trip(startStopId:"4015", endStopId:"6304") {
      timeRanges(dates:["2019-10-11"]) {
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
              "median": 7.926,
              "max": 27.683
            },
            "tripTimes": {
              "median": 10.633,
              "max": 11.583
            }
          },
          {
            "startTime": "07:00",
            "endTime": "10:00",
            "waitTimes": {
              "median": 2.405,
              "max": 13.783
            },
            "tripTimes": {
              "median": 11.6,
              "max": 15.083
            }
          },
          {
            "startTime": "10:00",
            "endTime": "16:00",
            "waitTimes": {
              "median": 2.733,
              "max": 12.183
            },
            "tripTimes": {
              "median": 12.483,
              "max": 18.217
            }
          },
          {
            "startTime": "16:00",
            "endTime": "19:00",
            "waitTimes": {
              "median": 2.928,
              "max": 16.483
            },
            "tripTimes": {
              "median": 13.467,
              "max": 17.167
            }
          },
          {
            "startTime": "19:00",
            "endTime": "03:00+1",
            "waitTimes": {
              "median": 7.082,
              "max": 21.383
            },
            "tripTimes": {
              "median": 11.825,
              "max": 15.05
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
    trip1: trip(startStopId:"4015", endStopId:"6304") {
      allDay: interval(dates:["2019-10-11"]) {
        ...intervalFields
      }
      morning: interval(dates:["2019-10-11"], startTime:"06:00", endTime:"10:00") {
        ...intervalFields
      }
    }
    trip2: trip(startStopId:"6307", endStopId:"6311") {
      allDay: interval(dates:["2019-10-11"]) {
        ...intervalFields
      }
      morning: interval(dates:["2019-10-11"], startTime:"06:00", endTime:"10:00") {
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
            "median": 3.636
          }
        },
        "morning": {
          "waitTimes": {
            "median": 2.883
          }
        }
      },
      "trip2": {
        "allDay": {
          "waitTimes": {
            "median": 3.738
          }
        },
        "morning": {
          "waitTimes": {
            "median": 2.979
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

### IntervalMetrics

Contains metrics data a particular pair of stops on a single route in a particular time range.

| Field Name | Type | Description |
| --- | --- | --- |
| `startTime` | `String` | Start time of interval. |
| `endTime` | `String` | End time of interval. |
| `waitTimes` | [`WaitTimeStats`](#waittimestats) | Contains metrics data for wait times. |
| `headways` | [`BasicStats`](#basicstats) | Contains metrics data for headways. |
| `tripTimes` | [`BasicStats`](#basicstats) | Contains metrics data for trip times (will be `None` if `endStopId` isn't given). |
| `timetableHeadways` | [`BasicStats`](#basicstats) | Contains metrics data for timetable/scheduled headways. |
| `timetableComparison` | [`ComparisonStats`](#comparisonstats) | Contains metrics data for comparisons between scheduled arrivals and arrival data. |

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
