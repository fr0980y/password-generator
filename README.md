# Password Generator

A lightweight, privacy-focused password generator built as an installable Progressive Web Application (PWA).

Password Generator provides a simple, convenient way to generate cryptographically secure passwords without relying on third-party password-generation websites, advertising, or remote services.

**Your passwords are yours. They never leave your device.**

## Features

### Password Generation
- Cryptographically secure random password generation using the browser's Web Crypto API.
- Configurable password length (8–128 characters).
- Selectable character categories:
  - Uppercase letters (A–Z)
  - Lowercase letters (a–z)
  - Numbers (0–9)
  - Symbols
- Option to exclude commonly confused characters.
- Option to require at least one character from each selected category.

### Convenience
- One-click password generation.
- One-click copying to the clipboard.
- Responsive interface designed for desktop and mobile devices.
- Automatically restores the most recently used generation settings.

### Privacy & Security
- Password generation happens entirely on the user's device.
- Generated passwords are never transmitted to a server.
- Generated passwords are never persisted by the application.
- Generation preferences are stored locally using browser local storage.
- No user accounts or authentication.
- No advertising, analytics, or tracking.
- Designed to operate entirely offline after initial installation or caching.

## Technology Stack

The application is built using modern web technologies:

- **Next.js** – Application framework.
- **React** – User interface.
- **TypeScript** – Type safety and maintainability.
- **Web Crypto API** – Cryptographically secure random-number generation.
- **Clipboard API** – Password copying.
- **localStorage** – Local persistence of generation preferences.
- **Progressive Web App (PWA)** – Installation and offline functionality.

No backend, database, or external password-generation service is required.

## Privacy by Design

Privacy is a fundamental design requirement rather than an optional feature.

The application follows several important principles:

1. Passwords are generated locally using the browser's cryptographically secure random-number generator.
2. Generated passwords are transient and are never saved by the application.
3. User preferences are stored locally on the device.
4. No generated passwords or configuration information are transmitted to external services.
5. No analytics, tracking, or advertising services are included.
6. Core functionality does not depend on an Internet connection once the application is cached.

The application does not manage clipboard contents or control how the operating system makes copied text available to other applications.

## Getting Started

### Prerequisites

- Node.js (LTS recommended).
- npm.
- A modern web browser.

### Installation

Clone the repository:

```bash
git clone https://github.com/fr0980y/password-generator.git
```

Navigate into the project directory:

```bash
cd password-generator
```

Install dependencies:

```bash
npm install
```

### Development

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The development server is for implementation and debugging. It does not reproduce the production static export or the generated Cloudflare Pages security headers.

### Production Static Export

Create the production static export and generated Cloudflare Pages headers:

```bash
npm run build
```

This writes the deployable static output to `out/` and generates `out/_headers`. It does not start an application server.

To preview an already-built export locally through the project's static-export server:

```bash
npm run preview
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in your browser.

The preview command reuses the static server used by the Playwright production-export tests. It is loopback-only, is intended for local verification, and is not the production hosting environment.

### Production Deployment

Deploy the contents and build process output to Cloudflare Pages. Cloudflare Pages is the production static host; no application server or backend is required.

## Project Status

**Status: In Development**

This project is being developed as a portfolio demonstration of modern JavaScript application development, privacy-conscious architecture, browser APIs, and offline-first Progressive Web Applications.

The initial release focuses exclusively on password generation.

### Planned Future Enhancements

Potential future additions include:

- Passphrase generator.
- PIN generator.
- Random string generator.

These features are outside the scope of the initial release.

## License

To be determined.
