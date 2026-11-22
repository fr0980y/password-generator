/**
 * Root App Router not-found page for unmatched URLs and route-level not-found
 * responses. Next.js includes this UI in the static export's 404 documents.
 *
 * The page is a Server Component: it has no client state or browser API needs.
 * Its CSS Module keeps all presentation in an external stylesheet, avoiding
 * inline styles that would conflict with the deployment's `style-src 'self'`
 * policy. The home link uses Next.js routing and targets the password
 * generator's root route.
 *
 * @module app/not-found
 */
import Link from "next/link";
import styles from "./not-found.module.css";

/**
 * Renders an accessible not-found message and a route back to the application.
 *
 * @returns The not-found page content rendered inside the root layout.
 */
export default function NotFound() {
  return (
    <main className={styles.page} aria-labelledby="not-found-heading">
      <section className={styles.card}>
        <h1 id="not-found-heading">
          Page not found
        </h1>

        <p role="status">
          The page you are looking for does not exist or may have moved.
        </p>

        <Link className={styles.homeLink} href="/">
          Return to the password generator
        </Link>
      </section>
    </main>
  );
}
