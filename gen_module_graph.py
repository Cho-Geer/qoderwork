#!/usr/bin/env python3
# Regenerate a compact, single-line, single-quoted SVG of the task-lens
# MODULE call-graph (arrowed connectors) and emit a batch_edit operations string.
import os

import math

MODULES = [
    # (col, row, name, count, fill, stroke)
    (60,  80,  "cli.ts",               10, "#E0E7FF", "#4338CA"),
    (400, 80,  "command-runner.ts",     4, "#DCFCE7", "#15803D"),
    (740, 80,  "config.ts",             9, "#FEF3C7", "#B45309"),
    (1080,80,  "types.ts",              1, "#E5E7EB", "#4B5563"),
    (60,  250, "diff-extractor.ts",    19, "#FEE2E2", "#B91C1C"),
    (400, 250, "seed-resolver.ts",      1, "#CCFBF1", "#0F766E"),
    (740, 250, "graph-builder.ts",      2, "#CFFAFE", "#0E7490"),
    (1080,250, "codegraph-provider.ts",11, "#EDE9FE", "#6D28D9"),
    (60,  420, "spine.ts",              4, "#FCE7F3", "#9D174D"),
    (400, 420, "coverage-reader.ts",    8, "#FFEDD5", "#C2410C"),
    (740, 420, "side-effects.ts",       1, "#FEF9C3", "#A16207"),
    (1080,420, "card-renderer.ts",      3, "#DBEAFE", "#1D4ED8"),
    (60,  590, "artifact-writer.ts",    8, "#F1F5F9", "#334155"),
]

# connector lines from the verified layout (solid = direct call, blue dashed = flow)
CONNECTORS = [
    # kind, x1,y1,x2,y2
    ("call", 340,126, 740,126),
    ("call", 200,172, 200,250),
    ("call", 340,126, 400,126),
    ("call", 340,296, 740,126),
    ("call", 1020,296,1080,296),
    ("call", 740,296, 680,296),
    ("call", 340,466, 400,296),
    ("call", 1080,296, 680,126),
    ("flow", 340,126, 740,296),
    ("flow", 740,296, 340,466),
    ("flow", 340,466, 400,466),
    ("flow", 340,466, 740,466),
    ("flow", 340,466,1080,466),
    ("flow", 1080,466, 340,636),
]

def box(x, y, name, count, fill, stroke):
    return (
        f"<rect x='{x}' y='{y}' width='280' height='92' rx='10' fill='{fill}' stroke='{stroke}' stroke-width='1.5'/>"
        f"<text x='{x+12}' y='{y+24}' font-size='13' font-weight='700' fill='#0F172A'>{name}</text>"
        f"<text x='{x+12}' y='{y+44}' font-size='10' fill='#475569'>函数数: {count}</text>"
    )

def arrowhead(x1, y1, x2, y2, color, length=8, half_width=4):
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    if dist < 0.001:
        return ""
    ux, uy = dx / dist, dy / dist
    px, py = -uy, ux
    # base center of the arrowhead (moved backward from tip along the line)
    bx = x2 - ux * length
    by = y2 - uy * length
    lx = bx + px * half_width
    ly = by + py * half_width
    rx = bx - px * half_width
    ry = by - py * half_width
    return f"<polygon points='{x2},{y2} {lx},{ly} {rx},{ry}' fill='{color}'/>"

def connector_path(kind, x1, y1, x2, y2):
    if kind == "call":
        return f"<path d='M{x1} {y1} L{x2} {y2}' fill='none' stroke='#334155' stroke-width='1.5' stroke-linecap='round'/>"
    else:
        return f"<path d='M{x1} {y1} L{x2} {y2}' fill='none' stroke='#2563EB' stroke-width='1.5' stroke-linecap='round' stroke-dasharray='6 4'/>"

def connector_color(kind):
    return "#334155" if kind == "call" else "#2563EB"

parts = []
parts.append("<svg xmlns='http://www.w3.org/2000/svg' width='1560' height='720' viewBox='0 0 1560 720' font-family='Sarasa Gothic SC, Inter, monospace'>")
parts.append("<rect x='0' y='0' width='1560' height='720' fill='#FFFFFF'/>")
parts.append("<text x='40' y='40' font-size='22' font-weight='700' fill='#0F172A'>task-lens 模块调用关系图（连线 = 调用 / 依赖）</text>")
parts.append("<text x='40' y='60' font-size='12' fill='#64748B'>实线 = 直接调用；蓝色虚线 = 端到端流程 (PHASE-02 → 03 → 04)</text>")
# connector paths (under boxes)
for c in CONNECTORS:
    parts.append(connector_path(*c))
# module boxes (on top of connector paths)
for m in MODULES:
    parts.append(box(*m))
# arrowheads (on top of boxes so tips are visible)
for c in CONNECTORS:
    parts.append(arrowhead(c[1], c[2], c[3], c[4], connector_color(c[0])))
parts.append("</svg>")

svg = "".join(parts)  # single line, single-quoted attributes

ops = "graph=I(\"0:1\", {type:\"frame\", name:\"task-lens call graph\", svg: \"%s\", width:1560, height:720})" % svg
update_ops = "U(\"2:1\", {svg: \"%s\"})" % svg

here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "module-graph.svg"), "w", encoding="utf-8") as f:
    f.write(svg)

for name, raw in [("module-ops.txt", ops), ("update-ops.txt", update_ops)]:
    wrapped = "\n".join(raw[i:i+90] for i in range(0, len(raw), 90))
    with open(os.path.join(here, name), "w", encoding="utf-8") as f:
        f.write(wrapped)

print("WROTE module-graph.svg bytes:", len(svg.encode("utf-8")))
print("WROTE module-ops.txt bytes:", len(ops.encode("utf-8")))
print("WROTE update-ops.txt bytes:", len(update_ops.encode("utf-8")))
print("single-quote count:", svg.count("'"), " double-quote count:", svg.count('"'))
