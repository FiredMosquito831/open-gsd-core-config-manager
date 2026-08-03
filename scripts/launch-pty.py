#!/usr/bin/env python3
"""Launch the bundled CLI in a real PTY, capture the launch URL, return it.

The running node process is intentionally left alive so the browser can connect.
"""
import os, pty, subprocess, json, re, time, sys

CWD = '/mnt/c/Users/fgghk/PycharmProjects/GSD CONFIG MANAGER'
META = '/tmp/gsd-probe.meta.json'

env = os.environ.copy()
env.pop('NO_COLOR', None)  # keep ANSI escapes; capture regex is Unicode-safe

master, slave = pty.openpty()
proc = subprocess.Popen(
    ['node', 'dist/cli.js', '--no-open'],
    cwd=CWD,
    stdin=slave, stdout=slave, stderr=slave,
    env=env,
    close_fds=True,
)
os.close(slave)

url = None
buf = b''
try:
    deadline = time.time() + 12  # generous: schema build first run can take ~5s
    while time.time() < deadline and url is None:
        try:
            data = os.read(master, 4096)
        except OSError:
            break
        if not data:
            time.sleep(0.05)
            continue
        buf += data
        text = buf.decode('utf-8', errors='replace')
        m = re.search(r'http://127\.0\.0\.1:\d+/\?t=[A-Za-z0-9-]+', text)
        if m:
            url = m.group(0)
        # keep a tail for regex only
        if len(buf) > 4096:
            buf = buf[-1024:]
finally:
    os.close(master)

if url:
    meta = {'url': url, 'pid': proc.pid}
    with open(META, 'w') as f:
        json.dump(meta, f)
    print(f'CAPTURED_URL={url}')
    print(f'PID={proc.pid}')
    sys.exit(0)
else:
    print('FAIL: no banner URL captured within deadline', file=sys.stderr)
    proc.kill()
    sys.exit(1)
