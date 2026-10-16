<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategic Planning Management System</title>
    <meta name="description" content="Plan, align and monitor strategic priorities in one place.">
    @vite(['resources/css/landing.css'])
</head>
<body>
    <a class="skip-link" href="#main">Skip to main content</a>

    <div class="landing-shell">
        <header class="app-header" aria-label="Site header">
            <a class="brand" href="{{ url('/') }}" aria-label="Strategic Planning Management System home">
                <x-brand-logo />
                <span class="brand-name">Strategic Planning Management System</span>
            </a>
            <nav class="top-nav" aria-label="Primary navigation">
                <a class="nav-link" href="#features">Features</a>
                <a class="nav-link" href="#how-it-works">How it works</a>
                <a class="nav-link" href="#roles">Who uses it</a>
                <a class="nav-link nav-link--login" href="{{ route('login') }}">Log in</a>
            </nav>
        </header>

        <main id="main">
            <section class="hero" aria-labelledby="hero-title">
                <div class="hero-inner">
                    <div class="hero-copy">
                        <p class="eyebrow">Official planning portal</p>
                        <h1 id="hero-title">Plan, align and monitor strategic priorities in one place</h1>
                        <p class="hero-lead">
                            The Strategic Planning Management System guides each strategic plan from first draft
                            to approval and progress reporting, keeping objectives aligned with national
                            development priorities.
                        </p>
                        <div class="hero-actions">
                            <a class="ui-button ui-button--primary hero-button" href="{{ route('login') }}">Log in to the system</a>
                            <a class="ui-button ui-button--secondary hero-button" href="#how-it-works">See how it works</a>
                        </div>
                        <p class="hero-note">Access is limited to authorised government users.</p>
                    </div>

                    <aside class="cycle-card" aria-labelledby="cycle-title">
                        <h2 id="cycle-title">The planning cycle</h2>
                        <ol class="cycle-list">
                            <li><span class="cycle-dot" aria-hidden="true"></span><div><strong>Draft</strong><span>Mission, vision, values and objectives</span></div></li>
                            <li><span class="cycle-dot" aria-hidden="true"></span><div><strong>Align</strong><span>Map objectives to national priorities</span></div></li>
                            <li><span class="cycle-dot" aria-hidden="true"></span><div><strong>Consult</strong><span>Collect and consolidate office inputs</span></div></li>
                            <li><span class="cycle-dot" aria-hidden="true"></span><div><strong>Approve</strong><span>Management review and decision</span></div></li>
                            <li><span class="cycle-dot" aria-hidden="true"></span><div><strong>Monitor</strong><span>Track progress and report results</span></div></li>
                        </ol>
                    </aside>
                </div>
            </section>

            <section id="features" class="section" aria-labelledby="features-title">
                <div class="section-inner">
                    <header class="section-heading">
                        <h2 id="features-title">What the system does</h2>
                        <p>One shared workspace for planning officers, offices and management.</p>
                    </header>
                    <div class="feature-grid">
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12v2h8v-2H8Zm0 4v2h5v-2H8Z"/></svg>
                            </span>
                            <h3>Draft strategic plans</h3>
                            <p>Define the mission, vision, core values and strategic objectives of each plan from a guided overview.</p>
                        </article>
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                            </span>
                            <h3>Align with national priorities</h3>
                            <p>Map objectives to PDP chapters and Presidential Agenda items so every plan supports national goals.</p>
                        </article>
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1v-1c0-1.8-.7-3.4-1.9-4.6 3 .3 5.4 2.2 5.4 4.6v1h-3.5Z"/></svg>
                            </span>
                            <h3>Collect office inputs</h3>
                            <p>Offices and units contribute to assigned objectives, and planners consolidate the inputs into the plan.</p>
                        </article>
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M3 3h2v16h16v2H3V3Zm15.3 3.3 1.4 1.4-6.2 6.2-3-3-3.8 3.8-1.4-1.4 5.2-5.2 3 3 4.8-4.8Z"/></svg>
                            </span>
                            <h3>Review and monitor</h3>
                            <p>Management reviews submitted plans, records decisions and follows progress through dashboards and reports.</p>
                        </article>
                    </div>
                </div>
            </section>

            <section id="how-it-works" class="section section--tinted" aria-labelledby="steps-title">
                <div class="section-inner">
                    <header class="section-heading">
                        <h2 id="steps-title">How it works</h2>
                        <p>Each plan follows the same clear path from preparation to reporting.</p>
                    </header>
                    <ol class="step-list">
                        <li class="step">
                            <span class="step-number" aria-hidden="true">1</span>
                            <h3>Prepare references</h3>
                            <p>Administrators maintain the reference data and templates that plans are built on.</p>
                        </li>
                        <li class="step">
                            <span class="step-number" aria-hidden="true">2</span>
                            <h3>Build the plan</h3>
                            <p>Planning officers create the draft, its objectives and their mappings.</p>
                        </li>
                        <li class="step">
                            <span class="step-number" aria-hidden="true">3</span>
                            <h3>Consolidate inputs</h3>
                            <p>Offices respond to assigned objectives and planners bring the inputs together.</p>
                        </li>
                        <li class="step">
                            <span class="step-number" aria-hidden="true">4</span>
                            <h3>Submit and approve</h3>
                            <p>Ready plans go to management for review, comments and a final decision.</p>
                        </li>
                        <li class="step">
                            <span class="step-number" aria-hidden="true">5</span>
                            <h3>Monitor progress</h3>
                            <p>Approved plans are tracked and reported on through the planning period.</p>
                        </li>
                    </ol>
                </div>
            </section>

            <section id="roles" class="section" aria-labelledby="roles-title">
                <div class="section-inner">
                    <header class="section-heading">
                        <h2 id="roles-title">Who uses it</h2>
                        <p>Each role sees the tools and records that match its responsibilities.</p>
                    </header>
                    <ul class="role-grid">
                        <li class="role-card"><h3>Planning Officer</h3><p>Creates and manages strategic plans and their objectives.</p></li>
                        <li class="role-card"><h3>Office / Unit</h3><p>Provides inputs on the objectives assigned to the office.</p></li>
                        <li class="role-card"><h3>Management</h3><p>Reviews plans, makes decisions and follows overall progress.</p></li>
                        <li class="role-card"><h3>Administrative Admin</h3><p>Maintains reference data, templates and plans across creators.</p></li>
                        <li class="role-card"><h3>Technical Admin</h3><p>Manages users, roles, system settings and audit records.</p></li>
                    </ul>
                </div>
            </section>

            <section class="access-band" aria-labelledby="access-title">
                <div class="access-band-inner">
                    <div>
                        <h2 id="access-title">Ready to continue your work?</h2>
                        <p>Sign in with your government account. For a new account, please contact your system administrator.</p>
                    </div>
                    <a class="ui-button access-button" href="{{ route('login') }}">Log in</a>
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
                <h3>Explore</h3>
                <ul>
                    <li><a href="#features">Features</a></li>
                    <li><a href="#how-it-works">How it works</a></li>
                    <li><a href="#roles">Who uses it</a></li>
                </ul>
            </div>
            <div class="footer-column">
                <h3>Account</h3>
                <ul>
                    <li><a href="{{ route('login') }}">Log in</a></li>
                    <li><a href="{{ route('forgot-password') }}">Forgot password</a></li>
                    <li><span>Version 1.0</span></li>
                </ul>
            </div>
        </footer>
    </div>
</body>
</html>
