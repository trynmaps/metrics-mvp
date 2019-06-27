from datetime import datetime, time


class Prediction:
    def __init__(self, queried_time: str, route_id: str, stop_id: str, vehicle_id: str, arrival_time: str, direction: str):
        self.queried_time = queried_time
        self.route_id = route_id
        self.stop_id = stop_id
        self.vehicle_id = vehicle_id
        self.arrival_time = arrival_time
        self.direction = direction

    def get_predicted_minutes_to_arrival(self):
        queried_time_stamp = datetime.strptime(
            self.queried_time, "%Y-%m-%dT%H:%M:%SZ")
        arrival_time_stamp = datetime.strptime(
            self.arrival_time, "%Y-%m-%dT%H:%M:%SZ")
        prediction_in_s = (arrival_time_stamp -
                           queried_time_stamp).total_seconds()
        prediction_in_m = divmod(prediction_in_s, 60)[0]
        return prediction_in_m


class Predictions:
    def __init__(self, queried_time: str):
        self.stop_id_to_predictions = {}
        self.queried_time = queried_time

    def add_prediction_to_stop(self, prediction: Prediction):
        stop_id = prediction.stop_id
        if stop_id not in self.stop_id_to_predictions:
            self.stop_id_to_predictions[stop_id] = []
        self.stop_id_to_predictions[stop_id].append(prediction)
    
    def get_predictions_for_stop(self, stop_id: str) -> Prediction:
      if stop_id not in self.stop_id_to_predictions:
        raise Exception(f"Stop ID not found for predictions at time {self.queried_time}")
      return self.stop_id_to_predictions['stop_id']
