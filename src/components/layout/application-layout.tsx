import type { ReactNode } from "react";
import packageMetadata from "../../../package.json";
import styles from "./application-layout.module.css";

/**
 * Props accepted by {@link ApplicationLayout}.
 *
 * `children` is the complete main-screen content supplied by the Next.js page.
 * The layout intentionally does not interpret or render that content itself,
 * keeping future password and configuration components independent.
 */
interface ApplicationLayoutProps {
  /** Main-screen content to render between the application header and footer. */
  children: ReactNode;
}

/**
 * Provides the application-wide page structure and keeps presentation concerns
 * separate from password-generation functionality.
 *
 * Future password and configuration components are rendered through `children`
 * inside the layout's primary content region.
 *
 * The application package version is read from `package.json` so the footer
 * presents the built project's current version without duplicating metadata.
 *
 * @param props - Layout content and presentation configuration.
 * @returns The application header, main content region, and footer.
 */
export function ApplicationLayout({ children }: ApplicationLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Password Generator</h1>
          <p>Secure passwords. Generated locally.</p>
        </header>

        <main className={styles.main}>{children}</main>

        <footer className={styles.footer}>
          <p>Generated locally. Preferences stay on this device.</p>
          <p>Version {packageMetadata.version}</p>
        </footer>
      </div>
    </div>
  );
}
