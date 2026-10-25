# Build check for data/region_hwasan.json (spec 4.5). Exit 1 on any failure.
# Usage: python -I pipeline/check_region.py data/region_hwasan.json
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def main(path):
    rules = C.load_rules()
    with open(path, encoding='utf-8') as f:
        reg = json.load(f)
    o = C.out_text()
    fails = []
    lat0, lon0, lat1, lon1 = reg['meta']['bbox']
    vids = [r['id'] for r in rules['ri']]
    vmap = {v['id']: v for v in reg['villages']}

    if sorted(vmap) != sorted(vids):
        fails.append('villages != 11 ri: %s' % sorted(vmap))
    pts = reg['points']
    ids = [p['id'] for p in pts]
    if len(ids) != len(set(ids)):
        fails.append('duplicate point ids')
    if len(pts) < 25:
        fails.append('points < 25 (%d)' % len(pts))
    rep = {p['villageId'] for p in pts if p['kind'] == 'village_node'}
    if rep != set(vids):
        fails.append('missing village_node points: %s' % sorted(set(vids) - rep))
    res = {r['id']: r for r in reg['resources']}
    if len(res) != len(reg['resources']):
        fails.append('duplicate resource ids')
    for rid in ('hanaro_hwasan', 'bank_nh_hwasan', 'post_hwasan', 'tour_A', 'care_link'):
        if rid not in res:
            fails.append('missing resource ' + rid)
    hubs = [r for r in reg['resources'] if r['cls'] == 'hub' and r.get('myeon') == rules['myeon']]
    if len(hubs) < 18:
        fails.append('hwasan hubs < 18 (%d)' % len(hubs))
    for vid, exp in rules['expectedFoodStores'].items():
        got = vmap.get(vid, {}).get('foodStores')
        if got != exp:
            fails.append('foodStores %s = %s, expected %d' % (vid, got, exp))
    for r in reg['resources']:
        if 'lat' in r:
            if not (lat0 <= r['lat'] <= lat1 and lon0 <= r['lon'] <= lon1):
                fails.append('resource outside bbox: ' + r['id'])
    for p in pts:
        if p['kind'] == 'hub' and p.get('hubResId') not in res:
            fails.append('point hubResId missing: ' + p['id'])
        if p['villageId'] not in vmap:
            fails.append('point villageId unknown: ' + p['id'])
    hd = [r for r in reg['resources'] if r['cls'] == 'hubdrop']
    if len(hd) != len(hubs):
        fails.append('hubdrop count %d != hubs %d' % (len(hd), len(hubs)))

    o.write('check_region: %s\n' % path)
    o.write('%-10s %-6s %5s %5s %5s\n' % ('ri', 'name', 'pts', 'hubs', 'food'))
    for vid in vids:
        v = vmap.get(vid, {})
        n_pts = sum(1 for p in pts if p['villageId'] == vid)
        n_hub = sum(1 for p in pts if p['villageId'] == vid and p['kind'] == 'hub')
        o.write('%-10s %-6s %5d %5d %5s\n' % (vid, v.get('name', '?'), n_pts, n_hub, v.get('foodStores', '?')))
    o.write('ri=%d points=%d hwasanHubs=%d\n' % (len(vmap), len(pts), len(hubs)))
    by = {}
    for r in reg['resources']:
        by[r['cls']] = by.get(r['cls'], 0) + 1
    o.write('resources=%d by class: %s\n' % (len(reg['resources']), ', '.join('%s %d' % kv for kv in sorted(by.items()))))
    o.write('fixed: %s\n' % ' '.join(rid for rid in ('hanaro_hwasan', 'bank_nh_hwasan', 'post_hwasan', 'tour_A', 'care_link') if rid in res))
    if fails:
        for f_ in fails:
            o.write('FAIL ' + f_ + '\n')
        o.flush()
        sys.exit(1)
    o.write('OK\n')
    o.flush()


if __name__ == '__main__':
    main(sys.argv[1])
