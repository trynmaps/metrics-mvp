class StopNotOnRouteError(Exception):
   """Raised when stop does not exist on route"""
   pass

class FirstBusOfDayError(Exception):
   """Raised for errors when calculating timing before the first bus of the day"""
   pass