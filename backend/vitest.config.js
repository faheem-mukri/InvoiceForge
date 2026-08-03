import { defineConfig } from 'vitest/config';

/**
 * Two projects, because they have different requirements:
 *
 *  unit        — pure functions. No database, fully parallel, milliseconds.
 *  integration — real HTTP requests against the Express app and a real
 *                PostgreSQL database, run serially.
 *
 * Run everything with `npm test`, or just the fast half with
 * `npx vitest run --project unit` (useful when no database is available).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/utils/**/*.test.js'],
          setupFiles: ['./tests/setup/envSetup.js'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'tests/auth/**/*.test.js',
            'tests/invoices/**/*.test.js',
            'tests/clients/**/*.test.js',
            'tests/products/**/*.test.js',
            'tests/payments/**/*.test.js',
            'tests/settings/**/*.test.js',
            'tests/middleware/**/*.test.js',
            'tests/database/**/*.test.js',
            'tests/dashboard/**/*.test.js',
            'tests/public/**/*.test.js',
          ],
          setupFiles: ['./tests/setup/envSetup.js', './tests/setup/dbSetup.js'],

          // Integration tests share one database and truncate between tests.
          // Running files in parallel would let suites wipe each other's rows
          // mid-assertion, so we serialise. A deliberate trade of speed for
          // determinism.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          fileParallelism: false,

          // PDF rendering and bcrypt hashing are slow; allow CI headroom.
          testTimeout: 20000,
          hookTimeout: 60000,
        },
      },
    ],

    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './coverage/junit.xml' },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Measure the application, not the test scaffolding.
      include: ['src/**/*.js'],
      exclude: [
        'src/index.js', // server bootstrap (listen only)
        'src/generated/**',
        'src/pdf/fonts/**',
        'tests/**',
      ],

      // Enforced: `npm run test:coverage` fails below these. Business logic and
      // utilities are held to a higher bar than glue code.
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,

        'src/utils/pricing.js': {
          lines: 95, functions: 95, statements: 95, branches: 90,
        },
        'src/utils/validate.js': {
          lines: 95, functions: 95, statements: 95, branches: 90,
        },
        'src/services/**/*.js': {
          lines: 75, functions: 75, statements: 75, branches: 65,
        },
      },
    },
  },
});
