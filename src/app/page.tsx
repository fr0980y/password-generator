import { ApplicationLayout } from "@/components/layout/application-layout";
import styles from "./page.module.css";

/**
 * Renders the main Password Generator page.
 *
 * The page currently reserves the semantic regions required by the UI/UX
 * architecture. Password display, configuration, feedback, and About/Privacy
 * implementations will be inserted into these regions by later phases.
 *
 * @returns The application's single-screen layout and future-content regions.
 */
export default function Home() {
  return (
    <ApplicationLayout>
      <div className={styles.generator}>
        <section
          className={`${styles.region} ${styles.passwordRegion}`}
          aria-labelledby="password-display-heading"
        >
          <h2 id="password-display-heading" className={styles.regionHeading}>
            Your Password
          </h2>
        </section>

        <section
          className={`${styles.region} ${styles.configurationRegion}`}
          aria-labelledby="configuration-heading"
        >
          <h2 id="configuration-heading" className={styles.regionHeading}>
            Password Configuration
          </h2>
        </section>

        <div
          className={styles.feedbackRegion}
          aria-live="polite"
          aria-label="Application feedback"
        />

        <section
          className={`${styles.region} ${styles.privacyRegion}`}
          aria-labelledby="privacy-heading"
        >
          <h2 id="privacy-heading" className={styles.regionHeading}>
            About / Privacy
          </h2>
        </section>
      </div>
    </ApplicationLayout>
  );
}
