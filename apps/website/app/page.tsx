"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Animation variants
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

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

// Components
function CodeRain() {
  const columns = Array.from({ length: 20 }, (_, i) => i);
  const chars = "01アイウエオカキクケコサシスセソタチツテト";

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
      {columns.map((col) => (
        <motion.div
          key={col}
          className="absolute text-green-500 text-sm font-mono"
          style={{ left: `${col * 5}%` }}
          initial={{ y: "-100%" }}
          animate={{ y: "100vh" }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5,
          }}
        >
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className="opacity-50">
              {chars[Math.floor(Math.random() * chars.length)]}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

function GlowingOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl ${className}`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        delay,
      }}
    />
  );
}

function TerminalDemo() {
  const lines = [
    { text: "$ polish init", delay: 0 },
    { text: "> Analyzing codebase...", delay: 0.5, color: "text-gray-500" },
    { text: "> Found 247 files to analyze", delay: 1, color: "text-cyan-400" },
    { text: "> Running quality checks...", delay: 1.5, color: "text-gray-500" },
    { text: "", delay: 2 },
    { text: "  SCORE: 0x4B (75/100)", delay: 2.2, color: "text-yellow-400" },
    { text: "  Issues: 23 warnings, 5 errors", delay: 2.5, color: "text-yellow-400" },
    { text: "", delay: 2.8 },
    { text: "> Starting autonomous fix loop...", delay: 3, color: "text-gray-500" },
    { text: "> Iteration 1: Fixed 12 issues", delay: 3.5, color: "text-green-400" },
    { text: "> Iteration 2: Fixed 8 issues", delay: 4, color: "text-green-400" },
    { text: "> Iteration 3: Fixed 5 issues", delay: 4.5, color: "text-green-400" },
    { text: "> Iteration 4: Fixed 3 issues", delay: 5, color: "text-green-400" },
    { text: "", delay: 5.3 },
    { text: "  SCORE: 0x5F (95/100)", delay: 5.5, color: "text-cyan-400 glow-cyan" },
    { text: "  All issues resolved!", delay: 5.8, color: "text-green-400 glow-green" },
  ];

  return (
    <div className="terminal-window max-w-2xl mx-auto">
      <div className="terminal-header">
        <div className="terminal-dot bg-red-500" />
        <div className="terminal-dot bg-yellow-500" />
        <div className="terminal-dot bg-green-500" />
        <span className="text-gray-500 text-sm ml-2">polish-session</span>
      </div>
      <div className="terminal-body h-80 overflow-hidden">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: line.delay, duration: 0.3 }}
            className={line.color || "text-green-400"}
          >
            {line.text || "\u00A0"}
          </motion.div>
        ))}
        <motion.span
          className="inline-block w-2 h-4 bg-green-400"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

function ScoreAnimation() {
  const scores = [42, 55, 68, 75, 82, 89, 95];

  return (
    <div className="relative h-40 flex items-end justify-center gap-3">
      {scores.map((score, i) => (
        <motion.div
          key={i}
          className="relative"
          initial={{ height: 0, opacity: 0 }}
          whileInView={{ height: `${score}%`, opacity: 1 }}
          transition={{ delay: i * 0.15, duration: 0.5, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <div
            className={`w-8 rounded-t ${
              score >= 90
                ? "bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.5)]"
                : score >= 70
                ? "bg-green-400 shadow-[0_0_20px_rgba(0,255,0,0.5)]"
                : score >= 50
                ? "bg-yellow-400"
                : "bg-red-400"
            }`}
            style={{ height: "100%" }}
          />
          <motion.span
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: i * 0.15 + 0.5 }}
          >
            {score}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="feature-card p-6 rounded-lg border border-green-900/50 neon-border"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeInUp}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-green-400 mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

function HowItWorksStep({
  number,
  title,
  description,
  isLast = false,
}: {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <motion.div
      className="relative flex gap-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeInUp}
      transition={{ delay: number * 0.2 }}
    >
      {/* Step number with glow */}
      <div className="relative">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-green-400 flex items-center justify-center text-green-400 font-bold relative z-10 bg-black"
          whileHover={{ scale: 1.1, boxShadow: "0 0 30px rgba(0,255,0,0.5)" }}
        >
          {number}
        </motion.div>
        {/* Connecting line */}
        {!isLast && (
          <motion.div
            className="absolute left-1/2 top-12 w-0.5 h-24 -translate-x-1/2"
            initial={{ height: 0, background: "linear-gradient(180deg, #00ff00, transparent)" }}
            whileInView={{ height: 96 }}
            transition={{ delay: number * 0.2 + 0.3, duration: 0.5 }}
            style={{ background: "linear-gradient(180deg, #00ff00, transparent)" }}
          />
        )}
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-green-400"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: number * 0.3,
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 pb-16">
        <h3 className="text-xl font-semibold text-green-400 mb-2">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function FloatingCode() {
  const codeSnippets = [
    "function polish(code) {",
    "  analyze()",
    "  fix()",
    "  repeat()",
    "}",
    "score++",
    "quality.improve()",
    "bugs.eliminate()",
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {codeSnippets.map((code, i) => (
        <motion.div
          key={i}
          className="absolute text-green-900/30 text-sm font-mono whitespace-nowrap"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 80 + 10}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5 + Math.random() * 3,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        >
          {code}
        </motion.div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  return (
    <main className="relative">
      {/* Background effects */}
      <CodeRain />
      <GlowingOrb className="w-96 h-96 bg-green-500/20 -top-48 -left-48" />
      <GlowingOrb className="w-64 h-64 bg-cyan-500/20 top-1/4 -right-32" delay={1} />
      <GlowingOrb className="w-80 h-80 bg-magenta-500/20 bottom-1/4 -left-40" delay={2} />

      {/* Navigation */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            className="text-2xl font-bold text-green-400 glow-green"
            whileHover={{ scale: 1.05 }}
          >
            POLISH
          </motion.div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-gray-400 hover:text-green-400 transition-colors text-sm">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-400 hover:text-green-400 transition-colors text-sm">
              How it Works
            </a>
            <motion.a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-green-400 text-green-400 rounded text-sm hover-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              GitHub
            </motion.a>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <FloatingCode />

        <motion.div
          className="relative z-10 text-center max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {/* Status badge */}
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-900/50 bg-green-900/10 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-400">Autonomous Code Quality</span>
          </motion.div>

          {/* Main title with glitch effect */}
          <motion.h1
            variants={fadeInUp}
            className="text-6xl md:text-8xl font-bold mb-6 relative"
          >
            <span className="glitch text-green-400 glow-green" data-text="POLISH">
              POLISH
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-gray-400 mb-4"
          >
            AI-powered code improvement that never sleeps
          </motion.p>

          <motion.p
            variants={fadeInUp}
            className="text-gray-500 mb-12 max-w-2xl mx-auto"
          >
            Polish autonomously analyzes, fixes, and improves your codebase.
            Watch your quality score rise as it iterates toward perfection.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 justify-center">
            <motion.a
              href="https://github.com/stangirard/polish"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-green-400 text-black font-semibold rounded hover-glow"
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(0,255,0,0.5)" }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.a>
            <motion.a
              href="#how-it-works"
              className="px-8 py-4 border border-green-400 text-green-400 rounded hover-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              See How It Works
            </motion.a>
          </motion.div>

          {/* Score preview */}
          <motion.div
            variants={fadeInUp}
            className="mt-16"
          >
            <div className="text-gray-500 text-sm mb-4">Quality Score Over Time</div>
            <ScoreAnimation />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="text-gray-500 text-sm mb-2">Scroll</div>
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center pt-2">
            <motion.div
              className="w-1.5 h-3 bg-green-400 rounded-full"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </motion.section>

      {/* Terminal Demo Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-4">
              Watch Polish in Action
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              See how Polish autonomously improves your code quality
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
          >
            <TerminalDemo />
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-4">
              How It Works
            </h2>
            <p className="text-gray-400">
              Polish uses an autonomous loop to continuously improve your code
            </p>
          </motion.div>

          <div className="space-y-0">
            <HowItWorksStep
              number={1}
              title="Initialize"
              description="Polish scans your codebase and understands its structure, dependencies, and coding patterns. It identifies areas that need improvement."
            />
            <HowItWorksStep
              number={2}
              title="Analyze"
              description="Using AI-powered analysis, Polish evaluates code quality across multiple dimensions: type safety, linting, complexity, and best practices."
            />
            <HowItWorksStep
              number={3}
              title="Plan"
              description="Polish creates a strategic plan to address issues, prioritizing high-impact fixes and considering dependencies between changes."
            />
            <HowItWorksStep
              number={4}
              title="Execute"
              description="Automated fixes are applied to your codebase. Polish handles everything from simple lint fixes to complex refactoring."
            />
            <HowItWorksStep
              number={5}
              title="Iterate"
              description="The loop continues until your code reaches the target quality score. Each iteration builds on the previous improvements."
              isLast
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-green-400 mb-4">
              Features
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need for autonomous code quality improvement
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <FeatureCard
              icon="🔄"
              title="Autonomous Loops"
              description="Set a target score and let Polish iterate until it's achieved. No manual intervention required."
              delay={0}
            />
            <FeatureCard
              icon="📊"
              title="Quality Metrics"
              description="Track your code quality with detailed metrics including type coverage, lint score, and complexity analysis."
              delay={0.1}
            />
            <FeatureCard
              icon="🤖"
              title="AI-Powered Fixes"
              description="Leverages advanced AI to understand context and apply intelligent fixes that respect your codebase patterns."
              delay={0.2}
            />
            <FeatureCard
              icon="👁️"
              title="Real-time Monitoring"
              description="Watch progress in real-time with a beautiful terminal UI showing every change as it happens."
              delay={0.3}
            />
            <FeatureCard
              icon="🔍"
              title="Deep Analysis"
              description="Goes beyond surface-level linting to analyze architecture, patterns, and potential improvements."
              delay={0.4}
            />
            <FeatureCard
              icon="🛡️"
              title="Safe by Design"
              description="All changes are validated and tested. Polish never breaks working code—only makes it better."
              delay={0.5}
            />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="grid md:grid-cols-3 gap-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {[
              { value: "95%", label: "Average Score Improvement" },
              { value: "10x", label: "Faster Than Manual Review" },
              { value: "0", label: "Breaking Changes" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                className="p-8 rounded-lg border border-green-900/30 bg-green-900/5"
              >
                <motion.div
                  className="text-5xl font-bold text-green-400 glow-green mb-2"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: i * 0.1 + 0.3, type: "spring" }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-green-400 mb-6 glow-green">
            Ready to Polish Your Code?
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Join developers who trust Polish to maintain and improve their code quality automatically.
          </p>
          <motion.a
            href="https://github.com/stangirard/polish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-green-400 text-black font-semibold rounded text-lg"
            whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(0,255,0,0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </motion.a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-green-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-green-400 font-bold text-xl">POLISH</div>
            <div className="text-gray-500 text-sm">
              Built with autonomy in mind. Made for developers who value quality.
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/stangirard/polish"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-green-400 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-green-900/20 text-center text-gray-600 text-sm">
            <p>
              &copy; {new Date().getFullYear()} Polish. Autonomous code quality for the modern developer.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
