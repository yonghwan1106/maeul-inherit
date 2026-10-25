# Shared helpers for the pipeline. ASCII-only source; Korean strings live in rules_ko.json.
# Run with `python -I`; every file is opened with an explicit encoding.
import csv
import hashlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R_EARTH_KM = 6371.0088


def load_rules():
    with open(os.path.join(HERE, 'rules_ko.json'), encoding='utf-8') as f:
        return json.load(f)


def load_osm(raw_dir):
    with open(os.path.join(raw_dir, 'osm_5myeon_20261025.json'), encoding='utf-8') as f:
        return json.load(f)


def haversine_km(lat1, lon1, lat2, lon2):
    p = math.pi / 180.0
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 2 * R_EARTH_KM * math.asin(min(1.0, math.sqrt(a)))


def el_latlon(e):
    if 'lat' in e and 'lon' in e:
        return e['lat'], e['lon']
    c = e.get('center')
    if c:
        return c['lat'], c['lon']
    return None, None


def write_csv(path, cols, rows):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator='\n')
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, '') for k in cols})


def read_csv(path, encoding='utf-8'):
    with open(path, encoding=encoding, newline='') as f:
        return list(csv.DictReader(f))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def out_text():
    # stdout as UTF-8 without touching PYTHONUTF8 (spec 13).
    return open(sys.stdout.fileno(), 'w', encoding='utf-8', closefd=False)


def ri_token(jibun, suffix):
    """Return the first address token ending with the ri suffix (e.g. '...ri'), or ''."""
    for tok in jibun.split():
        if len(tok) > 1 and tok.endswith(suffix):
            return tok
    return ''
