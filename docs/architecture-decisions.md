# Architecture Decision Records

**Project:** Password Generator  
**Document Version:** 1.0  
**Status:** Approved  
**Last Updated:** November 19, 2026

## Purpose

This document records significant architectural and technical decisions made during the design of the Password Generator application.

Each record describes the context behind a decision, the selected approach, alternatives considered, and the resulting consequences. The goal is to preserve the reasoning behind the architecture so future changes can be evaluated consistently.

Decisions may be superseded as the project evolves. When that happens, the original record should remain in place, with its status updated and a new ADR documenting the replacement.

## ADR-001: Use Next.js with Static Export

**Status:** Accepted

### Context

The application is a client-side password generator that does not require a backend, server-side rendering, API routes, or server-side data processing.

The application should be deployable as a collection of static files and should work after its resources have been cached for offline use.

### Decision

Use Next.js with static export enabled through `output: 'export'`.

Deploy the generated static assets to Cloudflare Pages. Browser-specific functionality, including password generation and access to browser APIs, will execute on the client.

### Alternatives Considered

- **Vite with React:** A simpler client-side application build setup, but Next.js is already part of the selected technology stack and provides a useful portfolio demonstration.
- **Next.js with server rendering:** Unnecessary because the application has no server-dependent functionality.

### Consequences

- The application can be hosted without a Next.js runtime server.
- There are no server hosting or application runtime costs.
- API routes and server actions are not part of the architecture.
- Browser-only functionality must execute in appropriate client-side contexts.
- Next.js features that require a server runtime cannot be used.
- Compatibility between the selected Next.js version, static export, and PWA tooling must be verified during implementation.

---

## ADR-002: Use a Feature-Oriented Project Structure

**Status:** Accepted

### Context

The application should have a clear separation of responsibilities without introducing unnecessary architectural complexity.

Although the MVP has one primary feature, the application may eventually include additional password-related utilities.

### Decision

Organize the project around application layers and feature-oriented modules.

Keep feature-specific functionality together while placing shared services, hooks, components, and types in appropriate shared locations.

### Alternatives Considered

- **Flat project structure:** Simple initially, but becomes harder to maintain as the application grows.
- **Strict layered architecture:** Provides separation but could introduce unnecessary abstraction for a relatively small application.
- **Fully feature-isolated structure:** Could create duplication for shared application services and components.

### Consequences

- Related functionality is easier to locate and maintain.
- Future features can be added without restructuring the entire application.
- Shared functionality remains reusable.
- The structure should remain proportional to actual application complexity.

---

## ADR-003: Use React Hooks Instead of External State Management

**Status:** Accepted

### Context

The application has a relatively small amount of state, primarily consisting of:

- Password configuration.
- Currently generated password.
- Initialization status.
- Validation results.
- User feedback and error states.

Introducing a separate state-management library would add dependencies and complexity without providing meaningful benefits for the MVP.

### Decision

Use React state and a custom hook, `use-password-generator.ts`, to coordinate the application's primary state and behavior.

Do not introduce Redux, Zustand, or another external state-management library.

### Alternatives Considered

- **Redux:** Provides structured state management but is excessive for the application's requirements.
- **Zustand:** Lightweight, but unnecessary given the limited state and application scope.
- **Component-local state only:** Could distribute application logic across multiple components and make behavior harder to coordinate.

### Consequences

- Fewer dependencies and less application complexity.
- State management remains close to the feature that owns it.
- The custom hook provides a consistent interface between the UI and underlying functionality.
- If application state becomes substantially more complex, this decision can be revisited.

---

## ADR-004: Keep Password Generation Independent of React

**Status:** Accepted

### Context

Password generation is the application's most important piece of functionality. It should be reliable, independently testable, and reusable without depending on the user interface.

Coupling generation logic to React components or hooks would make testing and future reuse more difficult.

### Decision

Implement password generation as a standalone TypeScript module.

The primary public function will be:

```ts
generatePassword(config: PasswordConfiguration): string
```

The module will:

- Accept a validated configuration.
- Perform secure random character selection.
- Enforce selected character-category requirements.
- Shuffle the resulting password.
- Return a complete password or throw an appropriate error.
- Avoid dependencies on React, browser UI components, storage, and clipboard functionality.

The generator will independently validate its input rather than relying exclusively on validation performed by the UI.

### Alternatives Considered

- **Generation inside a React hook:** Convenient initially, but couples core functionality to application state and lifecycle.
- **Generation inside a component:** Creates an even tighter dependency on presentation and makes independent testing difficult.

### Consequences

- Password generation can be tested independently.
- The generator can potentially be reused by future password-related features.
- UI changes do not require changes to the generation algorithm.
- The generator has a clearly defined responsibility and interface.

---

## ADR-005: Use the Web Crypto API for Secure Randomness

**Status:** Accepted

### Context

Password generation requires cryptographically secure random values.

The standard JavaScript `Math.random()` function is not designed for cryptographic use and must not be used to generate passwords.

### Decision

Use the browser's Web Crypto API, specifically `crypto.getRandomValues()`, for random number generation.

Implement:

- Rejection sampling to avoid modulo bias when selecting characters.
- Cryptographically secure shuffling of the completed password.
- Explicit failure handling when secure randomness is unavailable.

The application must never silently fall back to `Math.random()` or another insecure random-number source.

### Alternatives Considered

- **Math.random():** Inappropriate for generating security-sensitive passwords.
- **Third-party password-generation libraries:** Unnecessary for the selected functionality and introduce additional dependencies.
- **Server-side generation:** Conflicts with the application's privacy-first, client-side architecture.

### Consequences

- Password generation uses a browser-provided cryptographic random-number source.
- Password generation is performed locally on the user's device.
- Browsers without the required Web Crypto functionality cannot generate passwords.
- The application must provide a clear error state rather than an insecure fallback.

---

## ADR-006: Use localStorage for Preference Persistence

**Status:** Accepted

### Context

Users should not have to reconfigure their preferred password-generation settings every time they open the application.

However, generated passwords must never be persisted by the application.

The settings are small, non-sensitive preferences that do not justify a database or more complex storage solution.

### Decision

Use browser `localStorage` to persist password-generation preferences.

Persist only the configuration object, using a versioned storage structure.

Do not persist:

- Generated passwords.
- Password history.
- Clipboard contents.
- Other sensitive user information.

Validate stored settings when loading them and gracefully recover from corrupt, missing, or incompatible data.

If localStorage is unavailable, the application must continue operating with in-memory settings and display the agreed persistent warning.

### Alternatives Considered

- **sessionStorage:** Does not preserve preferences across browser sessions.
- **IndexedDB:** More capable than necessary for a small configuration object.
- **Cookies:** Not appropriate for application preferences and introduce unnecessary HTTP-related behavior.
- **No persistence:** Would require users to configure the application repeatedly.

### Consequences

- User preferences survive application restarts on the same browser and origin.
- No backend or account is needed to preserve preferences.
- Settings remain local to the browser.
- Clearing browser storage removes saved preferences.
- The application must handle storage failures without disabling password generation.

---

## ADR-007: Isolate Browser APIs Behind Dedicated Services

**Status:** Accepted

### Context

The application relies on browser-provided functionality, including:

- localStorage.
- The Clipboard API.
- Web Crypto.
- PWA and service worker capabilities.

Directly accessing these APIs throughout the component tree would distribute browser-specific implementation details across the application.

### Decision

Encapsulate browser APIs behind dedicated service modules where appropriate.

Initial services include:

- `settings-storage.ts`
- `clipboard.ts`

The password-generation module will access Web Crypto as part of its own implementation because secure randomness is intrinsic to its responsibility.

Services should expose simple interfaces and should not contain presentation logic.

For example:

```ts
copyToClipboard(text: string): Promise<void>
```

The service reports success or failure through its return behavior. The UI remains responsible for displaying feedback.

### Alternatives Considered

- **Direct browser API access from components:** Simpler initially, but spreads implementation details and complicates testing.
- **A generic browser abstraction layer:** Provides more abstraction than the application currently needs.

### Consequences

- Browser-specific functionality has clear ownership.
- Services can be tested independently with mocked browser APIs.
- Components remain focused on presentation and user interaction.
- Additional abstraction should only be introduced when a real need arises.

---

## ADR-008: Use Serwist for PWA Functionality

**Status:** Accepted

### Context

The application should support installation as a Progressive Web App and provide offline functionality after its required resources have been cached.

Implementing service worker registration, caching, and update handling manually would introduce additional implementation and maintenance work.

### Decision

Use Serwist through `@serwist/next` for service worker generation and integration.

Configure the PWA to:

- Precache the application shell and required static resources.
- Support offline access to the core application.
- Avoid unnecessary external runtime dependencies.
- Make application updates available without interrupting an active session.

An available update should become active on the next application launch or refresh rather than interrupting the user.

The implementation registers the worker from client-side code and checks for
updates on launch. A waiting worker accepts a launch-time activation request only
when the requesting page is the sole in-scope window client. It activates without
claiming clients, and only the requesting page reloads. With other tabs open,
activation is deferred until a later launch or refresh after they close so their
sessions are not taken over.

### Alternatives Considered

- **Manual service worker implementation:** Provides maximum control but requires more custom implementation and maintenance.
- **Other PWA plugins:** Could provide similar functionality, but Serwist is the selected approach for this project.
- **No PWA support:** Would eliminate offline functionality and installability.

### Consequences

- PWA infrastructure is handled by a dedicated tool.
- Offline behavior and update handling require explicit configuration and testing.
- Compatibility between Serwist, Next.js, and static export must be verified during implementation.
- Browser-specific PWA behavior may vary.
- The service worker must not introduce unnecessary network requests or external dependencies.

---

## ADR-009: Use Standard CSS and CSS Modules

**Status:** Accepted

### Context

The application has a relatively small interface and does not require a comprehensive styling framework or component library.

Styling should remain maintainable, predictable, and easy to customize.

### Decision

Use standard CSS and CSS Modules.

Use global CSS for application-wide styles, design tokens, and foundational styles. Use component-specific CSS Modules for individual component styling.

Do not introduce Tailwind CSS, Bootstrap, or a third-party UI framework for the MVP.

### Alternatives Considered

- **Tailwind CSS:** Provides utility-based styling but introduces a different styling workflow that is not necessary for this project.
- **Bootstrap:** Offers prebuilt components and layouts but adds unnecessary styling conventions and dependencies.
- **CSS-in-JS:** Provides component-oriented styling but adds complexity without a compelling benefit here.

### Consequences

- Styling remains close to the components it supports.
- CSS class names are locally scoped through CSS Modules.
- The project avoids an additional styling framework.
- Global design decisions remain centralized and reusable.

---

## ADR-010: Testing Strategy

**Status:** Accepted; current implementation recorded November 22, 2026

### Context

The application has security-sensitive core functionality and several browser-dependent behaviors.

Testing should cover the generation algorithm, configuration validation, persistence, clipboard interaction, user workflows, and offline functionality.

No single testing framework provides the most appropriate coverage for all these areas.

### Original Decision (Historical Proposal)

The original proposal selected Vitest for unit and integration testing, React Testing Library for component behavior, and Playwright for end-to-end browser testing.

Vitest was not adopted. Jest was considered as an alternative to Vitest, but neither is part of the current test infrastructure. Playwright remains planned and is not yet installed or configured.

### Current Implementation

Use Node.js's built-in `node:test` runner and `node:assert` for the implemented automated tests. Use esbuild to bundle and transpile TypeScript and TSX test entry points.

Use React Testing Library for React component and interaction tests, with jsdom to provide simulated DOM behavior. Browser APIs used in these tests are mocked or controlled; this setup does not replace real-browser testing.

Playwright remains the planned tool for real-browser end-to-end testing, including workflows and browser behavior that Node and jsdom cannot verify.

### Consequences

- Core generation and service behavior can be tested without a browser.
- React components and interactions can be tested in a simulated DOM.
- Real-browser behavior is not covered until the planned Playwright setup is implemented.
- Statistical tests may help identify implementation defects but do not establish cryptographic security.

---

## ADR-011: Use Cloudflare Pages for Deployment

**Status:** Accepted

### Context

The application is designed as a static client-side application and does not require an application server.

Deployment should be straightforward, support HTTPS, and integrate with the project's GitHub repository.

### Decision

Deploy the application to Cloudflare Pages using the static output generated by Next.js.

Use GitHub integration to trigger builds and deployments when changes are pushed to the configured branch.

### Alternatives Considered

- **Vercel:** Offers strong Next.js integration but its server-oriented features are unnecessary for this application.
- **Traditional web hosting:** Could serve static assets but would require more manual deployment configuration.
- **Self-hosted server:** Adds operational complexity without providing a meaningful benefit.

### Consequences

- The application can be deployed as static assets.
- Git-based deployment simplifies the development workflow.
- No application server needs to be maintained.
- Cloudflare Pages provides the hosting and delivery infrastructure.
- Build and deployment settings must remain consistent with the Next.js static export configuration.

---

## ADR-012: Avoid Backend Services and External Password-Generation Dependencies

**Status:** Accepted

### Context

Privacy is a central product principle:

**Your passwords are yours. They never leave your device.**

A backend, third-party password-generation service, account system, analytics provider, or cloud storage integration would introduce unnecessary complexity and potentially weaken the application's privacy guarantees.

### Decision

Keep the application entirely client-side.

Do not introduce:

- Backend application services.
- Databases.
- User accounts or authentication.
- Cloud synchronization or storage.
- Third-party password-generation services.
- Analytics or tracking.
- Advertising or payment integrations.
- Password history or application-managed password storage.

Password generation must occur locally using the Web Crypto API.

The application should avoid unnecessary third-party runtime dependencies and external network requests.

### Alternatives Considered

- **Backend password generation:** Unnecessary and inconsistent with the privacy objective.
- **Cloud-based settings synchronization:** Requires accounts or another mechanism for identifying users and introduces additional infrastructure.
- **Third-party generation libraries or services:** Not needed for the relatively focused generation algorithm.

### Consequences

- Passwords remain within the user's browser during generation and use.
- The application has no backend infrastructure to maintain.
- The privacy model is simpler to explain and verify.
- Preferences are local to the browser and are not synchronized between devices.
- Dependency selection and PWA caching must be considered carefully to avoid unnecessary external runtime communication.

---

## ADR-013: Use a React Error Boundary for Unexpected Rendering Failures

**Status:** Accepted

### Context

The application should provide a controlled recovery experience when an unexpected rendering error occurs.

However, ordinary operational failures—such as clipboard access errors, storage failures, or invalid configuration—should be handled by the functionality responsible for them.

Using a single global error mechanism for every type of failure would make error handling less clear.

### Decision

Implement a React Error Boundary around the main application interface to catch unexpected rendering errors in its descendant component tree.

Handle expected operational failures locally within their respective services, hooks, or components.

The Error Boundary should display a clear recovery message and an appropriate recovery action.

Never expose generated passwords through error messages, logs, or diagnostics.

### Alternatives Considered

- **Local error handling only:** Appropriate for expected operational failures, but insufficient as a general safeguard against unexpected rendering exceptions.
- **One global error-handling mechanism:** Would blur the distinction between rendering failures and ordinary application errors.
- **External error-monitoring service:** Unnecessary for this privacy-focused application and could introduce additional data-sharing concerns.

### Consequences

- Unexpected rendering failures receive a controlled fallback interface.
- Ordinary operational errors remain close to the functionality that produced them.
- The application avoids introducing an external error-monitoring dependency.
- Error recovery behavior must be tested.
- Error Boundaries do not catch every type of JavaScript error, including errors in event handlers and asynchronous callbacks; those require their own handling.

---

## Decision Review and Maintenance

These records represent the architectural baseline for the MVP.

Implementation details that have intentionally not been fixed by these decisions include:

- Exact Next.js, React, TypeScript, and Serwist versions.
- Service worker registration and update lifecycle implementation.
- Cache names, versioning, and invalidation strategy.
- localStorage key naming and future migration details.
- Exact component interfaces and hook return types.
- CSS token values and detailed styling conventions.
- Test coverage targets.
- Specific Content Security Policy directives.
- Cloudflare Pages build configuration.

These details should be determined during implementation without unnecessarily reopening the architectural decisions documented here.

If implementation reveals a significant architectural problem or a better approach, document the change in a new ADR rather than silently changing the established direction.
