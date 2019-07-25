# Backend API documentation

The backend API uses graphQL. There is one endpoint, `/metrics_api`, that accepts a query string containing the necessary parameters for the query and the fields to be returned in the response. 

# Structure of a graphQL query 

OpenTransit's data is organized as a nested structure of objects. Each object represents a subset of the data (data about a route, data about a stop, data about bus arrivals, etc). This data is divided into fields, which are either other objects or primitive types like `String` or `Float`. For instance, to fetch information about every route, we would start by querying `routes`, which is a `RouteList`, an object that contains information about each route:

```
class RouteList(ObjectType):
    routeInfos = List(RouteInfo)
```

`routeList` has one field, `routeInfos`, which is a list of `RouteInfo` objects:

```
class RouteInfo(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopDictionary)
```

`id` is a string that contains the route's ID, `title` is a string containing the route's title, and `directions` and `stops` are lists of `DirectionInfo` and `StopDictionary` objects, which contain information about the route's directions and its stops, respectively.

The structure of a graphQL query reflects this nested structure - in a query, the client must specify which fields it wants the server to return. Nested fields are contained in nested brackets - for instance, the query

```
{
  routes {
    routeInfos {
      id
      title
    }
  }
}
```

returns only the `id` and `title` of every route (which you can verify by loading the backend in a browser and pasting the query into graphiQL). Note that all the innermost elements of the query have to be primitive types. The query

```
{
  routes {
    routeInfos {
      id
      title
      directions {
        id
        stops {}
      }
    }
  }
}
```

wouldn't work because the query isn't requesting any fields from `stops` that are primitive types. But the query

```
{
  routes {
    routeInfos {
      id
      title
      directions {
        id
        stops {
          title
          lat
          lon
        }
      }
    }
  }
}
```

would work, because `title`, `lat` and `lon` are all primitive types.

### Parameters in queries

Querying information about a particular route or stop requires parameters. For instance, to fetch the summary statistics for wait times at stop `3476` on route `12` on the date `2019-06-06`, the query would need to pass in `routeId`, `startStopId` and `date` parameters:

```
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

A list of parameters for the `routeInfo` and `routeMetrics` objects is given [below](#parameters).

# Example queries

Each of these queries returns the same data as a particular endpoint from the old REST API.

## Return information for all routes

Equivalent to a call to `/api/routes`.

```
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

## Return information for one route

Equivalent to a call to `/api/route`.

```
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

## Return metrics data for a pair of stops on a route

Equivalent to a call to `/api/metrics-by-interval`.

```
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

# Structure of the backend API 

### Query

The root query object for the API.

| Field Name | Type | Description |
| --- | --- | --- |
| `routes` | `RouteList` | Returns data about every route. |
| `routeInfo` | `RouteInfo` | Returns data for a particular route. |
| `routeMetrics` | `RouteMetrics` | Returns metrics data for a stop (or pair of stops) on a single route.

### Parameters {#parameters}

`String!` denotes a required parameter field, and `[String]` denotes a list of `String` objects.

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
| `startTime` | `String` | Start time for each date to return metrics data from. Times use `HH:MM` format. |
| `endTime` | `String` | End time for each date to return metrics data from. |
| `directionId` | `String` | ID of the direction to return metrics data from. |
| `intervalLengths` | `Int` | Length, in hours, of the intervals to aggregate bus arrivals to compute metrics data for. |

### RouteList

Contains data about every route.

| Field Name | Type | Description |
| --- | --- | --- |
| `routeInfos` | `[RouteInfo]` | A list of `RouteInfo` objects containing data about every route. |

### RouteInfo

Contains data about a single route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the route. |
| `title` | `String` | Title of the route. |
| `directions` | `[DirectionInfo]` | List of directions on the route. |
| `stops` | `[StopDictionary]` | A list of data for every stop on the route, indexed by stop ID. |

### DirectionInfo

Contains data about a direction on a route.

| Field Name | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the direction. |
| `title` | `String` | Title of the direction (`Outbound to Mission Bay`). |
| `name` | `String` | Name of the direction (`Inbound` or `Outbound`). |
| `stops` | `[String]` | List of IDs for stops on the route. |

### StopDictionary

A key-value pair in the `stops` field of `RouteInfo`. Contains information about one stop.

| Field Name | Type | Description |
| --- | --- | --- |
| `key` | `Int` | The ID of the stop. Used to index the `stops` field in `RouteInfo`. |
| `value` | `StopInfo` | Data about the stop. |

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
| `stopInfo` | `MetricsStopInfo` | Contains data for `startStopId` and `endStopId`. |
| `metrics` | `StopMetrics` | Contains metrics data. |

### MetricsStopInfo

Contains stop data for queries to `RouteMetrics`.

| Field Name | Type | Description |
| --- | --- | --- |
| `startStopTitle` | `String` | Title of the start stop. |
| `endStopTitle` | `String` | Title of the end stop. |

### StopMetrics

Contains metrics data for queries to `RouteMetrics`.

| Field Name | Type | Description |
| --- | --- | --- |
| `waitTimes` | `MetricsStats` | Contains metrics data for wait times. |
| `headways` | `MetricsStats` | Contains metrics data for headways. |
| `tripTimes` | `MetricsStats` | Contains metrics data for trip times (will be `None` if `endStopId` isn't given). |
| `timetableHeadways` | `MetricsStats` | Contains metrics data for timetable/scheduled headways. |
| `timetableComparison` | `ComparisonStats` | Contains metrics data for comparisons between scheduled arrivals and arrival data. |

### MetricsStats

Contains summary statistics for a single metric (wait times, headways, or trip times).

| Field Name | Type | Description |
| --- | --- | --- |
| `intervals` | `[IntervalStats]` | A list of `IntervalStats` objects containing summary statistics for arrivals aggregated into the intervals specified by `intervalLengths`. |

### IntervalStats

Contains summary statistics for arrivals aggregated over a fixed time interval.

| Field Name | Type | Description |
| --- | --- | --- |
| `intervalStart` | `String` | The start of the interval. Times use `HH:MM` format. |
| `intervalEnd` | `String` | The end of the interval. |
| `stats` | `ArrayStats` | Contains summary statistics for arrivals from `intervalStart` to `intervalEnd`. |

### ArrayStats

Contains summary statistics for a single metric, computed from arrivals in a single interval.

| Field Name | Type | Description |
| --- | --- | --- |
| `count` | `Int` | The number of arrivals in the interval. |
| `avg` | `Float` | The average of the computed metric. |
| `min` | `Float` | The minimum value of the computed metric. |
| `median` | `Float` | The median value of the computed metric. |
| `max` | `Float` | The maximum value of the computed metric. |
| `percentiles` | `[PercentileData]` | Data for percentile values of the computed metric. |
| `histogram` | `[HistogramBin]` | Data for rendering histograms on the frontend. |

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
| `closestDeltaStats` | `[IntervalStats]` | Metrics data for differences between each arrival and the closest scheduled arrival. |
| `nextDeltaStats` | `[IntervalStats]` | Metrics data for differences between each arrival and the next scheduled arrival (closest scheduled arrival that occurs after the actual arrival). |