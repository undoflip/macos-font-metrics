#!/usr/bin/env python3
"""Survey of macOS system font metrics.

Writes numbers only (no outlines, no font files): per face — family, style,
unitsPerEm, hhea/OS/2 vertical metrics, xAvgCharWidth, capHeight, xHeight,
advance widths for a fixed set of code points, kerning pair count.

    pip install fonttools
    python3 harvest_fonts.py out.json
"""
import json
import os
import sys

from fontTools.ttLib import TTCollection, TTFont

ROOTS = ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts']

# Basic Latin/Latin-1, Cyrillic, Greek, punctuation, currency, arrows, blocks.
RANGES = [(0x20, 0x7E), (0xA0, 0x17F), (0x370, 0x3FF), (0x400, 0x4FF),
          (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2190, 0x21FF), (0x2580, 0x259F)]
EXTRA = [0x1E9E, 0x097F, 0x20B9, 0x20BA, 0x20B8, 0x2581, 0xFB01, 0xFB02]
CODEPOINTS = sorted({c for a, b in RANGES for c in range(a, b + 1)} | set(EXTRA))


def name_of(font, name_id):
    rec = font['name'].getName(name_id, 3, 1, 0x409) or font['name'].getName(name_id, 1, 0, 0)
    return str(rec) if rec else None


def describe(font):
    cmap = font.getBestCmap() or {}
    hmtx = font['hmtx'].metrics
    os2 = font['OS/2'] if 'OS/2' in font else None
    hhea = font['hhea']
    widths = {}
    for cp in CODEPOINTS:
        g = cmap.get(cp)
        if g is not None and g in hmtx:
            widths[f'{cp:04X}'] = hmtx[g][0]
    kern_pairs = 0
    if 'kern' in font:
        for t in font['kern'].kernTables:
            kern_pairs += len(getattr(t, 'kernTable', {}) or {})
    return {
        'family': name_of(font, 16) or name_of(font, 1),
        'style': name_of(font, 17) or name_of(font, 2),
        'fullName': name_of(font, 4),
        'postscript': name_of(font, 6),
        'unitsPerEm': font['head'].unitsPerEm,
        'hhea': {'ascender': hhea.ascent, 'descender': hhea.descent, 'lineGap': hhea.lineGap},
        'os2': None if os2 is None else {
            'typoAscender': os2.sTypoAscender, 'typoDescender': os2.sTypoDescender,
            'typoLineGap': os2.sTypoLineGap, 'winAscent': os2.usWinAscent,
            'winDescent': os2.usWinDescent, 'xAvgCharWidth': os2.xAvgCharWidth,
            'capHeight': getattr(os2, 'sCapHeight', None), 'xHeight': getattr(os2, 'sxHeight', None),
            'weightClass': os2.usWeightClass, 'widthClass': os2.usWidthClass,
        },
        'hasGPOS': 'GPOS' in font,
        'kernPairs': kern_pairs,
        'widths': widths,
    }


def fonts_in(path):
    low = path.lower()
    if low.endswith(('.ttc', '.otc')):
        coll = TTCollection(path, lazy=True)
        return list(coll.fonts)
    if low.endswith(('.ttf', '.otf', '.dfont')):
        return [TTFont(path, lazy=True)]
    return []


def main(out):
    result = {'macos': os.uname().release, 'faces': []}
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            path = os.path.join(root, name)
            if not os.path.isfile(path):
                continue
            try:
                for font in fonts_in(path):
                    face = describe(font)
                    face['file'] = os.path.relpath(path, '/')
                    result['faces'].append(face)
            except Exception as e:  # unreadable file: skip, but record it
                result.setdefault('skipped', []).append({'file': path, 'error': str(e)[:200]})
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"faces: {len(result['faces'])}, skipped: {len(result.get('skipped', []))}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'macos-fonts.json')
