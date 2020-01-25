from . import nextbus, constants, metrics, util, wait_times, trip_times, config
from graphene import ObjectType, String, Int, Float, List, Field, Boolean, Schema
from datetime import date
import sys
import numpy as np
import math

ROUND_DIGITS = 3

class DirectionInfo(ObjectType):
    id = String()
    title = String()
    stopIds = List(String)

    # `parent` is a routeconfig.DirectionInfo object

    def resolve_id(dir_info, info):
        return dir_info.id

    def resolve_title(dir_info, info):
        return dir_info.title

    def resolve_stopIds(dir_info, info):
        return dir_info.get_stop_ids()

class StopInfo(ObjectType):
    id = String()
    title = String()
    lat = Float()
    lon = Float()

    # `parent` is a routeconfig.StopInfo object

    def resolve_id(stop_info, info):
        return stop_info.id

    def resolve_title(stop_info, info):
        return stop_info.title

    def resolve_lat(stop_info, info):
        return stop_info.lat

    def resolve_lon(stop_info, info):
        return stop_info.lon

class RouteConfig(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopInfo)
    stopInfo = Field(StopInfo, stopId = String())
    directionInfo = Field(DirectionInfo, directionId = String())

    # `parent` is a routeconfig.RouteConfig object

    def resolve_id(route_config, info):
        return route_config.id

    def resolve_title(route_config, info):
        return route_config.title

    def resolve_stopInfo(route_config, info, stopId):
        return route_config.get_stop_info(stopId)

    def resolve_directionInfo(route_config, info, directionId):
        return route_config.get_direction_info(directionId)

    def resolve_directions(route_config, info):
        return route_config.get_direction_infos()

    def resolve_stops(route_config, info):
        return route_config.get_stop_infos()

class RouteInfo(ObjectType):
    id = String()
    title = String()
    config = Field(RouteConfig)

    # `parent` is a routeconfig.RouteConfig object
    # perhaps this could be optimized so that routeList doesn't need to load full config for all routes if the client just needs basic info

    def resolve_id(route_config, info):
        return route_config.id

    def resolve_title(route_config, info):
        return route_config.title

    def resolve_config(route_config, info):
        return route_config

def get_percentiles_data(percentiles, percentile_values):
    return [{"percentile": percentile, "value": round(value, ROUND_DIGITS)}
        for percentile, value in zip(percentiles, percentile_values)]

class PercentileData(ObjectType):
    percentile = Float()
    value = Float()

def get_histogram_data(histogram, bins, bin_size):
    return [{
            "count": round(float(count), ROUND_DIGITS),
            "binStart": bin,
            "binEnd": bin + bin_size
        }
      for bin, count in zip(bins, histogram)]

class HistogramBin(ObjectType):
    count = Float()
    binStart = Float()
    binEnd = Float()

class BasicStats(ObjectType):
    count = Int()
    avg = Float()
    min = Float()
    median = Float()
    max = Float()
    std = Float()
    percentiles = List(PercentileData,
        percentiles = List(Float, required = False),
    )
    histogram = List(HistogramBin,
        min = Float(required=False, default_value=0),
        max = Float(required=False),
        bin_size = Float(required=False, default_value=5)
    )
    countRange = Int(
        min = Float(required=False),
        max = Float(required=False),
    )
    values = List(Float)

    # parent is an array-like containing numeric values

    def resolve_values(values, info):
        return values

    def resolve_count(values, info):
        return len(values)

    def resolve_countRange(values, info, min=None, max=None):
        if min is not None and max is not None:
            return np.sum((values >= min) & (values < max))
        elif min is not None:
            return np.sum(values >= min)
        elif max is not None:
            return np.sum(values < max)
        else:
            return len(values)

    def resolve_avg(values, info):
        if len(values) > 0:
            return round(np.average(values), ROUND_DIGITS)
        else:
            return None

    def resolve_std(values, info):
        if len(values) > 0:
            return round(np.std(values), ROUND_DIGITS)
        else:
            return None

    def resolve_min(values, info):
        if len(values) > 0:
            return round(np.min(values), ROUND_DIGITS)
        else:
            return None

    def resolve_median(values, info):
        if len(values) > 0:
            return round(np.median(values), ROUND_DIGITS)
        else:
            return None

    def resolve_max(values, info):
        if len(values) > 0:
            return round(np.max(values), ROUND_DIGITS)
        else:
            return None

    def resolve_percentiles(values, info, percentiles = None):
        if len(values) > 0:
            if percentiles is None:
                percentiles = range(0, 101, 5)
            percentile_values = np.percentile(values, percentiles)
            return get_percentiles_data(percentiles, percentile_values)
        else:
            return None

    def resolve_histogram(values, info, bin_size = None, min = None, max = None):
        if len(values) > 0:
            percentile_values = np.percentile(values, [0, 100])

            if bin_size is None or bin_size <= 0:
                bin_size = 5

            bin_min = min if min is not None else 0 # math.floor(percentile_values[0] / bin_size) * bin_size
            bin_max = max if max is not None else math.ceil(percentile_values[-1] / bin_size) * bin_size + bin_size
            bins = np.arange(bin_min, bin_max, bin_size)

            histogram, bin_edges = np.histogram(values, bins)

            return get_histogram_data(histogram, bins, bin_size)
        else:
            return None

class WaitTimeStats(ObjectType):
    avg = Float()
    min = Float()
    median = Float()
    max = Float()
    percentiles = List(PercentileData,
        percentiles = List(Float, required = False),
    )
    histogram = List(HistogramBin,
        min = Float(required=False, default_value=0),
        max = Float(required=False, default_value=90),
        bin_size = Float(required=False, default_value=5)
    )

    # parent is a wait_times.WaitTimeStats object (either IntervalWaitTimeStats or MultiIntervalWaitTimeStats)

    def resolve_avg(wait_stats, info):
        return round_or_none(wait_stats.get_average())

    def resolve_min(wait_stats, info):
        return round_or_none(wait_stats.get_quantile(0))

    def resolve_median(wait_stats, info):
        return round_or_none(wait_stats.get_quantile(0.5))

    def resolve_max(wait_stats, info):
        return round_or_none(wait_stats.get_quantile(1))

    def resolve_percentiles(wait_stats, info, percentiles = None):
        if percentiles is None:
            percentiles = range(0, 101, 5)

        percentile_values = wait_stats.get_percentiles(percentiles)
        if percentile_values is not None:
            return get_percentiles_data(percentiles, percentile_values)
        else:
            return None

    def resolve_histogram(wait_stats, info, bin_size = 5, min = 0, max = 90):
        if bin_size < 0:
            bin_size = 5

        bins = np.arange(min, max + bin_size, bin_size)

        histogram = wait_stats.get_histogram(bins)
        if histogram is not None:
            histogram = histogram * 100 # convert to percentages

            nonzero_buckets = np.nonzero(histogram)[0]
            if len(nonzero_buckets) > 0:
                histogram_end_index = nonzero_buckets[-1] + 1
            else:
                histogram_end_index = 0

            histogram = histogram[0:histogram_end_index]
            bins = bins[0:histogram_end_index]

            return get_histogram_data(histogram, bins, bin_size)
        else:
            return None

class ScheduleAdherence(ObjectType):
    onTimeCount = Int()
    lateCount = Int()
    earlyCount = Int()
    missingCount = Int()
    scheduledCount = Int()

    closestDeltas = Field(BasicStats)

    # parent is a pd.DataFrame as returned by timetables.match_schedule_to_arrivals

    def resolve_onTimeCount(adherence_df, info):
        return np.sum(adherence_df['on_time'])

    def resolve_lateCount(adherence_df, info):
        return np.sum(adherence_df['late'])

    def resolve_earlyCount(adherence_df, info):
        return np.sum(adherence_df['early'])

    def resolve_missingCount(adherence_df, info):
        return np.sum(adherence_df['no_match'])

    def resolve_scheduledCount(adherence_df, info):
        return len(adherence_df)

    def resolve_closestDeltas(adherence_df, info):
        return adherence_df['closest_actual_delta'].values / 60

class TripIntervalMetrics(ObjectType):
    dates = List(String)
    startTime = String()
    endTime = String()

    waitTimes = Field(WaitTimeStats)
    scheduledWaitTimes = Field(WaitTimeStats)

    headways = Field(BasicStats)
    scheduledHeadways = Field(BasicStats)

    tripTimes = Field(BasicStats)
    scheduledTripTimes = Field(BasicStats)

    departures = Int()
    scheduledDepartures = Int()

    arrivals = Int()
    scheduledArrivals = Int()

    departureScheduleAdherence = Field(ScheduleAdherence,
        early_sec = Int(required=False, default_value=60),
        late_sec = Int(required=False, default_value=300),
    )

    arrivalScheduleAdherence = Field(ScheduleAdherence,
        early_sec = Int(required=False, default_value=60),
        late_sec = Int(required=False, default_value=300),
    )

    headwayScheduleDeltas = Field(BasicStats)

    # parent is a dict with "route_metrics","start_stop_id","end_stop_id","direction_id","range" keys

    def resolve_dates(parent, info):
        return [str(d) for d in parent["range"].dates]

    def resolve_waitTimes(parent, info):
        return parent["route_metrics"].get_wait_time_stats(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_scheduledWaitTimes(parent, info):
        return parent["route_metrics"].get_scheduled_wait_time_stats(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_headways(parent, info):
        return parent["route_metrics"].get_headways(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_scheduledHeadways(parent, info):
        return parent["route_metrics"].get_scheduled_headways(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_tripTimes(parent, info):
        return parent["route_metrics"].get_trip_times(
            direction_id = parent["direction_id"],
            start_stop_id = parent["start_stop_id"],
            end_stop_id = parent["end_stop_id"],
            rng = parent["range"]
        )

    def resolve_scheduledTripTimes(parent, info):
        return parent["route_metrics"].get_scheduled_trip_times(
            direction_id = parent["direction_id"],
            start_stop_id = parent["start_stop_id"],
            end_stop_id = parent["end_stop_id"],
            rng = parent["range"]
        )

    def resolve_departures(parent, info):
        return parent["route_metrics"].get_departures(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_scheduledDepartures(parent, info):
        return parent["route_metrics"].get_scheduled_departures(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_arrivals(parent, info):
        return parent["route_metrics"].get_arrivals(
            direction_id = parent["direction_id"],
            stop_id = parent["end_stop_id"],
            rng = parent["range"]
        )

    def resolve_scheduledArrivals(parent, info):
        return parent["route_metrics"].get_scheduled_arrivals(
            direction_id = parent["direction_id"],
            stop_id = parent["end_stop_id"],
            rng = parent["range"]
        )

    def resolve_departureScheduleAdherence(parent, info, early_sec, late_sec):
        return parent["route_metrics"].get_departure_schedule_adherence(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            early_sec = early_sec,
            late_sec = late_sec,
            rng = parent["range"]
        )

    def resolve_arrivalScheduleAdherence(parent, info, early_sec, late_sec):
        return parent["route_metrics"].get_arrival_schedule_adherence(
            direction_id = parent["direction_id"],
            stop_id = parent["end_stop_id"],
            early_sec = early_sec,
            late_sec = late_sec,
            rng = parent["range"]
        )

    def resolve_headwayScheduleDeltas(parent, info):
        return parent["route_metrics"].get_headway_schedule_deltas(
            direction_id = parent["direction_id"],
            stop_id = parent["start_stop_id"],
            rng = parent["range"]
        )

    def resolve_startTime(parent, info):
        return parent["range"].start_time_str

    def resolve_endTime(parent, info):
        return parent["range"].end_time_str

class TripMetrics(ObjectType):
    interval = Field(TripIntervalMetrics,
        date_strs = List(String, name='dates'),
        start_time = String(required = False),
        end_time = String(required = False),
    )

    timeRanges = List(TripIntervalMetrics,
        date_strs = List(String, name='dates'),
    )

    byDay = List(TripIntervalMetrics,
        date_strs = List(String, name='dates'),
        start_time = String(required = False),
        end_time = String(required = False),
    )

    # parent is a dict with "route_metrics","start_stop_id","end_stop_id","direction_id" keys

    def resolve_interval(parent, info, date_strs, start_time = None, end_time = None):
        dates = [util.parse_date(date_str) for date_str in date_strs]

        agency = config.get_agency(parent['route_metrics'].agency_id)

        rng = metrics.Range(
            dates,
            start_time,
            end_time,
            agency.tz
        )

        return {
            "range": rng,
            **parent
        }

    def resolve_timeRanges(parent, info, date_strs):
        dates = [util.parse_date(date_str) for date_str in date_strs]

        agency = config.get_agency(parent['route_metrics'].agency_id)

        return [
            {
                'range': metrics.Range(
                    dates,
                    start_time,
                    end_time,
                    agency.tz
                ),
                **parent
            }
            for start_time,end_time in constants.DEFAULT_TIME_STR_INTERVALS
        ]

    def resolve_byDay(parent, info, date_strs, start_time = None, end_time = None):
        dates = [util.parse_date(date_str) for date_str in date_strs]
        agency = config.get_agency(parent['route_metrics'].agency_id)

        return [
            {
                'range': metrics.Range(
                    [date],
                    start_time,
                    end_time,
                    agency.tz
                ),
                **parent,
            }
            for date in dates
        ]

class RouteIntervalStats(ObjectType):
    routeId = String()
    medianWaitTime = Float() # minutes
    averageSpeed = Float(
        units = String(required=False),
    )
    travelTimeVariability = Float() # minutes
    onTimeRate = Float()

    def resolve_routeId(parent, info):
        return parent["route_id"]

    def resolve_travelTimeVariability(parent, info):
        return round_or_none(parent["agency_metrics"].get_travel_time_variability(parent["route_id"], None, parent["range"]))

    def resolve_averageSpeed(parent, info, units=constants.MILES_PER_HOUR):
        return round_or_none(parent["agency_metrics"].get_average_speed(parent["route_id"], None, parent["range"], units))

    def resolve_medianWaitTime(parent, info):
        return round_or_none(parent["agency_metrics"].get_median_wait_time(parent["route_id"], None, "median", parent["range"]))

    def resolve_onTimeRate(parent, info):
        return round_or_none(parent["agency_metrics"].get_on_time_rate(parent["route_id"], None, "median", parent["range"]))

class AgencyIntervalMetrics(ObjectType):
    routes = List(RouteIntervalStats)

    def resolve_routes(parent, info):
        route_ids = parent["agency_metrics"].get_route_ids()

        return [
            {
                'route_id': route_id,
                **parent,
            }
            for route_id in route_ids
        ]

class SegmentStats(ObjectType):
    fromStopId = String()
    toStopId = String()
    medianTripTime = Float()

    def resolve_fromStopId(parent, info):
        return parent['from_stop_id']

    def resolve_toStopId(parent, info):
        return parent['to_stop_id']

    def resolve_medianTripTime(parent, info):
        return parent['median_trip_time']

class DirectionIntervalMetrics(ObjectType):
    directionId = String()
    segments = List(SegmentStats)
    cumulativeSegments = List(SegmentStats)

    def resolve_directionId(parent, info):
        return parent["direction_id"]

    def resolve_segments(parent, info):
        return parent["route_metrics"].get_segment_stats(parent["direction_id"], parent["range"])

    def resolve_cumulativeSegments(parent, info):
        return parent["route_metrics"].get_cumulative_segment_stats(parent["direction_id"], parent["range"])


class RouteIntervalMetrics(ObjectType):
    directions = List(DirectionIntervalMetrics)

    def resolve_directions(parent, info):
        route_config = parent["route_metrics"].get_route_config()

        return [{
                **parent,
                "direction_id": direction_id,
            } for direction_id in route_config.get_direction_ids()
        ]

class RouteMetrics(ObjectType):
    trip = Field(TripMetrics,
        start_stop_id = String(required=True),
        end_stop_id = String(required = False),
        direction_id = String(required = False)
    )

    interval = Field(RouteIntervalMetrics,
        date_strs = List(String, name='dates'),
        start_time = String(required=False),
        end_time = String(required=False),
    )

    # parent is a metrics.RouteMetrics object

    def resolve_trip(route_metrics, info, start_stop_id, end_stop_id = None, direction_id = None):
        return {
            "route_metrics": route_metrics,
            "start_stop_id": start_stop_id,
            "end_stop_id": end_stop_id,
            "direction_id": direction_id,
        }

    def resolve_interval(route_metrics, info, date_strs, start_time = None, end_time = None):
        dates = [util.parse_date(date_str) for date_str in date_strs]

        agency = config.get_agency(route_metrics.agency_id)

        rng = metrics.Range(
            dates,
            start_time,
            end_time,
            agency.tz
        )

        return {
            "range": rng,
            "route_metrics": route_metrics,
        }

class AgencyMetrics(ObjectType):
    agencyId = String()

    route = Field(RouteMetrics,
        route_id = String(required=True)
    )

    interval = Field(AgencyIntervalMetrics,
        date_strs = List(String, name='dates'),
        start_time = String(required=False),
        end_time = String(required=False),
    )

    # parent is a metrics.AgencyMetrics object

    def resolve_agencyId(agency_metrics, info):
        return agency_metrics.agency_id

    def resolve_route(agency_metrics, info, route_id):
        return agency_metrics.get_route_metrics(route_id)

    def resolve_interval(agency_metrics, info, date_strs, start_time = None, end_time = None):
        dates = [util.parse_date(date_str) for date_str in date_strs]

        rng = metrics.Range(
            dates,
            start_time,
            end_time,
            None
        )

        return {
            "range": rng,
            "agency_metrics": agency_metrics
        }

class Query(ObjectType):
    agencies = List(AgencyMetrics,
        agency_ids = List(String)
    )
    agency = Field(AgencyMetrics,
        agency_id = String(required=True)
    )

    def resolve_agencies(parent, info, agency_ids):
        return [metrics.AgencyMetrics(agency_id) for agency_id in agency_ids]

    def resolve_agency(parent, info, agency_id):
        return metrics.AgencyMetrics(agency_id)

def round_or_none(number, num_digits=ROUND_DIGITS):
    if number is None:
        return None
    return round(number, num_digits)

metrics_api = Schema(query = Query)
