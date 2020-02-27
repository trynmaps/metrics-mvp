import backend_path
import unittest
import datetime
import numpy as np
from backend.models import config


class ConfigTest(unittest.TestCase):
    def test_get_agency(self):
        muni = config.get_agency("muni")

        self.assertEqual(muni.id, "muni")
        self.assertEqual(muni.provider, "nextbus")
        self.assertEqual(muni.timezone_id, "America/Los_Angeles")
        self.assertEqual(muni.tz.zone, "America/Los_Angeles")
        self.assertEqual(muni.nextbus_id, "sf-muni")

        portland_sc = config.get_agency("portland-sc")
        self.assertEqual(portland_sc.id, "portland-sc")
        self.assertEqual(portland_sc.gtfs_agency_id, "PSC")

        test = config.get_agency("test")
        self.assertEqual(test.id, "test")

        with self.assertRaises(FileNotFoundError):
            config.get_agency("invalid")


if __name__ == "__main__":
    unittest.main()
