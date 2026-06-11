const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const replacements = [
  [
    "rounded-xl border border-[var(--border-primary)] bg-[var(--glass-bg)]",
    "glass-card rounded-xl hover:transform-none",
  ],
  [
    "rounded-2xl border border-[var(--border-primary)] bg-[var(--glass-bg)]",
    "glass-panel rounded-2xl",
  ],
  [
    "rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]",
    "glass-card rounded-xl hover:transform-none",
  ],
  [
    "rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)]",
    "glass-panel rounded-2xl",
  ],
  [
    "rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]",
    "glass-card rounded-xl hover:transform-none",
  ],
  [
    "rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-hover)]",
    "glass-panel rounded-2xl",
  ],
  [
    "rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--border-hover)]",
    "glass-card rounded-xl hover:transform-none",
  ],
  [
    "rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]",
    "glass-panel rounded-2xl",
  ],
  [
    "bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--border-hover)] rounded-xl",
    "glass-card rounded-xl hover:transform-none",
  ],
  [
    "rounded-xl border border-[var(--border-hover)] bg-[var(--bg-secondary)]/95 p-3 shadow-xl backdrop-blur-xl",
    "glass-card rounded-xl p-3 shadow-xl hover:transform-none",
  ],
  [
    "rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-hover)] p-6 shadow-2xl",
    "glass-panel rounded-2xl p-6 shadow-2xl",
  ],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".tsx")) {
      let content = fs.readFileSync(full, "utf8");
      const original = content;
      for (const [from, to] of replacements) {
        content = content.split(from).join(to);
      }
      if (content !== original) {
        fs.writeFileSync(full, content);
        console.log("Updated:", path.relative(root, full));
      }
    }
  }
}

walk(root);
console.log("Done.");