from datetime import datetime, time
import re
import os
import json
from . import util, siri_api, constants


class Prediction:
    def __init__(self, queried_time: str, route_id: str, stop_id: str, trip_id: str, arrival_time: str, direction: str, agency: str):
        self.queried_time = queried_time
        self.route_id = route_id
        self.stop_id = stop_id
        self.trip_id = trip_id
        self.arrival_time = arrival_time
        self.direction = direction
        self.agency = agency

    def get_predicted_minutes_to_arrival(self):
        queried_date_time = datetime.strptime(
            self.queried_time, "%Y-%m-%dT%H:%M:%SZ")
        arrival_date_time = datetime.strptime(
            self.arrival_time, "%Y-%m-%dT%H:%M:%SZ")
        prediction_in_s = (arrival_date_time -
                           queried_date_time).total_seconds()
        prediction_in_m = divmod(prediction_in_s, 60)[0]
        return prediction_in_m

    @classmethod
    def from_data(cls, data: dict):
        return cls(
            queried_time=data['queried_time'],
            route_id=data['route_id'],
            stop_id=data['stop_id'],
            trip_id=data['trip_id'],
            arrival_time=data['arrival_time'],
            direction=data['direction'],
            agency=data['agency'],
        )

    def get_data(self):
        return {
            'queried_time': self.queried_time,
            'route_id': self.route_id,
            'stop_id': self.stop_id,
            'trip_id': self.trip_id,
            'arrival_time': self.arrival_time,
            'direction': self.direction,
            'agency': self.agency
        }


class PredictionsByStop:
    def __init__(self, stop_id: str, queried_time, prediction_data: list, agency: str):
        self.queried_time = queried_time
        self.stop_id = stop_id
        self.prediction_data = prediction_data
        self.agency = agency

    def add_prediction(self, prediction: Prediction):
        self.prediction_data.append(prediction)

    @classmethod
    def from_data(cls, data: dict):
        predictions = [Prediction.from_data(p) for p in data['predictions']]
        return cls(
            stop_id=data['stop_id'],
            queried_time=data['queried_time'],
            prediction_data=predictions,
            agency=data['agency'],
        )

    def get_data(self):
        return {
            'queried_time': self.queried_time,
            'stop_id': self.stop_id,
            'prediction_data': self.prediction_data,
            'agency': self.agency,
        }


class AllPredictions:
    def __init__(self, stops_to_predictions):
        self.stops_to_predictions = stops_to_predictions

    def get_stops_to_predictions(self):
        return self.stops_to_predictions

    @classmethod
    def from_data(cls, data: dict):
        return


def get_cache_path(agency: str, datetime: datetime) -> str:
    datetime_str = datetime.strftime("%m-%d-%Y_%H-%S")
    if re.match(r'^[\w\-]+$', agency) is None:
        raise Exception(f"Invalid agency: {agency}")

    if re.match(r'^[\w\-]+$', datetime_str) is None:
        raise Exception(f"Invalid date: {datetime_str}")

    return os.path.join(util.get_data_dir(), f"predictions_{agency}_{datetime_str}.json")


def get_all_predictions(agency: str, datetime: datetime) -> AllPredictions:
    # TODO: round to the nearest 5 minutes
    cache_path = get_cache_path(agency, datetime)
    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return json.loads(text)
    except FileNotFoundError:
        pass

    # eventually want to call out to S3 here

    all_predictions = siri_api.get_all_predictions(
        constants.SIRI_API_KEY_TEST, 'sf'
    )
    all_prediction_data = {}
    for stop_id in all_predictions:
        all_prediction_data[stop_id] = [
            p.get_data() for p in all_predictions[stop_id].get_data()['prediction_data']]

    with open(cache_path, "w+") as f:
        json.dump(all_prediction_data, f)
    return all_prediction_data
