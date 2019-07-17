from . import nextbus, constants, metrics, util
from graphene import ObjectType, String, Int, Float, List, Field, Boolean, Schema
from datetime import date

class DirectionInfo(ObjectType):
    id = String()
    title = String()
    name = String()
    stops = List(String)

class StopInfo(ObjectType):
    title = String()
    lat = Float()
    lon = Float()

class StopDictionary(ObjectType):
    key = Int()
    value = Field(StopInfo)

class RouteInfo(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopDictionary)

class RouteList(ObjectType):
    routeInfos = List(RouteInfo)

class PercentileData(ObjectType):
    percentile = Int()
    value = Float()

class HistogramBin(ObjectType):
    value = String()
    count = Int()
    binStart = Float()
    binEnd = Float()

class ArrayStats(ObjectType):
    count = Int()
    avg = Float()
    min = Float()
    median = Float()
    max = Float()
    percentiles = List(PercentileData)
    histogram = List(HistogramBin)

class IntervalStats(ObjectType):
    interval_start = String()
    interval_end = String()
    stats = Field(ArrayStats)

class MetricsStats(ObjectType):
    intervals = List(IntervalStats)

class ComparisonStats(ObjectType):
    closestDeltaStats = List(IntervalStats)
    nextDeltaStats = List(IntervalStats)

class MetricsStopInfo(ObjectType):
    startStopTitle = String()
    endStopTitle = String()

class StopMetrics(ObjectType):
    waitTimes = Field(MetricsStats)
    headways = Field(MetricsStats)
    tripTimes = Field(MetricsStats)
    timetableHeadways = Field(MetricsStats)
    timetableComparison = Field(ComparisonStats)

class RouteMetrics(ObjectType):
    stopinfo = Field(MetricsStopInfo)
    metrics = Field(StopMetrics)

class Query(ObjectType):
    routes = Field(RouteList)
    routeInfo = Field(RouteInfo, routeId = String())
    routeMetrics = Field(RouteMetrics, routeId = String(), startStopId = String(), endStopId = String(required = False) , date = String(required = False), startDate = String(required = False), endDate = String(required = False), startTime = String(required = False), endTime = String(required = False), directionId = String(required = False), intervalLengths = Int(required = False))

    def resolve_routes(parent, info):
        return get_all_routes()

    def resolve_routeInfo(parent, info, routeId):
        return get_route_info(routeId)

    def resolve_routeMetrics(parent, info, routeId, startStopId, endStopId = None, date = "2019-06-06", startDate = None, endDate = None, startTime = "00:00", endTime = "22:59", directionId = None, intervalLengths = None):
        return get_route_metrics(routeId, startStopId, endStopId, date, startDate, endDate, startTime, endTime, directionId, intervalLengths)
        
metrics_api = Schema(query = Query)

def get_route_metrics(routeId, startStopId, endStopId, date, startDate, endDate, startTime, endTime, directionId, intervalLengths):
    stop_info = get_stop_info(routeId, startStopId, endStopId)
    metrics = get_stop_metrics(routeId, startStopId, endStopId, date, startDate, endDate, startTime, endTime, directionId, intervalLengths)

    return RouteMetrics(stopinfo = stop_info, metrics = metrics)

def get_route_info(route_id: str):
    rc = nextbus.get_route_config(constants.AGENCY, route_id)

    return RouteInfo(
        id = route_id,
        title = rc.title,
        directions = [
            DirectionInfo(
                id = dir.id, 
                title = dir.title, 
                name = dir.name, 
                stops = dir.get_stop_ids()
                ) for dir in rc.get_direction_infos()
        ],
        stops = [
            StopDictionary(
                key = stop.id,
                value = StopInfo(
                    title = stop.title,
                    lat = stop.lat,
                    lon = stop.lon
                )
            ) for stop in rc.get_stop_infos()
        ]
    )

def get_all_routes():
    route_list = nextbus.get_route_list(constants.AGENCY)

    return RouteList(
        routeInfos = [
            get_route_info(route.id) for route in route_list
        ]
    )

def get_stop_info(route_id: str, start_stop_id: int, end_stop_id: int):
    rc = nextbus.get_route_config(constants.AGENCY, route_id)

    return MetricsStopInfo(startStopTitle = rc.get_stop_info(start_stop_id).title, endStopTitle = rc.get_stop_info(end_stop_id).title if end_stop_id else None)

def get_stop_metrics(route_id: str, start_stop_id: int, end_stop_id: int, d: str, start_date: str, end_date: str, start_time: str, end_time: str, direction_id: str, interval_lengths: int):
    if d:
        dates = [date.fromisoformat(d)]
    else:
        dates = util.get_dates_in_range(start_date, end_date)

    rm = metrics.RouteMetrics(constants.AGENCY, route_id)

    if interval_lengths:
        intervals = util.get_intervals(start_time, end_time, interval_lengths)
    else:
        intervals = constants.DEFAULT_TIME_STR_INTERVALS

    # parameters for one stop metrics (wait times, headways) and two stop metrics (trip times)
    one_stop_params = {
        "stop_id": start_stop_id,
        "direction_id": direction_id
    }
    two_stop_params = {
        "start_stop_id": start_stop_id,
        "end_stop_id": end_stop_id,
        "direction_id": direction_id
    }

    return StopMetrics(
        waitTimes = get_interval_metrics(dates, one_stop_params, intervals, rm.get_wait_time_stats),
        headways = get_interval_metrics(dates, one_stop_params, intervals, rm.get_headway_min_stats),
        tripTimes = get_interval_metrics(dates, two_stop_params, intervals, rm.get_trip_time_stats),
        timetableHeadways = get_interval_metrics(dates, one_stop_params, intervals, rm.get_timetable_headway_stats),
        timetableComparison = get_comparison_stats(dates, one_stop_params, intervals, rm.get_timetable_comparison_stats)
    )

def get_comparison_stats(dates, data, intervals, statfunc):
    interval_stats = {
        'next_arrival': [],
        'closest_arrival': []
    }

    for interval in intervals:
        comparison_stats = statfunc(**{**data, **{"rng": metrics.Range(dates, interval[0], interval[1], constants.PACIFIC_TIMEZONE)}})
        next_arrival_stats = comparison_stats['next_arrival_delta_stats']
        closest_arrival_stats = comparison_stats['closest_arrival_delta_stats']

        if next_arrival_stats['count'] > 0:
            next_arrival_stats['percentiles'] = [
                PercentileData(ele['percentile'], ele['value']) for ele in next_arrival_stats['percentiles']
            ]
            next_arrival_stats['histogram'] = [
                HistogramBin(ele['value'], ele['count'], ele['bin_start'], ele['bin_end']) for ele in next_arrival_stats['histogram']
            ]

        if closest_arrival_stats['count'] > 0:
            closest_arrival_stats['percentiles'] = [
                PercentileData(ele['percentile'], ele['value']) for ele in closest_arrival_stats['percentiles']
            ]
            closest_arrival_stats['histogram'] = [
                HistogramBin(ele['value'], ele['count'], ele['bin_start'], ele['bin_end']) for ele in closest_arrival_stats['histogram']
            ]

        interval_stats['next_arrival'].append(IntervalStats(
            interval_start = interval[0],
            interval_end = interval[1],
            stats = ArrayStats(**next_arrival_stats)
        ))

        interval_stats['closest_arrival'].append(IntervalStats(
            interval_start = interval[0],
            interval_end = interval[1],
            stats = ArrayStats(**closest_arrival_stats)
        ))
        
    return ComparisonStats(
        closestDeltaStats = interval_stats['closest_arrival'],
        nextDeltaStats = interval_stats['next_arrival']
    )

def get_interval_stats(dates, interval_start, interval_end, data, statfunc):
    stats = statfunc(**{**data, **{"rng": metrics.Range(dates, interval_start, interval_end, constants.PACIFIC_TIMEZONE)}})

    # first condition accounts for the case where RouteMetrics.get_trip_time_stats returns None
    if stats and stats['count'] > 0:
        stats['percentiles'] = [
            PercentileData(ele['percentile'], ele['value']) for ele in stats['percentiles']
        ]
        stats['histogram'] = [
            HistogramBin(ele['value'], ele['count'], ele['bin_start'], ele['bin_end']) for ele in stats['histogram']
        ]

    return IntervalStats(
        interval_start = interval_start,
        interval_end = interval_end,
        stats = ArrayStats(**(stats if stats else {"count": 0}))
    )

def get_interval_metrics(dates, data, intervals, statfunc):
    return MetricsStats(intervals = [get_interval_stats(dates, interval[0], interval[1], data, statfunc) for interval in intervals])