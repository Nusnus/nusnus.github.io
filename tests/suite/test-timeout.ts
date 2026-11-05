/**
 * @file How long a test may run before it fails as hung, for every Vitest
 * run the suite starts: its own projects and the runs its integration tests
 * start to test the suite's setup files and fixtures.
 */

// The timeout only says how long a test that hangs takes to fail. A loaded
// machine, as checks in several checkouts at once load it, or the owner's
// other work beside one, slows every test many times over, past Vitest's
// default: in checks at load averages of 80 to 210 on 10 cores, the
// worker-version wait's unit test took 5.8 s against 0.15 s alone, the fake
// network's integration test, which runs Vitest itself, over 20 s against
// 0.7 s alone, and a test in the Vitest run it starts over 5 s. A minute
// leaves room for the slowest test, 0.9 s alone, to run forty times slower
// and more.
export const TEST_TIMEOUT_MS = 60_000;
