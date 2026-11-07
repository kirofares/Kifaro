"""Scoped XML regression and exact-byte preservation checks; no paid data."""
import hashlib
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / 'scripts/spotters/svg-xml-repairs.json').read_text())


class SvgXmlRepairs(unittest.TestCase):
    def test_fifteen_distinct_existing_assets(self):
        self.assertEqual(len(MANIFEST), 15)
        self.assertEqual(len({row['path'] for row in MANIFEST}), 15)

    def test_xml_and_exact_preservation(self):
        for row in MANIFEST:
            with self.subTest(path=row['path']):
                repaired = (ROOT / row['path']).read_bytes()
                self.assertEqual(hashlib.sha256(repaired).hexdigest(), row['fixed_sha256'])
                root = ET.fromstring(repaired)
                self.assertEqual(root.tag, '{http://www.w3.org/2000/svg}svg')
                self.assertEqual(repaired.count(b'&amp;'), row['replacements'])
                # All 15 originals had exactly one literal ampersand and no entities.
                # Reversing only that encoding must recover EVERY original byte.
                original = repaired.replace(b'&amp;', b'&')
                self.assertEqual(hashlib.sha256(original).hexdigest(), row['original_sha256'])
                with self.assertRaises(ET.ParseError):
                    ET.fromstring(original)


if __name__ == '__main__':
    unittest.main()
