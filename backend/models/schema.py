from . import nextbus, constants, metrics, util, wait_times, trip_times, config
from graphene import ObjectType, String, Int, Float, List, Field, Boolean, Schema
from datetime import date
import sys
import numpy as np
import math

ROUND_DIGITS = 3

class BasicWaitTimeStats(ObjectType):
    median = Float()
    percentile = Float(percentile=Int(required=True))
    probabilityLessThan = Float(minutes=Int(required=True))

    def resolve_median(parent, info):
        first_date = util.parse_date(parent["date_str"])
        wait_time_median = wait_times.get_cached_wait_times(parent['route_metrics'].agency_id, first_date, "median", parent["start_time"], parent["end_time"])
        if wait_time_median is None:
            raise Exception(f"There is no cached median for start_stop_id {parent['start_stop_id']} at times {parent['start_time'], parent['end_time']}.")
        wait_time_median_value = wait_time_median.get_value(parent["route_metrics"].route_id, parent["direction_id"], parent["start_stop_id"])
        if wait_time_median_value is None:
            raise Exception(f"There is no cached median value returned for start_stop_id {parent['start_stop_id']} at times {parent['start_time'], parent['end_time']}.")
        return wait_time_median_value

    def resolve_percentile(parent, info, percentile):
        first_date = util.parse_date(parent["date_str"])
        wait_time_percentile = wait_times.get_cached_wait_times(parent['route_metrics'].agency_id, first_date, "p10-median-p90", parent["start_time"], parent["end_time"])
        percentiles_arr = wait_time_percentile.get_value(parent["route_metrics"].route_id, parent["direction_id"], parent["start_stop_id"])
        if percentiles_arr is None:
            raise Exception(f"There is no cached data for stop: {parent['start_stop_id']}.")
        if percentile == 10:
            return percentiles_arr[0]
        elif percentile == 50:
            return percentiles_arr[1]
        elif percentile == 90:
            return percentiles_arr[2]
        else:
            raise Exception(f"User requested a percentile other than [ 10 | 50 | 90 ].")

    def resolve_probabilityLessThan(parent, info, minutes):
        first_date = util.parse_date(parent["date_str"])
        wait_time_probability = wait_times.get_cached_wait_times(parent['route_metrics'].agency_id, first_date, "plt5m-30m", parent["start_time"], parent["end_time"])
        probabilitys_arr = wait_time_probability.get_value(parent["route_metrics"].route_id, parent["direction_id"], parent["start_stop_id"])
        minutes_to_index = {5: 0, 10: 1, 15: 2, 20: 3, 25: 4, 30: 5}
        if minutes not in minutes_to_index:
            raise Exception(f'User requested minutes other than [ 5 | 10 | 15 | 20 | 25 | 30 ]')
        return probabilitys_arr[minutes_to_index[minutes]]

class BasicTripTimeStats(ObjectType):
    median = Float()
    percentile = Float(percentile=Int(required=True))

    def resolve_median(parent, info):
        first_date = util.parse_date(parent["date_str"])
        trip_time_median = trip_times.get_cached_trip_times(parent['route_metrics'].agency_id, first_date, "median", parent["start_time"], parent["end_time"])
        return trip_time_median.get_value(parent["route_metrics"].route_id, parent["direction_id"], parent["start_stop_id"], parent["end_stop_id"])

    def resolve_percentile(parent, info, percentile):
        first_date = util.parse_date(parent["date_str"])
        trip_time_percentile = trip_times.get_cached_trip_times(parent['route_metrics'].agency_id, first_date, "p10-median-p90", parent["start_time"], parent["end_time"])
        percentiles_arr = trip_time_percentile.get_value(parent["route_metrics"].route_id, parent["direction_id"], parent["start_stop_id"], parent["end_stop_id"])
        if percentiles_arr is None:
            raise Exception(f"There is no cached data for stops: {parent['start_stop_id']}, {parent['end_stop_id']}.")
        if percentile == 10:
            return percentiles_arr[0]
        elif percentile == 50:
            return percentiles_arr[1]
        elif percentile == 90:
            return percentiles_arr[2]
        else:
            raise Exception(f"User requested a percentile other than [ 10 | 50 | 90 ].")


class BasicIntervalMetrics(ObjectType):
    dates = List(String)
    startTime = String()
    endTime = String()
    waitTimes = Field(BasicWaitTimeStats)
    tripTimes = Field(BasicTripTimeStats)

    def resolve_dates(parent, info):
        dates = [parent["date_str"]]
        return dates

    def resolve_startTime(parent, info):
        return parent["start_time"]

    def resolve_endTime(parent, info):
        return parent["end_time"]

    def resolve_waitTimes(parent, info):
        return parent

    def resolve_tripTimes(parent, info):
        return parent


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

class IntervalMetrics(ObjectType):
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
    interval = Field(IntervalMetrics,
        date_strs = List(String, name='dates'),
        start_time = String(required = False),
        end_time = String(required = False),
    )

    timeRanges = List(IntervalMetrics,
        date_strs = List(String, name='dates'),
    )

    byDay = List(BasicIntervalMetrics,
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

        return [{
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

    def resolve_byDay(parent, info, date_strs, start_time, end_time):
        return [{**parent,
                "start_time": start_time,
                "end_time": end_time,
                "date_str": date_str
            }
            for date_str in date_strs
        ]

class RouteMetrics(ObjectType):
    trip = Field(TripMetrics,
        startStopId = String(required=True),
        endStopId = String(required = False),
        directionId = String(required = False)
    )

    # parent is a metrics.RouteMetrics object

    def resolve_trip(route_metrics, info, startStopId, endStopId = None, directionId = None):
        return {
            "route_metrics": route_metrics,
            "start_stop_id": startStopId,
            "end_stop_id": endStopId,
            "direction_id": directionId,
        }

class Query(ObjectType):
    routes = List(RouteInfo,
        agency_id = String(required=True)
    )
    routeConfig = Field(RouteConfig,
        agency_id = String(required=True),
        route_id = String(required=True)
    )
    routeMetrics = Field(RouteMetrics,
        agency_id = String(required=True),
        route_id = String(required=True))

    def resolve_routes(parent, info, agency_id):
        agency = config.get_agency(agency_id)
        return agency.get_route_list()

    def resolve_routeConfig(parent, info, agency_id, route_id):
        agency = config.get_agency(agency_id)
        return agency.get_route_config(route_id)

    def resolve_routeMetrics(parent, info, agency_id, route_id):
        return metrics.RouteMetrics(agency_id, route_id)

def round_or_none(number, num_digits=ROUND_DIGITS):
    if number is None:
        return None
    return round(number, num_digits)

metrics_api = Schema(query = Query)
