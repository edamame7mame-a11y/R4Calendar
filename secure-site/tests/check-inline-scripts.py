from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile

PAGES = [
    "member/index.html",
    "member/kuji.html",
    "member/memo.html",
    "member/plunder.html",
    "member/plunder_guide.html",
]

class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.current = None
    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script":
            attrs = dict(attrs)
            self.current = {"src": attrs.get("src"), "type": attrs.get("type", ""), "parts": []}
    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.current is not None:
            self.scripts.append(self.current)
            self.current = None

failed = False
for page in PAGES:
    parser = ScriptParser()
    parser.feed(Path(page).read_text(encoding="utf-8"))
    inline = [s for s in parser.scripts if not s["src"] and "".join(s["parts"]).strip()]
    if not inline:
        print(f"SKIP {page}: no inline scripts")
        continue
    for index, script in enumerate(inline, 1):
        suffix = ".mjs" if "module" in script["type"].lower() else ".js"
        with tempfile.NamedTemporaryFile("w", suffix=suffix, encoding="utf-8") as tmp:
            tmp.write("".join(script["parts"]))
            tmp.flush()
            result = subprocess.run(["node", "--check", tmp.name], text=True, capture_output=True)
        if result.returncode:
            failed = True
            print(f"FAIL {page} inline script {index}")
            print(result.stderr.strip())
        else:
            print(f"PASS {page} inline script {index}")
if failed:
    sys.exit(1)
