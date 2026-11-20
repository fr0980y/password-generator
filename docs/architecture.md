# Password Generator
## Architecture Document

**Version:** 1.0  
**Status:** Approved Architecture Baseline  
**Project:** Password Generator

---

## 1. Overview

The Password Generator application will use a lightweight, modular, client-side architecture built with Next.js, React, and TypeScript.

The application will be deployed as a statically exported Progressive Web Application (PWA) through Cloudflare Pages.

All password generation, configuration management, and sensitive operations will execute locally in the user's browser. The application will not require a backend, database, authentication system, or remote password-generation service.

The architecture emphasizes:

- Security and privacy by default.
- Clear separation of responsibilities.
- Minimal runtime dependencies.
- Testable, independently maintainable modules.
- Offline availability.
- Simplicity without unnecessary abstraction.
- Flexibility for potential future security utilities.

**Core architectural principle:**

> Generated passwords remain entirely on the user's device. The application never transmits or persists them.

## 2. Technology Stack

| Area | Technology | Responsibility |
|---|---|---|
| Application framework | Next.js | Application structure and static build |
| UI library | React | Component-based interface |
| Language | TypeScript | Type safety and maintainability |
| Rendering | Next.js Static Export | Generate static application assets |
| Hosting | Cloudflare Pages | Static application hosting |
| Cryptography | Browser Web Crypto API | Secure random number generation |
| Clipboard | Browser Clipboard API | Copy generated passwords |
| Settings persistence | localStorage | Store user preferences |
| PWA integration | Serwist (`@serwist/next`) | Service-worker generation and integration |
| Styling | CSS Modules and standard CSS | Component and application styling |
| Unit testing | Vitest | Unit and integration tests |
| Component testing | React Testing Library | React component behavior |
| End-to-end testing | Playwright | Browser-level testing |

No backend framework, database, or external state-management library is required.

## 3. Architectural Principles

### 3.1 Separation of Concerns

Each module should have a clearly defined responsibility.

- React components handle presentation and user interaction.
- Application hooks coordinate application state and workflows.
- Feature modules implement application functionality.
- Services encapsulate browser API integrations.
- Constants and types define shared application contracts.

Components should not directly implement cryptographic algorithms or persistence mechanisms.

### 3.2 Client-Side Execution

All sensitive functionality executes in the browser.

- Password generation uses the Web Crypto API.
- Preferences are stored using localStorage.
- Clipboard operations use the browser Clipboard API.
- No generated password is transmitted to a server.

### 3.3 Minimal Dependencies

Third-party dependencies should be introduced only when they provide meaningful value.

The application will avoid unnecessary frameworks, libraries, and abstractions.

### 3.4 Independent Testability

Core functionality should be testable independently of the React interface.

In particular, password generation, configuration validation, and preference persistence should have independently testable interfaces.

### 3.5 Future Extensibility

The architecture should allow additional security utilities to be introduced as separate features without requiring substantial changes to existing functionality.

Potential future features include passphrase generation, PIN generation, and random string generation.

These are not part of the initial implementation.

## 4. Application Architecture

The application will use a layered architecture.

### 4.1 Presentation Layer

**Technology:** React

Responsible for:

- Rendering the application interface.
- Displaying the generated password.
- Presenting configuration controls.
- Handling user interactions.
- Displaying validation and error feedback.
- Presenting About / Privacy information.

The presentation layer communicates with application logic through the primary application hook.

### 4.2 Application Logic Layer

**Technology:** TypeScript and React hooks

Responsible for coordinating:

- Application initialization.
- Configuration loading.
- Configuration changes.
- Configuration validation.
- Password generation requests.
- Clipboard operations.
- Persistence operations.
- Application feedback and error state.

The application logic layer connects the presentation layer with the underlying feature modules and services.

### 4.3 Feature Layer

**Technology:** TypeScript

Contains the actual application functionality.

The initial implementation includes the Password Generator feature.

Responsibilities include:

- Password generation.
- Character-set construction.
- Cryptographic random selection.
- Password shuffling.
- Configuration validation.
- Generation-related constants and types.

The generation algorithm must remain independent of React and UI components.

### 4.4 Browser Services Layer

Encapsulates browser-specific functionality.

Services include:

- Settings persistence through localStorage.
- Clipboard access through the Clipboard API.

These services provide small, clearly defined interfaces to the application logic layer.

### 4.5 PWA Layer

**Technology:** Serwist

Responsible for:

- Service-worker integration.
- Application resource caching.
- Offline application loading.
- Application update handling.

The PWA layer must support offline operation without introducing remote runtime dependencies.

## 5. Project Directory Structure

The following directory structure will serve as the initial organizational baseline.

```text
password-generator/
│
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   │
│   ├── manifest.json
│   └── ...
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── ...
│   │
│   ├── components/
│   │   ├── password/
│   │   ├── configuration/
│   │   ├── common/
│   │   └── layout/
│   │
│   ├── features/
│   │   └── password-generator/
│   │       ├── password-generator.ts
│   │       ├── password-generator.types.ts
│   │       ├── password-generator.validation.ts
│   │       └── password-generator.constants.ts
│   │
│   ├── services/
│   │   ├── settings-storage.ts
│   │   └── clipboard.ts
│   │
│   ├── hooks/
│   │   └── use-password-generator.ts
│   │
│   └── types/
│
├── docs/
│
├── next.config.ts
├── package.json
├── tsconfig.json
└── ...
```

This structure is intentionally modest. Additional directories or files may be introduced as implementation needs become clearer.

### 5.1 Application Directory

`src/app/`

Contains Next.js application entry points.

- `layout.tsx`: Root application layout and metadata.
- `page.tsx`: Main application page.
- `globals.css`: Application-wide styles and design tokens.

### 5.2 Components Directory

`src/components/`

Contains reusable presentation components.

**password/**

- PasswordGenerator
- PasswordDisplay
- GenerateButton
- CopyButton

**configuration/**

- PasswordConfiguration
- PasswordLengthControl
- CharacterCategoryControls
- AmbiguousCharacterToggle
- CategoryEnforcementToggle
- ConfigurationValidation

**common/**

- ApplicationFeedback
- AboutPrivacy
- Other reusable interface elements as needed.

**layout/**

- ApplicationLayout
- Other structural layout components as needed.

Components should remain focused on presentation and user interaction rather than implementing application or browser-service logic.

### 5.3 Features Directory

`src/features/password-generator/`

Contains the password-generation implementation.

**password-generator.ts**

Primary generation interface.

Responsibilities:

- Build enabled character sets.
- Generate required category characters.
- Fill remaining password positions.
- Cryptographically shuffle the resulting characters.
- Return a complete password or report an error.

**password-generator.types.ts**

Defines feature-specific types, including the password configuration interface.

**password-generator.validation.ts**

Contains shared configuration validation logic.

**password-generator.constants.ts**

Contains:

- Default configuration.
- Minimum and maximum password lengths.
- Character sets.
- Ambiguous-character definitions.
- Other generation-related constants.

### 5.4 Services Directory

`src/services/`

Encapsulates browser API integrations.

**settings-storage.ts**

Responsible for:

- Loading saved preferences.
- Saving preferences.
- Resetting preferences.
- Validating stored data.
- Handling storage failures.
- Supporting versioned settings data.

**clipboard.ts**

Responsible for:

- Copying text through the Clipboard API.
- Reporting clipboard failures.
- Providing a consistent interface to the application logic.

The clipboard service must not log or persist the supplied password.

### 5.5 Hooks Directory

`src/hooks/`

Contains application-level React hooks.

**use-password-generator.ts**

The primary application coordination hook.

Responsibilities:

- Initialize application state.
- Restore saved configuration.
- Maintain the current configuration.
- Maintain the currently displayed password.
- Validate configuration changes.
- Request password generation.
- Coordinate clipboard operations.
- Manage application feedback and error state.
- Coordinate preference persistence.

No external state-management library is required.

### 5.6 Types Directory

`src/types/`

Reserved for genuinely shared types that do not belong to a specific feature or service.

Feature-specific types should remain within their respective feature directories.

The directory should not become a general dumping ground for types.

## 6. Component Architecture

The application will use a relatively shallow React component hierarchy.

```text
App (page.tsx)
│
├── ApplicationLayout
│
└── PasswordGenerator
    │
    ├── PasswordDisplay
    │   └── CopyButton
    │
    ├── PasswordConfiguration
    │   ├── PasswordLengthControl
    │   ├── CharacterCategoryControls
    │   ├── AmbiguousCharacterToggle
    │   └── CategoryEnforcementToggle
    │
    ├── GenerateButton
    │
    ├── ConfigurationValidation
    │
    ├── ApplicationFeedback
    │
    └── AboutPrivacy
```

### 6.1 Component Responsibilities

| Component | Responsibility |
|---|---|
| ApplicationLayout | Provides the overall application structure |
| PasswordGenerator | Coordinates the primary application interface |
| PasswordDisplay | Displays the currently generated password |
| CopyButton | Initiates copying and displays copy feedback |
| PasswordConfiguration | Groups the configuration controls |
| Configuration controls | Allow users to modify individual settings |
| GenerateButton | Initiates password generation |
| ConfigurationValidation | Displays configuration validation feedback |
| ApplicationFeedback | Displays operational errors and status messages |
| AboutPrivacy | Displays privacy and application information |

### 6.2 State Management

Application state will be coordinated through `use-password-generator.ts`.

React's built-in state management is sufficient for the initial application.

No Redux, Zustand, or other external state-management library is required.

Components receive the values and callbacks they need through props.

The application should avoid duplicating state or independently maintaining conflicting representations of configuration.

## 7. Password Generation Architecture

### 7.1 Module Independence

The password-generation module must remain independent of:

- React.
- Next.js.
- Browser storage.
- Clipboard functionality.
- Presentation components.
- Application-level state management.

It accepts a configuration and returns a generated password.

### 7.2 Public Interface

The module will expose a simple generation interface.

```typescript
generatePassword(
  config: PasswordConfiguration
): string
```

The function is synchronous because `crypto.getRandomValues()` is synchronous.

It either returns a complete password or throws an appropriate error.

### 7.3 Generation Process

The generation algorithm follows these steps:

1. Validate the supplied configuration.
2. Assemble enabled character sets.
3. Apply ambiguous-character exclusions.
4. Select one character from each enabled category when category enforcement is enabled.
5. Fill remaining positions using the combined enabled character pool.
6. Cryptographically shuffle all selected characters.
7. Return the completed password.

### 7.4 Cryptographic Randomness

All randomness used for password generation and shuffling must originate from:

```typescript
crypto.getRandomValues()
```

Random integer selection must avoid modulo bias through rejection sampling.

The implementation must never use `Math.random()` for password generation or shuffling.

### 7.5 Failure Handling

The generation module must not return incomplete passwords.

If generation fails:

- The function reports an error.
- The application retains the previously displayed password.
- No partial result is exposed.
- No password is included in diagnostic output.

### 7.6 Testing

The generator must be independently testable.

Tests should cover:

- Password length.
- Enabled character categories.
- Disabled character categories.
- Ambiguous-character exclusion.
- Category enforcement.
- Invalid configurations.
- Cryptographic API availability.
- Random selection and shuffling edge cases.
- Generation failure handling.

Statistical tests may help identify implementation defects but do not establish cryptographic security.

## 8. Configuration Architecture

### 8.1 Configuration Model

Configuration will be represented by a single strongly typed object.

```typescript
interface PasswordConfiguration {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  requireEachCategory: boolean;
}
```

This object represents the active generation preferences.

### 8.2 Default Configuration

The default configuration is:

```typescript
const DEFAULT_CONFIGURATION = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachCategory: true
};
```

### 8.3 Validation

Configuration validation is centralized in `password-generator.validation.ts`.

The validation module returns a structured result.

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

The UI uses this result for immediate feedback.

The generation module independently validates its input before generating a password.

This provides a consistent validation mechanism and protects the generation module from invalid inputs regardless of where they originate.

### 8.4 Configuration Changes

Configuration changes immediately update application state and trigger a persistence attempt.

Changing configuration does not automatically generate a new password.

The currently displayed password remains unchanged until the user explicitly requests generation.

## 9. Settings Persistence Architecture

### 9.1 Storage Mechanism

Browser localStorage will be used to persist configuration preferences.

No database or external persistence service is required.

### 9.2 Storage Service

`settings-storage.ts` encapsulates all localStorage operations.

Proposed interface:

```typescript
loadSettings(): PasswordConfiguration

saveSettings(
  config: PasswordConfiguration
): void

resetSettings(): void
```

The storage service is responsible for serialization, deserialization, validation, and storage error handling.

### 9.3 Versioned Storage Structure

Preferences will be stored in a versioned wrapper.

Example:

```json
{
  "version": 1,
  "settings": {
    "length": 20,
    "uppercase": true,
    "lowercase": true,
    "numbers": true,
    "symbols": true,
    "excludeAmbiguous": false,
    "requireEachCategory": true
  }
}
```

Future configuration changes can be handled through schema versioning and migration logic.

### 9.4 Storage Failure Handling

If localStorage is unavailable or throws an error:

- The application continues using in-memory configuration.
- Password generation remains available.
- The application displays the agreed persistent warning.
- No generated password is stored as a fallback.

### 9.5 Security Boundary

The storage service accepts configuration only.

Generated passwords, password history, and clipboard contents must never be passed to or stored by this service.

## 10. Clipboard Architecture

### 10.1 Clipboard Service

Clipboard functionality is isolated in `services/clipboard.ts`.

Proposed interface:

```typescript
copyToClipboard(text: string): Promise<void>
```

The service uses the browser Clipboard API.

It reports success or failure to the application logic layer.

### 10.2 User Interaction

The application hook coordinates clipboard operations.

On success:

- The current password is copied.
- The interface briefly displays "Copied!".

On failure:

- The user receives an understandable error.
- The password remains visible and selectable.
- Manual copying remains possible.

Clipboard access is initiated only following an explicit user action.

### 10.3 Security Considerations

The clipboard service must not:

- Persist copied passwords.
- Log copied passwords.
- Modify the displayed password.
- Add unrelated text to clipboard contents.

The About / Privacy information will explain that the operating system manages clipboard contents and that the application cannot control how long other applications can access them.

## 11. PWA and Offline Architecture

### 11.1 Static Export

The application will use Next.js static export.

The Next.js configuration will include:

```typescript
const nextConfig = {
  output: 'export'
};

export default nextConfig;
```

The resulting static application will be deployed through Cloudflare Pages.

There will be no Next.js runtime server, API routes, or server actions.

Browser-specific functionality must execute only in appropriate client-side contexts.

### 11.2 Service Worker

Serwist (`@serwist/next`) will provide service-worker integration.

The service worker will be responsible for:

- Precaching required application resources.
- Supporting offline application launches.
- Serving cached resources when offline.
- Managing application resource updates.

Compatibility between Serwist, the selected Next.js version, and static export must be verified during implementation.

### 11.3 Resource Caching

Resources required for core application functionality must be available locally after initial caching.

These include:

- Application HTML and JavaScript.
- Stylesheets.
- Fonts.
- Icons.
- Application metadata.
- Other required runtime assets.

The application must not depend on externally hosted runtime resources.

### 11.4 Offline Operation

After required resources have been cached:

- The application can launch offline.
- Password generation works offline.
- Configuration changes work offline.
- Preferences can be saved locally when browser storage is available.
- Clipboard functionality works offline when supported by the browser.

### 11.5 Application Updates

Application updates must not interrupt an active user session.

The current application version may continue operating until the user next launches or refreshes the application.

Updated resources become active on the next launch or refresh.

The implementation must avoid unexpectedly replacing active application resources while the user is working.

## 12. Error Handling Architecture

Error handling will be distributed according to module responsibility, with application-level coordination through the primary hook.

### 12.1 Error Categories

| Category | Examples | Handling |
|---|---|---|
| Configuration | Invalid length, no categories selected | Shared validation and inline feedback |
| Generation | Web Crypto unavailable, generation failure | Generation module reports failure |
| Persistence | localStorage unavailable | Storage service reports failure |
| Clipboard | Permission denied, API unavailable | Clipboard service reports failure |
| Application | Unexpected runtime errors | Application-level error handling |

### 12.2 Application Hook

The application hook coordinates expected operational failures and determines the appropriate user feedback.

It must preserve valid application state when an operation fails.

For example, a failed generation request must not replace the previously displayed password.

### 12.3 React Error Boundary

A React Error Boundary will surround the main application interface.

Its responsibilities include:

- Catching unexpected rendering errors.
- Preventing an unhandled component failure from leaving the user with a blank screen.
- Displaying a simple recovery message.
- Providing an appropriate recovery or reload action.

Ordinary operational errors should continue to be handled locally rather than routed through the Error Boundary.

### 12.4 Sensitive Information

Passwords must never appear in:

- Console output.
- Application logs.
- Error messages.
- Diagnostic information.
- Error-reporting payloads.

Error handling must not expose sensitive application data.

## 13. Styling Architecture

The application will use standard CSS and CSS Modules.

No third-party UI framework or styling framework is required.

### 13.1 Global Styles

`globals.css` will contain:

- CSS resets or normalization where appropriate.
- Global typography.
- Shared design tokens.
- Global layout defaults.
- Application-wide accessibility styles.

### 13.2 Component Styles

Individual components may use CSS Modules.

For example:

```text
components/
└── password/
    ├── PasswordDisplay.tsx
    └── PasswordDisplay.module.css
```

This keeps component-specific styles isolated and reduces unintended styling conflicts.

### 13.3 Design Considerations

The interface should remain:

- Responsive.
- Accessible.
- Minimal and distraction-free.
- Readable on mobile and desktop.
- Consistent across supported browsers.

## 14. Testing Architecture

Testing will use three complementary tools.

### 14.1 Vitest

Used for unit and integration testing.

Primary targets:

- Password generation.
- Configuration validation.
- Character-set construction.
- Random selection and shuffling.
- Settings serialization and validation.
- Storage failure handling.
- Clipboard service behavior.

### 14.2 React Testing Library

Used for component and interface testing.

Primary targets:

- Password display.
- Configuration controls.
- Validation feedback.
- Generate and Copy actions.
- Restore Defaults behavior.
- Accessible interaction and feedback.

Tests should emphasize observable user behavior rather than implementation details.

### 14.3 Playwright

Used for end-to-end browser testing.

Primary targets:

- Application initialization.
- Complete password-generation workflows.
- Configuration persistence across reloads.
- Clipboard behavior.
- Responsive layouts.
- Offline functionality.
- PWA resource caching.
- Update behavior.
- Browser compatibility.

### 14.4 Security Testing Priorities

Testing should specifically verify:

- Generated passwords are never persisted.
- Passwords are never transmitted externally.
- `Math.random()` is not used for generation.
- Invalid configurations cannot generate passwords.
- Failed generation preserves the previous password.
- Storage and clipboard failures do not compromise generation.
- Offline operation does not require remote services.

Testing cannot mathematically prove the security of the cryptographic implementation. The implementation should also be reviewed against the relevant Web Crypto API behavior and established cryptographic practices.

## 15. Security Boundaries and Constraints

The following constraints apply across the architecture.

### 15.1 Password Handling

- Passwords exist only in application memory while being displayed and used.
- Passwords are never persisted by the application.
- Passwords are never transmitted externally.
- Passwords are never logged.
- Passwords are not included in error messages or diagnostics.

### 15.2 Cryptographic Randomness

- Use `crypto.getRandomValues()`.
- Avoid modulo bias through rejection sampling.
- Use cryptographically secure shuffling.
- Never use `Math.random()` for password generation.

### 15.3 Browser API Isolation

Browser-specific functionality must be isolated in appropriate client-side modules.

The application must handle missing or unavailable browser APIs gracefully.

### 15.4 Content Security Policy

The application should implement a restrictive Content Security Policy appropriate to its static architecture.

The policy should avoid unnecessary external script, style, font, image, and connection sources.

### 15.5 Dependency Management

Runtime dependencies should be kept minimal.

Fonts, icons, scripts, and styles should be bundled locally rather than loaded from CDNs.

The application should not introduce analytics, tracking, advertising, or unnecessary external services.

## 16. Deployment Architecture

The application will be deployed as a static site through Cloudflare Pages.

### 16.1 Build Process

The Next.js build produces a static export.

The generated static output is deployed to Cloudflare Pages.

### 16.2 Runtime

Cloudflare Pages serves the static application resources.

No application server is required to generate passwords or manage preferences.

### 16.3 Network Requirements

The application requires an Internet connection for its initial delivery and for receiving updates.

Once required resources are cached, core functionality is available offline.

No network connection is required for password generation, configuration changes, or local preference persistence.

## 17. Future Extensibility

The architecture intentionally separates feature functionality from shared application infrastructure.

Potential future security utilities could be added as independent feature modules.

For example:

```text
features/
├── password-generator/
├── passphrase-generator/
├── pin-generator/
└── random-string-generator/
```

Shared infrastructure such as configuration persistence, clipboard integration, application layout, and PWA functionality can be reused where appropriate.

Future features should not be introduced until they have defined requirements and a clear benefit.

## 18. Architectural Decision Summary

| Decision | Selected Approach |
|---|---|
| Framework | Next.js |
| UI | React |
| Language | TypeScript |
| Rendering | Static export |
| Hosting | Cloudflare Pages |
| Organization | Feature-oriented modular structure |
| Component design | Small, focused components |
| State management | Custom React hook |
| External state library | None |
| Password generation | Standalone TypeScript module |
| Randomness | Web Crypto API |
| Validation | Shared centralized module |
| Configuration model | Strongly typed object |
| Preference storage | Versioned localStorage service |
| Clipboard | Dedicated Clipboard API service |
| PWA integration | Serwist |
| Error handling | Local handling plus React Error Boundary |
| Styling | CSS Modules and standard CSS |
| Unit testing | Vitest |
| Component testing | React Testing Library |
| End-to-end testing | Playwright |

## 19. Implementation Considerations

The following details will be resolved during implementation rather than treated as fixed architectural decisions:

- Exact Next.js and Serwist versions.
- Serwist configuration compatible with static export.
- Service-worker registration and update lifecycle details.
- Cache naming and versioning strategy.
- Exact localStorage key and migration implementation.
- Exact component props and hook return types.
- Detailed CSS organization.
- Test coverage targets.
- Content Security Policy directives.
- Cloudflare Pages build and deployment settings.

These decisions should remain consistent with the requirements and architectural principles established in this document.
