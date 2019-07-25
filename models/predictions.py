from datetime import datetime, time
import re
import os
import json
from . import util, constants, nextbus_predictions as np


class Prediction:
    def __init__(self, route_id, stop_id, vehicle_id, minutes_to_arrival, epoch_time, queried_time, dir_tag):
        self.route_id = route_id
        self.stop_id = stop_id
        self.vehicle_id = vehicle_id
        self.minutes_to_arrival = minutes_to_arrival
        self.epoch_time = epoch_time
        self.dir_tag = dir_tag
        self.queried_time = queried_time

    @classmethod
    def from_data(cls, data: dict):
        return cls(
            queried_time=data['queried_time'],
            route_id=data['route_id'],
            stop_id=data['stop_id'],
            vehicle_id=data['vehicle_id'],
            dir_tag=data['dir_tag'],
            minutes_to_arrival=data['minutes_to_arrival'],
            epoch_time=data['epoch_time'],
        )

    def get_data(self):
        return {
            'queried_time': self.queried_time,
            'route_id': self.route_id,
            'stop_id': self.stop_id,
            'vehicle_id': self.vehicle_id,
            'dir_tag': self.dir_tag,
            'minutes_to_arrival': self.minutes_to_arrival,
            'epoch_time': self.epoch_time
        }

# Not used currently since we're only getting predictions for one route at a time.
# We will use in the future however, so want to leave this in for future use.
class PredictionsByStop:
    def __init__(self, stop_id: str, queried_time, predictions: list, agency: str):
        self.queried_time = queried_time
        self.stop_id = stop_id
        self.predictions = predictions
        self.agency = agency

    def add_prediction(self, prediction: Prediction):
        self.predictions.append(prediction)

    @classmethod
    def from_data(cls, data: dict):
        predictions = [Prediction.from_data(p) for p in data['predictions']]
        return cls(
            stop_id=data['stop_id'],
            queried_time=data['queried_time'],
            predictions=predictions,
            agency=data['agency'],
        )

    def get_data(self):
        return {
            'queried_time': self.queried_time,
            'stop_id': self.stop_id,
            'predictions': [p.get_data() for p in self.predictions],
            'agency': self.agency,
        }

# Not used currently.
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


def get_predictions_for_route(agency: str, route_id: str) -> list:
    # TODO: add cache path logic

    route_to_prediction_request = np.create_predictions_requests('sf-muni')
    request_url = route_to_prediction_request[route_id]
    return np.get_prediction_data_for_request(request_url)
