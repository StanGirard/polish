"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setDisplayedText(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text, started]);

  return (
    <span>
      {displayedText}
      {displayedText.length < text.length && started && (
        <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

function AnimatedScore() {
  const [score, setScore] = useState(34);
  const targetScores = [34, 45, 58, 67, 75, 82, 89, 95];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % targetScores.length;
        setScore(targetScores[next]);
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const getColor = (s: number) => {
    if (s >= 90) return "text-cyan-400";
    if (s >= 70) return "text-green-400";
    if (s >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="font-mono text-center">
      <div className="text-gray-500 text-sm mb-2">QUALITY SCORE</div>
      <motion.div
        key={score}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-6xl md:text-8xl font-bold ${getColor(score)}`}
        style={{
          textShadow: score >= 90 ? "0 0 30px rgba(0, 255, 255, 0.5)" : undefined,
        }}
      >
        {score}
      </motion.div>
      <div className="text-gray-600 text-sm mt-2">/100</div>
    </div>
  );
}

function ComparisonTable() {
  const rows = [
    { traditional: "Generate code in 30 sec", polish: "Generate in 5 min" },
    { traditional: "YOU fix for 2-3 hours", polish: "AI polishes for 2 hours" },
    { traditional: "Ship when 'good enough'", polish: "Ship when metrics say 95%+" },
    { traditional: "Black box magic", polish: "24 atomic commits you can review" },
    { traditional: "No quality metrics", polish: "Score: 34 -> 89 (proven)" },
    { traditional: "One-shot, hope it works", polish: "1000 iterations, tested" },
  ];

  return (
    <div className="font-mono text-sm overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="border border-gray-700 rounded">
          <div className="grid grid-cols-2 border-b border-gray-700">
            <div className="p-4 text-red-400 border-r border-gray-700 font-semibold">
              Traditional AI Coding
            </div>
            <div className="p-4 text-green-400 font-semibold">Polish</div>
          </div>
          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`grid grid-cols-2 ${i < rows.length - 1 ? "border-b border-gray-800" : ""}`}
            >
              <div className="p-4 text-gray-500 border-r border-gray-800">
                {row.traditional}
              </div>
              <div className="p-4 text-gray-300">{row.polish}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolishLoop() {
  const steps = [
    { label: "1. Measure", detail: "lint: 23 errors, types: 15 errors, coverage: 45%" },
    { label: "2. Pick Worst", detail: "Focus: typeErrors (worst)" },
    { label: "3. Atomic Fix", detail: "LLM fixes ONE type error" },
    { label: "4. Validate", detail: "Run tests, recalculate score" },
    { label: "5. Commit/Rollback", detail: "If improved: commit. If broken: rollback" },
  ];

  return (
    <div className="font-mono text-sm">
      <div className="border border-gray-700 rounded p-6">
        <div className="text-green-400 mb-4 font-semibold">POLISH LOOP</div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="flex gap-4"
            >
              <span className="text-cyan-400 w-28 flex-shrink-0">{step.label}</span>
              <span className="text-gray-500">{step.detail}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-800 text-gray-600 text-xs">
          Repeat until: score &gt;= 90 OR timeout OR plateau
        </div>
      </div>
    </div>
  );
}

function TerminalSession() {
  const lines = [
    { text: "$ polish 'Add OAuth with GitHub'", color: "text-white" },
    { text: "", color: "" },
    { text: "Phase 1: IMPLEMENT", color: "text-cyan-400" },
    { text: "  Analyzing project structure...", color: "text-gray-500" },
    { text: "  Generating auth/config.ts", color: "text-gray-400" },
    { text: "  Generating auth/providers.ts", color: "text-gray-400" },
    { text: "  Modifying middleware.ts", color: "text-gray-400" },
    { text: "  Initial score: 34/100", color: "text-yellow-400" },
    { text: "", color: "" },
    { text: "Phase 2: POLISH", color: "text-cyan-400" },
    { text: "  #1  fix-types    +5 pts   Fix Optional type", color: "text-green-400" },
    { text: "  #2  add-tests    +8 pts   Add test for parseToken", color: "text-green-400" },
    { text: "  #3  fix-types    +3 pts   Add return type", color: "text-green-400" },
    { text: "  #4  fix-lint     +2 pts   Remove unused import", color: "text-green-400" },
    { text: "  #5  fix-types    FAIL     tests broken -> rollback", color: "text-red-400" },
    { text: "  #6  add-tests    +7 pts   Test edge case", color: "text-green-400" },
    { text: "  ...", color: "text-gray-600" },
    { text: "  #24 fix-types    +2 pts   Final type annotation", color: "text-green-400" },
    { text: "", color: "" },
    { text: "  Score: 34 -> 91 (+57 pts)", color: "text-cyan-400" },
    { text: "  24 atomic commits", color: "text-gray-400" },
    { text: "  Done.", color: "text-green-400" },
  ];

  return (
    <div className="font-mono text-xs md:text-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-500 ml-2 text-xs">polish-session</span>
        </div>
        <div className="p-4 h-96 overflow-y-auto">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`${line.color} leading-relaxed`}
            >
              {line.text || "\u00A0"}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransparencySection() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="font-mono text-sm">
        <div className="text-red-400 mb-4 font-semibold">BLACK BOX (Others)</div>
        <div className="border border-gray-800 rounded p-4 bg-gray-950">
          <div className="text-gray-500">[Your prompt]</div>
          <div className="text-gray-600 my-2 text-center">|</div>
          <div className="text-gray-600 my-2 text-center">v</div>
          <div className="text-gray-500 text-center py-4 border border-dashed border-gray-700 rounded my-2">
            ??? Magic ???
          </div>
          <div className="text-gray-600 my-2 text-center">|</div>
          <div className="text-gray-600 my-2 text-center">v</div>
          <div className="text-gray-500">[Code that might work]</div>
        </div>
      </div>

      <div className="font-mono text-sm">
        <div className="text-green-400 mb-4 font-semibold">TRANSPARENT (Polish)</div>
        <div className="border border-gray-700 rounded p-4 bg-gray-950">
          <div className="space-y-1 text-xs">
            <div className="text-gray-400">[Your mission]</div>
            <div className="text-gray-600">  |</div>
            <div className="text-cyan-400">[Implement: 4 files created]</div>
            <div className="text-yellow-400">[Score: 34/100]</div>
            <div className="text-gray-600">  |</div>
            <div className="text-green-400">[fix-types +3 pts → commit]</div>
            <div className="text-green-400">[add-tests +8 pts → commit]</div>
            <div className="text-red-400">[fix-types FAIL → rollback]</div>
            <div className="text-green-400">[fix-lint +2 pts → commit]</div>
            <div className="text-gray-600">  |</div>
            <div className="text-cyan-400">[Score: 89/100]</div>
            <div className="text-gray-400">[24 atomic commits, reviewed]</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MathSection() {
  return (
    <div className="grid md:grid-cols-2 gap-8 font-mono text-sm">
      <div>
        <div className="text-red-400 mb-4 font-semibold">Traditional AI Coding</div>
        <div className="space-y-2 text-gray-400">
          <div className="flex justify-between">
            <span>Generate</span>
            <span className="text-gray-600">30 seconds</span>
          </div>
          <div className="flex justify-between">
            <span>Manual fixes</span>
            <span className="text-red-400">2 hours (YOU)</span>
          </div>
          <div className="flex justify-between">
            <span>Add tests</span>
            <span className="text-red-400">1 hour (YOU)</span>
          </div>
          <div className="flex justify-between">
            <span>Fix edge cases</span>
            <span className="text-red-400">30 min (YOU)</span>
          </div>
          <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-semibold">
            <span>Your time</span>
            <span className="text-red-400">3.5 hours</span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-green-400 mb-4 font-semibold">Polish</div>
        <div className="space-y-2 text-gray-400">
          <div className="flex justify-between">
            <span>Generate</span>
            <span className="text-gray-600">5 minutes</span>
          </div>
          <div className="flex justify-between">
            <span>Automated polish</span>
            <span className="text-cyan-400">2 hours (AUTONOMOUS)</span>
          </div>
          <div className="flex justify-between">
            <span>Your review</span>
            <span className="text-green-400">10 minutes</span>
          </div>
          <div className="flex justify-between opacity-0">
            <span>-</span>
            <span>-</span>
          </div>
          <div className="border-t border-gray-800 pt-2 mt-2 flex justify-between font-semibold">
            <span>Your time</span>
            <span className="text-green-400">15 minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostSection() {
  return (
    <div className="font-mono text-sm">
      <div className="border border-gray-700 rounded overflow-hidden">
        <div className="grid grid-cols-3 border-b border-gray-700 bg-gray-900">
          <div className="p-3 text-gray-400">Strategy</div>
          <div className="p-3 text-gray-400 border-l border-gray-700">Models</div>
          <div className="p-3 text-gray-400 border-l border-gray-700">Cost/2h</div>
        </div>
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-3 text-gray-300">Maximum Quality</div>
          <div className="p-3 text-gray-500 border-l border-gray-800">Opus + Sonnet</div>
          <div className="p-3 text-yellow-400 border-l border-gray-800">~$2.50</div>
        </div>
        <div className="grid grid-cols-3 border-b border-gray-800 bg-green-950/20">
          <div className="p-3 text-green-400">Best Value</div>
          <div className="p-3 text-gray-400 border-l border-gray-800">Sonnet + DeepSeek</div>
          <div className="p-3 text-green-400 border-l border-gray-800">~$0.13</div>
        </div>
        <div className="grid grid-cols-3">
          <div className="p-3 text-gray-300">Maximum Scale</div>
          <div className="p-3 text-gray-500 border-l border-gray-800">DeepSeek + DeepSeek</div>
          <div className="p-3 text-cyan-400 border-l border-gray-800">~$0.05</div>
        </div>
      </div>
      <div className="mt-4 text-gray-600 text-xs">
        Atomic fixes don&apos;t need genius-level reasoning. A $0.001/fix model running 1000 times beats a $0.10/fix model running 10 times.
      </div>
    </div>
  );
}

function CorePrinciples() {
  const principles = [
    {
      title: "Persistent Iteration",
      desc: "Runs for hours, not seconds. Small models become powerful when given time.",
    },
    {
      title: "Objective Quality",
      desc: "Measures lint, types, tests, coverage. Not vibes.",
    },
    {
      title: "Atomic Commits",
      desc: "Each fix is isolated, tested, and committable. 24 commits you can review.",
    },
    {
      title: "Cost Efficient",
      desc: "Uses small models for iteration. $0.13 per session, not $2.50.",
    },
    {
      title: "Fail-Safe",
      desc: "Tests prevent regressions. Auto-rollback on failure. Never breaks working code.",
    },
    {
      title: "Transparent",
      desc: "See exactly what changed and why. Score progression: 34 -> 67 -> 89.",
    },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {principles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="border-l-2 border-green-900 pl-4"
        >
          <div className="text-green-400 font-semibold mb-2">{p.title}</div>
          <div className="text-gray-500 text-sm leading-relaxed">{p.desc}</div>
        </motion.div>
      ))}
    </div>
  );
}

function UsageExample() {
  return (
    <div className="font-mono text-sm space-y-4">
      <div className="text-gray-400 mb-2">CLI</div>
      <div className="bg-gray-950 border border-gray-800 rounded p-4 space-y-2">
        <div>
          <span className="text-gray-500"># With a mission</span>
        </div>
        <div>
          <span className="text-cyan-400">$</span>{" "}
          <span className="text-white">npx polish</span>{" "}
          <span className="text-green-400">&quot;Add a GET /api/users/:id endpoint&quot;</span>
        </div>
        <div className="mt-4">
          <span className="text-gray-500"># Just improve existing code</span>
        </div>
        <div>
          <span className="text-cyan-400">$</span>{" "}
          <span className="text-white">npx polish --polish-only</span>
        </div>
        <div className="mt-4">
          <span className="text-gray-500"># With max duration</span>
        </div>
        <div>
          <span className="text-cyan-400">$</span>{" "}
          <span className="text-white">npx polish</span>{" "}
          <span className="text-green-400">&quot;Add OAuth&quot;</span>{" "}
          <span className="text-yellow-400">--duration 1h</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <main className="relative bg-black min-h-screen">
      {/* Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-black/80 backdrop-blur-sm border-b border-gray-900"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold text-green-400 font-mono">POLISH</div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-gray-500 hover:text-green-400 transition-colors text-sm font-mono"
            >
              How it works
            </a>
            <a
              href="#cost"
              className="text-gray-500 hover:text-green-400 transition-colors text-sm font-mono"
            >
              Pricing
            </a>
            <a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-gray-700 text-gray-300 rounded text-sm font-mono hover:border-green-400 hover:text-green-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="min-h-screen flex flex-col items-center justify-center px-6 pt-20"
        style={{ opacity: heroOpacity }}
      >
        <motion.div
          className="text-center max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div
            variants={fadeInUp}
            className="inline-block px-3 py-1 rounded border border-gray-800 text-gray-500 text-xs font-mono mb-8"
          >
            Autonomous Quality System
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-7xl font-bold mb-6 font-mono"
          >
            <span className="text-green-400">POLISH</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-gray-400 mb-4 font-mono"
          >
            <TypewriterText text="AI-generated code is fast, but not done." delay={0.5} />
          </motion.p>

          <motion.p
            variants={fadeInUp}
            className="text-gray-600 mb-12 max-w-2xl mx-auto font-mono text-sm leading-relaxed"
          >
            Polish is a persistent quality automation system that runs small or large LLMs for hours to guarantee long-term code quality. Ship when metrics say 95%+, not when it feels &quot;good enough&quot;.
          </motion.p>

          <motion.div variants={fadeInUp} className="mb-16">
            <AnimatedScore />
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 justify-center">
            <a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-green-400 text-black font-semibold rounded font-mono hover:bg-green-300 transition-colors"
            >
              Get Started
            </a>
            <a
              href="#how-it-works"
              className="px-8 py-3 border border-gray-700 text-gray-300 rounded font-mono hover:border-green-400 hover:text-green-400 transition-colors"
            >
              See How It Works
            </a>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Problem Statement */}
      <section className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              The Problem
            </h2>
            <p className="text-gray-500 font-mono text-sm max-w-3xl">
              Current AI coding tools give you a black box. One-shot generation, no quality guarantee, human cleanup required. You end up debugging AI-generated code instead of shipping features.
            </p>
          </motion.div>

          <ComparisonTable />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              How It Works
            </h2>
            <p className="text-gray-500 font-mono text-sm max-w-3xl">
              Two phases: Implement (fast, rough generation) then Polish (persistent iteration until metrics hit 95%+).
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            <TerminalSession />
            <PolishLoop />
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              No More Black Boxes
            </h2>
            <p className="text-gray-500 font-mono text-sm max-w-3xl">
              Polish doesn&apos;t ask &quot;does this feel right?&quot; It asks &quot;did the score improve?&quot; Every change is tracked, tested, and committed atomically.
            </p>
          </motion.div>

          <TransparencySection />
        </div>
      </section>

      {/* Time Math */}
      <section className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              The Math That Matters
            </h2>
            <p className="text-gray-500 font-mono text-sm max-w-3xl">
              Developer time is expensive. Compute time is cheap. Let machines iterate for hours so humans don&apos;t have to.
            </p>
          </motion.div>

          <MathSection />
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              Core Principles
            </h2>
          </motion.div>

          <CorePrinciples />
        </div>
      </section>

      {/* Cost */}
      <section id="cost" className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              Cost Efficient
            </h2>
            <p className="text-gray-500 font-mono text-sm max-w-3xl">
              Use big models for initial implementation, small models for the polish loop. 95% cheaper than all-Sonnet approach.
            </p>
          </motion.div>

          <CostSection />
        </div>
      </section>

      {/* Usage */}
      <section className="py-24 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-4 font-mono">
              Usage
            </h2>
          </motion.div>

          <UsageExample />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-gray-900">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-6 font-mono">
            Ready to Polish Your Code?
          </h2>
          <p className="text-gray-500 mb-8 font-mono text-sm">
            Stop debugging AI-generated code. Let Polish iterate until it&apos;s production-ready.
          </p>
          <a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-green-400 text-black font-semibold rounded font-mono hover:bg-green-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-green-400 font-bold text-lg font-mono">POLISH</div>
            <div className="text-gray-600 text-sm font-mono">
              Optimize for time to production, not time to first draft.
            </div>
            <a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-green-400 transition-colors font-mono text-sm"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
