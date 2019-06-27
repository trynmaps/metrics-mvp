import requests
import json

from . import predictions as p


def call_predictions_api(api_key: str, agency: str, stopCode: str = None) -> p.Predictions:
    url = f"http://api.511.org/transit/StopMonitoring?api_key={api_key}&agency={agency}"
    if stopCode:
        url += f"&stopCode={stopCode}"
    resp = requests.get(url)
    if resp.status_code != 200:
        resp.raise_for_status()
    resp.encoding = 'utf-8-sig'
    resp_json = resp.json()
    all_predictions = resp_json['ServiceDelivery']['StopMonitoringDelivery']['MonitoredStopVisit']
    queried_time = resp_json['ServiceDelivery']['ResponseTimestamp']
    predictions_obj = p.Predictions(queried_time)
    for prediction in all_predictions:
        queried_time = prediction['RecordedAtTime']
        route_id = prediction['MonitoredVehicleJourney']['LineRef']
        stop_id = prediction['MonitoredVehicleJourney']['MonitoredCall']['StopPointRef']
        vehicle_id = prediction['MonitoredVehicleJourney']['FramedVehicleJourneyRef']['DatedVehicleJourneyRef']
        arrival_time = prediction['MonitoredVehicleJourney']['MonitoredCall']['AimedArrivalTime']
        direction = prediction['MonitoredVehicleJourney']['DirectionRef']
        new_prediction = p.Prediction(
            queried_time, route_id, stop_id, vehicle_id, arrival_time, direction)
        predictions_obj.add_prediction_to_stop(new_prediction)
    return predictions_obj
