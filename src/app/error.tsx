"use client";

import styles from "./error.module.css";

/**
 * Route-segment fallback for unexpected rendering failures in the App Router.
 *
 * Next.js places this client component behind a React error boundary and
 * supplies the thrown value and a reset callback. This fallback deliberately
 * ignores the thrown value so messages, stack traces, digests, and application
 * state are never rendered or reported. The reset action retries the segment;
 * the separate reload action provides a broader recovery option. This
 * route-level boundary does not catch failures in its parent root layout.
 */
interface ErrorProps {
  /** Thrown value supplied by Next.js; intentionally not inspected or exposed. */
  error: unknown;
  /** Clears this boundary's error state and attempts to render the segment again. */
  reset: () => void;
}

/**
 * Renders the generic recovery interface shown after an unexpected render error.
 *
 * @param props - Error-boundary values supplied by the Next.js App Router.
 * @returns An accessible fallback with retry and full-page reload actions.
 */
export default function Error({ reset }: ErrorProps) {
  return (
    <main className={styles.page} aria-labelledby="error-heading">
      <section className={styles.card}>
        <h1 id="error-heading">Something went wrong</h1>

        <p role="alert">
          We couldn&apos;t display this page. Try again or reload the application.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={reset}
          >
            Try again
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </div>
      </section>
    </main>
  );
}
