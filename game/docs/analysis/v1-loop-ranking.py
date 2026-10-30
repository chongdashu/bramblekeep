#!/usr/bin/env python3
"""Reproduce the descriptive Jev ranking from its saved report; no API call."""
import json
from pathlib import Path

report = json.loads(Path(__file__).with_name('v1-loop-jev-report-20261028.json').read_text())
rows = []
for case in report['cases']:
    if case['id'].startswith('smoke-') or case.get('status') == 'error':
        continue
    answers = case['answers']
    impact = answers['loop_impact']['score']
    fit = answers['v1_fit']['score']
    signal = answers['user_signal']['noul']
    # Chosen for this assessment; not a probability or a learned weight.
    total = .7 * impact / 3 + .3 * fit / 2
    rows.append((total, case['id'], impact, fit, signal))
for total, candidate, impact, fit, signal in sorted(rows, reverse=True):
    print(f'{candidate:12} {total:.3f}  loop {impact:.2f}/3  v1 fit {fit:.2f}/2  user-signal {signal:.2f}')
