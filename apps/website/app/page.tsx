"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.15,
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
    }, 40);
    return () => clearInterval(interval);
  }, [text, started]);

  return (
    <span>
      {displayedText}
      {displayedText.length < text.length && started && (
        <motion.span
          className="inline-block w-0.5 h-6 md:h-8 bg-green-400 ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </span>
  );
}

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

  const getGlow = (s: number) => {
    if (s >= 90) return "0 0 60px rgba(34, 211, 238, 0.4)";
    if (s >= 70) return "0 0 40px rgba(74, 222, 128, 0.3)";
    return "none";
  };

  return (
    <div className="relative">
      <div className="text-gray-600 text-xs tracking-widest mb-3">QUALITY SCORE</div>
      <motion.div
        key={score}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`text-7xl md:text-9xl font-bold tabular-nums ${getColor(score)}`}
        style={{ textShadow: getGlow(score) }}
      >
        {score}
      </motion.div>
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
    <div className="overflow-x-auto -mx-6 px-6">
      <div className="min-w-[640px]">
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2">
            <div className="p-5 bg-gray-900/50 border-b border-r border-gray-800">
              <span className="text-red-400/80 text-sm font-medium tracking-wide">Traditional AI Coding</span>
            </div>
            <div className="p-5 bg-gray-900/50 border-b border-gray-800">
              <span className="text-green-400 text-sm font-medium tracking-wide">Polish</span>
            </div>
          </div>
          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="grid grid-cols-2"
            >
              <div className={`p-4 text-gray-500 text-sm border-r border-gray-800 ${i < rows.length - 1 ? "border-b border-gray-800/50" : ""}`}>
                {row.traditional}
              </div>
              <div className={`p-4 text-gray-300 text-sm ${i < rows.length - 1 ? "border-b border-gray-800/50" : ""}`}>
                {row.polish}
              </div>
            </motion.div>
          ))}
        </div>
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
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start gap-4"
          >
            <span className="text-gray-700 text-xs font-mono">{step.num}</span>
            <div>
              <div className="text-gray-200 text-sm">{step.label}</div>
              <div className="text-gray-600 text-xs mt-0.5">{step.detail}</div>
            </div>
          </motion.div>
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
    { text: "  #5  fix-types    FAIL -> rollback", color: "text-red-400/70" },
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
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03 }}
            className={`${line.color} leading-relaxed`}
          >
            {line.text || "\u00A0"}
          </motion.div>
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
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
        >
          <div className="text-green-400 text-sm font-medium">{p.title}</div>
          <div className="text-gray-600 text-sm mt-1">{p.desc}</div>
        </motion.div>
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
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <main className="relative bg-black min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-5">
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
      <motion.section
        ref={heroRef}
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ opacity: heroOpacity }}
      >
        <motion.div
          className="text-center max-w-3xl"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div variants={fadeIn} className="mb-16">
            <AnimatedScore />
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-2xl md:text-3xl text-gray-300 mb-4 leading-relaxed"
          >
            <TypewriterText text="AI-generated code is fast, but not done." delay={0.3} />
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-gray-600 max-w-xl mx-auto text-sm leading-relaxed mb-10"
          >
            Polish runs LLMs for hours to get your code to production quality. Ship when metrics say 95%+, not when it feels good enough.
          </motion.p>

          <motion.div variants={fadeInUp}>
            <a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-green-400 text-black text-sm font-medium rounded hover:bg-green-300 transition-colors"
            >
              Get Started
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            className="w-5 h-8 border border-gray-700 rounded-full flex justify-center pt-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-1 h-2 bg-gray-600 rounded-full" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Problem */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">The Problem</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Current AI tools give you code fast, but you spend hours fixing it. One-shot generation, no quality metrics, human cleanup required.
            </p>
          </motion.div>
          <ComparisonTable />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">How It Works</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Two phases: Implement (rough generation) then Polish (iterate until 95%+).
            </p>
          </motion.div>
          <div className="grid lg:grid-cols-2 gap-6">
            <TerminalSession />
            <PolishLoop />
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">No Black Boxes</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Every change is tracked, tested, and committed atomically. See exactly what changed and why.
            </p>
          </motion.div>
          <TransparencySection />
        </div>
      </section>

      {/* Math */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">The Math</h2>
            <p className="text-gray-600 text-sm max-w-2xl">
              Developer time is expensive. Compute time is cheap.
            </p>
          </motion.div>
          <MathSection />
        </div>
      </section>

      {/* Principles */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">Principles</h2>
          </motion.div>
          <CorePrinciples />
        </div>
      </section>

      {/* Usage */}
      <section className="py-32 px-6 border-t border-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mb-12"
          >
            <h2 className="text-xl md:text-2xl text-gray-200 mb-3">Usage</h2>
          </motion.div>
          <div className="max-w-md">
            <UsageExample />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-gray-900">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
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
        </motion.div>
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
