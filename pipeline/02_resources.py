# P2: replacement resources from OSM + sbiz (rule classification, merge).
# Usage: python -I pipeline/02_resources.py <raw_dir> <out_dir>
# Reads out/hubs.csv from P1. Writes out/resources.csv and out/sbiz_classified.csv. ASCII-only source.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

COLS = ['id', 'name', 'cls', 'src', 'lat', 'lon', 'myeon', 'villageId', 'sbizNo', 'sbizSub', 'supplierClass',
        'reason', 'mergedFrom', 'note', 'judgeUnknown']

FIXED = {
    ('node', 10864068901): 'hanaro_hwasan',
    ('node', 368648568): 'bank_nh_hwasan',
    ('node', 368880742): 'post_hwasan',
}


def normalize(name, rules):
    s = name
    for a, b in rules['nameNormalize']['aliases']:
        s = s.replace(a, b)
    for d in rules['nameNormalize']['drop']:
        s = s.replace(d, '')
    return s


def classify_sbiz(name, sub, rules):
    """Return (supplierClass, exclude, reason)."""
    for rule in rules['supplierRules']:
        for kw in rule['keywords']:
            if kw in name:
                return rule['class'], rule['exclude'], 'keyword:' + kw
    if sub in rules['subGroups']['meatFish']:
        return rules['supplierFresh'], False, 'sub:' + sub
    return rules['supplierUnknown'], False, 'no_rule'


def sbiz_cls(sub, rules):
    g = rules['subGroups']
    if sub in g['daily']:
        return 'store_daily'
    return 'store_fresh'  # meat/fish or veg (non-producer)


def main(raw_dir, out_dir):
    rules = C.load_rules()
    osm = C.load_osm(raw_dir)
    els = osm['elements']
    notes = rules['notes']
    o_cfg = rules['osm']

    # myeon of an OSM point = nearest seat office ("... haengjeongbokjisenteo") name's first token
    offices = []
    for e in els:
        t = e.get('tags', {})
        if t.get('amenity') == 'townhall' and rules['seatOfficeKeyword'] in t.get('name', ''):
            lat, lon = C.el_latlon(e)
            nm = t['name']
            cut = [i for i, ch in enumerate(nm[:5]) if ch in (rules['myeonSuffix'], '읍')]
            if cut:
                offices.append((nm[:cut[0] + 1], lat, lon))

    def myeon_of(lat, lon):
        if not offices:
            return ''
        return min(offices, key=lambda x: C.haversine_km(lat, lon, x[1], x[2]))[0]

    res = []
    # --- OSM
    for e in els:
        t = e.get('tags', {})
        lat, lon = C.el_latlon(e)
        if lat is None:
            continue
        shop, amen = t.get('shop'), t.get('amenity')
        name = t.get('name', '')
        branch = t.get('branch', '')
        cls = None
        if shop == 'supermarket' and (o_cfg['hanaroKeyword'] in name or o_cfg['hanaroKeyword'] in t.get('brand', '')):
            cls = 'hanaro'
        elif shop in ('supermarket', 'convenience'):
            cls = 'store_daily'
        elif amen == 'bank':
            cls = 'bank'
        elif amen == 'post_office':
            cls = 'post'
        if cls is None:
            continue
        rid = FIXED.get((e['type'], e['id'])) or ('osm_%s%d' % ('n' if e['type'] == 'node' else 'w', e['id']))
        disp = name
        if branch and branch not in name:
            disp = '%s(%s)' % (name, branch)
        if rid == 'hanaro_hwasan':
            disp = o_cfg['hanaroHwasanName']
        elif rid == 'bank_nh_hwasan':
            disp = o_cfg['bankNhHwasanName']
        elif rid == 'post_hwasan':
            disp = o_cfg['postHwasanName']
        note = notes['osmShop'] if cls in ('hanaro', 'store_daily') else notes['osmPublic']
        res.append({'id': rid, 'name': disp, 'cls': cls, 'src': 'osm', 'lat': lat, 'lon': lon,
                    'myeon': myeon_of(lat, lon), 'villageId': '', 'sbizNo': '', 'sbizSub': '', 'supplierClass': '',
                    'reason': 'osm:%s=%s' % ('shop' if shop else 'amenity', shop or amen), 'mergedFrom': '', 'note': note,
                    'judgeUnknown': 'false', '_osmType': e['type'], '_norm': normalize(name + branch, rules)})

    # --- hubs (from P1)
    for h in C.read_csv(os.path.join(out_dir, 'hubs.csv')):
        res.append({'id': h['id'], 'name': h['name'], 'cls': 'hub', 'src': 'osm', 'lat': float(h['lat']),
                    'lon': float(h['lon']), 'myeon': rules['myeon'], 'villageId': h['villageId'], 'sbizNo': '',
                    'sbizSub': '', 'supplierClass': '', 'reason': 'osm:amenity=townhall;assign=' + h['assign'],
                    'mergedFrom': '', 'note': notes['hub'], 'judgeUnknown': 'false', '_osmType': 'hub', '_norm': ''})

    # --- sbiz
    sc = rules['sbizCols']
    name_to_id = {r['name']: r['id'] for r in rules['ri']}
    food = set(rules['foodSubs'])
    classified = []
    for r in C.read_csv(os.path.join(raw_dir, 'sbiz_202606_wanju_5myeon.csv')):
        if r[sc['major']] != rules['sbizRetailMajor'] or r[sc['sub']] not in food:
            continue
        name, sub = r[sc['name']], r[sc['sub']]
        sup, excl, reason = classify_sbiz(name, sub, rules)
        classified.append({'sbizNo': r[sc['no']], 'name': name, 'sub': sub, 'myeon': r[sc['admName']],
                           'jibun': r[sc['jibun']], 'supplierClass': sup, 'exclude': 'true' if excl else 'false',
                           'reason': reason})
        if excl:
            continue
        myeon = r[sc['admName']]
        vid = ''
        if myeon == rules['myeon']:
            vid = name_to_id.get(C.ri_token(r[sc['jibun']], rules['riSuffix']), '')
        judge = sup == rules['supplierUnknown']
        note = notes['sbiz'] + (' · ' + notes['judgeUnknown'] if judge else '')
        res.append({'id': 'sbiz_' + r[sc['no']], 'name': name, 'cls': sbiz_cls(sub, rules), 'src': 'sbiz',
                    'lat': float(r[sc['lat']]), 'lon': float(r[sc['lon']]), 'myeon': myeon, 'villageId': vid,
                    'sbizNo': r[sc['no']], 'sbizSub': sub, 'supplierClass': sup, 'reason': reason, 'mergedFrom': '',
                    'note': note, 'judgeUnknown': 'true' if judge else 'false', '_osmType': 'sbiz',
                    '_norm': normalize(name, rules)})

    # --- merge: normalized names equal or contained, within mergeM metres, same class
    lim_km = rules['mergeM'] / 1000.0
    rank = {'osm': 0, 'hub': 0, 'sbiz': 1}
    res.sort(key=lambda x: (0 if x['id'] in FIXED.values() else 1, x['_osmType'] != 'node', x['id']))
    kept = []
    for r in res:
        target = None
        if r['cls'] != 'hub' and r['_norm']:
            for k in kept:
                if k['cls'] != r['cls'] or not k['_norm']:
                    continue
                if C.haversine_km(k['lat'], k['lon'], r['lat'], r['lon']) > lim_km:
                    continue
                if k['_norm'] == r['_norm'] or k['_norm'] in r['_norm'] or r['_norm'] in k['_norm']:
                    target = k
                    break
        if target is None:
            kept.append(r)
            continue
        merged = [x for x in (target['mergedFrom'].split('|') if target['mergedFrom'] else [target['id']])]
        merged.append(r['id'])
        target['mergedFrom'] = '|'.join(merged)
        srcs = set(target['src'].split('|')) | set(r['src'].split('|'))
        target['src'] = '|'.join(sorted(srcs, key=lambda s: rank.get(s, 9)))
        if r['src'] == 'sbiz' and not target['sbizNo']:
            for k in ('sbizNo', 'sbizSub', 'supplierClass', 'villageId'):
                target[k] = target[k] or r[k]
            if target['id'] not in FIXED.values():
                target['name'] = r['name']
            target['note'] = r['note']
            target['judgeUnknown'] = r['judgeUnknown']
            target['reason'] += ';' + r['reason']
    kept.sort(key=lambda x: x['id'])

    C.write_csv(os.path.join(out_dir, 'resources.csv'), COLS, kept)
    C.write_csv(os.path.join(out_dir, 'sbiz_classified.csv'),
                ['sbizNo', 'name', 'sub', 'myeon', 'jibun', 'supplierClass', 'exclude', 'reason'],
                sorted(classified, key=lambda x: x['sbizNo']))
    o = C.out_text()
    by = {}
    for r in kept:
        by[r['cls']] = by.get(r['cls'], 0) + 1
    o.write('P2 resources=%d merged=%d sbizFood=%d excluded=%d by_cls=%s\n' % (
        len(kept), sum(1 for r in kept if r['mergedFrom']), len(classified),
        sum(1 for c in classified if c['exclude'] == 'true'), ','.join('%s:%d' % kv for kv in sorted(by.items()))))
    o.flush()


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
