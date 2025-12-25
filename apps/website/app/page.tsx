"use client";

import { useState, useEffect, useRef } from "react";

// Animated typing terminal
function TypingTerminal() {
  const [lines, setLines] = useState<{ text: string; color: string }[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allLines = [
    { text: "$ polish 'Add OAuth with GitHub'", color: "text-white" },
    { text: "", color: "" },
    { text: "Phase 1: IMPLEMENT", color: "text-cyan-400" },
    { text: "  Analyzing project structure...", color: "text-gray-500" },
    { text: "  Creating auth/config.ts", color: "text-gray-400" },
    { text: "  Creating auth/providers.ts", color: "text-gray-400" },
    { text: "  Creating auth/middleware.ts", color: "text-gray-400" },
    { text: "  Initial score: 34/100", color: "text-orange-400" },
    { text: "", color: "" },
    { text: "Phase 2: POLISH", color: "text-cyan-400" },
    { text: "  [1/24] fix-types     +5 pts  Fix Optional<User> type", color: "text-green-400" },
    { text: "  [2/24] add-tests     +8 pts  Add parseToken test", color: "text-green-400" },
    { text: "  [3/24] fix-types     +3 pts  Add return type annotation", color: "text-green-400" },
    { text: "  [4/24] fix-lint      +2 pts  Remove unused import", color: "text-green-400" },
    { text: "  [5/24] fix-types     FAIL    Breaking change -> rollback", color: "text-red-400" },
    { text: "  [6/24] add-tests     +7 pts  Test auth edge case", color: "text-green-400" },
    { text: "  [7/24] fix-coverage  +4 pts  Cover error branch", color: "text-green-400" },
    { text: "  ...", color: "text-gray-600" },
    { text: "  [24/24] fix-types    +2 pts  Final type annotation", color: "text-green-400" },
    { text: "", color: "" },
    { text: "  Score: 34 -> 91 (+57 points)", color: "text-cyan-400" },
    { text: "  Commits: 24 atomic changes", color: "text-gray-400" },
    { text: "  Duration: 47 minutes", color: "text-gray-400" },
    { text: "", color: "" },
    { text: "Done. Ready for review.", color: "text-green-400" },
  ];

  useEffect(() => {
    if (isComplete) return;

    const currentLine = allLines[currentLineIndex];
    if (!currentLine) {
      setIsComplete(true);
      return;
    }

    if (currentCharIndex < currentLine.text.length) {
      const timeout = setTimeout(() => {
        setCurrentCharIndex((prev) => prev + 1);
      }, currentLine.text.startsWith("$") ? 50 : 15);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setLines((prev) => [...prev, currentLine]);
        setCurrentLineIndex((prev) => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.text === "" ? 100 : 200);
      return () => clearTimeout(timeout);
    }
  }, [currentLineIndex, currentCharIndex, isComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const currentLine = allLines[currentLineIndex];

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-gray-500 text-xs ml-2 font-mono">polish --session</span>
      </div>
      <div ref={containerRef} className="p-4 h-[400px] overflow-y-auto font-mono text-sm">
        {lines.map((line, i) => (
          <div key={i} className={`${line.color} leading-relaxed whitespace-pre`}>
            {line.text || "\u00A0"}
          </div>
        ))}
        {currentLine && !isComplete && (
          <div className={`${currentLine.color} leading-relaxed whitespace-pre`}>
            {currentLine.text.slice(0, currentCharIndex)}
            <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// Score with animated progress bar
function ScoreVisualization() {
  const [score, setScore] = useState(34);
  const [targetScore, setTargetScore] = useState(34);
  const scores = [34, 47, 58, 67, 76, 83, 89, 95];
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => {
        const next = (prev + 1) % scores.length;
        setTargetScore(scores[next]);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (score === targetScore) return;
    const step = score < targetScore ? 1 : -1;
    const timeout = setTimeout(() => {
      setScore((prev) => prev + step);
    }, 30);
    return () => clearTimeout(timeout);
  }, [score, targetScore]);

  const getColor = (s: number) => {
    if (s >= 90) return { text: "text-cyan-400", bar: "bg-cyan-400", glow: "shadow-cyan-400/50" };
    if (s >= 70) return { text: "text-green-400", bar: "bg-green-400", glow: "shadow-green-400/30" };
    if (s >= 50) return { text: "text-yellow-400", bar: "bg-yellow-400", glow: "" };
    return { text: "text-orange-400", bar: "bg-orange-400", glow: "" };
  };

  const colors = getColor(score);

  return (
    <div className="text-center">
      <div className="text-gray-600 text-xs tracking-[0.2em] mb-4">QUALITY SCORE</div>
      <div className={`text-8xl md:text-9xl font-bold tabular-nums ${colors.text} transition-colors duration-300`}>
        {score}
      </div>
      <div className="text-gray-700 text-lg mb-8">/100</div>

      {/* Progress bar */}
      <div className="max-w-xs mx-auto">
        <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-300 ${colors.glow} shadow-lg`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-600 font-mono">
          <span>0</span>
          <span className={score >= 90 ? "text-cyan-400" : "text-gray-600"}>90+</span>
          <span>100</span>
        </div>
      </div>

      {/* Phase indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {scores.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === phase ? `${colors.bar} scale-125` : i < phase ? "bg-gray-600" : "bg-gray-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Animated polish loop
function PolishLoopVisualization() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    { num: "01", label: "Measure", detail: "Run lint, types, tests, coverage", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { num: "02", label: "Identify", detail: "Find worst metric to fix", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
    { num: "03", label: "Fix", detail: "LLM makes ONE atomic change", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { num: "04", label: "Validate", detail: "Run tests, recalculate score", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { num: "05", label: "Commit", detail: "Keep if better, rollback if worse", icon: "M5 13l4 4L19 7" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-gray-950/50">
      <div className="flex items-center justify-between mb-6">
        <span className="text-green-400 text-sm font-medium tracking-wide">THE LOOP</span>
        <span className="text-gray-600 text-xs font-mono">repeat until score &gt;= 90</span>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 p-3 rounded-lg transition-all duration-500 ${
              i === activeStep ? "bg-green-950/30 border border-green-900/50" : "border border-transparent"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${
              i === activeStep ? "bg-green-400/20" : "bg-gray-900"
            }`}>
              <svg
                className={`w-4 h-4 transition-colors duration-300 ${
                  i === activeStep ? "text-green-400" : "text-gray-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono transition-colors duration-300 ${
                  i === activeStep ? "text-green-400" : "text-gray-700"
                }`}>
                  {step.num}
                </span>
                <span className={`text-sm transition-colors duration-300 ${
                  i === activeStep ? "text-gray-200" : "text-gray-400"
                }`}>
                  {step.label}
                </span>
              </div>
              <div className={`text-xs mt-1 transition-colors duration-300 ${
                i === activeStep ? "text-gray-400" : "text-gray-600"
              }`}>
                {step.detail}
              </div>
            </div>
            {i === activeStep && (
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Time comparison visualization
function TimeComparison() {
  const [hoveredSide, setHoveredSide] = useState<"traditional" | "polish" | null>(null);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Traditional */}
      <div
        className={`p-6 rounded-lg border transition-all duration-300 cursor-default ${
          hoveredSide === "traditional"
            ? "border-red-900/50 bg-red-950/10"
            : "border-gray-800 bg-gray-950/30"
        }`}
        onMouseEnter={() => setHoveredSide("traditional")}
        onMouseLeave={() => setHoveredSide(null)}
      >
        <div className="text-red-400/80 text-sm font-medium mb-6">Traditional AI Coding</div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Generate</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-gray-700 rounded" />
              <span className="text-gray-400 text-sm font-mono">30s</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Fix types</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-red-900/50 rounded" />
              <span className="text-red-400/80 text-sm font-mono">45m</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Add tests</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-red-900/50 rounded" />
              <span className="text-red-400/80 text-sm font-mono">1h</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Debug</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-red-900/50 rounded" />
              <span className="text-red-400/80 text-sm font-mono">30m</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Your time</span>
            <span className="text-red-400 text-xl font-bold font-mono">3+ hours</span>
          </div>
        </div>
      </div>

      {/* Polish */}
      <div
        className={`p-6 rounded-lg border transition-all duration-300 cursor-default ${
          hoveredSide === "polish"
            ? "border-green-900/50 bg-green-950/10"
            : "border-gray-800 bg-gray-950/30"
        }`}
        onMouseEnter={() => setHoveredSide("polish")}
        onMouseLeave={() => setHoveredSide(null)}
      >
        <div className="text-green-400 text-sm font-medium mb-6">Polish</div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Generate + Polish</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-cyan-900/30 rounded" />
              <span className="text-cyan-400/80 text-sm font-mono">~1h</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Review commits</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-2 bg-green-900/50 rounded" />
              <span className="text-green-400/80 text-sm font-mono">10m</span>
            </div>
          </div>
          <div className="flex items-center justify-between opacity-0">
            <span>-</span>
            <span>-</span>
          </div>
          <div className="flex items-center justify-between opacity-0">
            <span>-</span>
            <span>-</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Your time</span>
            <span className="text-green-400 text-xl font-bold font-mono">10 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Problem visualization with animated counters
function ProblemSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const painPoints = [
    { time: "30s", label: "Generate", yours: false },
    { time: "45m", label: "Fix types", yours: true },
    { time: "30m", label: "Fix lint", yours: true },
    { time: "1h", label: "Add tests", yours: true },
    { time: "20m", label: "Debug", yours: true },
  ];

  return (
    <div ref={sectionRef}>
      <div className="text-red-400/60 text-xs tracking-[0.15em] mb-8">THE PAINFUL REALITY</div>

      <div className="flex flex-wrap items-center gap-3 mb-12">
        {painPoints.map((point, i) => (
          <div
            key={i}
            className={`transform transition-all duration-500 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`px-4 py-3 rounded-lg border ${
                point.yours
                  ? "border-red-900/40 bg-red-950/20"
                  : "border-gray-800 bg-gray-900/30"
              }`}>
                <div className={`text-xl font-mono font-bold ${
                  point.yours ? "text-red-400" : "text-gray-400"
                }`}>
                  {point.time}
                </div>
                <div className="text-gray-600 text-xs mt-1">{point.label}</div>
                {point.yours && (
                  <div className="text-red-400/60 text-[10px] mt-1 uppercase tracking-wide">you</div>
                )}
              </div>
              {i < painPoints.length - 1 && (
                <span className="text-gray-700 text-lg">+</span>
              )}
            </div>
          </div>
        ))}
        <span className="text-gray-700 text-lg">=</span>
        <div
          className={`px-5 py-3 rounded-lg border border-red-800/50 bg-red-950/30 transform transition-all duration-500 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "600ms" }}
        >
          <div className="text-3xl font-mono font-bold text-red-400">3h+</div>
          <div className="text-red-400/60 text-xs mt-1">your time wasted</div>
        </div>
      </div>

      {/* Core issues */}
      <div className="grid md:grid-cols-3 gap-8">
        {[
          { title: "One-shot generation", desc: "AI generates code once and hopes it works. No iteration, no improvement, no guarantee." },
          { title: "No quality metrics", desc: "How good is the code? Nobody knows. No tests, no types, no lint. Just vibes." },
          { title: "Human cleanup", desc: "You become the debugger. Fix the AI's mistakes, add missing tests, handle edge cases." },
        ].map((item, i) => (
          <div
            key={i}
            className={`transform transition-all duration-500 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: `${700 + i * 100}ms` }}
          >
            <div className="text-gray-200 text-sm font-medium mb-2">{item.title}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Principles grid with hover effects
function PrinciplesGrid() {
  const principles = [
    { title: "Persistent", desc: "Runs for hours, not seconds. Time unlocks quality.", color: "green" },
    { title: "Objective", desc: "Metrics over vibes. Numbers don't lie.", color: "cyan" },
    { title: "Atomic", desc: "One fix per commit. Easy to review and revert.", color: "green" },
    { title: "Efficient", desc: "Small models at scale beat big models once.", color: "cyan" },
    { title: "Safe", desc: "Auto-rollback on failure. Never breaks working code.", color: "green" },
    { title: "Transparent", desc: "See every change. Understand every decision.", color: "cyan" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {principles.map((p, i) => (
        <div
          key={i}
          className="group p-4 rounded-lg border border-gray-800 bg-gray-950/30 hover:border-gray-700 hover:bg-gray-900/30 transition-all duration-300 cursor-default"
        >
          <div className={`text-sm font-medium mb-2 ${
            p.color === "green" ? "text-green-400" : "text-cyan-400"
          }`}>
            {p.title}
          </div>
          <div className="text-gray-600 text-sm leading-relaxed group-hover:text-gray-500 transition-colors">
            {p.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

// CLI usage with copy button
function UsageSection() {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('npx polish "Your task here"');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl">
      <div className="border border-gray-800 rounded-lg overflow-hidden bg-black">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-gray-800">
          <span className="text-gray-500 text-xs font-mono">terminal</span>
          <button
            onClick={copyCommand}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 font-mono text-sm space-y-4">
          <div>
            <div className="text-gray-600 text-xs mb-2"># Run with a mission</div>
            <div>
              <span className="text-gray-500">$</span>{" "}
              <span className="text-white">npx polish</span>{" "}
              <span className="text-green-400">&quot;Add user authentication with OAuth&quot;</span>
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-xs mb-2"># Just polish existing code</div>
            <div>
              <span className="text-gray-500">$</span>{" "}
              <span className="text-white">npx polish</span>{" "}
              <span className="text-yellow-400">--polish-only</span>
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-xs mb-2"># Set a time budget</div>
            <div>
              <span className="text-gray-500">$</span>{" "}
              <span className="text-white">npx polish</span>{" "}
              <span className="text-green-400">&quot;Add API endpoint&quot;</span>{" "}
              <span className="text-yellow-400">--duration 2h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Economics section - why LLMs beat expensive engineers
function EconomicsSection() {
  const models = [
    { name: "Grok Code Fast", provider: "xAI", input: "$0.20", output: "$1.50", tag: "fastest" },
    { name: "GLM-4.7", provider: "Zhipu AI", input: "$0.60", output: "$2.20", tag: "best value" },
    { name: "Claude Sonnet 4.5", provider: "Anthropic", input: "$3.00", output: "$15.00", tag: "highest quality" },
  ];

  return (
    <div className="space-y-16">
      {/* Main value prop */}
      <div className="text-center">
        <div className="text-gray-500 text-sm mb-4">The question is simple</div>
        <h3 className="text-2xl md:text-3xl text-gray-200 mb-6">
          Why pay an engineer <span className="text-red-400">$500/day</span> to polish code<br />
          when an LLM does it for <span className="text-green-400">$50</span>?
        </h3>
      </div>

      {/* Real cost calculation */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-6 bg-gray-900/30 border-b border-gray-800">
          <div className="text-gray-400 text-sm mb-1">Real session example</div>
          <div className="text-gray-200">300 lines of code, 5 hours of polishing, 100M tokens</div>
        </div>
        <div className="grid md:grid-cols-2">
          <div className="p-6 border-b md:border-b-0 md:border-r border-gray-800">
            <div className="text-green-400 text-xs tracking-wide mb-4">WITH GLM-4.7</div>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">70M input tokens</span>
                <span className="text-gray-400 font-mono">70 x $0.60 = $42</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">30M output tokens</span>
                <span className="text-gray-400 font-mono">30 x $2.20 = $66</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-800">
                <span className="text-gray-400">Total cost</span>
                <span className="text-green-400 font-mono font-bold text-lg">$108</span>
              </div>
            </div>
            <div className="text-gray-600 text-xs">5 hours of autonomous iteration</div>
          </div>
          <div className="p-6">
            <div className="text-cyan-400 text-xs tracking-wide mb-4">WITH CLAUDE SONNET 4.5</div>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">70M input tokens</span>
                <span className="text-gray-400 font-mono">70 x $3 = $210</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">30M output tokens</span>
                <span className="text-gray-400 font-mono">30 x $15 = $450</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-800">
                <span className="text-gray-400">Total cost</span>
                <span className="text-cyan-400 font-mono font-bold text-lg">$660</span>
              </div>
            </div>
            <div className="text-gray-600 text-xs">Maximum quality, still cheaper than human</div>
          </div>
        </div>
      </div>

      {/* Comparison with engineer */}
      <div className="grid md:grid-cols-3 gap-6 text-center">
        <div className="p-6 rounded-lg border border-gray-800 bg-gray-950/30">
          <div className="text-red-400 text-3xl font-bold mb-2">$500+</div>
          <div className="text-gray-500 text-sm">Senior Engineer</div>
          <div className="text-gray-600 text-xs mt-2">1 day of work</div>
        </div>
        <div className="p-6 rounded-lg border border-cyan-900/50 bg-cyan-950/10">
          <div className="text-cyan-400 text-3xl font-bold mb-2">$660</div>
          <div className="text-gray-500 text-sm">Claude Sonnet 4.5</div>
          <div className="text-gray-600 text-xs mt-2">100M tokens, 5 hours</div>
        </div>
        <div className="p-6 rounded-lg border border-green-900/50 bg-green-950/10">
          <div className="text-green-400 text-3xl font-bold mb-2">$108</div>
          <div className="text-gray-500 text-sm">GLM-4.7</div>
          <div className="text-gray-600 text-xs mt-2">100M tokens, 5 hours</div>
        </div>
      </div>

      {/* Key insight */}
      <div className="text-center py-8 border-y border-gray-800">
        <div className="text-gray-600 text-sm mb-3">The insight</div>
        <div className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          LLMs can iterate for <span className="text-green-400">5 hours</span>, process{" "}
          <span className="text-green-400">100M tokens</span>, and still cost{" "}
          <span className="text-green-400">less than a day</span> of engineering time.
        </div>
      </div>

      {/* Model pricing table */}
      <div>
        <div className="text-gray-400 text-sm mb-6">Model pricing (per 1M tokens)</div>
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-900/50 border-b border-gray-800 text-xs text-gray-500">
            <div>Model</div>
            <div>Input</div>
            <div>Output</div>
            <div></div>
          </div>
          {models.map((model, i) => (
            <div
              key={i}
              className={`grid grid-cols-4 gap-4 p-4 text-sm ${
                i < models.length - 1 ? "border-b border-gray-800/50" : ""
              }`}
            >
              <div>
                <div className="text-gray-200">{model.name}</div>
                <div className="text-gray-600 text-xs">{model.provider}</div>
              </div>
              <div className="text-gray-400 font-mono">{model.input}</div>
              <div className="text-gray-400 font-mono">{model.output}</div>
              <div className="flex justify-end">
                {model.tag && (
                  <span className={`text-[10px] px-2 py-1 rounded ${
                    model.tag === "highest quality"
                      ? "bg-cyan-400/20 text-cyan-400"
                      : model.tag === "best value"
                      ? "bg-green-400/20 text-green-400"
                      : "bg-yellow-400/20 text-yellow-400"
                  }`}>
                    {model.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="text-gray-700 text-xs mt-4 text-center">
          Use fast models for iteration. Premium models for initial generation.
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative bg-black text-gray-100 min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-5 bg-black/90 backdrop-blur-sm border-b border-gray-900/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold text-green-400 tracking-tight">POLISH</div>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <div className="text-center max-w-3xl mb-16">
          <ScoreVisualization />
        </div>

        <h1 className="text-2xl md:text-4xl text-gray-200 mb-4 text-center max-w-2xl leading-relaxed">
          AI-generated code is <span className="text-green-400">fast</span>, but not <span className="text-gray-500">done</span>.
        </h1>

        <p className="text-gray-500 max-w-xl mx-auto text-center text-sm md:text-base leading-relaxed mb-10">
          Polish runs LLMs for hours to get your code to production quality. Ship when metrics say 95%+, not when it feels good enough.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-green-400 text-black text-sm font-medium rounded-lg hover:bg-green-300 transition-colors"
          >
            Get Started
          </a>
          <a
            href="#how-it-works"
            className="px-6 py-3 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:border-gray-600 hover:bg-gray-900/50 transition-colors"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* Problem */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">The Problem</h2>
            <p className="text-gray-600 text-sm md:text-base max-w-2xl">
              AI generates code in 30 seconds. Then you spend 3 hours making it work.
            </p>
          </div>
          <ProblemSection />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">How It Works</h2>
            <p className="text-gray-600 text-sm md:text-base max-w-2xl">
              Two phases: Implement (fast generation) then Polish (iterate until 95%+).
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <TypingTerminal />
            <PolishLoopVisualization />
          </div>
        </div>
      </section>

      {/* Time Comparison */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">The Math</h2>
            <p className="text-gray-600 text-sm md:text-base max-w-2xl">
              Developer time is expensive. Compute time is cheap. Let machines iterate for hours.
            </p>
          </div>
          <TimeComparison />
        </div>
      </section>

      {/* Economics */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">The Economics</h2>
            <p className="text-gray-600 text-sm md:text-base max-w-2xl">
              Why pay $500/day for an engineer to polish code when an LLM can do the same for cents?
            </p>
          </div>
          <EconomicsSection />
        </div>
      </section>

      {/* Principles */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">Principles</h2>
          </div>
          <PrinciplesGrid />
        </div>
      </section>

      {/* Usage */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">Usage</h2>
          </div>
          <UsageSection />
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl text-gray-200 mb-6">
            Ready to ship <span className="text-green-400">production-ready</span> code?
          </h2>
          <p className="text-gray-600 mb-10 text-sm md:text-base">
            Stop debugging AI-generated code. Let Polish iterate until it&apos;s done.
          </p>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-green-400 text-black font-medium rounded-lg hover:bg-green-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-green-400 font-bold">POLISH</div>
          <div className="text-gray-700 text-sm text-center">
            Optimize for time to production, not time to first draft.
          </div>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
