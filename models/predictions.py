from datetime import datetime, time
import re
import os
import json
from . import util, siri_api, constants


class Prediction:
    def __init__(self, queried_time: str, route_id: str, stop_id: str, vehicle_id: str, arrival_time: str, direction: str, agency: str):
        self.queried_time = queried_time
        self.route_id = route_id
        self.stop_id = stop_id
        self.vehicle_id = vehicle_id
        self.arrival_time = arrival_time
        self.direction = direction
        self.agency = agency

    def get_predicted_minutes_to_arrival(self):
        queried_time_stamp = datetime.strptime(
            self.queried_time, "%Y-%m-%dT%H:%M:%SZ")
        arrival_time_stamp = datetime.strptime(
            self.arrival_time, "%Y-%m-%dT%H:%M:%SZ")
        prediction_in_s = (arrival_time_stamp -
                           queried_time_stamp).total_seconds()
        prediction_in_m = divmod(prediction_in_s, 60)[0]
        return prediction_in_m

    @classmethod
    def from_data(cls, data: dict):
        return cls(
            queried_time=data['queried_time'],
            route_id=data['route_id'],
            stop_id=data['stop_id'],
            vehicle_id=data['vehicle_id'],
            arrival_time=data['arrival_time'],
            direction=data['direction'],
            agency=data['agency'],
        )


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


def get_cache_path(agency: str, stop_id: str, datetime: datetime) -> str:
    datetime_str = str(datetime)
    if re.match(r'^[\w\-]+$', agency) is None:
        raise Exception(f"Invalid agency: {agency}")

    if re.match(r'^[\w\-]+$', stop_id) is None:
        raise Exception(f"Invalid stop id: {stop_id}")

    if re.match(r'^[\w\-]+$', datetime_str) is None:
        raise Exception(f"Invalid date: {datetime_str}")

    return os.path.join(util.get_data_dir(), f"predictions_{agency}/{datetime_str}/predictions_{agency}_{datetime_str}_{stop_id}.json")


def get_predictions_by_stop(agency: str, stop_id: str, datetime: datetime) -> PredictionsByStop:
    # TODO: round to the nearest 5 minutes
    cache_path = get_cache_path(agency, stop_id, datetime)
    try:
        with open(cache_path, "r") as f:
            text = f.read()
            return PredictionsByStop.from_data(json.loads(text))
    except FileNotFoundError:
        pass

    # eventually want to call out to S3 here

    predictions_by_stop = siri_api.get_predictions_by_stop_id(
        constants.SIRI_API_KEY_TEST, 'SF', stop_id)
    with open(cache_path, "w") as f:
        f.write(predictions_by_stop.get_data())

    return predictions_by_stop
