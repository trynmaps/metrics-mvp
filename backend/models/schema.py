from . import constants, metrics, util, config
from graphene import ObjectType, String, Int, Float, List, Field, Boolean, Schema
from datetime import date
import sys
import numpy as np
import math

ROUND_DIGITS = 3

class DirectionInfo(ObjectType):
    id = String()
    title = String()
    name = String()
    stopIds = List(String)

    # `parent` is a routeconfig.DirectionInfo object

    def resolve_id(parent, info):
        return parent.id

    def resolve_title(parent, info):
        return parent.title

    def resolve_name(parent, info):
        return parent.name

    def resolve_stopIds(parent, info):
        return parent.get_stop_ids()

class StopInfo(ObjectType):
    id = String()
    title = String()
    lat = Float()
    lon = Float()

    # `parent` is a routeconfig.StopInfo object

    def resolve_id(parent, info):
        return parent.id

    def resolve_title(parent, info):
        return parent.title

    def resolve_lat(parent, info):
        return parent.lat

    def resolve_lon(parent, info):
        return parent.lon

class RouteConfig(ObjectType):
    id = String()
    title = String()
    directions = List(DirectionInfo)
    stops = List(StopInfo)
    stopInfo = Field(StopInfo, stopId = String())
    directionInfo = Field(DirectionInfo, directionId = String())

    # `parent` is a routeconfig.RouteConfig object

    def resolve_id(parent, info):
        return parent.id

    def resolve_title(parent, info):
        return parent.title

    def resolve_stopInfo(parent, info, stopId):
        return parent.get_stop_info(stopId)

    def resolve_directionInfo(parent, info, directionId):
        return parent.get_direction_info(directionId)

    def resolve_directions(parent, info):
        return parent.get_direction_infos()

    def resolve_stops(parent, info):
        return parent.get_stop_infos()

class RouteInfo(ObjectType):
    id = String()
    title = String()
    config = Field(RouteConfig)

    # `parent` is a routeconfig.RouteConfig object

    def resolve_id(parent, info):
        return parent.id

    def resolve_title(parent, info):
        return parent.title

    def resolve_config(parent, info):
        #agency = config.get_agency(parent.agency_id)
        return parent #agency.get_route_config(parent.id)

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

    # parent is a dict containing "values" property, an array-like containing numeric values

    def resolve_count(parent, info):
        return len(parent["values"])

    def resolve_avg(parent, info):
        values = parent["values"]
        if len(values) > 0:
            return round(np.average(values), ROUND_DIGITS)
        else:
            return None

    def resolve_std(parent, info):
        values = parent["values"]
        if len(values) > 0:
            return round(np.std(values), ROUND_DIGITS)
        else:
            return None

    def resolve_min(parent, info):
        values = parent["values"]
        if len(values) > 0:
            return round(np.min(values), ROUND_DIGITS)
        else:
            return None

    def resolve_median(parent, info):
        values = parent["values"]
        if len(values) > 0:
            return round(np.median(values), ROUND_DIGITS)
        else:
            return None

    def resolve_max(parent, info):
        values = parent["values"]
        if len(values) > 0:
            return round(np.max(values), ROUND_DIGITS)
        else:
            return None

    def resolve_percentiles(parent, info, percentiles = None):
        values = parent["values"]
        if len(values) > 0:
            if percentiles is None:
                percentiles = range(0, 101, 5)
            percentile_values = np.percentile(values, percentiles)
            return get_percentiles_data(percentiles, percentile_values)
        else:
            return None

    def resolve_histogram(parent, info, bin_size = None, min = None, max = None):
        values = parent["values"]
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

    # parent is a dict containing a "wait_stats_arr" key with a list of WaitTimeStats objects

    def resolve_avg(parent, info):
        averages = []
        for wait_stats in parent['wait_stats_arr']:
            avg = wait_stats.get_average()
            if avg is not None:
                averages.append(avg)

        if len(averages) > 0:
            return round(np.average(averages), ROUND_DIGITS)
        else:
            return None

    def resolve_min(parent, info):
        percentiles_data = WaitTimeStats.resolve_percentiles(parent, info, [0])
        return percentiles_data[0]['value'] if percentiles_data is not None else None

    def resolve_median(parent, info):
        percentiles_data = WaitTimeStats.resolve_percentiles(parent, info, [50])
        return percentiles_data[0]['value'] if percentiles_data is not None else None

    def resolve_max(parent, info):
        percentiles_data = WaitTimeStats.resolve_percentiles(parent, info, [100])
        return percentiles_data[0]['value'] if percentiles_data is not None else None

    def resolve_percentiles(parent, info, percentiles = None):
        percentile_values_arr = []

        if percentiles is None:
            percentiles = range(0, 101, 5)

        for wait_stats in parent['wait_stats_arr']:
            percentile_values = wait_stats.get_percentiles(percentiles)
            if percentile_values is not None:
                percentile_values_arr.append(percentile_values)

        if len(percentile_values_arr) > 0:
            # todo: handle multiple days
            percentile_values = percentile_values_arr[0]

            return get_percentiles_data(percentiles, percentile_values)
        else:
            return None

    def resolve_histogram(parent, info, bin_size = 5, min = 0, max = 90):
        histograms = []

        if bin_size < 0:
            bin_size = 5

        bins = np.arange(min, max + bin_size, bin_size)

        for wait_stats in parent['wait_stats_arr']:
            histogram = wait_stats.get_histogram(bins)
            if histogram is not None:
                histograms.append(histogram * 100) # convert to percentages

        if len(histograms) > 0:
            # todo: handle multiple days
            histogram = histograms[0]

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


class ComparisonStats(ObjectType):
    closestDeltaStats = Field(BasicStats)
    nextDeltaStats = Field(BasicStats)

    def resolve_closestDeltaStats(parent, info):
        return {"values": parent["closest_arrival_deltas"]}

    def resolve_nextDeltaStats(parent, info):
        return {"values": parent["next_arrival_deltas"]}

class IntervalMetrics(ObjectType):
    startTime = String()
    endTime = String()
    waitTimes = Field(WaitTimeStats)
    headways = Field(BasicStats)
    tripTimes = Field(BasicStats)
    timetableHeadways = Field(BasicStats)
    timetableComparison = Field(ComparisonStats)

    def resolve_waitTimes(parent, info):
        return {'wait_stats_arr':
            parent["route_metrics"].get_wait_time_stats(
                direction_id = parent["direction_id"],
                stop_id = parent["start_stop_id"],
                rng = parent["range"]
            )
        }

    def resolve_headways(parent, info):
        return {
            'values': parent["route_metrics"].get_headways(
                direction_id = parent["direction_id"],
                stop_id = parent["start_stop_id"],
                rng = parent["range"]
            )
        }

    def resolve_tripTimes(parent, info):
        return {
            'values': parent["route_metrics"].get_trip_times(
                direction_id = parent["direction_id"],
                start_stop_id = parent["start_stop_id"],
                end_stop_id = parent["end_stop_id"],
                rng = parent["range"]
            )
        }

    def resolve_timetableHeadways(parent, info):
        return {
            'values': parent["route_metrics"].get_timetable_headways(
                direction_id = parent["direction_id"],
                stop_id = parent["start_stop_id"],
                rng = parent["range"]
            )
        }

    def resolve_timetableComparison(parent, info):
        return parent["route_metrics"].get_timetable_comparisons(
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

class RouteMetrics(ObjectType):
    trip = Field(TripMetrics,
        startStopId = String(required=True),
        endStopId = String(required = False),
        directionId = String(required = False)
    )

    # parent is a metrics.RouteMetrics object

    def resolve_trip(parent, info, startStopId, endStopId = None, directionId = None):
        return {
            "route_metrics": parent,
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

metrics_api = Schema(query = Query)
