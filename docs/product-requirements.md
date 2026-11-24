# Password Generator
## Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Approved  
**Project Type:** Portfolio Demo / Progressive Web Application

---

## 1. Product Overview

Password Generator is a lightweight, privacy-focused Progressive Web Application (PWA) that generates cryptographically secure passwords entirely on the user's device.

The application provides a convenient alternative to advertising-supported third-party password-generation websites.

It is designed to be accessible from desktop and mobile devices, installable, and fully functional offline after initial installation or caching.

The initial release focuses on configurable password generation, with the architecture accommodating additional security utilities in the future.

## 2. Product Goals

1. **Security:** Generate passwords using cryptographically secure randomness.
2. **Privacy:** Never transmit generated passwords or sensitive information over the Internet.
3. **Simplicity:** Provide a clean, distraction-free interface focused on accomplishing the task quickly.
4. **Configurability:** Allow users to customize password length and character composition.
5. **Convenience:** Make generating and copying passwords quick and effortless.
6. **Persistence:** Remember the user's preferred generation settings between sessions.
7. **Accessibility:** Work well on phones, tablets, and desktop computers.
8. **Availability:** Work offline after the application has been installed or initially loaded and cached.

## 3. Target Users

- Individuals who need to create strong passwords for websites and applications.
- Users who prefer not to rely on third-party password-generation websites.
- Users who want a quick, convenient utility without accounts, advertisements, or unnecessary features.

No specialized technical knowledge should be required.

## 4. Product Philosophy

- **Privacy by default:** Generated passwords never leave the device.
- **Minimalism:** Do one thing well rather than becoming a bloated utility.
- **No unnecessary dependencies:** Keep the application lightweight.
- **User control:** Let users configure generation behavior.
- **Transparency:** Clearly communicate how passwords are generated and handled.

## 5. Core User Experience

### 5.1 Primary Workflow

1. Open the application.
2. See a newly generated password using the last-used settings or defaults.
3. Copy the password with a single action.
4. Optionally adjust settings and generate another password.
5. Close the application.

The user should not need to navigate through menus or perform unnecessary steps to accomplish the primary task.

### 5.2 Main Interface

The main interface consists of three primary areas:

- **Generated Password:** A prominent display of the currently generated password with Generate and Copy actions inside its card.
- **Generation Controls:** Options for password length and character composition.
- **Actions:** Generate and Copy buttons.

### 5.3 Application Launch

On first launch:
- Load default generation settings.
- Automatically generate a password.
- Display the generated password immediately.
- Make configuration controls readily available.

On subsequent launches:
- Restore previously saved settings.
- Automatically generate a fresh password.
- Never restore a previously generated password.

### 5.4 Password Generation Interaction

- Clicking Generate replaces the displayed password with a newly generated password.
- Changing configuration settings does not automatically regenerate the displayed password.
- The currently displayed password remains unchanged when settings are modified.
- The user must explicitly select Generate to create a password using updated settings.
- Updated settings are saved immediately.
- Copy always copies the currently displayed password, regardless of subsequent configuration changes.
- Provide visible confirmation when copying succeeds.

### 5.5 Configuration Controls

Users can configure:

- Password length.
- Uppercase letters.
- Lowercase letters.
- Numbers.
- Special characters.
- Exclusion of ambiguous characters.
- Requirement to include at least one character from each selected category.
- Enable extended password lengths to allow up to 128 characters; otherwise the maximum is 40.

## 6. Password Generation Requirements

| Requirement | Default / Constraint |
|---|---|
| Default length | 20 characters |
| Minimum length | 8 characters |
| Standard maximum length | 40 characters |
| Extended maximum length | 128 characters when enabled |
| Uppercase letters | Enabled |
| Lowercase letters | Enabled |
| Numbers | Enabled |
| Symbols | Enabled |
| Ambiguous characters | Included |
| Require each selected category | Enabled |

All four character categories are enabled by default.

When the requirement to include each selected category is enabled, at least one character from every selected category must appear in the generated password.

## 7. Character Handling

### 7.1 Character Sets

Use explicitly defined character sets:

- Uppercase: `ABCDEFGHIJKLMNOPQRSTUVWXYZ`
- Lowercase: `abcdefghijklmnopqrstuvwxyz`
- Numbers: `0123456789`
- Symbols: `!@#$%^&*()-_=+[]{};:,.?/`

### 7.2 Ambiguous Characters

When ambiguous-character exclusion is enabled, exclude:

- Uppercase `I` and `O`
- Lowercase `l`
- Numbers `0` and `1`

### 7.3 Configuration Validation

- At least one character category must remain enabled.
- Password length must be between 8 and 40 characters by default, or 8 and 128 when extended lengths are enabled.
- When category inclusion is required, password length must be sufficient to accommodate at least one character from each selected category.
- Invalid configurations must prevent generation and provide understandable feedback.

## 8. Settings and Persistence

Browser `localStorage` will be used to persist user preferences.

Requirements:

1. Save settings automatically whenever they change.
2. Restore settings when the application launches.
3. Use default settings if no saved configuration exists.
4. Validate saved settings before applying them.
5. Handle corrupted or outdated settings gracefully.
6. Never persist generated passwords or password history.
7. Never transmit settings to external services.
8. Version the stored settings structure to identify the supported preference schema.

Only non-sensitive configuration preferences may be persisted.

## 9. About / Privacy

Include a simple informational section explaining:

- Passwords are generated locally using the browser's cryptographically secure random-number generator.
- Generated passwords are never transmitted to a server.
- Generated passwords are never saved by the application.
- User preferences are stored locally on the device.
- The application works offline after being cached.
- No advertising, analytics, or tracking is used.

## 10. Future Expansion

The following utilities are potential future additions and are explicitly outside the initial MVP scope.

| Utility | Release |
|---|---|
| Password Generator | MVP |
| Passphrase Generator | Future |
| PIN Generator | Future |
| Random String Generator | Future |

The application architecture should accommodate additional utilities without requiring a substantial redesign.

## 11. Non-Functional Requirements

### 11.1 Performance
- Password generation should feel instantaneous.
- The application should remain lightweight and responsive.

### 11.2 Responsive Design
- Support mobile phones, tablets, and desktop computers.
- Provide an interface appropriate to different screen sizes.

### 11.3 Installation
- Support installation as a Progressive Web Application on compatible browsers.

### 11.4 Offline Operation
- All core functionality must work without an Internet connection after initial installation or caching.
- Password generation, copying, and settings management must not depend on remote services.

### 11.5 Accessibility
- Support keyboard navigation.
- Provide appropriate screen-reader support.
- Maintain adequate color contrast.
- Use accessible controls and interaction feedback.

### 11.6 Browser Compatibility
Target current versions of:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari

PWA installation capabilities may vary by browser and operating system.

### 11.7 Maintainability
Keep the following concerns logically separated:
- Password generation.
- Settings management and persistence.
- User interface and presentation.
- PWA and offline functionality.

### 11.8 Security
- Use the Web Crypto API for cryptographically secure random-number generation.
- Avoid modulo bias when converting random values into character selections.
- Never use `Math.random()` for password generation.
- Implement a restrictive Content Security Policy.
- Avoid unnecessary third-party runtime dependencies.
- Do not log, persist, or transmit generated passwords.
- Do not introduce remote dependencies into the password-generation process.

## 12. MVP Scope

The initial release includes:

- Configurable password generation.
- Adjustable password length.
- Optional extended password lengths up to 128 characters; disabled by default.
- Four selectable character categories.
- Ambiguous-character exclusion.
- Optional enforcement of selected character categories.
- Copy-to-clipboard functionality.
- Explicit password regeneration.
- Automatic local settings persistence.
- Automatic password generation on application launch.
- Responsive desktop and mobile interface.
- PWA installation support.
- Offline functionality.
- About / Privacy information.

## 13. Out of Scope

The initial release will not include:

- User accounts or authentication.
- Server-side functionality or databases.
- Password storage or password history.
- Password-manager functionality.
- Password synchronization between devices.
- Cloud storage or backups.
- Analytics or tracking.
- Advertising.
- Subscription or payment functionality.
- Passphrase, PIN, or random-string generation.

## 14. Guiding Principle

**Your passwords are yours. They never leave your device.**

Password Generator should remain a simple, trustworthy utility that prioritizes security, privacy, and convenience over unnecessary functionality.
