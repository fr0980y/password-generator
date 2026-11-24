# Password Generator
## Functional Requirements Document

**Version:** 1.0  
**Status:** Approved Requirements Baseline  
**Project:** Password Generator

---

## 1. Purpose

This document defines the functional behavior of the Password Generator application. It translates the product requirements into specific, testable requirements that will guide implementation and verification.

The application is a lightweight, privacy-focused, offline-capable Progressive Web Application (PWA). It generates cryptographically secure passwords entirely on the user's device.

**Product principle:**

> Your passwords are yours. They never leave your device.

## 2. Application Initialization

### FR-001 — Application Startup
The application shall initialize its required functionality when launched, including configuration loading, capability detection, and interface rendering.

**Acceptance criteria:**
- The application initializes without requiring an account or authentication.
- The interface becomes usable as soon as initialization completes.
- Initialization failures are handled without exposing sensitive information.

### FR-002 — Initial Configuration
The application shall load the default configuration when no previously saved preferences exist.

**Acceptance criteria:**
- Default settings are applied on first launch.
- Default settings are described in the Configuration Management section.

### FR-003 — Restore Saved Configuration
The application shall restore the user's most recently saved preferences when available.

**Acceptance criteria:**
- Saved preferences are loaded before the initial password is generated.
- Stored preferences are validated before being applied.
- Invalid or incompatible preferences are handled gracefully.

### FR-004 — Initial Password Generation
The application shall automatically generate a password after initialization.

**Acceptance criteria:**
- A password is generated using the active configuration.
- A newly generated password is displayed immediately.
- The application does not restore a previously generated password.

### FR-005 — Fresh Password on Subsequent Launches
The application shall generate a fresh password each time it is launched.

**Acceptance criteria:**
- The previously displayed password is never persisted by the application.
- Each launch generates a new password using the restored preferences.

### FR-006 — Browser Capability Detection
The application shall detect whether the required browser cryptographic functionality is available.

**Acceptance criteria:**
- The application checks for the availability of the Web Crypto API.
- If secure random generation is unavailable, password generation is disabled.
- The user receives a clear explanation of the limitation.
- The application does not fall back to a weaker random number generator.

### FR-007 — Initialization Failure Handling
The application shall handle unexpected initialization failures gracefully.

**Acceptance criteria:**
- A clear, understandable error is displayed when initialization cannot complete.
- The application does not expose passwords or other sensitive information in error messages.
- Functionality that does not depend on the failed capability remains available where practical.

---

## 3. Password Generation

### FR-010 — Generate Password
The application shall generate a password using the user's active configuration when the user selects Generate.

**Acceptance criteria:**
- The generated password follows the current configuration.
- The newly generated password replaces the previously displayed password only after successful generation.
- Generation occurs entirely on the user's device.

### FR-011 — Password Length
The application shall support configurable password lengths.

**Acceptance criteria:**
- Default length is 20 characters.
- Minimum length is 8 characters.
- Maximum length is 40 characters when extended lengths are disabled.
- Maximum length is 128 characters when extended lengths are enabled.
- The generated password contains exactly the configured number of characters.

### FR-012 — Character Categories
The application shall support four independently configurable character categories.

| Category | Character Set |
|---|---|
| Uppercase | `ABCDEFGHIJKLMNOPQRSTUVWXYZ` |
| Lowercase | `abcdefghijklmnopqrstuvwxyz` |
| Numbers | `0123456789` |
| Symbols | `!@#$%^&*()-_=+[]{};:,.?/` |

**Acceptance criteria:**
- All four categories are enabled by default.
- Users can independently enable or disable each category.
- Only enabled categories contribute characters to the generated password.
- At least one category must remain enabled.

### FR-013 — Exclude Ambiguous Characters
The application shall allow users to exclude commonly confused characters.

**Acceptance criteria:**
- Ambiguous characters are included by default.
- When exclusion is enabled, the following characters are removed from their respective sets:
  - Uppercase: `I`, `O`
  - Lowercase: `l`
  - Numbers: `0`, `1`
- Exclusion applies only to the applicable character categories.

### FR-014 — Require Each Selected Category
The application shall support requiring at least one character from every enabled category.

**Acceptance criteria:**
- This option is enabled by default.
- When enabled, the generated password contains at least one character from every selected category.
- When disabled, characters are selected from the combined enabled character pool without a category-presence guarantee.

### FR-015 — Cryptographically Secure Randomness
The application shall use the browser's Web Crypto API for all password-generation randomness.

**Acceptance criteria:**
- `crypto.getRandomValues()` is used to obtain cryptographically secure random values.
- `Math.random()` is never used for password generation.
- Random character selection avoids modulo bias through rejection sampling.

### FR-016 — Unbiased Character Distribution
The application shall avoid introducing predictable patterns or distribution bias during password construction.

**Acceptance criteria:**
- Character selection uses unbiased random selection.
- Required category characters are not left in predictable positions.
- The final password is shuffled using cryptographically secure randomness.
- Shuffling avoids modulo bias.

### FR-017 — Password Generation Algorithm
The application shall follow a consistent generation process.

**Acceptance criteria:**
1. Assemble the enabled character sets, applying ambiguous-character exclusions.
2. Validate the active configuration.
3. If category enforcement is enabled, select one random character from each enabled category.
4. Fill the remaining positions using the combined enabled character pool.
5. Cryptographically shuffle the resulting characters.
6. Display the completed password.

### FR-018 — Generation Failure
The application shall preserve the previously displayed password if generation fails.

**Acceptance criteria:**
- An incomplete or partially generated password is never displayed.
- The previously displayed password remains unchanged.
- A clear error message is displayed.
- The user can retry generation.
- Passwords are not written to console logs or error messages.

---

## 4. Configuration Management

### FR-020 — Password Length Control
The application shall provide a control for adjusting password length.

**Acceptance criteria:**
- The control supports values from 8 through 40 by default and 8 through 128 when extended lengths are enabled.
- The default value is 20.
- The slider maximum and helper text reflect the active maximum.
- Values outside the permitted range cannot be applied.

### FR-021 — Character Category Controls
The application shall provide independent controls for each character category.

**Acceptance criteria:**
- Uppercase, lowercase, numbers, and symbols can be enabled or disabled independently.
- All categories are enabled by default.
- Changes are reflected immediately in the active configuration.

### FR-022 — Ambiguous Character Control
The application shall provide a control for including or excluding ambiguous characters.

**Acceptance criteria:**
- Ambiguous characters are included by default.
- Changing the control immediately updates the active configuration.

### FR-023 — Category Enforcement Control
The application shall provide a control for requiring at least one character from each selected category.

**Acceptance criteria:**
- The option is enabled by default.
- Changing the control immediately updates the active configuration.

### FR-024 — Configuration Changes Do Not Regenerate
Changing configuration settings shall not automatically generate a new password.

**Acceptance criteria:**
- The currently displayed password remains unchanged after a configuration change.
- A new password is generated only when the user explicitly selects Generate.

### FR-025 — Immediate Configuration Persistence
Configuration changes shall be saved immediately when the user changes a setting.

**Acceptance criteria:**
- Each valid setting change triggers a save attempt.
- Users do not need to select a separate Save action.
- Persistence behavior follows the Settings Persistence requirements.

### FR-026 — Minimum Category Selection
The application shall require at least one character category to be enabled.

**Acceptance criteria:**
- If all categories are disabled, the configuration is marked invalid.
- The application does not automatically re-enable a category.
- Generate is disabled while no categories are selected.
- The user sees the message: "Select at least one character category."

### FR-027 — Category Enforcement Length Validation
The application shall validate password length against the number of selected categories when category enforcement is enabled.

**Acceptance criteria:**
- The configured length must be greater than or equal to the number of enabled categories.
- Invalid configurations cannot be used to generate a password.
- The user receives a concise explanation of the validation failure.

### FR-028 — Immediate Configuration Validation
The application shall validate configuration changes as they occur.

**Acceptance criteria:**
- Invalid settings are identified without requiring the user to select Generate.
- Generate is disabled while the configuration is invalid.
- The user receives a concise explanation of the problem.
- Correcting the configuration restores the ability to generate passwords.

### FR-029 — Restore Defaults
The application shall provide a Restore Defaults action.

**Acceptance criteria:**
- All configuration settings return to their defined default values.
- Extended password lengths are disabled and the password length is restored to 20.
- Restored defaults are saved immediately.
- The currently displayed password remains unchanged.
- The user must explicitly select Generate to create a password using the restored settings.

### FR-030 — Configuration Independence
Configuration settings shall remain independent of the currently displayed password.

**Acceptance criteria:**
- Changing configuration does not modify the displayed password.
- Copy always acts on the currently displayed password, regardless of whether the configuration has changed since it was generated.

### FR-031 — Extended Password Lengths
The application shall optionally allow password lengths above 40 characters.

**Acceptance criteria:**
- The "Enable extended password lengths" option is unchecked by default.
- Its helper text explains that it allows lengths above 40, up to 128 characters.
- The minimum remains 8 characters in either mode.
- Enabling extended lengths raises the slider maximum to 128 without changing the selected length.
- Disabling extended lengths lowers the slider maximum to 40 and clamps any selected length above 40 to 40.
- Restoring defaults disables extended lengths and restores the length to 20.
- The setting is persisted with the other password preferences.

---

## 5. Clipboard Management

### FR-040 — Copy Password
The application shall allow the user to copy the currently displayed password.

**Acceptance criteria:**
- Selecting Copy copies the exact currently displayed password.
- The Clipboard API is used when available.
- Clipboard access is requested only following an explicit user action.

### FR-041 — Copy Confirmation
The application shall provide visible confirmation when a copy operation succeeds.

**Acceptance criteria:**
- The Copy button temporarily changes its label to "Copied!".
- The button returns to its normal label after a short period.
- The confirmation does not interrupt the user's workflow.

### FR-042 — Clipboard Failure
The application shall handle clipboard access failures.

**Acceptance criteria:**
- An understandable error message is displayed.
- The password remains visible and selectable.
- The user can manually select and copy the password.

### FR-043 — Disable Copy Without Password
The Copy action shall be unavailable when no password is displayed.

**Acceptance criteria:**
- Copy is disabled when no password exists.
- Copy becomes available when a password is successfully generated.

### FR-044 — Preserve Displayed Password
Copying a password shall not modify the displayed password.

**Acceptance criteria:**
- The displayed password remains unchanged after copying.
- Copy does not trigger password generation.

### FR-045 — Clipboard Content
The application shall copy only the currently displayed password.

**Acceptance criteria:**
- No additional text, labels, or formatting are included.
- The copied value matches the displayed password exactly.

### FR-046 — Clipboard Privacy Disclosure
The application shall explain the distinction between its own storage behavior and the operating system clipboard.

**Acceptance criteria:**
- The About / Privacy information explains that copying places the password on the OS-managed clipboard.
- The application does not claim to control clipboard contents or how long other applications can access them.

---

## 6. Settings Persistence

### FR-050 — Local Preference Storage
The application shall use browser localStorage to persist user preferences.

**Acceptance criteria:**
- Only configuration preferences are stored.
- The `enableExtendedPasswordLengths` preference is stored with the configuration.
- No backend or remote storage is used.
- Preferences remain available across application launches when browser storage is available.

### FR-051 — Immediate Saving
The application shall attempt to save preferences whenever the user changes a setting.

**Acceptance criteria:**
- Valid preference changes are saved immediately.
- No separate Save action is required.

### FR-052 — Restore Preferences
The application shall restore saved preferences during initialization.

**Acceptance criteria:**
- Saved preferences are loaded before initial password generation.
- Defaults are used when no saved preferences exist.

### FR-053 — Settings Schema Versioning
The application shall version its stored settings structure.

**Acceptance criteria:**
- Stored preferences include a schema version.
- The application can identify incompatible or unsupported stored settings.
- Unsupported previous schemas fall back to current defaults; no compatibility migration is required for this unreleased project.

### FR-054 — Stored Settings Validation
The application shall validate stored preferences before applying them.

**Acceptance criteria:**
- Invalid values are not blindly applied.
- Missing, malformed, or incompatible settings are handled gracefully.
- Defaults are restored when stored settings cannot be safely used.

### FR-055 — No Password Persistence
The application shall never persist generated passwords.

**Acceptance criteria:**
- Generated passwords are not written to localStorage.
- No password history is maintained.
- Clipboard contents are not stored by the application.

### FR-056 — No External Transmission
The application shall not transmit preferences or generated passwords to external services.

**Acceptance criteria:**
- No backend or remote API is used for password generation or preference storage.
- Passwords and preferences remain on the user's device.

### FR-057 — Storage Unavailable
The application shall continue functioning when localStorage is unavailable or cannot be accessed.

**Acceptance criteria:**
- The application continues using in-memory configuration.
- Password generation remains available.
- The user receives the following warning:

  "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application."

### FR-058 — Persistent Storage Warning
The application shall display a persistent, unobtrusive warning when preference persistence is unavailable.

**Acceptance criteria:**
- The warning is displayed once rather than repeatedly for individual changes.
- The warning remains visible while persistence is unavailable.
- The warning does not prevent password generation or other core functionality.

### FR-059 — Storage Recovery
The application shall handle storage errors without compromising password generation.

**Acceptance criteria:**
- A failed save does not interrupt the current session.
- Active in-memory settings remain usable.
- The application does not attempt to store passwords as an alternative.

---

## 7. About / Privacy

### FR-060 — About / Privacy Information
The application shall provide an About / Privacy section accessible from the main interface.

**Acceptance criteria:**
- The information is accessible without navigating away from the main application.
- A lightweight dialog or section may be used.
- Ordinary application actions do not require modal dialogs.

### FR-061 — Local Password Generation Disclosure
The application shall explain that password generation occurs entirely on the user's device.

**Acceptance criteria:**
- The information clearly states that passwords are not sent to an external service.
- The information explains that the application does not require an account or backend.

### FR-062 — Cryptographic Security Disclosure
The application shall explain its use of the browser's Web Crypto API.

**Acceptance criteria:**
- The information identifies cryptographically secure randomness as the basis for password generation.
- The application does not make unsupported claims about absolute security.

### FR-063 — Password Non-Persistence Disclosure
The application shall explain that generated passwords are not stored by the application.

**Acceptance criteria:**
- The information distinguishes generated passwords from locally stored preferences.
- It explains that the application does not maintain password history.

### FR-064 — Local Preferences Disclosure
The application shall explain how user preferences are stored.

**Acceptance criteria:**
- The information states that preferences are stored locally in the browser.
- It explains that preferences are not transmitted externally.

### FR-065 — Offline Functionality Disclosure
The application shall explain that core functionality is available offline after the application has been initially loaded and cached.

**Acceptance criteria:**
- The information describes offline availability accurately.
- It does not imply that the application can be installed or initially loaded without an Internet connection.

### FR-066 — No Tracking or Advertising Disclosure
The application shall disclose its privacy-focused operation.

**Acceptance criteria:**
- The application does not include advertising, analytics, or tracking.
- The About / Privacy information communicates this clearly.

### FR-067 — Application Version
The About / Privacy section shall display application version information.

**Acceptance criteria:**
- The currently running application version is displayed.
- Version information is maintained as part of the application release process.

---

## 8. Error Handling and Edge Cases

### FR-070 — No Character Categories Selected
The application shall prevent generation when all character categories are disabled.

**Acceptance criteria:**
- The configuration remains unchanged.
- Generate is disabled.
- The user sees: "Select at least one character category."

### FR-071 — Invalid Password Length
The application shall prevent invalid password lengths.

**Acceptance criteria:**
- Length cannot be lower than 8 or higher than the active maximum (40 by default, 128 when extended lengths are enabled).
- Invalid values are rejected or prevented by the input control.
- The active configuration remains valid.

### FR-072 — Insufficient Length for Category Enforcement
The application shall prevent generation when the configured length cannot accommodate every selected category.

**Acceptance criteria:**
- The application identifies the invalid configuration before generation.
- Generate is disabled.
- The user receives a concise explanation.

### FR-073 — Web Crypto Unavailable
The application shall disable password generation when the required cryptographic API is unavailable.

**Acceptance criteria:**
- No weaker random number generator is substituted.
- The user receives a clear explanation.
- Non-generation information remains accessible where practical.

### FR-074 — Generation Failure
The application shall preserve the last successfully generated password when a new generation attempt fails.

**Acceptance criteria:**
- The previous password remains displayed.
- No partial password is displayed.
- An understandable error is shown.
- The user can retry.

### FR-075 — Clipboard Unavailable or Denied
The application shall provide a manual-copy alternative when clipboard access is unavailable or denied.

**Acceptance criteria:**
- The user receives a clear message.
- The password remains visible and selectable.
- No attempt is made to copy without explicit user action.

### FR-076 — Local Storage Unavailable
The application shall continue in an in-memory configuration mode when localStorage cannot be used.

**Acceptance criteria:**
- Password generation remains functional.
- Current preferences remain active during the session.
- The persistent storage warning is displayed.

### FR-077 — Corrupted or Incompatible Settings
The application shall recover gracefully when stored preferences are corrupted or incompatible.

**Acceptance criteria:**
- Unsafe or invalid preferences are not applied.
- Defaults are restored.
- The application continues initialization.
- No sensitive information is exposed.

### FR-078 — Offline Operation
The application shall support its core functionality without an active Internet connection after required application resources have been cached.

**Acceptance criteria:**
- Password generation works offline.
- Configuration changes work offline.
- Copy functionality works offline when supported by the browser.
- No remote service is required for core functionality.

### FR-079 — Unexpected Errors and Sensitive Information
The application shall handle unexpected errors without exposing generated passwords or sensitive information.

**Acceptance criteria:**
- Passwords are never included in error messages.
- Passwords are never written to console logs.
- Unexpected failures do not cause the application to display incomplete or invalid passwords.
- Recoverable errors do not unnecessarily disable unrelated functionality.

---

## 9. Interface Behavior and Accessibility

### FR-080 — Responsive Interface
The application shall provide a usable interface on mobile phones, tablets, and desktop devices.

**Acceptance criteria:**
- The layout adapts to available screen dimensions.
- Primary controls remain accessible on smaller screens.
- No essential functionality requires a desktop-sized display.

### FR-081 — Main Interface
The main screen shall provide direct access to password generation and configuration.

**Acceptance criteria:**
- The currently generated password is prominently displayed.
- Generate and Copy actions are readily accessible.
- Generate and Copy are colocated directly below the password field inside the password card.
- All primary configuration controls are visible without navigating to a separate settings screen.

### FR-082 — Password Presentation
The application shall display the generated password as plain text.

**Acceptance criteria:**
- The password uses a monospaced font.
- The complete password is visible and selectable.
- No show/hide toggle is provided.

### FR-083 — Password Selection
The application shall allow normal text selection of the displayed password.

**Acceptance criteria:**
- Users can select all or part of the password.
- Selection supports manual copying when the Clipboard API is unavailable.

### FR-084 — Clear Configuration Labels
The application shall provide clear labels for all configuration controls.

**Acceptance criteria:**
- Each control has an understandable label.
- The purpose of ambiguous-character exclusion and category enforcement is clear.
- Controls communicate their current state.

### FR-085 — Validation Feedback
The application shall visually distinguish valid and invalid configurations.

**Acceptance criteria:**
- Invalid settings are clearly identified.
- Validation messages explain how to correct the problem.
- Generate is disabled when the configuration is invalid.

### FR-086 — Accessible Feedback
The application shall provide accessible feedback for important actions and errors.

**Acceptance criteria:**
- Copy success and failure messages are perceivable.
- Validation and error messages are available to assistive technology.
- Feedback does not unnecessarily interrupt the user's workflow.

### FR-087 — Keyboard Accessibility
The application shall support keyboard navigation and operation.

**Acceptance criteria:**
- All interactive controls are keyboard accessible.
- Focus order is logical.
- Focus indicators are visible.
- No core operation requires a mouse or touch input.

### FR-088 — Screen Reader Support
The application shall provide appropriate semantic structure and accessible control descriptions.

**Acceptance criteria:**
- Controls have accessible names.
- Password and status information can be understood by screen readers.
- Important dynamic feedback is announced appropriately.

### FR-089 — Visual Accessibility
The application shall provide sufficient visual contrast and readable interface elements.

**Acceptance criteria:**
- Text and controls have adequate contrast.
- Labels and status messages do not rely on color alone.
- Text remains readable at common mobile and desktop sizes.

### FR-090 — Non-Intrusive Interaction
The application shall avoid unnecessary interruptions during ordinary use.

**Acceptance criteria:**
- Ordinary actions do not require modal dialogs.
- Copy confirmation is brief.
- Validation feedback is presented inline or in an unobtrusive manner.
- Restoring defaults does not require unnecessary confirmation.

---

## 10. PWA and Offline Functionality

### FR-100 — Progressive Web Application
The application shall be implemented as an installable Progressive Web Application.

**Acceptance criteria:**
- The application includes the necessary PWA manifest and metadata.
- Supported browsers can offer installation.
- The application has an appropriate application name and icon.
- Installation behavior follows the capabilities of the browser and platform.

### FR-101 — Application Resource Caching
The application shall cache the resources required for core functionality.

**Acceptance criteria:**
- Required application assets are cached for offline use.
- Runtime functionality does not depend on externally hosted scripts, stylesheets, fonts, or icons.
- The application does not require a remote password-generation service.

### FR-102 — Offline Application Launch
The application shall be launchable without an Internet connection after its required resources have been cached.

**Acceptance criteria:**
- The application shell loads offline.
- The main interface is available.
- Core password-generation functionality remains usable.

### FR-103 — Offline Password Generation
The application shall generate passwords while offline.

**Acceptance criteria:**
- Web Crypto API functionality is available in the supported browser context.
- No network connection is required to generate passwords.
- No password or generation request is transmitted externally.

### FR-104 — Offline Configuration
The application shall support configuration changes while offline.

**Acceptance criteria:**
- All configuration controls remain usable.
- Preferences can be saved locally when browser storage is available.
- Configuration behavior is consistent with the Settings Persistence requirements.

### FR-105 — Offline Clipboard
The application shall support copying passwords while offline when the browser supports the required clipboard functionality.

**Acceptance criteria:**
- Clipboard access does not require a remote service.
- If clipboard access is unavailable, manual selection and copying remain possible.

### FR-106 — Browser and Platform Compatibility
The application shall target current versions of Chrome, Edge, Firefox, and Safari.

**Acceptance criteria:**
- Core functionality is tested in the targeted browsers.
- Differences in PWA installation and offline support are handled according to platform capabilities.
- Unsupported capabilities are communicated clearly rather than silently replaced with insecure alternatives.

### FR-107 — Application Updates
The application shall support updates to cached application resources.

**Acceptance criteria:**
- Updated application resources are made available through the PWA update mechanism.
- An update shall not interrupt an active user session.
- The current session may continue using the existing application version.
- An available update becomes active the next time the application is launched or refreshed.
- The application does not unexpectedly replace its active resources while the user is working.

### FR-108 — Offline and Update Failure Handling
The application shall handle unavailable network connections and update failures gracefully.

**Acceptance criteria:**
- An update failure does not prevent continued use of the currently cached application.
- Offline functionality remains available when required resources are already cached.
- The application does not require a successful update check to generate passwords.

---

## 11. Cross-Cutting Security Requirements

The following requirements apply throughout the application and complement the individual functional requirements.

1. **Client-side generation:** Password generation must occur entirely within the browser.
2. **Cryptographic randomness:** All random values used for password generation and shuffling must originate from the Web Crypto API.
3. **No insecure fallback:** The application must never substitute `Math.random()` or another non-cryptographic generator.
4. **No password transmission:** Generated passwords must never be transmitted over the network.
5. **No password persistence:** Generated passwords must never be stored by the application.
6. **No password logging:** Passwords must never appear in console output, application logs, or error messages.
7. **Minimal dependencies:** Third-party runtime dependencies should be avoided unless they provide clear value.
8. **Local resources:** Runtime assets, including fonts, icons, scripts, and styles, should be bundled locally rather than loaded from CDNs.
9. **Content Security Policy:** The application should implement a restrictive Content Security Policy appropriate to its architecture.
10. **No tracking:** The application must not include analytics, advertising, or tracking functionality.

---

## 12. Out of Scope

The following capabilities are explicitly excluded from the initial release:

- User accounts or authentication.
- Backend services or databases.
- Cloud synchronization or remote preference storage.
- Password storage or password-manager functionality.
- Password history.
- Password sharing.
- Analytics or tracking.
- Advertising.
- Payment functionality.
- Remote password-generation APIs.
- Passphrase generation.
- PIN generation.
- General-purpose random string generation.

These may be considered for future versions, but they are not part of the MVP.

---

## 13. MVP Completion Criteria

The initial release is considered functionally complete when:

- The application generates passwords using cryptographically secure randomness.
- Users can configure password length and character composition.
- Configuration validation prevents invalid generation requests.
- Generated passwords can be copied or manually selected.
- Preferences persist locally when browser storage is available.
- Generated passwords are never persisted or transmitted by the application.
- The application works offline after required resources have been cached.
- The application provides clear error handling and accessible feedback.
- The application is usable on supported mobile and desktop browsers.
- The About / Privacy section accurately explains the application's security and privacy behavior.
