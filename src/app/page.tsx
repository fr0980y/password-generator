"use client";

/**
 * Main Password Generator page and Phase 8 application integration.
 *
 * This module is the Next.js client boundary for the interactive password and
 * configuration presentation. It composes existing presentation components
 * and delegates application state, validation, password generation, settings
 * persistence, and clipboard coordination to `usePasswordGenerator`.
 */
import { ApplicationLayout } from "@/components/layout/application-layout";
import { AboutPrivacy } from "@/components/common/about-privacy";
import { PasswordConfiguration } from "@/components/configuration/password-configuration";
import { CopyButton } from "@/components/password/copy-button";
import { GenerateButton } from "@/components/password/generate-button";
import { PasswordDisplay } from "@/components/password/password-display";
import { usePasswordGenerator } from "@/hooks/use-password-generator";
import styles from "./page.module.css";

/**
 * Renders the main Password Generator page.
 *
 * The page composes the password display, Generate and Copy actions,
 * configuration controls, accessible feedback region, and About/Privacy
 * disclosure. All application behavior is delegated to the coordination hook.
 *
 * @returns The application's composed single-screen layout.
 */
export default function Home() {
  const {
    configuration,
    configurationValidation,
    password,
    isInitialized,
    generationError,
    isCopied,
    copyError,
    settingsWarning,
    onConfigurationChange,
    onRestoreDefaults,
    onGenerate,
    onCopy,
  } = usePasswordGenerator();

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

          <PasswordDisplay password={password} />

          <div className={styles.passwordActions}>
            <CopyButton
              onCopy={onCopy}
              disabled={!isInitialized || password === null}
              copied={isCopied}
            />
          </div>
        </section>

        <section
          className={`${styles.region} ${styles.configurationRegion}`}
          aria-labelledby="configuration-heading"
        >
          <h2 id="configuration-heading" className={styles.regionHeading}>
            Password Configuration
          </h2>

          <PasswordConfiguration
            configuration={configuration}
            onConfigurationChange={onConfigurationChange}
            onRestoreDefaults={onRestoreDefaults}
          />
        </section>

        <div className={styles.generateAction}>
          <GenerateButton
            onGenerate={onGenerate}
            disabled={!isInitialized || !configurationValidation.isValid}
          />
        </div>

        <div
          className={styles.feedbackRegion}
          aria-live="polite"
          aria-label="Application feedback"
        >
          {!configurationValidation.isValid && (
            <p className={`${styles.feedbackMessage} ${styles.feedbackError}`}>
              Configuration error: {configurationValidation.errors.join(" ")}
            </p>
          )}
          {generationError && (
            <p className={`${styles.feedbackMessage} ${styles.feedbackError}`}>
              {generationError}
            </p>
          )}
          {copyError && (
            <p className={`${styles.feedbackMessage} ${styles.feedbackError}`}>
              {copyError}
            </p>
          )}
          {settingsWarning && (
            <p className={`${styles.feedbackMessage} ${styles.feedbackWarning}`}>
              {settingsWarning}
            </p>
          )}
        </div>

        <section
          className={`${styles.region} ${styles.privacyRegion}`}
          aria-label="About and privacy information"
        >
          <AboutPrivacy />
        </section>
      </div>
    </ApplicationLayout>
  );
}
