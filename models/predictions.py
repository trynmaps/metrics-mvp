from datetime import datetime, time


class Prediction:
    def __init__(self, route_id: str, stop_id: str, vehicle: str, minutes: str, epoch_time: str, queried_time: datetime, direction_tag: str):
        self.route_id = route_id
        self.stop_id = stop_id
        self.vehicle = vehicle
        self.predicted_minutes = minutes
        self.epoch_time = epoch_time
        self.queried_time = queried_time
        self.direction_tag = direction_tag

    # def get_predicted_arrival_time(self):
        # TODO: convert epoch time to a real time

    def get_queried_time(self):
        return self.queried_time


class Predictions:
    def __init__(self, predictions: list, route_id: str, stop_id: str, queried_time: datetime):
        self.predictions = predictions
        self.route_id = route_id
        self.stop_id = stop_id
        self.queried_time = queried_time

    def get_predictions(self):
        return self.predictions
