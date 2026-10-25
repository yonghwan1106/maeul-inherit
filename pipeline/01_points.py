# P1: village representative points, hub assignment, demand points, population, food-store counts.
# Usage: python -I pipeline/01_points.py <raw_dir> <out_dir>
# Writes out/villages.csv, out/points.csv, out/hubs.csv. ASCII-only source (spec 14).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def main(raw_dir, out_dir):
    rules = C.load_rules()
    osm = C.load_osm(raw_dir)
    els = osm['elements']
    seat = rules['seat']
    ri_list = rules['ri']
    name_to_id = {r['name']: r['id'] for r in ri_list}
    filt = rules['riFilterKm']

    # 1. ri representative points: place=village named like a Hwasan ri, within 8 km of the seat office.
    villages = {}
    for e in els:
        t = e.get('tags', {})
        if e['type'] != 'node' or t.get('place') != 'village':
            continue
        vid = name_to_id.get(t.get('name', ''))
        if not vid:
            continue
        d = C.haversine_km(seat['lat'], seat['lon'], e['lat'], e['lon'])
        if d > filt:
            continue
        if vid in villages:
            raise SystemExit('duplicate ri node within filter: ' + vid)
        villages[vid] = {'id': vid, 'name': t['name'], 'lat': e['lat'], 'lon': e['lon'], 'osmId': e['id']}
    missing = [r['id'] for r in ri_list if r['id'] not in villages]
    if missing:
        raise SystemExit('ri nodes missing: ' + ','.join(missing))

    # seat village = ri node nearest to the seat office
    seat_vid = min(villages, key=lambda v: C.haversine_km(seat['lat'], seat['lon'], villages[v]['lat'], villages[v]['lon']))

    # place nodes (village + hamlet) for nearest-place hub assignment
    places = []
    for e in els:
        t = e.get('tags', {})
        if e['type'] == 'node' and t.get('place') in ('village', 'hamlet'):
            places.append((e['id'], e['lat'], e['lon']))
    rep_osm = {v['osmId']: vid for vid, v in villages.items()}

    # 2-3. hubs: amenity=townhall (node/way center) not an office; assign ri by name, else nearest place node.
    hubs = []
    for e in els:
        t = e.get('tags', {})
        if t.get('amenity') != 'townhall':
            continue
        name = t.get('name', '')
        if not name or any(k in name for k in rules['hubExclude']):
            continue
        lat, lon = C.el_latlon(e)
        if lat is None:
            continue
        if C.haversine_km(seat['lat'], seat['lon'], lat, lon) > filt:
            continue
        vid, how = None, ''
        for r in ri_list:
            if r['name'] in name:
                vid, how = r['id'], 'name'
                break
        if vid is None:
            best = min(places, key=lambda p: (C.haversine_km(lat, lon, p[1], p[2]), p[0]))
            if best[0] in rep_osm:
                vid, how = rep_osm[best[0]], 'nearest_place'
        if vid is None:
            continue
        osm_ref = str(e['id']) if e['type'] == 'node' else 'w' + str(e['id'])
        hubs.append({'id': 'hub_' + osm_ref, 'osmRef': osm_ref, 'name': name, 'lat': lat, 'lon': lon,
                     'villageId': vid, 'assign': how})
    hubs.sort(key=lambda h: h['id'])

    # 5. population: myeon total from D2 (cp949), equal split over 11 ri (assumption)
    cols = rules['moisCols']
    pop_rows = C.read_csv(os.path.join(raw_dir, 'mois_admdong_age_20260930.csv'), encoding='cp949')
    row = next(r for r in pop_rows if r[cols['code']] == rules['myeonAdmCode'])
    total = int(row[cols['total']].replace(',', ''))
    old = 0
    for k, v in row.items():
        digits = ''
        for ch in k:
            if ch.isdigit():
                digits += ch
            else:
                break
        if digits and int(digits) >= 65 and (k.endswith(cols['male']) or k.endswith(cols['female'])):
            old += int(v.replace(',', '') or 0)
    pop_ri = total / len(ri_list)

    # 6. food-store counts per ri from sbiz (ri from jibun-address token, joined by bjd code (52-system))
    sc = rules['sbizCols']
    sb = C.read_csv(os.path.join(raw_dir, 'sbiz_202606_wanju_5myeon.csv'))
    food = set(rules['foodSubs'])
    counts = {r['id']: 0 for r in ri_list}
    bjd_of = {}
    for r in sb:
        if r[sc['admName']] != rules['myeon']:
            continue
        tok = C.ri_token(r[sc['jibun']], rules['riSuffix'])
        vid = name_to_id.get(tok)
        if not vid:
            continue
        code = r[sc['bjdCode']]
        if not code.startswith('52'):
            continue
        bjd_of.setdefault(vid, code)
        if r[sc['major']] == rules['sbizRetailMajor'] and r[sc['sub']] in food:
            counts[vid] += 1

    # 4. demand points
    hubs_by_v = {}
    for h in hubs:
        hubs_by_v.setdefault(h['villageId'], []).append(h)
    points = []
    vrows = []
    for r in ri_list:
        vid = r['id']
        v = villages[vid]
        hv = hubs_by_v.get(vid, [])
        n = 1 + len(hv)
        w = pop_ri / n
        points.append({'id': 'p_%s_node' % vid, 'villageId': vid, 'name': v['name'], 'lat': v['lat'], 'lon': v['lon'],
                       'kind': 'village_node', 'hubResId': '', 'weight': '%.6f' % w})
        for h in hv:
            points.append({'id': 'p_%s_%s' % (vid, h['id']), 'villageId': vid, 'name': h['name'], 'lat': h['lat'],
                           'lon': h['lon'], 'kind': 'hub', 'hubResId': h['id'], 'weight': '%.6f' % w})
        vrows.append({'id': vid, 'name': v['name'], 'lat': v['lat'], 'lon': v['lon'], 'osmId': v['osmId'],
                      'pop': '%.6f' % pop_ri, 'popAssumed': 'true', 'isSeat': 'true' if vid == seat_vid else 'false',
                      'foodStores': counts[vid], 'codeVerified': 'false', 'bjdCode': bjd_of.get(vid, ''),
                      'nHubs': len(hv)})

    os.makedirs(out_dir, exist_ok=True)
    C.write_csv(os.path.join(out_dir, 'villages.csv'),
                ['id', 'name', 'lat', 'lon', 'osmId', 'pop', 'popAssumed', 'isSeat', 'foodStores', 'codeVerified', 'bjdCode', 'nHubs'], vrows)
    C.write_csv(os.path.join(out_dir, 'points.csv'),
                ['id', 'villageId', 'name', 'lat', 'lon', 'kind', 'hubResId', 'weight'], points)
    C.write_csv(os.path.join(out_dir, 'hubs.csv'), ['id', 'osmRef', 'name', 'lat', 'lon', 'villageId', 'assign'], hubs)
    C.write_csv(os.path.join(out_dir, 'myeon.csv'), ['myeonPop', 'pop65', 'pop65Share', 'admCode', 'asOf'],
                [{'myeonPop': total, 'pop65': old, 'pop65Share': '%.4f' % (old / total), 'admCode': rules['myeonAdmCode'],
                  'asOf': '2026-09-30'}])

    o = C.out_text()
    o.write('P1 villages=%d hubs=%d points=%d myeonPop=%d pop65=%d (%.1f%%) seat=%s\n' % (
        len(vrows), len(hubs), len(points), total, old, 100.0 * old / total, seat_vid))
    for v in vrows:
        o.write('  %-10s %s hubs=%d food=%d\n' % (v['id'], v['name'], v['nHubs'], v['foodStores']))
    o.flush()


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
