# These are sample graphQL queries that also list all the possible parameters and fields in the API.

# get route info for every route
all_routes_query = '''{
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
'''

# get route info for route 12
one_route_query = '''{
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
'''

# get metrics for a pair of stops on a route
stops_query = '''{
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
  '''