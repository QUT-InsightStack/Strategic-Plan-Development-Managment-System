<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome | Strategic Plan Development Management System</title>
    <meta name="description" content="DOST internal work platform for preparing, aligning and monitoring strategic plans.">
    @vite(['resources/css/landing.css'])
</head>
<body>
    <a class="skip-link" href="#main">Skip to main content</a>

    <div class="landing-shell">
        <header class="app-header" aria-label="Site header">
            <a class="brand" href="{{ url('/') }}" aria-label="Strategic Plan Development Management System home">
                <x-brand-logo />
                <span class="brand-name">Strategic Plan Development Management System</span>
            </a>
            <nav class="top-nav" aria-label="Primary navigation">
                <a class="nav-link nav-link--login" href="{{ route('login') }}">Sign in</a>
            </nav>
        </header>

        <main id="main">
            <section class="hero" aria-labelledby="hero-title">
                <div class="hero-inner">
                    <div class="hero-copy">
                        <p class="eyebrow">DOST Internal Work Platform</p>
                        <h1 id="hero-title">Strategic Plan Development Management System</h1>
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

        </main>

        <footer class="app-footer">
            <div class="footer-brand">
                <x-brand-logo class="footer-logo" />
            </div>
            <div class="footer-column">
                <h3>System</h3>
                <ul>
                    <li><span>Strategic Plan Development Management System</span></li>
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
