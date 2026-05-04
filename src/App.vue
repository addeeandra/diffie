<template>
  <main class="app-shell">
    <section class="hero">
      <p class="eyebrow">Diffie</p>
      <h1>Visual PostgreSQL snapshot diffs, locally in the browser.</h1>
      <p class="lede">
        This project is being rebuilt from a single-file prototype into a focused Vue + Vite app.
        Version 1 targets PostgreSQL <code>INSERT INTO ... VALUES</code> dumps first, keeps processing local,
        and aims for clean print-friendly diff output.
      </p>

      <div class="status-grid" aria-label="Project status overview">
        <article>
          <h2>Current focus</h2>
          <p>Scaffold the app shell, parser modules, diff engine boundaries, and docs.</p>
        </article>
        <article>
          <h2>Input target</h2>
          <p>Small PostgreSQL SQL snapshots, typically under 5 MB, optimized for INSERT dumps.</p>
        </article>
        <article>
          <h2>Output target</h2>
          <p>Interactive diff review in-browser, with print-media support for sharing or saving to PDF.</p>
        </article>
      </div>

      <div class="next-steps">
        <span>Prototype reference: <code>prototype/db-diff-visualizer.jsx</code></span>
        <span>See <code>README.md</code>, <code>CONTRIBUTING.md</code>, and <code>ROADMAP.md</code>.</span>
      </div>
    </section>
  </main>
</template>
