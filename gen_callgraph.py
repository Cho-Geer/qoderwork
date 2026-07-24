#!/usr/bin/env python3
# Generate an SVG call-graph + function-signature reference for the task-lens module.
import xml.sax.saxutils as su

def esc(s: str) -> str:
    return su.escape(s)

# ---------------------------------------------------------------------------
# Module data: name (file), grid (col,row), funcs = (label, signature, internal)
# ---------------------------------------------------------------------------
MODULES = [
    {
        "name": "cli.ts", "col": 0, "row": 0, "fill": "#E0E7FF", "stroke": "#4338CA",
        "funcs": [
            ("parsePairs", "parsePairs(tokens: string[]): Map<string,string>  [内部]", True),
            ("required", "required(map: Map<string,string>, key: string): string  [内部]", True),
            ("parseGenerate", "parseGenerate(tokens: string[]): GenerateRequest  [内部]", True),
            ("parseFeedback", "parseFeedback(tokens: string[]): FeedbackRequest  [内部]", True),
            ("parseMetrics", "parseMetrics(tokens: string[]): MetricsRequest  [内部]", True),
            ("isAbsolutePath", "isAbsolutePath(p: string): boolean  [内部]", True),
            ("parseBool", "parseBool(v: string, label: string): boolean  [内部]", True),
            ("parseCli", "parseCli(argv: string[]): CliRequest", False),
            ("runGenerate", "runGenerate(req: GenerateRequest, runner: CommandRunner, clock: Clock): Promise<...>  [内部]", True),
            ("main", "main(argv: string[]): Promise<number>", False),
        ],
    },
    {
        "name": "command-runner.ts", "col": 1, "row": 0, "fill": "#DCFCE7", "stroke": "#15803D",
        "funcs": [
            ("buildChildEnv", "buildChildEnv(source?: NodeJS.ProcessEnv): {env, keys}", False),
            ("readLimited", "readLimited(stream: ReadableStream, limit: number, onLimit: ()=>void): Promise<...>  [内部]", True),
            ("clamp", "clamp(value: number|undefined, def: number, max: number): number  [内部]", True),
            ("runCommand", "runCommand(request: CommandRequest): Promise<CommandResult>", False),
        ],
    },
    {
        "name": "config.ts", "col": 2, "row": 0, "fill": "#FEF3C7", "stroke": "#B45309",
        "funcs": [
            ("sha256Hex", "sha256Hex(input: string): string", False),
            ("canonicalConfigJson", "canonicalConfigJson(config: TaskLensConfigV1): string  [内部]", True),
            ("configHash", "configHash(config: TaskLensConfigV1): string", False),
            ("defaultConfig", "defaultConfig(): TaskLensConfigV1", False),
            ("isPlainObject", "isPlainObject(v: unknown): v is Record<string,unknown>  [内部]", True),
            ("validateConfig", "validateConfig(raw: unknown): TaskLensConfigV1  [内部]", True),
            ("realpathDir", "realpathDir(p: string, label: string): string  [内部]", True),
            ("assertOutputOutsideProject", "assertOutputOutsideProject(outPath: string, projectRealpath: string): string", False),
            ("resolveConfig", "resolveConfig(projectRealpath: string, configPath?: string): Promise<{config, projectRealpath, hash}>", False),
        ],
    },
    {
        "name": "types.ts", "col": 3, "row": 0, "fill": "#E5E7EB", "stroke": "#4B5563",
        "funcs": [
            ("(无函数体)", "仅类型 / 常量 / 错误类 (CliError, ProcessFailure)", True),
        ],
    },
    {
        "name": "diff-extractor.ts", "col": 0, "row": 1, "fill": "#FEE2E2", "stroke": "#B91C1C",
        "funcs": [
            ("revParseHead", "revParseHead(): CommandRequest  [内部]", True),
            ("revParseRef", "revParseRef(ref: string): CommandRequest  [内部]", True),
            ("statusPorcelain", "statusPorcelain(): CommandRequest  [内部]", True),
            ("diffWorkingTree", "diffWorkingTree(): CommandRequest  [内部]", True),
            ("diffCommit", "diffCommit(baseSha: string, headSha: string): CommandRequest  [内部]", True),
            ("lsFilesUntracked", "lsFilesUntracked(): CommandRequest  [内部]", True),
            ("withCwd", "withCwd(req: CommandRequest, cwd: string): CommandRequest  [内部]", True),
            ("stripPathMarker", "stripPathMarker(line: string, marker: 'a'|'b'): string  [内部]", True),
            ("parseDiff", "parseDiff(output: string): ParsedDiff  [内部]", True),
            ("parseUntracked", "parseUntracked(output: string): string[]  [内部]", True),
            ("sortHunks", "sortHunks(hunks): DiffHunk[]  [内部]", True),
            ("sortRenames", "sortRenames(renames): RenameEntry[]  [内部]", True),
            ("sortDeleted", "sortDeleted(regions): DeletedRegion[]  [内部]", True),
            ("sortUntracked", "sortUntracked(paths): string[]  [内部]", True),
            ("canonicalDiffJson", "canonicalDiffJson(model): string  [内部]", True),
            ("run", "run(runner: CommandRunner, req: CommandRequest, cwd: string): Promise<CommandResult>  [内部]", True),
            ("extractDiff", "extractDiff(input: DiffInput, runner: CommandRunner): Promise<DiffModel>", False),
            ("canonicalTaskIdJson", "canonicalTaskIdJson(input: ReceiptInput, provider: ProviderMetadata): string  [内部]", True),
            ("createInputReceipt", "createInputReceipt(input: ReceiptInput, clock: Clock): TaskInputReceipt", False),
        ],
    },
    {
        "name": "seed-resolver.ts", "col": 1, "row": 1, "fill": "#CCFBF1", "stroke": "#0F766E",
        "funcs": [
            ("resolveSeeds", "resolveSeeds(hunks: readonly DiffHunk[], ranges: readonly FunctionRange[]): SeedResolution", False),
        ],
    },
    {
        "name": "graph-builder.ts", "col": 2, "row": 1, "fill": "#CFFAFE", "stroke": "#0E7490",
        "funcs": [
            ("filterEdges", "filterEdges(edges: readonly EdgeRef[], ranges: readonly FunctionRange[]): {edges, unverified}", False),
            ("buildGraph", "buildGraph(provider: StructureProvider, seeds: readonly Seed[], budget?: GraphBudget): Promise<GraphResult>", False),
        ],
    },
    {
        "name": "codegraph-provider.ts", "col": 3, "row": 1, "fill": "#EDE9FE", "stroke": "#6D28D9",
        "funcs": [
            ("CodeGraphProvider.open", "CodeGraphProvider.open(projectRealpath: string): Promise<CodeGraphProvider>  [static]", False),
            ("getFunctionRanges", "CodeGraphProvider.getFunctionRanges(files: string[]): Promise<FunctionRange[]>", False),
            ("getCallers", "CodeGraphProvider.getCallers(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>", False),
            ("getCallees", "CodeGraphProvider.getCallees(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>", False),
            ("close", "CodeGraphProvider.close(): void", False),
            ("CliStructureProvider.open", "CliStructureProvider.open(projectRealpath: string, runner?: CommandRunner): Promise<CliStructureProvider>  [static]", False),
            ("getFunctionRanges", "CliStructureProvider.getFunctionRanges(files: string[]): Promise<FunctionRange[]>", False),
            ("getCallers", "CliStructureProvider.getCallers(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>", False),
            ("getCallees", "CliStructureProvider.getCallees(ids: string[], budget: GraphBudget): Promise<EdgeRef[]>", False),
            ("resolveExactId", "CliStructureProvider.resolveExactId(name: string, file: string, kind: string): Promise<string>  [private]", True),
            ("parseEdgeRow", "parseEdgeRow(row: EdgeRow, direction: 'caller'|'callee'): EdgeRef  [内部]", True),
        ],
    },
    {
        "name": "spine.ts", "col": 0, "row": 2, "fill": "#FCE7F3", "stroke": "#9D174D",
        "funcs": [
            ("buildSpineForest", "buildSpineForest(graph: GraphResult, seeds: readonly Seed[], entries: readonly string[], budget?: GraphBudget): SpineForest", False),
            ("bfsPath", "bfsPath(entry: string, seedIds: readonly string[], edgeMap: Map): PathResult  [内部]", True),
            ("bfsBranchPath", "bfsBranchPath(seedId: string, displayNodes: Set, reverseEdgeMap: Map): {...}|null  [内部]", True),
            ("findBestEntryByCallerDistance", "findBestEntryByCallerDistance(graph: GraphResult, seedIds: readonly string[], reverseEdgeMap: Map): string|null  [内部]", True),
        ],
    },
    {
        "name": "coverage-reader.ts", "col": 1, "row": 2, "fill": "#FFEDD5", "stroke": "#C2410C",
        "funcs": [
            ("sha256Hex", "sha256Hex(input: string): string  [内部]", True),
            ("normalizeFilePath", "normalizeFilePath(p: string, baseDir: string): string  [内部]", True),
            ("isWithinProject", "isWithinProject(resolved: string, projectRoot: string): boolean  [内部]", True),
            ("nodeKey", "nodeKey(node: FunctionNode): string  [内部]", True),
            ("readCompanion", "readCompanion(companionPath: string, binding: CoverageBinding): Promise<...>  [内部]", True),
            ("parseLcov", "parseLcov(text: string): LcovSfRecord[]  [内部]", True),
            ("observeNode", "observeNode(rec: LcovSfRecord, node: FunctionNode, checks: string[]): Observation  [内部]", True),
            ("readCoverage", "readCoverage(coveragePath: string|undefined, binding: CoverageBinding, nodes: FunctionNode[]): Promise<CoverageResult>", False),
        ],
    },
    {
        "name": "side-effects.ts", "col": 2, "row": 2, "fill": "#FEF9C3", "stroke": "#A16207",
        "funcs": [
            ("detectSideEffects", "detectSideEffects(source: string, config: TaskLensConfigV1): DetectedSideEffect[]", False),
        ],
    },
    {
        "name": "card-renderer.ts", "col": 3, "row": 2, "fill": "#DBEAFE", "stroke": "#1D4ED8",
        "funcs": [
            ("renderCard", "renderCard(graph: TaskGraphV1, receipt: TaskInputReceipt): string", False),
            ("escapePipe", "escapePipe(s: string): string  [内部]", True),
            ("computeNodeConfidence", "computeNodeConfidence(nodes: readonly FunctionNode[], edges: readonly CallEdge[]): Map<string, number|null>  [内部]", True),
        ],
    },
    {
        "name": "artifact-writer.ts", "col": 0, "row": 3, "fill": "#F1F5F9", "stroke": "#334155",
        "funcs": [
            ("validateCard", "validateCard(card: string): void  [内部]", True),
            ("assertDeepSerializable", "assertDeepSerializable(value: unknown, breadcrumb: string): void  [内部]", True),
            ("sha256Hex", "sha256Hex(input: string): string  [内部]", True),
            ("canonicalizeGraph", "canonicalizeGraph(graph: TaskGraphV1): string  [内部]", True),
            ("generateUUID", "generateUUID(): string  [内部]", True),
            ("writeVerified", "writeVerified(filePath: string, content: string): {sha256, bytes}  [内部]", True),
            ("writeArtifacts", "writeArtifacts(request: ArtifactWriteRequest): Promise<ArtifactReceipt>", False),
            ("cleanupStaging", "cleanupStaging(stagingDir: string): void  [内部]", True),
        ],
    },
]

# Cross-module edges: (from, to, kind)  kind: 'call' = 直接调用(实线); 'pipe' = 流程/数据流(虚线)
EDGES = [
    ("cli.ts", "config.ts", "call"),
    ("cli.ts", "diff-extractor.ts", "call"),
    ("cli.ts", "command-runner.ts", "call"),
    ("diff-extractor.ts", "config.ts", "call"),
    ("graph-builder.ts", "codegraph-provider.ts", "call"),
    ("graph-builder.ts", "seed-resolver.ts", "call"),
    ("spine.ts", "seed-resolver.ts", "call"),
    ("codegraph-provider.ts", "command-runner.ts", "call"),
    # 端到端流程 (PHASE-02 -> 03 -> 04)
    ("cli.ts", "graph-builder.ts", "pipe"),
    ("graph-builder.ts", "spine.ts", "pipe"),
    ("spine.ts", "coverage-reader.ts", "pipe"),
    ("spine.ts", "side-effects.ts", "pipe"),
    ("spine.ts", "card-renderer.ts", "pipe"),
    ("card-renderer.ts", "artifact-writer.ts", "pipe"),
]

# ---------------------------------------------------------------------------
# Layout — Section 1: module graph
# ---------------------------------------------------------------------------
COLX = [60, 400, 740, 1080]
ROWY = [80, 250, 420, 590]
BW, BH = 280, 92
WIDTH = 1560

def mod_center(m):
    return COLX[m["col"]] + BW / 2, ROWY[m["row"]] + BH / 2

def mod_rect(m):
    return COLX[m["col"]], ROWY[m["row"]]

mod_by_name = {m["name"]: m for m in MODULES}

SECTION1_H = ROWY[3] + BH + 40  # bottom of last row + gap

# ---------------------------------------------------------------------------
# Section 2: function signature reference
# ---------------------------------------------------------------------------
SIG_COLX = [40, 430, 820, 1210]
SIG_W = 330
SIG_LH = 16
SIG_HEADER = 30
SIG_PAD = 10

cards = []  # (x, y, h, module)
col_heights = [SECTION1_H + 60] * 4  # current y cursor per column
for m in MODULES:
    n = len(m["funcs"])
    h = SIG_HEADER + SIG_PAD + n * SIG_LH + SIG_PAD
    col = m["col"]
    x = SIG_COLX[col]
    y = col_heights[col]
    cards.append((x, y, h, m))
    col_heights[col] = y + h + 24

SECTION2_H = max(col_heights) + 20
TOTAL_H = SECTION2_H

# ---------------------------------------------------------------------------
# Build SVG
# ---------------------------------------------------------------------------
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{TOTAL_H}" viewBox="0 0 {WIDTH} {TOTAL_H}" font-family="Sarasa Gothic SC, Inter, monospace">')

# defs
out.append('<defs>')
out.append('<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#334155"/></marker>')
out.append('<marker id="arrowP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2563EB"/></marker>')
out.append('</defs>')

# background
out.append(f'<rect x="0" y="0" width="{WIDTH}" height="{TOTAL_H}" fill="#FFFFFF"/>')

# Section 1 title
out.append(f'<text x="40" y="40" font-size="22" font-weight="700" fill="#0F172A">task-lens 模块调用关系图（连线 = 调用 / 依赖）</text>')
out.append(f'<text x="40" y="60" font-size="12" fill="#64748B">实线 = 直接调用；蓝色虚线 = 端到端流程 (PHASE-02 → 03 → 04)</text>')

# edges (drawn under boxes)
for (f, t, kind) in EDGES:
    fm = mod_by_name[f]; tm = mod_by_name[t]
    fx, fy = mod_center(fm); tx, ty = mod_center(tm)
    fx0, fy0 = mod_rect(fm); tx0, ty0 = mod_rect(tm)
    # choose anchors
    dx = tx - fx; dy = ty - fy
    if abs(dx) >= abs(dy):
        if dx >= 0:
            x1, y1 = fx0 + BW, fy; x2, y2 = tx0, ty
        else:
            x1, y1 = fx0, fy; x2, y2 = tx0 + BW, ty
    else:
        if dy >= 0:
            x1, y1 = fx, fy0 + BH; x2, y2 = tx, ty0
        else:
            x1, y1 = fx, fy0; x2, y2 = tx, ty0 + BH
    color = "#334155" if kind == "call" else "#2563EB"
    dash = "" if kind == "call" else ' stroke-dasharray="6 4"'
    marker = "arrow" if kind == "call" else "arrowP"
    out.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{color}" stroke-width="1.5"{dash} marker-end="url(#{marker})"/>')

# module boxes
for m in MODULES:
    x, y = mod_rect(m)
    out.append(f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="10" fill="{m["fill"]}" stroke="{m["stroke"]}" stroke-width="1.5"/>')
    out.append(f'<text x="{x + 12}" y="{y + 24}" font-size="13" font-weight="700" fill="#0F172A">{esc(m["name"])}</text>')
    out.append(f'<text x="{x + 12}" y="{y + 44}" font-size="10" fill="#475569">函数数: {len(m["funcs"])}</text>')

# Section 2 title
out.append(f'<text x="40" y="{SECTION1_H + 36}" font-size="22" font-weight="700" fill="#0F172A">函数签名清单（按模块，含内部函数）</text>')

# signature cards
for (x, y, h, m) in cards:
    out.append(f'<rect x="{x}" y="{y}" width="{SIG_W}" height="{h}" rx="8" fill="#FFFFFF" stroke="{m["stroke"]}" stroke-width="1.2"/>')
    out.append(f'<rect x="{x}" y="{y}" width="{SIG_W}" height="{SIG_HEADER}" rx="8" fill="{m["fill"]}"/>')
    out.append(f'<text x="{x + 10}" y="{y + 20}" font-size="13" font-weight="700" fill="#0F172A">{esc(m["name"])}</text>')
    ty = y + SIG_HEADER + SIG_PAD + 12
    for (label, sig, internal) in m["funcs"]:
        col = "#64748B" if internal else "#0F172A"
        weight = "400" if internal else "700"
        # wrap long signatures into two lines
        if len(sig) > 42:
            half = sig[:42].rfind(" ")
            if half < 20:
                half = 42
            l1 = sig[:half]
            l2 = sig[half:]
            out.append(f'<text x="{x + 10}" y="{ty}" font-size="10.5" font-weight="{weight}" fill="{col}">{esc(label)}</text>')
            out.append(f'<text x="{x + 14}" y="{ty + 12}" font-size="9.5" fill="#475569">{esc(l1)}</text>')
            out.append(f'<text x="{x + 14}" y="{ty + 24}" font-size="9.5" fill="#475569">{esc(l2)}</text>')
            ty += SIG_LH + 14
        else:
            out.append(f'<text x="{x + 10}" y="{ty}" font-size="10.5" font-weight="{weight}" fill="{col}">{esc(label)}</text>')
            out.append(f'<text x="{x + 14}" y="{ty + 12}" font-size="9.5" fill="#475569">{esc(sig)}</text>')
            ty += SIG_LH

out.append('</svg>')

svg = "\n".join(out)
svg = svg.replace("'", "")
with open("task-lens-callgraph.svg", "w", encoding="utf-8") as f:
    f.write(svg)
print("WROTE svg bytes:", len(svg), "height:", TOTAL_H)
