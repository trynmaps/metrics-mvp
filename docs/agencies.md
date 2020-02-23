# Configuring transit agencies

New transit agencies can be supported by adding a small YAML configuration file at /backend/agencies/<agency-id>.yaml .

The transit agency in the frontend can be configured by setting OPENTRANSIT_AGENCY_IDS environment variable to a comma delimited string of agency IDs.

In development, this can be configured via a docker-compose.override.yml file like this:

```
version: "3.7"
services:
  flask-dev:
    environment:
      OPENTRANSIT_AGENCY_IDS: portland-sc,trimet
```

The configuration settings for each agency are:

`id` - must match the agency ID used by orion and tryn-api (e.g. "muni", not "sf-muni")

`provider` - can be set to `nextbus` for Nextbus-based agencies to augment the static GTFS data with data from the Nextbus API.

`nextbus_agency_id` - for Nextbus-based agencies, the ID of the agency in Nextbus API (e.g. "sf-muni")

`timezone_id` - local time zone of agency, e.g. "America/Los_Angeles"

`gtfs_url` - public url where static GTFS ZIP file can be downloaded

`route_id_gtfs_field` - the column name in routes.txt in the static GTFS feed where the route ID that is used by OpenTransit is stored. By default this is the column named `route_id`. However, some providers store an opaque route ID in this column that would not have meaning to riders and that is different from the route ID stored by orion and returned by tryn-api. These agencies generally return the route ID in the column named `route_short_name`. The route ID used by metrics-mvp must be the same as the same as the route ID used by orion and tryn-api (for Nextbus agencies, this is the same as the route ID Nextbus). There is an added edge case for Muni where some routes have a `route_short_name` containing a dash in the GTFS file (e.g. T-OWL), but Nextbus returns a route ID containing an underscore (e.g. T_OWL). For now, the code replace dashes with underscores in the route IDs for all agencies using the nextbus provider, although it may be possible that there are other Nextbus agencies that actually do have dashes in the Nextbus route IDs.

`stop_id_gtfs_field` - the column name in stops.txt in the static GTFS feed where the stop ID that is used by OpenTransit is stored. By default this is the column named `stop_id`. However, you can override it with another column from stops.txt, such as `stop_code`. This may be helpful because some agencies may have multiple stop_ids that correspond to the same logical stop.

`default_directions` - an optional object with keys for each GTFS direction_id, and object values containing metadata for that direction_id (which applies to all routes unless overridden by custom_directions). This setting allows configuring the prefix of the direction title in the web UI, e.g.:
```
default_directions:
  '0':
    title_prefix: Outbound
  '1':
    title_prefix: Inbound
```

`custom_default_directions` - an extension of `default_directions`; it is an optional object with keys for each `default_directions` object you provide that also contains a `route` field where you provide the list of routes that the rule should apply to. This field can be provided in addition to `default_directions`. In the example below, a direction_id of '0' can have multiple meanings such as Outbound or Eastbound depending on the route:
```
  'inbound-outbound':
    '0':
      title_prefix: Outbound
    '1':
      title_prefix: Inbound
    routes: [
      'KT', 'L', 'M', 'N', 'J', 'E', 'F'
    ]
  'east-west':
    '0':
      title_prefix: Eastbound
    '1':
      title_prefix: Westbound
    routes: [
      '2', '3', '4', '501', '502', '503', '504', '505', '506', '508', '509', '512'
    ]
```

`custom_directions` - an optional object that allows manually defining directions for certain routes, in order to support routes with multiple branches. Each key in this object is a route ID, and the value is an array of directions for that route, with the properties `id`, `title` (optional), `gtfs_direction_id`, `included_stop_ids` (optional), and `excluded_stop_ids` (optional).

The `gtfs_direction_id`, `included_stop_ids`, and `excluded_stop_ids` properties are used to filter the shape_ids referred to by trips.txt in the GTFS feed. Each custom direction should match at least one shape in the GTFS feed. If a custom direction can be matched to multiple shapes, it is matched to the one associated with the most trips in the GTFS feed. If a custom direction cannot be matched to any shapes, the direction will be omitted and an exception will be raised by save_routes.py after saving the new routes file. If included_stop_ids contains multiple stop IDs, they must be listed in order.

For example:

```
custom_directions:
  '38':
    - id: "1-48th"
      title: "Inbound from 48th Ave & Point Lobos Ave to Transit Center"
      gtfs_direction_id: "1"
      included_stop_ids: ["13608"]
    - id: "1-VA"
      title: "Inbound from V.A. Hospital to Transit Center"
      gtfs_direction_id: "1"
      included_stop_ids: ["15511"]
    - id: "0-32nd"
      gtfs_direction_id: "0"
      included_stop_ids: ["14275"]
    - id: "0-48th"
      gtfs_direction_id: "0"
      included_stop_ids: ["13608"]
      excluded_stop_ids: ["15511"]
    - id: "0-VA"
      title: "Outbound to 48th Ave & Point Lobos Ave via V.A. Hospital"
      gtfs_direction_id: "0"
      included_stop_ids: ["15511","13608"]
```

If a route is not included in custom_directions, OpenTransit will use the shape and sequence of stops that appears the most often in stop_times.txt for each GTFS direction_id (after merging shapes with common subsequences of stops).

`default_day_start_hour` - the hour (integer) that OpenTransit considers the beginning of the day. This allows associating trips after midnight with the previous day.

`custom_day_start_hours` - array of objects with `start_hour`, `routes` properties that override `default_day_start_hour`

`invalid_direction_times` - array of objects with `start_time`, `end_time` and `directions` properties that allows compute_arrivals.py to ignore GPS observations from vehicles that are deadheading (returning the other direction from a one-way express route).

`js_properties` - an object with arbitrary key/value pairs that are available in the agency object in the frontend JS code.

### Frontend configuration

Agency-specific configuration is not compiled directly into the React JavaScript code. Instead, the HTML page hosting the React code first loads a script tag from the backend at the URL /api/js_config , which sets the global variable `window.OpentransitConfig`. The `config` React module reads this variable and exposes the constants `Agencies` (array of agency objects) and `S3Bucket` (name of the S3 bucket where route configuration, arrival times, cached wait time stats, and cached trip time stats are stored).

Note: for testing with other devices on your local network, update `REACT_APP_METRICS_BASE_URL` in docker-compose.yml to refer to the right network address, rather than localhost.

Currently the frontend only displays routes from the first agency in the Agencies array (for the first agency listed in `OPENTRANSIT_AGENCY_IDS`). However, a future version of the frontend could use this configuration to display statistics from multiple transit agencies in the same region.

To make it easy to pass arbitrary agency-specific data to javascript, the `js_properties` setting in the agency configuration file can be an object with arbitrary key/value pairs. Currently the frontend uses the keys `routeHeuristics`, `serviceArea`, `defaultDisabledRoutes`, `title`, `initialMapCenter`, and `initialMapZoom`. The `timezone_id` setting in the agency configuration file is also passed to the backend as `timezoneId`.
