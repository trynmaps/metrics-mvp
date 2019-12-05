#!/usr/bin/env python
"""
save_predictions.py

Run by a cronjob, we pull the predictions for everything on all lines, every 15 seconds,

and save it to a json file

"""

import time
import random
import bz2
import models.predictions

routes = "E,F,J,KT,KLM,L,M,N,NX,S,1,1AX,1BX,2,3,5,5R,6,7,7X,8,8AX,8BX,9,9R,10,12,14,14R,14X,18,19,21,22,23,24,25,27,28,28R,29,30,30X,31,31AX,31BX,33,35,36,37,38,38R,38AX,38BX,39,41,43,44,45,47,48,49,52,54,55,56,57,66,67,76X,78X,79X,81X,82X,83X,88,714,PM,PH,C".split(",")
i = 1
while True:
    print(f"run number {i}")
    i += 1
    for route in routes:
        print(route)
        predictions = models.predictions.get_predictions_for_route('sf-muni',route)
        if predictions is None:
            continue

        with bz2.open("route_predictions.csv.bz2", "at") as flines:
            output_data = ""
            headers = ["queried_time", "route_id", "stop_id", "vehicle_id", "dir_tag", "minutes_to_arrival"]
            for prediction in predictions:
                prediction_data = prediction.get_data()
                output_data += ",".join(str(prediction_data[header]) for header in headers)
                output_data += "\n"
                print(prediction.queried_time)
            flines.write(output_data)
            time.sleep(random.random()/10) # Wait somewhere between 0 and 0.1 seconds
    
