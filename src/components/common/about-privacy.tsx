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
            Passwords are generated locally on your device using the browser&apos;s
            Web Crypto API.
          </li>
          <li>
            Passwords are not transmitted to an application server or third party.
          </li>
          <li>
            Generated passwords and password history are not saved by the
            application.
          </li>
          <li>
            Configuration preferences may be stored locally in this browser.
            They are not stored in a remote account or cloud service.
          </li>
          <li>
            The application supports offline use after required resources have
            been loaded and cached.
          </li>
          <li>
            Copying to the clipboard occurs only after you explicitly choose Copy.
            The browser and operating system control clipboard contents after
            that action.
          </li>
        </ul>

        <p className={styles.version}>
          Application version: {packageMetadata.version}
        </p>
      </div>
    </details>
  );
}
