/**
 * Static privacy disclosure file for the main application screen.
 *
 * It belongs to the common presentation components and relies on native HTML
 * disclosure behavior rather than application state. It reads only the package
 * version and renders the approved privacy text; it does not perform browser,
 * clipboard, storage, or network operations.
 */
import packageMetadata from "../../../package.json";
import styles from "./about-privacy.module.css";

/**
 * Accessible, presentation-only About/Privacy disclosure.
 *
 * This component uses the native `details` and `summary` elements so the
 * disclosure is keyboard-operable and communicates its expanded state without
 * custom state or JavaScript. It contains only static privacy information and
 * the application version.
 *
 * @returns A native expandable About/Privacy disclosure.
 */
export function AboutPrivacy() {
  return (
    <details className={styles.disclosure}>
      <summary className={styles.summary}>
        About / Privacy
      </summary>

      <div className={styles.content}>
        <h2 className={styles.heading}>Privacy information</h2>
        <ul>
          <li>
            Passwords are generated locally in your browser using the browser&apos;s
            Web Crypto API. Password generation does not send passwords to the
            application server or third parties.
          </li>

          <li>
            Generated passwords are not saved in application storage, and the
            application does not keep password history.
          </li>

          <li>
            Configuration preferences may be saved in this browser&apos;s
            localStorage. They do not include generated passwords and are not
            sent to a remote service.
          </li>

          <li>
            The application does not use accounts, analytics, advertising,
            tracking, or behavioral telemetry. Your browser or hosting provider
            may collect information outside the application&apos;s control.
          </li>

          <li>
            Local generation does not protect against malware, malicious browser
            extensions, compromised browsers or operating systems, keyloggers,
            or screen capture. Someone with physical access to an unlocked
            device may be able to see information displayed here.
          </li>

          <li>
            Copying a password is an explicit action. Afterward, the application
            cannot control clipboard history, synchronization, retention, or
            access by other applications.
          </li>

          <li>
            The application can work offline after its required resources have
            been cached; offline availability depends on your browser.
          </li>
        </ul>

        <p className={styles.version}>
          Application version: {packageMetadata.version}
        </p>
      </div>
    </details>
  );
}
