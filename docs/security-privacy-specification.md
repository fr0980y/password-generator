# Security & Privacy Specification

**Project:** Password Generator  
**Document Version:** 1.0  
**Status:** Proposed  
**Last Updated:** November 20, 2026

## 1. Purpose

This document defines the security and privacy requirements for the Password Generator application.

The application's primary security objective is to generate cryptographically secure passwords locally without transmitting or persistently storing generated passwords.

This specification establishes:

- Security and privacy principles.
- Sensitive data classification.
- Application trust boundaries.
- Threat considerations.
- Security requirements.
- Browser API handling requirements.
- Dependency and supply-chain considerations.
- Security verification procedures.
- Privacy communication requirements.

This document complements the Functional Requirements, Architecture, Architecture Decisions, Implementation Plan, and Test Plan.

## 2. Security and Privacy Objectives

The application is built around one central principle:

**Your passwords are yours. They never leave your device.**

The following objectives support that principle.

### 2.1 Local Password Generation

All password generation must occur within the user's browser.

The application must never send generated passwords to:

- An application server.
- A third-party password-generation service.
- An analytics provider.
- A logging service.
- Any other external service.

### 2.2 Cryptographically Secure Randomness

Password generation must use the browser's Web Crypto API.

The application must not use `Math.random()` or another insecure random-number source for password generation or shuffling.

### 2.3 No Application-Managed Password Persistence

The application must not persist generated passwords.

Passwords must not be written to:

- localStorage.
- sessionStorage.
- IndexedDB.
- Cache Storage.
- Cookies.
- Application-managed files.
- Any other application-managed persistent storage.

### 2.4 Minimal Data Collection

The application does not require user accounts, personal information, or application telemetry.

It must not implement:

- Account registration.
- Authentication.
- Analytics.
- Tracking.
- Advertising.
- Cloud synchronization.
- User profiling.
- Password history.

### 2.5 Transparent Privacy Communication

Users should be able to understand:

- Where passwords are generated.
- What information the application stores.
- What information it does not store.
- What happens when they copy a password.
- What offline operation means.
- What limitations remain outside the application's control.

---

## 3. Data Classification

The application handles very little information.

The following classification establishes how each type of information must be treated.

| Data | Classification | Handling |
|---|---|---|
| Generated password | Highly sensitive | Memory only; never persist or transmit |
| Password configuration | Non-sensitive preference | May persist locally |
| Application version | Public | May be displayed |
| Application static assets | Public | May be cached |
| Clipboard contents | Sensitive, externally managed | Write only after explicit user action |
| Browser environment information | Not intentionally collected | Do not collect for analytics or tracking |

### 3.1 Generated Passwords

Generated passwords are the application's most sensitive data.

They must:

- Exist only as necessary for application operation.
- Remain within the browser's execution environment.
- Never be written to application-managed persistent storage.
- Never be transmitted over the network.
- Never appear in console output, error messages, or diagnostics.
- Never be included in automated test reports or screenshots.

The application should retain only the currently displayed password in application memory.

When a new password is generated successfully, the previous password should be replaced.

The application should not implement password history, password recovery, or password restoration.

### 3.2 Configuration Preferences

Password configuration is not considered sensitive information.

The following values may be stored locally:

- Password length.
- Uppercase enabled/disabled.
- Lowercase enabled/disabled.
- Numbers enabled/disabled.
- Symbols enabled/disabled.
- Ambiguous-character exclusion.
- Required-category enforcement.

No other user information is necessary for the MVP.

---

## 4. Trust Boundaries

The application operates within several environments with different security responsibilities.

### 4.1 Application Boundary

The application's own code controls:

- Password generation.
- Password configuration.
- In-memory application state.
- Preference persistence.
- Clipboard write requests.
- User interface behavior.
- Service worker configuration.

The application must enforce the security requirements within these areas.

### 4.2 Browser Boundary

The browser provides:

- JavaScript execution.
- Web Crypto.
- localStorage.
- Clipboard API.
- Service workers.
- Cache Storage.
- HTTPS security context enforcement.

The application depends on browser security controls but cannot independently guarantee that the browser or operating system is free from compromise.

### 4.3 Operating System Boundary

The operating system manages the system clipboard and may expose clipboard contents to other applications or services.

Once a password is copied, the application cannot control:

- How long clipboard contents remain available.
- Whether clipboard history is enabled.
- Whether another application reads clipboard contents.
- Whether the operating system synchronizes clipboard contents.
- Whether clipboard contents are otherwise retained externally.

The application must communicate this distinction honestly.

### 4.4 Hosting and Delivery Boundary

Cloudflare Pages and the associated delivery infrastructure provide the application's static assets over HTTPS.

The hosting platform is responsible for delivering the application.

It does not need to receive generated passwords or application configuration.

Application delivery and update requests are expected network activity and must be distinguished from password transmission.

---

## 5. Threat Considerations

The application is intentionally small, but it still has meaningful security considerations.

### 5.1 Insecure Randomness

**Threat:** Passwords are generated using predictable or insufficiently random values.

**Mitigation:**

- Use `crypto.getRandomValues()`.
- Implement rejection sampling.
- Use cryptographically secure shuffling.
- Prohibit `Math.random()` for password generation.
- Fail safely if Web Crypto is unavailable.

### 5.2 Accidental Password Persistence

**Threat:** A password is unintentionally saved through browser storage, caching, logging, or application diagnostics.

**Mitigation:**

- Keep generated passwords out of persistence services.
- Restrict settings storage to configuration data.
- Do not cache generated password content.
- Avoid logging password values.
- Review browser storage and application network activity during testing.

### 5.3 Accidental Password Transmission

**Threat:** Passwords are transmitted through analytics, external services, application APIs, or unexpected network requests.

**Mitigation:**

- Do not implement backend password-generation services.
- Do not include analytics or tracking.
- Avoid unnecessary external runtime dependencies.
- Verify that password generation and configuration changes produce no network requests.
- Review the application's Content Security Policy.

### 5.4 Malicious or Compromised Dependencies

**Threat:** A third-party dependency introduces malicious code or behavior that exposes generated passwords.

**Mitigation:**

- Minimize runtime dependencies.
- Prefer established packages with clear maintenance histories.
- Review dependency changes.
- Keep dependencies updated.
- Monitor known vulnerabilities.
- Avoid unnecessary third-party runtime services.

### 5.5 Cross-Site Scripting

**Threat:** Malicious script execution accesses application memory and potentially reads generated passwords.

**Mitigation:**

- Avoid unsafe HTML injection.
- Use React's standard escaping behavior.
- Avoid rendering untrusted HTML.
- Configure an appropriate Content Security Policy.
- Review third-party scripts and dependencies.
- Avoid unnecessary external script sources.

A compromised application script can access the same execution environment as the password generator. Therefore, preventing unauthorized script execution is particularly important.

### 5.6 Clipboard Exposure

**Threat:** A copied password becomes accessible to clipboard history, other applications, or operating-system synchronization.

**Mitigation:**

- Only write to the clipboard after explicit user interaction.
- Never read clipboard contents.
- Never persist clipboard contents in application storage.
- Clearly explain that clipboard management is outside the application's control.

### 5.7 Service Worker and Cache Exposure

**Threat:** Sensitive content is accidentally included in cached requests or responses.

**Mitigation:**

- Cache only intended application resources.
- Do not persist generated passwords in Cache Storage.
- Avoid unnecessary network request caching.
- Review service worker behavior and cache contents.
- Verify update and cache invalidation behavior.

### 5.8 Compromised Browser or Device

**Threat:** Malware, browser extensions, malicious applications, or a compromised operating system access passwords displayed or copied by the user.

**Mitigation:**

The application cannot fully prevent this category of compromise.

It should minimize unnecessary exposure and clearly communicate that local generation does not protect against an already-compromised device or browser.

---

## 6. Cryptographic Requirements

### 6.1 Random Number Generation

All random values used in password generation must originate from the Web Crypto API.

The implementation must use:

```ts
crypto.getRandomValues()
```

The application must not use:

```ts
Math.random()
```

for any security-sensitive generation or shuffling operation.

### 6.2 Rejection Sampling

Character selection must avoid modulo bias.

The implementation must reject random values outside the acceptable range rather than simply applying modulo arithmetic to every random value.

### 6.3 Required Character Categories

When category enforcement is enabled:

1. Select at least one character from every enabled category.
2. Fill the remaining password positions from the combined selected character pool.
3. Shuffle the completed password using cryptographically secure randomness.

### 6.4 Secure Shuffling

The final password must be shuffled using cryptographically secure random values.

The implementation must not rely on insecure random comparators or `Math.random()`-based sorting techniques.

### 6.5 Failure Behavior

If Web Crypto is unavailable or fails:

- Password generation must fail.
- The application must not fall back to insecure randomness.
- The existing displayed password must remain unchanged.
- The user must receive an understandable error.
- Generation controls must reflect the unavailable functionality.

---

## 7. Browser Storage Requirements

### 7.1 localStorage

The application may use localStorage exclusively for password configuration preferences.

The stored structure must be versioned.

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

### 7.2 Storage Validation

Persisted values must be validated before use.

The application must handle:

- Missing data.
- Corrupt JSON.
- Missing properties.
- Unexpected data types.
- Invalid configuration values.
- Unsupported schema versions.
- Storage access failures.

Invalid data must never be allowed to bypass normal configuration validation.

### 7.3 Storage Failure

When localStorage is unavailable:

- The application must continue operating in memory.
- Password generation must remain available if Web Crypto is available.
- Settings must remain usable during the current session.
- The required persistent warning must be displayed.

The application must not attempt to work around storage restrictions by silently introducing another persistent storage mechanism.

---

## 8. Clipboard Requirements

### 8.1 Explicit User Action

Clipboard writes must occur only in response to an explicit user action.

The application must not automatically copy generated passwords.

### 8.2 Clipboard API

Use the browser Clipboard API through the dedicated clipboard service.

Clipboard functionality should operate in secure contexts where supported.

### 8.3 Clipboard Failure

When copying fails:

- The application must not crash.
- The password must remain displayed.
- The user must receive an understandable error.
- Manual selection and copying must remain possible.

### 8.4 Clipboard Limitations

The application must not claim to:

- Clear clipboard history.
- Control clipboard retention.
- Prevent other applications from reading copied content.
- Prevent operating-system clipboard synchronization.

---

## 9. Network and External Communication Requirements

### 9.1 No Password Transmission

Generated passwords must never be included in network requests.

Password generation must not require a network connection.

### 9.2 No Backend

The MVP must not introduce:

- Application API endpoints.
- Server-side password generation.
- User authentication.
- Databases.
- Cloud storage.
- Password synchronization.

### 9.3 No Analytics or Tracking

The application must not include:

- Analytics scripts.
- Tracking pixels.
- Advertising networks.
- User profiling.
- Behavioral telemetry.
- Third-party monitoring that collects user activity.

### 9.4 External Runtime Requests

The application should avoid external runtime requests that are not required for its operation.

Application resources should be served from the application's own deployment origin.

Normal static asset delivery and application update requests are permitted.

---

## 10. Content Security Policy

The application should implement a restrictive Content Security Policy appropriate for its static hosting and client-side architecture.

The policy should:

- Restrict script sources.
- Restrict connection destinations.
- Restrict object embedding.
- Restrict frame embedding.
- Restrict base URL manipulation.
- Restrict form submission destinations where appropriate.
- Avoid unnecessary inline script permissions.
- Avoid broad wildcard source allowances.

The final policy must be tested against the actual Next.js and Serwist output.

Do not introduce CSP directives that unnecessarily break application functionality.

Where practical, configure security headers through the hosting platform because static export does not provide a running Next.js server to apply runtime headers.

---

## 11. Dependency and Supply-Chain Security

Third-party dependencies introduce potential security and privacy risks.

The project should maintain a minimal dependency footprint.

### Requirements

- Review dependencies before adding them.
- Prefer packages with active maintenance and established usage.
- Avoid packages that introduce unnecessary network communication.
- Review transitive dependencies where practical.
- Monitor known vulnerabilities.
- Apply security updates in a timely manner.
- Avoid unnecessary runtime dependencies.
- Keep development-only dependencies separate from production dependencies.

### Dependency Review

Before adding a new production dependency, consider:

1. Is it necessary?
2. Does the browser already provide the required functionality?
3. Does it introduce external runtime communication?
4. Does it process or retain generated passwords?
5. Is it actively maintained?
6. Is its dependency footprint reasonable?
7. Does it introduce avoidable security risk?

A dependency should not be added simply because it is convenient when a small, well-tested native implementation is sufficient.

---

## 12. Progressive Web App Security

The PWA implementation must preserve the application's security and privacy guarantees.

### Requirements

- Serve the application over HTTPS.
- Cache only required application resources.
- Do not cache generated passwords.
- Do not cache clipboard contents.
- Avoid caching sensitive responses.
- Keep service worker scope limited to the application.
- Use an appropriate update strategy.
- Verify cache invalidation behavior.
- Avoid unnecessary external network dependencies.

The service worker should not intercept or persist sensitive user-generated content.

---

## 13. Error Handling and Diagnostics

Errors must be handled without exposing sensitive information.

### Requirements

- Do not log generated passwords.
- Do not include passwords in exception messages.
- Do not include passwords in validation output.
- Do not include passwords in diagnostic reports.
- Do not expose sensitive application state in recovery interfaces.
- Keep expected operational failures separate from unexpected rendering failures.

The React Error Boundary should display a generic recovery message rather than exposing internal error details.

The application must not introduce external error-reporting services.

---

## 14. Memory and Password Lifecycle

Generated passwords should remain in application memory only as long as needed for the current application experience.

### Requirements

- Maintain only the currently displayed password.
- Replace the previous password after successful generation.
- Preserve the previous password when generation fails.
- Do not maintain a password history.
- Do not retain previous passwords in hidden component state.
- Do not persist passwords across reloads.
- Do not attempt to restore previously generated passwords.

JavaScript strings cannot be reliably or securely zeroed from memory, and garbage collection is managed by the runtime.

The application should therefore avoid making guarantees about immediate memory erasure.

Closing or reloading the application ends the application's ability to restore its previous displayed password, but cannot guarantee that every copy of the underlying data has been immediately erased from device memory.

---

## 15. Privacy Disclosure Requirements

The About/Privacy section must communicate the following information clearly.

### What the Application Does

- Generates passwords locally on the user's device.
- Uses the browser's Web Crypto API.
- Saves password-generation preferences locally.
- Supports offline operation after required resources have been cached.

### What the Application Does Not Do

- Transmit generated passwords.
- Store generated passwords.
- Maintain password history.
- Require user accounts.
- Synchronize passwords or preferences through a cloud service.
- Use advertising.
- Use analytics or tracking.

### Clipboard Disclosure

The application copies passwords to the operating system clipboard only when requested.

The application cannot control clipboard history, retention, or access by other applications.

### Browser and Device Disclosure

Local generation does not protect against compromised browsers, malicious extensions, malware, or other software that can access the browser or device.

The privacy disclosure should communicate these limitations without unnecessarily alarming users.

---

## 16. Security Verification

Security requirements must be verified through implementation review and testing.

The following checklist should be completed before the initial production release.

### Password Generation

- [ ] Web Crypto is used for all security-sensitive randomness.
- [ ] `Math.random()` is not used for generation or shuffling.
- [ ] Rejection sampling is implemented correctly.
- [ ] Secure shuffling is implemented correctly.
- [ ] Invalid configurations are rejected.
- [ ] Generation failures do not produce partial passwords.
- [ ] No insecure fallback exists.

### Password Storage

- [ ] Passwords are not written to localStorage.
- [ ] Passwords are not written to sessionStorage.
- [ ] Passwords are not written to IndexedDB.
- [ ] Passwords are not written to Cache Storage.
- [ ] Passwords are not written to cookies.
- [ ] No password history exists.
- [ ] Only approved configuration preferences are persisted.

### Network Communication

- [ ] Password generation requires no network request.
- [ ] Configuration changes require no network request.
- [ ] Clipboard operations do not transmit passwords.
- [ ] No analytics or tracking requests occur.
- [ ] No advertising requests occur.
- [ ] No unnecessary external runtime requests occur.

### Browser APIs

- [ ] Clipboard access requires explicit user interaction.
- [ ] Clipboard contents are never read by the application.
- [ ] Storage failures are handled safely.
- [ ] Web Crypto failures are handled safely.
- [ ] Browser-only APIs execute in appropriate client contexts.

### PWA and Hosting

- [ ] HTTPS is enabled.
- [ ] Service worker caching is reviewed.
- [ ] Sensitive information is not cached.
- [ ] Update behavior is verified.
- [ ] Content Security Policy is configured and tested.
- [ ] Deployment security headers are reviewed.

### Dependencies and Diagnostics

- [ ] Production dependencies have been reviewed.
- [ ] Known vulnerabilities have been addressed or evaluated.
- [ ] No unnecessary external monitoring is present.
- [ ] Generated passwords are absent from logs.
- [ ] Error messages do not expose passwords.

---

## 17. Security Limitations and Explicit Non-Goals

The application is designed to minimize exposure of generated passwords, but it is not a complete security boundary for a compromised device.

The application cannot guarantee protection against:

- Malware.
- Malicious browser extensions.
- Compromised browsers.
- Compromised operating systems.
- Keyloggers or screen-capture software.
- Other applications with access to clipboard contents.
- Physical access to an unlocked device.
- Malicious or compromised application delivery infrastructure.

The application also does not attempt to:

- Manage stored passwords.
- Evaluate whether generated passwords have been compromised elsewhere.
- Authenticate users.
- Secure other applications.
- Provide encrypted cloud synchronization.
- Replace a dedicated password manager.

These limitations are intentional and consistent with the scope of the MVP.

---

## 18. Security Acceptance Criteria

The application is considered compliant with this specification when:

- [ ] Password generation occurs entirely within the browser.
- [ ] Cryptographically secure randomness is used.
- [ ] Modulo bias is avoided through rejection sampling.
- [ ] Passwords are never transmitted.
- [ ] Passwords are never persisted by the application.
- [ ] Only approved configuration preferences are stored.
- [ ] Clipboard operations occur only after explicit user action.
- [ ] Browser API failures are handled safely.
- [ ] No analytics, tracking, or advertising is present.
- [ ] Third-party dependencies have been reviewed.
- [ ] Service worker caching does not expose passwords.
- [ ] Content Security Policy and deployment security headers have been reviewed.
- [ ] Passwords are excluded from logs and diagnostics.
- [ ] Privacy disclosures accurately describe application behavior and limitations.
- [ ] All critical security verification tasks have been completed.

---

## 19. Document Maintenance

This specification should be reviewed when:

- New browser APIs are introduced.
- New dependencies are added.
- Persistence behavior changes.
- PWA caching behavior changes.
- External services are considered.
- Password handling changes.
- Hosting or deployment architecture changes.
- New security or privacy requirements are identified.

Any change that weakens an established privacy guarantee must be explicitly evaluated and documented before implementation.

Significant architectural changes should be recorded in a new Architecture Decision Record.

---

## 20. Document Relationships

This specification complements:

- `product-requirements.md`
- `functional-requirements.md`
- `architecture.md`
- `architecture-decisions.md`
- `implementation-plan.md`
- `ui-ux-specification.md`
- `test-plan.md`

The Product Requirements document establishes the privacy-first product principles.

The Functional Requirements document defines the required application behavior.

The Architecture documents establish the technical implementation.

The Implementation Plan defines the development sequence.

The Test Plan defines how application behavior is verified.

This document establishes the security and privacy requirements that must be preserved throughout implementation and maintenance.
