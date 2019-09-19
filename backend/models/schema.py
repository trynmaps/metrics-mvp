from . import nextbus, constants, metrics, util
from graphene import ObjectType, String, Int, Float, List, Field, Boolean, Schema
from datetime import date

class DirectionInfo(ObjectType):
    id = String()
    title = String()
    name = String()
    stops = List(String)

    def resolve_id(parent, info):
        return parent["dir"].id

    def resolve_title(parent, info):
        return parent["dir"].title

    def resolve_name(parent, info):
        return parent["dir"].name

    def resolve_stops(parent, info):
        return parent["dir"].get_stop_ids()

class StopInfo(ObjectType):
    title = String()
    lat = Float()
    lon = Float()

    def resolve_title(parent, info):
        return parent["stop_info"].title

    def resolve_lat(parent, info):
        return parent["stop_info"].lat

    def resolve_lon(parent, info):
        return parent["stop_info"].lon

class StopDictionary(ObjectType):
    key = Int()
    value = Field(StopInfo)

    def resolve_key(parent, info):
        return parent["stop_info"].id

    def resolve_value(parent, info):
        return {
            "stop_info": parent["stop_info"]
        }

class RouteInfo(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopDictionary)

    def resolve_id(parent, info):
        return parent["id"]

    def resolve_title(parent, info):
        return parent["route_config"].title

    def resolve_directions(parent, info):
        return [
            {
                "dir": dir_info
            } for dir_info in parent["route_config"].get_direction_infos()
        ]

    def resolve_stops(parent, info):
        return [
            {
                "stop_info": stop
            } for stop in parent["route_config"].get_stop_infos()
        ]

class RouteList(ObjectType):
    routeInfos = List(RouteInfo)

    def resolve_routeInfos(parent, info):
        return [
            {
                "id": route.id,
                "route_config": nextbus.get_route_config(constants.AGENCY, route.id)
            } for route in parent["routes"]
        ]

class PercentileData(ObjectType):
    percentile = Int()
    value = Float()

    def resolve_percentile(parent, info):
        return parent["percentile"]

    def resolve_value(parent, info):
        return parent["value"]

class HistogramBin(ObjectType):
    value = String()
    count = Int()
    binStart = Float()
    binEnd = Float()

    def resolve_value(parent, info):
        return parent["value"]

    def resolve_count(parent, info):
        return parent["count"]

    def resolve_binStart(parent, info):
        return parent["bin_start"]

    def resolve_binEnd(parent, info):
        return parent["bin_end"]

class ArrayStats(ObjectType):
    count = Int()
    avg = Float()
    min = Float()
    median = Float()
    max = Float()
    percentiles = List(PercentileData)
    histogram = List(HistogramBin)

    def resolve_count(parent, info):
        return parent["count"]

    def resolve_avg(parent, info):
        return parent["avg"]

    def resolve_min(parent, info):
        return parent["min"]

    def resolve_median(parent, info):
        return parent["median"]

    def resolve_max(parent, info):
        return parent["max"]

    def resolve_percentiles(parent, info):
        return [
            {
                "percentile": ele["percentile"],
                "value": ele["value"]
            }
            for ele in parent["percentiles"]
        ]
    
    def resolve_histogram(parent, info):
        return [
            {
                "value": ele["value"],
                "count": ele["count"],
                "bin_start": ele["bin_start"],
                "bin_end": ele["bin_end"]
            }
            for ele in parent["histogram"]
        ]

class IntervalStats(ObjectType):
    intervalStart = String()
    intervalEnd = String()
    stats = Field(ArrayStats)
 
    def resolve_intervalStart(parent, info):
        return parent["interval_start"]

    def resolve_intervalEnd(parent, info):
        return parent["interval_end"]

    def resolve_stats(parent, info):
        stats = parent["statfunc"](
                **{**parent["data"], **{
                    "rng": metrics.Range(parent["dates"], parent["interval_start"], parent["interval_end"], constants.PACIFIC_TIMEZONE)
                    }
                })

        if parent["metric_name"] == "next_delta":
            stats = stats["next_arrival_delta_stats"]
        elif parent["metric_name"] == "closest_delta":
            stats = stats["closest_arrival_delta_stats"]

        return stats if stats else {"count" : 0}

class MetricsStats(ObjectType):
    intervals = List(IntervalStats)

    def resolve_intervals(parent, info):
        return [
            {
                **parent, **{
                    "interval_start": interval[0],
                    "interval_end": interval[1]
                }
            }
            for interval in parent["intervals"]
        ]

class ComparisonStats(ObjectType):
    closestDeltaStats = List(IntervalStats)
    nextDeltaStats = List(IntervalStats)

    def resolve_closestDeltaStats(parent, info):
        return [
            {
                "interval_start": interval[0],
                "interval_end": interval[1],
                "data": parent["data"],
                "dates": parent["dates"],
                "statfunc": parent["statfunc"],
                "metric_name": "closest_delta"
            }
            for interval in parent["intervals"]
        ]

    def resolve_nextDeltaStats(parent, info):
        return [
            {
                "interval_start": interval[0],
                "interval_end": interval[1],
                "data": parent["data"],
                "dates": parent["dates"],
                "statfunc": parent["statfunc"],
                "metric_name": "next_delta"
            }
            for interval in parent["intervals"]
        ]

class MetricsStopInfo(ObjectType):
    startStopTitle = String()
    endStopTitle = String()

    def resolve_startStopTitle(parent, info):
        return parent["rc"].get_stop_info(parent["start_stop_id"]).title

    def resolve_endStopTitle(parent, info):
        return parent["rc"].get_stop_info(parent["end_stop_id"]).title

class StopMetrics(ObjectType):
    waitTimes = Field(MetricsStats)
    headways = Field(MetricsStats)
    tripTimes = Field(MetricsStats)
    timetableHeadways = Field(MetricsStats)
    timetableComparison = Field(ComparisonStats)

    def resolve_waitTimes(parent, info):
        return get_stats({
            "params": parent,
            "statfunc": parent["rm"].get_wait_time_stats,
            "metric_name": "wait_times",
            "data": {
                "stop_id": parent["start_stop_id"],
                "direction_id": parent["direction_id"]
            }
        })

    def resolve_headways(parent, info):
        return get_stats({
            "params": parent,
            "statfunc": parent["rm"].get_headway_min_stats,
            "metric_name": "headways",
            "data": {
                "stop_id": parent["start_stop_id"],
                "direction_id": parent["direction_id"]
            }
        })

    def resolve_tripTimes(parent, info):
        return get_stats({
            "params": parent,
            "statfunc": parent["rm"].get_trip_time_stats,
            "metric_name": "trip_times",
            "data": {
                "start_stop_id": parent["start_stop_id"],
                "end_stop_id": parent["end_stop_id"],
                "direction_id": parent["direction_id"]
            }
        })

    def resolve_timetableHeadways(parent, info):
        return get_stats({
            "params": parent,
            "statfunc": parent["rm"].get_timetable_headway_stats,
            "metric_name": "timetable_headways",
            "data": {
                "stop_id": parent["start_stop_id"],
                "direction_id": parent["direction_id"]
            }
        })

    def resolve_timetableComparison(parent, info):
        return get_stats({
            "params": parent,
            "statfunc": parent["rm"].get_timetable_comparison_stats,
            "metric_name": "timetable_comparison",
            "data": {
                "stop_id": parent["start_stop_id"],
                "direction_id": parent["direction_id"]
            }
        })

class RouteMetrics(ObjectType):
    stopinfo = Field(MetricsStopInfo)
    metrics = Field(StopMetrics)

    def resolve_stopinfo(parent, info):
        return {
            "rc": nextbus.get_route_config(constants.AGENCY, parent["route_id"]),
            "start_stop_id": parent["start_stop_id"],
            "end_stop_id": parent["end_stop_id"]
        }

    def resolve_metrics(parent, info):
        return parent

class Query(ObjectType):
    routes = Field(RouteList)
    routeInfo = Field(RouteInfo, routeId = String())
    routeMetrics = Field(RouteMetrics, routeId = String(), startStopId = String(), endStopId = String(required = False) , date = String(required = False), startDate = String(required = False), endDate = String(required = False), startTime = String(required = False), endTime = String(required = False), directionId = String(required = False), intervalLengths = Int(required = False))

    def resolve_routes(parent, info):
        return {
            "routes": nextbus.get_route_list(constants.AGENCY)
        }

    def resolve_routeInfo(parent, info, routeId):
        return {
            "id": routeId,
            "route_config": nextbus.get_route_config(constants.AGENCY, routeId)
        }

    def resolve_routeMetrics(parent, info, routeId, startStopId, endStopId = None, date = "2019-06-06", startDate = None, endDate = None, startTime = "00:00", endTime = "22:59", directionId = None, intervalLengths = None):
        return {
            "rm": metrics.RouteMetrics(constants.AGENCY, routeId),
            "route_id": routeId,
            "start_stop_id": startStopId,
            "end_stop_id": endStopId,
            "date": date,
            "start_date": startDate,
            "end_date": endDate,
            "start_time": startTime,
            "end_time": endTime,
            "direction_id": directionId,
            "interval_lengths": intervalLengths
        }
        
def get_stats(parent):
    if parent["params"]["date"]:
        dates = [date.fromisoformat(parent["params"]["date"])]
    else:
        dates = util.get_dates_in_range(parent["params"]["start_date"], parent["params"]["end_date"])

    if parent["params"]["interval_lengths"]:
        intervals = util.get_intervals(parent["params"]["start_time"], parent["params"]["end_time"], parent["params"]["interval_lengths"])
    else:
        intervals = constants.DEFAULT_TIME_STR_INTERVALS

    return {
        "dates": dates,
        "intervals": intervals,
        "statfunc": parent["statfunc"],
        "metric_name": parent["metric_name"],
        "data": parent["data"]
    }

metrics_api = Schema(query = Query)