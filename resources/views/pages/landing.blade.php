<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome | Strategic Planning Management System</title>
    <meta name="description" content="DOST internal work platform for preparing, aligning and monitoring strategic plans.">
    @vite(['resources/css/landing.css'])
</head>
<body>
    <a class="skip-link" href="#main">Skip to main content</a>

    <div class="landing-shell">
        <div class="gov-strip">
            <span>Republic of the Philippines</span>
            <span class="gov-strip__divider" aria-hidden="true"></span>
            <span>Department of Science and Technology</span>
        </div>

        <header class="app-header" aria-label="Site header">
            <a class="brand" href="{{ url('/') }}" aria-label="Strategic Planning Management System home">
                <x-brand-logo />
                <span class="brand-name">Strategic Planning Management System</span>
            </a>
            <nav class="top-nav" aria-label="Primary navigation">
                <a class="nav-link" href="#features">Features</a>
                <a class="nav-link nav-link--login" href="{{ route('login') }}">Sign in</a>
            </nav>
        </header>

        <main id="main">
            <section class="hero" aria-labelledby="hero-title">
                <div class="hero-inner">
                    <div class="hero-copy">
                        <p class="eyebrow">DOST Internal Work Platform</p>
                        <h1 id="hero-title">Strategic Planning Management System</h1>
                        <p class="hero-tagline">Aligned, Accountable and Transparent Planning</p>
                        <p class="hero-lead">
                            Prepare strategic plans, align objectives with national development priorities,
                            consolidate office inputs and monitor progress, all in one secure workspace.
                        </p>
                        <div class="hero-actions">
                            <a class="ui-button ui-button--primary hero-button" href="{{ route('login') }}">
                                Sign in
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.3 5.3 20 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.2l-4.3-4.3 1.4-1.4Z"/></svg>
                            </a>
                            <a class="ui-button ui-button--secondary hero-button" href="#features">Learn more</a>
                        </div>
                        <p class="hero-note">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"/></svg>
                            For authorised DOST personnel only. For account access, contact your system administrator.
                        </p>
                    </div>

                    <div class="hero-visual">
                        @include('pages.partials.landing-illustration')
                    </div>
                </div>
            </section>

            <section id="features" class="features" aria-labelledby="features-title">
                <h2 id="features-title" class="visually-hidden">What the system does</h2>
                <div class="feature-grid">
                    <article class="feature-card">
                        <span class="feature-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12v2h8v-2H8Zm0 4v2h5v-2H8Z"/></svg>
                        </span>
                        <div>
                            <h3>Draft strategic plans</h3>
                            <p>Mission, vision, core values and objectives in one guided overview.</p>
                        </div>
                    </article>
                    <article class="feature-card">
                        <span class="feature-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                        </span>
                        <div>
                            <h3>Align with national priorities</h3>
                            <p>Map objectives to PDP chapters and the Presidential Agenda.</p>
                        </div>
                    </article>
                    <article class="feature-card">
                        <span class="feature-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1v-1c0-1.8-.7-3.4-1.9-4.6 3 .3 5.4 2.2 5.4 4.6v1h-3.5Z"/></svg>
                        </span>
                        <div>
                            <h3>Collect office inputs</h3>
                            <p>Offices contribute to assigned objectives and planners consolidate them.</p>
                        </div>
                    </article>
                    <article class="feature-card">
                        <span class="feature-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M3 3h2v16h16v2H3V3Zm15.3 3.3 1.4 1.4-6.2 6.2-3-3-3.8 3.8-1.4-1.4 5.2-5.2 3 3 4.8-4.8Z"/></svg>
                        </span>
                        <div>
                            <h3>Review and monitor</h3>
                            <p>Management approves plans and follows progress through reports.</p>
                        </div>
                    </article>
                </div>
            </section>
        </main>

        <footer class="app-footer">
            <div class="footer-brand">
                <x-brand-logo class="footer-logo" />
            </div>
            <div class="footer-column">
                <h3>System</h3>
                <ul>
                    <li><span>Strategic Planning Management System</span></li>
                    <li><span>For internal government use only</span></li>
                </ul>
            </div>
            <div class="footer-column">
                <h3>Agency</h3>
                <ul>
                    <li><span>Department of Science and Technology</span></li>
                    <li><span>Republic of the Philippines</span></li>
                </ul>
            </div>
            <div class="footer-column">
                <h3>Account</h3>
                <ul>
                    <li><a href="{{ route('login') }}">Sign in</a></li>
                    <li><a href="{{ route('forgot-password') }}">Forgot password</a></li>
                    <li><span>Version 1.0</span></li>
                </ul>
            </div>
        </footer>
    </div>
</body>
</html>
