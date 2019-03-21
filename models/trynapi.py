import requests
import urllib
import json

def get_state(agency, start_time_ms, end_time_ms, route_ids):
    tryn_agency = 'muni' if agency == 'sf-muni' else agency

    params = f'trynState(agency: {json.dumps(tryn_agency)}, startTime: {json.dumps(str(start_time_ms))}, endTime: {json.dumps(str(end_time_ms))}, routes: {json.dumps(route_ids)})'

    query = f"""{{
       {params} {{
        agency
        startTime
        routes {{
          rid
          routeStates {{
            vtime
            vehicles {{ vid lat lon did }}
          }}
        }}
      }}
    }}"""

    print(params)

    query_url = "https://06o8rkohub.execute-api.us-west-2.amazonaws.com/dev/graphql?query="+query
    r = requests.get(query_url)

    print(f"   response length = {len(r.text)}")

    return json.loads(r.text)
