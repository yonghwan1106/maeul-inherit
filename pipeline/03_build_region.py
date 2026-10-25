# P3: build data/region_hwasan.json (Region, spec 5.1) from P1/P2 outputs + derived resources.
# Usage: python -I pipeline/03_build_region.py <out_dir> <region_json>
# Python writes FACTS only; per-route cells are built in TypeScript (lib/ontology.ts, engine/cells.ts).
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

BBOX = (35.87, 127.12, 36.10, 127.34)


def main(out_dir, region_path):
    rules = C.load_rules()
    raw_dir = os.path.join(os.path.dirname(os.path.abspath(out_dir)), 'raw')
    der = rules['derived']

    villages = []
    codes = {}
    for v in C.read_csv(os.path.join(out_dir, 'villages.csv')):
        villages.append({'id': v['id'], 'name': v['name'], 'lat': float(v['lat']), 'lon': float(v['lon']),
                         'pop': round(float(v['pop']), 4), 'popAssumed': v['popAssumed'] == 'true',
                         'isSeat': v['isSeat'] == 'true', 'foodStores': int(v['foodStores']),
                         'codeVerified': v['codeVerified'] == 'true'})
        if v['bjdCode']:
            codes[v['id']] = v['bjdCode']

    points = []
    for p in C.read_csv(os.path.join(out_dir, 'points.csv')):
        o = {'id': p['id'], 'villageId': p['villageId'], 'name': p['name'], 'lat': float(p['lat']),
             'lon': float(p['lon']), 'kind': p['kind'], 'weight': round(float(p['weight']), 4)}
        if p['hubResId']:
            o['hubResId'] = p['hubResId']
        points.append(o)

    resources = []
    hubs = []
    for r in C.read_csv(os.path.join(out_dir, 'resources.csv')):
        o = {'id': r['id'], 'name': r['name'], 'cls': r['cls'], 'src': r['src'].split('|'),
             'lat': float(r['lat']), 'lon': float(r['lon'])}
        for k in ('myeon', 'villageId', 'sbizNo', 'sbizSub', 'supplierClass'):
            if r[k]:
                o[k] = r[k]
        if r['judgeUnknown'] == 'true':
            o['judgeUnknown'] = True
        if r['mergedFrom']:
            o['mergedFrom'] = r['mergedFrom'].split('|')
        o['note'] = r['note']
        resources.append(o)
        if r['cls'] == 'hub':
            hubs.append(o)

    # derived resources (no location)
    resources.append({'id': 'tour_A', 'name': der['tour_A']['name'], 'cls': 'tour', 'src': ['derived'],
                      'anonymized': True, 'note': der['tour_A']['note'], 'evidenceUrl': der['tour_A']['evidenceUrl']})
    resources.append({'id': 'care_link', 'name': der['care_link']['name'], 'cls': 'care_link', 'src': ['derived'],
                      'note': der['care_link']['note'], 'evidenceUrl': der['care_link']['evidenceUrl']})
    for h in hubs:
        osm_id = h['id'][len('hub_'):]
        resources.append({'id': 'hubdrop_hanaro_hwasan_%s' % osm_id,
                          'name': der['hubdropName'].replace('{hub}', h['name']), 'cls': 'hubdrop',
                          'src': ['derived'], 'lat': h['lat'], 'lon': h['lon'], 'myeon': rules['myeon'],
                          'villageId': h['villageId'], 'deliverer': 'hanaro_hwasan', 'hubId': h['id'],
                          'note': der['hubdropNote']})
    resources.sort(key=lambda x: x['id'])

    # bus stops within busStopKm of the seat office (optional "bus" condition only)
    seat = rules['seat']
    osm = C.load_osm(raw_dir)
    bus = []
    for e in osm['elements']:
        if e.get('tags', {}).get('highway') == 'bus_stop' and e['type'] == 'node':
            if C.haversine_km(seat['lat'], seat['lon'], e['lat'], e['lon']) <= rules['busStopKm']:
                bus.append([round(e['lat'], 7), round(e['lon'], 7)])
    bus.sort()

    myeon = C.read_csv(os.path.join(out_dir, 'myeon.csv'))[0]
    inputs = {}
    for fn in sorted(os.listdir(raw_dir)):
        inputs['pipeline/raw/' + fn] = C.sha256_file(os.path.join(raw_dir, fn))
    inputs['pipeline/rules_ko.json'] = C.sha256_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rules_ko.json'))
    kst = datetime.timezone(datetime.timedelta(hours=9))
    meta = {
        'name': 'region_hwasan',
        'myeon': rules['myeon'],
        'seat': seat,
        'bbox': list(BBOX),
        'sources': rules['sources'],
        'osmBaseTime': osm.get('osm3s', {}).get('timestamp_osm_base', ''),
        'odbl': '© OpenStreetMap contributors. data/region_hwasan.json은 OpenStreetMap 파생 데이터로 ODbL 1.0을 따릅니다.',
        'assumptions': rules['assumptions'],
        'myeonPop': int(myeon['myeonPop']),
        'pop65': int(myeon['pop65']),
        'pop65Share': float(myeon['pop65Share']),
        'popAsOf': myeon['asOf'],
        'villageBjdCodes': codes,
        'codeVerified': False,
        'generatedAt': datetime.datetime.now(kst).replace(microsecond=0).isoformat(),
        'inputSha256': inputs,
        'busStops': bus,
    }
    region = {'meta': meta, 'villages': villages, 'points': points, 'resources': resources}
    os.makedirs(os.path.dirname(os.path.abspath(region_path)), exist_ok=True)
    with open(region_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(region, f, ensure_ascii=False, indent=1)
        f.write('\n')
    o = C.out_text()
    o.write('P3 villages=%d points=%d resources=%d busStops=%d -> %s\n' % (
        len(villages), len(points), len(resources), len(bus), region_path))
    o.flush()


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
