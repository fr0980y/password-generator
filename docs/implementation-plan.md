# Implementation Plan

**Project:** Password Generator  
**Document Version:** 1.0  
**Status:** Proposed  
**Last Updated:** November 23, 2026

## 1. Purpose

This document defines the implementation roadmap for the Password Generator application.

It translates the approved Product Requirements, Functional Requirements, Architecture, and Architecture Decision Records into an ordered set of development phases and deliverables.

The plan is intended to:

- Provide a clear implementation sequence.
- Identify dependencies between development activities.
- Establish completion criteria for each phase.
- Keep implementation aligned with the approved architecture and requirements.
- Provide a practical roadmap without unnecessarily restricting implementation details.

The implementation should prioritize correctness, security, privacy, maintainability, and a straightforward user experience.

## 2. Implementation Principles

The following principles will guide development:

1. **Follow the approved architecture.** Avoid introducing new frameworks, services, or architectural patterns without a clear reason.
2. **Build incrementally.** Complete and verify foundational functionality before building on top of it.
3. **Keep core functionality independent.** Password generation, validation, persistence, and clipboard functionality should have clearly defined responsibilities.
4. **Test as functionality is developed.** Do not defer all testing until the end.
5. **Protect sensitive information.** Generated passwords must never be logged, persisted, transmitted, or included in diagnostics.
6. **Prefer simple solutions.** Avoid abstractions and dependencies that do not provide meaningful value.
7. **Maintain documentation.** Update affected requirements, architecture, and decision records when implementation reveals a necessary change.

## 3. Implementation Overview

Development will proceed through the following phases.

| Phase | Description | Status |
|---|---|---|
| 1 | Project Foundation | Completed |
| 2 | PWA Foundation | Completed |
| 3 | Core Types and Configuration Validation | Completed |
| 4 | Password Generation Engine | Completed |
| 5 | Settings Persistence | Completed |
| 6 | Clipboard Service | Completed |
| 7 | User Interface | Completed |
| 8 | Application Integration and Error Handling | Completed |
| 9 | Testing and Security Verification | Completed through 9.3.5.4 for automated/static infrastructure verification; remaining acceptance items move to Phase 10 |
| 10 | Deployment and Release | Remaining |
| 11 | Password Actions and Extended Lengths | Completed |

The phases are ordered by dependency, although some independent tasks may be developed in parallel where practical.

---

## 4. Phase 1 — Project Foundation

### Objective

Verify the existing project configuration and establish a clean, maintainable development foundation.

The project already exists in GitHub and is connected to Cloudflare Pages. This phase builds on that setup rather than recreating it.

### Tasks

- [ ] Review the existing project structure.
- [ ] Review `package.json` and installed dependencies.
- [ ] Review Next.js configuration.
- [ ] Verify TypeScript configuration.
- [ ] Verify ESLint configuration.
- [ ] Verify the existing GitHub repository and Cloudflare Pages integration.
- [ ] Configure Next.js static export.
- [ ] Verify that the application builds successfully.
- [ ] Establish the agreed source directory and project organization.
- [ ] Create the initial documentation and feature directories.
- [ ] Remove unused starter content and unnecessary dependencies.
- [ ] Establish baseline formatting and linting conventions.

### Deliverables

- Verified Next.js project.
- Working TypeScript configuration.
- Static export configuration.
- Initial project directory structure.
- Successful production build.

### Completion Criteria

The project builds successfully, produces static output, and remains deployable through the existing Cloudflare Pages configuration.

---

## 5. Phase 2 — PWA Foundation

### Objective

Establish the Progressive Web App infrastructure and verify compatibility with the static-export architecture.

### Tasks

- [ ] Verify compatibility between the selected Next.js version, static export, and Serwist.
- [ ] Install and configure Serwist.
- [ ] Configure service worker generation and registration.
- [ ] Create the web app manifest.
- [ ] Create application icons in the required sizes.
- [ ] Configure application name, description, theme color, and display behavior.
- [ ] Configure precaching for the application shell and required static resources.
- [ ] Establish appropriate caching behavior for application assets.
- [ ] Implement the agreed non-interruptive update strategy.
- [ ] Verify that cached application resources support offline startup.
- [ ] Verify that no unnecessary external runtime dependencies are introduced.

### Deliverables

- Configured PWA infrastructure.
- Web app manifest.
- Application icons.
- Generated service worker.
- Initial offline-capable application shell.

### Completion Criteria

The application can be installed where supported, loads successfully after required resources have been cached, and can operate offline without requiring an application server.

---

## 6. Phase 3 — Core Types and Configuration Validation

### Objective

Implement the shared data structures, default configuration, character definitions, and validation rules required by the password generator.

### Tasks

- [ ] Define the `PasswordConfiguration` interface.
- [ ] Define the default configuration.
- [ ] Define the allowed password length range.
- [ ] Define the four character categories.
- [ ] Define ambiguous-character exclusion rules.
- [ ] Implement centralized configuration validation.
- [ ] Implement validation for at least one enabled character category.
- [ ] Implement validation for minimum password length when category enforcement is enabled.
- [ ] Define a consistent validation result structure.
- [ ] Create unit tests covering valid and invalid configurations.

### Deliverables

- `password-generator.types.ts`
- `password-generator.constants.ts`
- `password-generator.validation.ts`
- Configuration validation tests.

### Completion Criteria

Configuration types and validation rules accurately represent the approved functional requirements and are independently testable.

---

## 7. Phase 4 — Password Generation Engine

### Objective

Implement the core password-generation algorithm independently of React and the user interface.

This is the most security-sensitive functional component of the application.

### Tasks

- [ ] Implement secure random number generation using Web Crypto.
- [ ] Implement rejection sampling to eliminate modulo bias.
- [ ] Implement character-pool construction based on configuration.
- [ ] Implement ambiguous-character exclusion.
- [ ] Implement required-category character selection.
- [ ] Implement secure shuffling of the completed password.
- [ ] Ensure the generator independently validates its input.
- [ ] Implement explicit failure handling when Web Crypto is unavailable.
- [ ] Ensure failures never produce partial or invalid passwords.
- [ ] Verify that no insecure random-number fallback exists.
- [ ] Implement comprehensive unit tests.

### Testing Considerations

Tests should cover:

- All character categories individually.
- Every combination of enabled categories.
- Minimum and maximum password lengths.
- Ambiguous-character exclusion.
- Required-category enforcement.
- Category enforcement disabled.
- Invalid configurations.
- Web Crypto unavailable or failing.
- Random-number edge cases.
- Shuffle behavior.
- Password length and character-set correctness.

Statistical testing may be used as an additional diagnostic, but must not be treated as proof of cryptographic security.

### Deliverables

- `password-generator.ts`
- Comprehensive generator unit tests.

### Completion Criteria

The generator produces valid passwords using cryptographically secure randomness, satisfies all configured constraints, and handles failures safely.

---

## 8. Phase 5 — Settings Persistence

### Objective

Implement reliable persistence of user preferences without ever storing generated passwords.

### Tasks

- [ ] Implement the settings storage service.
- [ ] Define the versioned localStorage data structure.
- [ ] Implement `loadSettings()`.
- [ ] Implement `saveSettings()`.
- [ ] Implement `resetSettings()`.
- [ ] Validate persisted values before using them.
- [ ] Handle missing, corrupt, and incompatible stored settings.
- [ ] Implement graceful fallback when localStorage is unavailable.
- [ ] Ensure the application can continue operating with in-memory settings.
- [ ] Implement the agreed persistent storage warning.
- [ ] Verify that only configuration data is persisted.

### Deliverables

- `settings-storage.ts`
- Storage service tests.

### Completion Criteria

Preferences load and save correctly, invalid persisted data is handled safely, and storage failures do not prevent password generation.

No generated password is ever written to localStorage.

---

## 9. Phase 6 — Clipboard Service

### Objective

Implement the application's clipboard functionality using the browser Clipboard API.

### Tasks

- [ ] Implement `copyToClipboard(text: string): Promise<void>`.
- [ ] Verify secure-context requirements.
- [ ] Handle successful clipboard writes.
- [ ] Handle denied permissions and unavailable clipboard functionality.
- [ ] Ensure the service does not store, log, or otherwise retain copied passwords.
- [ ] Implement service-level tests using mocked browser APIs.

### Deliverables

- `clipboard.ts`
- Clipboard service tests.

### Completion Criteria

The service can copy text when supported and reports failures cleanly without introducing any password-persistence behavior.

---

## 10. Phase 7 — User Interface

### Objective

Build the responsive application interface and connect it to the underlying functionality.

The interface should be simple, approachable, and focused on generating and copying passwords.

### Tasks

#### Application Layout

- [ ] Implement the main application layout.
- [ ] Establish global styles and design tokens.
- [ ] Implement responsive layouts for desktop and mobile.
- [ ] Establish consistent spacing, typography, and control styling.

#### Password Display

- [ ] Implement the password display component.
- [ ] Display generated passwords as plain text.
- [ ] Use a monospaced font.
- [ ] Ensure passwords can be selected manually.
- [ ] Implement the Copy button.
- [ ] Provide clear copy-success and copy-failure feedback.

#### Configuration Controls

- [ ] Implement the password length control.
- [ ] Implement uppercase, lowercase, number, and symbol toggles.
- [ ] Implement ambiguous-character exclusion.
- [ ] Implement required-category enforcement.
- [ ] Display configuration validation feedback.
- [ ] Implement Restore Defaults.

#### Generation Controls

- [ ] Implement the Generate button.
- [ ] Ensure changing settings does not automatically regenerate the password.
- [ ] Ensure generation occurs only through the explicit Generate action or initial application initialization.

#### Application Information

- [ ] Implement the About/Privacy section.
- [ ] Explain local password generation.
- [ ] Explain the use of Web Crypto.
- [ ] Explain local preference persistence.
- [ ] Explain offline support.
- [ ] Explain that passwords are not transmitted or stored by the application.
- [ ] Explain the distinction between application storage and the operating system clipboard.
- [ ] Display the application version.

#### Accessibility

- [ ] Provide accessible labels for all controls.
- [ ] Verify keyboard navigation.
- [ ] Verify screen-reader compatibility.
- [ ] Provide visible focus indicators.
- [ ] Verify appropriate contrast.
- [ ] Ensure feedback is communicated accessibly.

### Deliverables

- Main application interface.
- Password display and copy controls.
- Configuration controls.
- About/Privacy information.
- Responsive styling.

### Completion Criteria

The interface supports all approved user workflows, remains usable across supported screen sizes, and meets the accessibility requirements established in the Functional Requirements document.

---

## 11. Phase 8 — Application Integration and Error Handling

### Objective

Connect all application layers and implement the complete initialization, interaction, and recovery workflows.

### Tasks

- [ ] Implement `use-password-generator.ts`.
- [ ] Coordinate configuration state.
- [ ] Coordinate generated password state.
- [ ] Implement first-launch initialization using default settings.
- [ ] Implement subsequent initialization using persisted settings.
- [ ] Generate a fresh password on every application initialization.
- [ ] Ensure previously generated passwords are never restored.
- [ ] Implement automatic persistence of configuration changes.
- [ ] Implement Restore Defaults behavior without changing the currently displayed password.
- [ ] Implement Copy behavior using the currently displayed password.
- [ ] Ensure generation failures preserve the previous password.
- [ ] Implement Web Crypto unavailable behavior.
- [ ] Implement localStorage unavailable behavior.
- [ ] Implement clipboard failure behavior and manual-copy fallback.
- [ ] Implement the React Error Boundary.
- [ ] Verify that unexpected rendering failures display an appropriate recovery interface.
- [ ] Ensure sensitive password data never appears in logs, diagnostics, or error messages.

### Deliverables

- Integrated application state and behavior.
- Initialization and recovery workflows.
- Application-level error handling.

### Completion Criteria

All application functionality works together according to the Functional Requirements document, including initialization, configuration changes, generation, copying, persistence, and failure recovery.

---

## 12. Phase 9 — Testing and Security Verification

### Objective

Verify that the completed application satisfies its functional, architectural, security, privacy, and usability requirements.

**Status:** Completed through the automated and static-infrastructure work covered by **Phase 9.3.5.4**. The implemented Node.js and Playwright suites verify core workflows and production-static security headers, while deployed HTTPS/HSTS, cross-browser PWA behavior, real-device layout, offline operation, clipboard permission failures, and service-worker updates remain manual acceptance work in Phase 10.

### Tasks

#### Automated Testing

- [x] Complete generator unit tests.
- [x] Complete configuration validation tests.
- [x] Complete persistence service tests.
- [x] Complete clipboard service tests.
- [x] Complete component tests using React Testing Library.
- [x] Implement end-to-end tests using Playwright.
- [x] Test first-launch behavior.
- [x] Test subsequent-launch behavior.
- [x] Test settings persistence.
- [x] Test generation and clipboard workflows.
- [x] Test validation and error handling.
- [x] Test Restore Defaults behavior.
- [ ] Test responsive layouts.
- [ ] Test offline startup and operation.
- [ ] Test PWA installation where supported.
- [ ] Test service worker update behavior.

#### Security and Privacy Verification

- [x] Verify that password generation occurs entirely in the browser.
- [x] Verify that Web Crypto is used for all random generation.
- [x] Verify that `Math.random()` is not used by the generation implementation.
- [x] Verify rejection sampling and secure shuffling.
- [x] Verify that generated passwords are not written to localStorage.
- [x] Verify that passwords are not included in logs or error messages.
- [x] Verify that the application makes no password-transmitting network requests.
- [x] Verify that no analytics or tracking code is present.
- [x] Verify that no unnecessary external runtime requests occur.
- [x] Review third-party dependencies.
- [x] Configure and verify an appropriate Content Security Policy.
- [x] Verify that clipboard functionality requires explicit user action.
- [x] Review the application against the Security & Privacy Specification.

#### Browser Compatibility

Test supported functionality in current versions of:

- Chrome
- Edge
- Firefox
- Safari

Also verify relevant mobile browser and PWA behavior where practical.

### Deliverables

- [x] Automated test suite.
- [x] Automated security and privacy verification results.
- [ ] Browser compatibility and real-device results.
- [ ] Documented defects and resolutions.

### Completion Criteria

Core automated critical functionality passes testing, identified security and privacy requirements are verified by the implemented suites, and no unresolved critical implementation defects remain. Remaining browser, device, PWA, and deployed-environment verification is Phase 10 manual acceptance testing.

#### Phase 9.3.5.4 completion note

The static-export regression work completed in Phase 9.3.5.4 includes generated Cloudflare `_headers`, inline-script CSP hash generation, local static-server header enforcement, browser CSP violation capture, and 400/404/405/500 response-header coverage. The automated Chromium suite now exercises the production export under that local production-like policy. Local HTTP cannot establish deployed HTTPS/HSTS behavior.

---

## 13. Phase 10 — Deployment and Release

### Objective

Prepare and deploy the production application through the existing GitHub and Cloudflare Pages integration.

**Status:** Remaining work. Phase 10 consists of confirming Cloudflare Pages build and hosting, verifying the deployed HTTPS and PWA behavior, performing manual acceptance tests on real browsers and devices, and publishing the initial release.

### Tasks

- [ ] Verify production build configuration.
- [ ] Verify static export output.
- [ ] Verify Cloudflare Pages build settings.
- [ ] Verify production environment behavior.
- [ ] Verify HTTPS.
- [ ] Verify PWA installation and offline functionality on the deployed application.
- [ ] Verify service worker registration and update behavior.
- [ ] Verify production Content Security Policy.
- [ ] Verify application version information.
- [ ] Perform a final functional smoke test.
- [ ] Review project documentation for consistency.
- [ ] Publish the initial production release.

### Deliverables

- Production deployment.
- Verified PWA functionality.
- Initial release.
- Updated project documentation.

### Completion Criteria

The application is deployed successfully, accessible over HTTPS, installable where supported, and fully functional under the production configuration.

### Phase 11 — Password Actions and Extended Lengths

**Status:** Completed

#### Objective

Keep the primary password actions with the displayed password and provide an
optional, persisted setting for password lengths above the standard 40-character
maximum.

#### Completed Tasks

- [x] Move Generate Password into the password card beside Copy.
- [x] Apply stacked narrow-mobile, equal-width intermediate, and 2:1 wider-screen button layouts.
- [x] Set the default password length to 20 and standard maximum to 40.
- [x] Add the disabled-by-default extended-length setting with a maximum of 128.
- [x] Clamp the selected length to 40 when extended lengths are disabled.
- [x] Validate both length modes while preserving existing category and generation behavior.
- [x] Persist the setting using storage schema version 2 without a version-1 migration.
- [x] Add validation, hook/UI, persistence, and production-export browser tests.
- [x] Update requirements, architecture, security, UI, and test documentation.

#### Completion Criteria

The new setting controls the slider maximum and validation limit, is restored
from local preferences, and never causes generated passwords to be persisted.
The existing Web Crypto generation algorithm and failure behavior remain
unchanged.

---

## 14. Final MVP Acceptance Criteria

The project is considered complete when all of the following are true:

- [ ] Users can generate passwords using configurable character categories.
- [ ] Password generation uses cryptographically secure randomness.
- [ ] All approved password configuration rules are enforced.
- [ ] Users can copy generated passwords.
- [ ] Passwords are never persisted or transmitted by the application.
- [ ] Preferences persist locally when browser storage is available.
- [ ] The application remains usable when localStorage is unavailable.
- [ ] A fresh password is generated on every application initialization.
- [ ] The application works offline after required resources are cached.
- [ ] The application can be installed as a PWA where supported.
- [ ] Application updates do not interrupt active sessions.
- [ ] The interface is responsive and accessible.
- [ ] Expected errors are handled gracefully.
- [ ] Unexpected rendering failures have a recovery experience.
- [ ] Automated tests cover core functionality and important user workflows.
- [ ] Security and privacy requirements have been verified.
- [ ] The application is deployed successfully to Cloudflare Pages.
- [ ] Documentation accurately reflects the implemented application.

## 15. Change Management

This plan is based on the approved requirements and architecture as of version 1.0.

Implementation may reveal issues or opportunities that justify changes.

When a proposed change affects an established requirement or architectural decision:

1. Identify the affected document and requirement or decision.
2. Evaluate the impact of the proposed change.
3. Update the relevant documentation.
4. Create a new ADR when a significant architectural decision is changed or introduced.
5. Update this implementation plan if the development sequence or deliverables are affected.

Minor implementation details do not require new ADRs.

The implementation plan should be updated as necessary to reflect meaningful changes in project scope or technical direction.

---

## 16. Document Relationships

This document is subordinate to the approved product and technical direction established by the following documents:

- `product-requirements.md`
- `functional-requirements.md`
- `architecture.md`
- `architecture-decisions.md`

The implementation must satisfy the requirements and architectural constraints established by those documents.

Where an inconsistency is discovered, the relevant documents should be reviewed and reconciled rather than allowing conflicting specifications to persist.
