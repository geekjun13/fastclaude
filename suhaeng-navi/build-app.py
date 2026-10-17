#!/usr/bin/env python3
"""Builds app.html, the installable standalone version of 수행 내비, from index.html.

index.html is the claude.ai artifact page (the artifact host supplies <html>/<head>).
app.html wraps the same body in a full document with the web-app manifest and icons, so it can
be served from any static host (e.g. GitHub Pages) and installed to a phone's home screen.
Run after changing index.html:  python3 build-app.py
"""
from pathlib import Path

HERE = Path(__file__).parent
HEAD = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>수행 내비</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="theme-color" content="#F4F1E8">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="수행 내비">
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""

body = (HERE / "index.html").read_text(encoding="utf-8").splitlines()
body = [l for l in body if not l.startswith("<title>") and not l.startswith('<meta name="claude:')]
(HERE / "app.html").write_text(HEAD + "\n".join(body) + "\n</body>\n</html>\n", encoding="utf-8")
print("app.html written")
