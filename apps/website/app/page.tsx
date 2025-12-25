"use client";

import { useState, useEffect } from "react";

function AnimatedScore() {
  const [score, setScore] = useState(34);
  const targetScores = [34, 45, 58, 67, 75, 82, 89, 95];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % targetScores.length;
        setScore(targetScores[next]);
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const getColor = (s: number) => {
    if (s >= 90) return "text-cyan-400";
    if (s >= 70) return "text-green-400";
    if (s >= 50) return "text-yellow-400";
    return "text-orange-400";
  };

  return (
    <div className="relative text-center">
      <div className="text-gray-600 text-xs tracking-widest mb-3">QUALITY SCORE</div>
      <div
        className={`text-7xl md:text-9xl font-bold tabular-nums transition-all duration-300 ${getColor(score)}`}
      >
        {score}
      </div>
      <div className="text-gray-700 text-lg mt-1">/100</div>
      <div className="flex justify-center gap-1.5 mt-6">
        {targetScores.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i <= currentIndex ? "bg-green-400" : "bg-gray-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ProblemVisualization() {
  const painPoints = [
    { time: "30s", label: "Generate", status: "fast" },
    { time: "45m", label: "Fix types", status: "you" },
    { time: "30m", label: "Fix lint", status: "you" },
    { time: "1h", label: "Add tests", status: "you" },
    { time: "20m", label: "Debug", status: "you" },
    { time: "15m", label: "Review", status: "you" },
  ];

  return (
    <div className="space-y-12">
      <div>
        <div className="text-red-400/60 text-xs tracking-widest mb-6">THE PAINFUL REALITY</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-4">
          {painPoints.map((point, i) => (
            <div key={i} className="flex items-center">
              <div className={`px-4 py-3 rounded-lg border ${
                point.status === "fast"
                  ? "border-gray-700 bg-gray-900/30"
                  : "border-red-900/30 bg-red-950/10"
              }`}>
                <div className={`text-lg font-mono ${
                  point.status === "fast" ? "text-gray-400" : "text-red-400/80"
                }`}>
                  {point.time}
                </div>
                <div className="text-gray-600 text-xs mt-1">{point.label}</div>
                {point.status === "you" && (
                  <div className="text-red-400/50 text-[10px] mt-1">you</div>
                )}
              </div>
              {i < painPoints.length - 1 && (
                <div className="text-gray-700 px-1">+</div>
              )}
            </div>
          ))}
          <div className="text-gray-700 px-2">=</div>
          <div className="px-4 py-3 rounded-lg border border-red-900/50 bg-red-950/20">
            <div className="text-2xl font-mono text-red-400">3h+</div>
            <div className="text-red-400/50 text-xs mt-1">your time</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <div className="text-gray-300 text-sm">One-shot generation</div>
          <div className="text-gray-600 text-xs leading-relaxed">
            AI generates once, hopes it works. No iteration, no refinement.
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-gray-300 text-sm">No quality metrics</div>
          <div className="text-gray-600 text-xs leading-relaxed">
            How good is the code? No score, no tests, no lint. Just vibes.
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-gray-300 text-sm">Human cleanup required</div>
          <div className="text-gray-600 text-xs leading-relaxed">
            You debug the AI. Fix types, add tests, handle edge cases. Every time.
          </div>
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-2">
          <div className="p-4 border-r border-b border-gray-800 bg-gray-900/30">
            <span className="text-gray-500 text-xs tracking-wide">Traditional</span>
          </div>
          <div className="p-4 border-b border-gray-800 bg-gray-900/30">
            <span className="text-green-400/80 text-xs tracking-wide">Polish</span>
          </div>
        </div>
        {[
          { old: "Ship when 'good enough'", new: "Ship when score hits 95%" },
          { old: "Black box magic", new: "24 atomic commits to review" },
          { old: "Hope it works", new: "1000 iterations, all tested" },
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-2">
            <div className={`p-4 text-gray-600 text-sm border-r border-gray-800 ${i < 2 ? "border-b border-gray-800/50" : ""}`}>
              {row.old}
            </div>
            <div className={`p-4 text-gray-300 text-sm ${i < 2 ? "border-b border-gray-800/50" : ""}`}>
              {row.new}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PolishLoop() {
  const steps = [
    { num: "01", label: "Measure", detail: "lint, types, tests, coverage" },
    { num: "02", label: "Pick Worst", detail: "Focus on lowest metric" },
    { num: "03", label: "Atomic Fix", detail: "LLM fixes ONE issue" },
    { num: "04", label: "Validate", detail: "Run tests, recalculate" },
    { num: "05", label: "Commit or Rollback", detail: "Keep only improvements" },
  ];

  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-gray-950/50">
      <div className="text-green-400 text-sm font-medium tracking-wide mb-6">THE LOOP</div>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-4">
            <span className="text-gray-700 text-xs font-mono">{step.num}</span>
            <div>
              <div className="text-gray-200 text-sm">{step.label}</div>
              <div className="text-gray-600 text-xs mt-0.5">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-gray-800/50 text-gray-600 text-xs">
        Repeat until score &gt;= 90 or timeout
      </div>
    </div>
  );
}

function TerminalSession() {
  const lines = [
    { text: "$ polish 'Add OAuth with GitHub'", color: "text-white" },
    { text: "", color: "" },
    { text: "Phase 1: IMPLEMENT", color: "text-cyan-400" },
    { text: "  Analyzing project...", color: "text-gray-600" },
    { text: "  Creating auth/config.ts", color: "text-gray-500" },
    { text: "  Creating auth/providers.ts", color: "text-gray-500" },
    { text: "  Initial score: 34/100", color: "text-yellow-400" },
    { text: "", color: "" },
    { text: "Phase 2: POLISH", color: "text-cyan-400" },
    { text: "  #1  fix-types    +5 pts", color: "text-green-400" },
    { text: "  #2  add-tests    +8 pts", color: "text-green-400" },
    { text: "  #3  fix-types    +3 pts", color: "text-green-400" },
    { text: "  #4  fix-lint     +2 pts", color: "text-green-400" },
    { text: "  #5  fix-types    FAIL", color: "text-red-400/70" },
    { text: "  #6  add-tests    +7 pts", color: "text-green-400" },
    { text: "  ...", color: "text-gray-700" },
    { text: "  #24 fix-types    +2 pts", color: "text-green-400" },
    { text: "", color: "" },
    { text: "  Score: 34 -> 91 (+57)", color: "text-cyan-400" },
    { text: "  24 commits", color: "text-gray-500" },
  ];

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/50 border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
        </div>
        <span className="text-gray-600 text-xs ml-2">polish-session</span>
      </div>
      <div className="p-4 h-80 overflow-y-auto text-xs md:text-sm font-mono">
        {lines.map((line, i) => (
          <div key={i} className={`${line.color} leading-relaxed`}>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

function TransparencySection() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="text-red-400/60 text-sm font-medium mb-4">BLACK BOX</div>
        <div className="border border-gray-800/50 rounded-lg p-5 bg-gray-950/30 h-48 flex flex-col justify-center">
          <div className="text-center space-y-2 text-gray-600 text-sm">
            <div>[prompt]</div>
            <div className="text-gray-700">|</div>
            <div className="py-3 border border-dashed border-gray-800 rounded text-gray-700">???</div>
            <div className="text-gray-700">|</div>
            <div>[code]</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-green-400 text-sm font-medium mb-4">TRANSPARENT</div>
        <div className="border border-gray-800 rounded-lg p-5 bg-gray-950/50 h-48 overflow-y-auto">
          <div className="space-y-1 text-xs font-mono">
            <div className="text-gray-500">[mission]</div>
            <div className="text-cyan-400/80">[implement: 4 files]</div>
            <div className="text-yellow-400/80">[score: 34]</div>
            <div className="text-green-400/80">[fix-types +3 pts]</div>
            <div className="text-green-400/80">[add-tests +8 pts]</div>
            <div className="text-red-400/60">[fix-types FAIL]</div>
            <div className="text-green-400/80">[fix-lint +2 pts]</div>
            <div className="text-cyan-400">[score: 89]</div>
            <div className="text-gray-500">[24 commits]</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MathSection() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-3">
        <div className="text-red-400/60 text-sm font-medium mb-4">Traditional</div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Generate</span>
          <span className="text-gray-600">30 sec</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Manual fixes</span>
          <span className="text-red-400/70">2h (you)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Add tests</span>
          <span className="text-red-400/70">1h (you)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Edge cases</span>
          <span className="text-red-400/70">30m (you)</span>
        </div>
        <div className="border-t border-gray-800 pt-3 mt-3 flex justify-between text-sm font-medium">
          <span className="text-gray-400">Your time</span>
          <span className="text-red-400">3.5 hours</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-green-400 text-sm font-medium mb-4">Polish</div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Generate</span>
          <span className="text-gray-600">5 min</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Autonomous polish</span>
          <span className="text-cyan-400/70">2h (machine)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Review</span>
          <span className="text-green-400/70">10 min</span>
        </div>
        <div className="flex justify-between text-sm opacity-0">
          <span>-</span>
          <span>-</span>
        </div>
        <div className="border-t border-gray-800 pt-3 mt-3 flex justify-between text-sm font-medium">
          <span className="text-gray-400">Your time</span>
          <span className="text-green-400">15 minutes</span>
        </div>
      </div>
    </div>
  );
}

function CorePrinciples() {
  const principles = [
    { title: "Persistent", desc: "Runs for hours, not seconds" },
    { title: "Objective", desc: "Metrics, not vibes" },
    { title: "Atomic", desc: "One fix per commit" },
    { title: "Efficient", desc: "Small models at scale" },
    { title: "Safe", desc: "Auto-rollback on failure" },
    { title: "Transparent", desc: "Every change tracked" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
      {principles.map((p, i) => (
        <div key={i}>
          <div className="text-green-400 text-sm font-medium">{p.title}</div>
          <div className="text-gray-600 text-sm mt-1">{p.desc}</div>
        </div>
      ))}
    </div>
  );
}

function UsageExample() {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950/50">
      <div className="px-4 py-3 bg-gray-900/30 border-b border-gray-800">
        <span className="text-gray-500 text-xs">CLI</span>
      </div>
      <div className="p-4 space-y-3 text-sm font-mono">
        <div>
          <span className="text-gray-600"># With a mission</span>
        </div>
        <div>
          <span className="text-gray-500">$</span>{" "}
          <span className="text-gray-300">npx polish</span>{" "}
          <span className="text-green-400/80">&quot;Add OAuth&quot;</span>
        </div>
        <div className="pt-2">
          <span className="text-gray-600"># Just improve existing code</span>
        </div>
        <div>
          <span className="text-gray-500">$</span>{" "}
          <span className="text-gray-300">npx polish --polish-only</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative bg-black text-gray-100 min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-5 bg-black/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-lg font-semibold text-green-400 tracking-tight">POLISH</div>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        <div className="text-center max-w-3xl">
          <div className="mb-16">
            <AnimatedScore />
          </div>

          <h1 className="text-2xl md:text-3xl text-gray-300 mb-4 leading-relaxed">
            AI-generated code is fast, but not done.
          </h1>

          <p className="text-gray-600 max-w-xl mx-auto text-sm leading-relaxed mb-10">
            Polish runs LLMs for hours to get your code to production quality. Ship when metrics say 95%+, not when it feels good enough.
          </p>

          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-green-400 text-black text-sm font-medium rounded hover:bg-green-300 transition-colors"
          >
            Get Started
          </a>
        </div>
      </section>

      {/* Problem */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">The Problem</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              AI generates code in 30 seconds. Then you spend 3 hours making it work.
            </p>
          </div>
          <ProblemVisualization />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">How It Works</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Two phases: Implement (rough generation) then Polish (iterate until 95%+).
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <TerminalSession />
            <PolishLoop />
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">No Black Boxes</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Every change is tracked, tested, and committed atomically. See exactly what changed and why.
            </p>
          </div>
          <TransparencySection />
        </div>
      </section>

      {/* Math */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">The Math</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Developer time is expensive. Compute time is cheap.
            </p>
          </div>
          <MathSection />
        </div>
      </section>

      {/* Principles */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">Principles</h2>
          </div>
          <CorePrinciples />
        </div>
      </section>

      {/* Usage */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">Usage</h2>
          </div>
          <div className="max-w-md">
            <UsageExample />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl text-gray-200 mb-4">
            Ready to ship production-ready code?
          </h2>
          <p className="text-gray-600 mb-8 text-sm">
            Stop debugging AI-generated code. Let Polish iterate until it&apos;s done.
          </p>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-400 text-black text-sm font-medium rounded hover:bg-green-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-green-400 text-sm font-medium">POLISH</div>
          <div className="text-gray-700 text-xs">
            Time to production, not time to first draft.
          </div>
        </div>
      </footer>
    </main>
  );
}
