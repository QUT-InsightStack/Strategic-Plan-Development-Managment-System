<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>Log In | Strategic Planning Management System</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <div class="login-shell" data-login-page>
        <header class="app-header" aria-label="Application header">
            <a class="brand" href="/" aria-label="Strategic Planning Management System home">
                <img class="brand-logo" src="{{ Vite::asset('resources/images/logo.png') }}" alt="Strategic Planning Management System logo">
                <span class="brand-name">Strategic Planning Management System</span>
            </a>

            <nav class="top-nav" aria-label="Primary navigation">
                <button class="nav-link" type="button" data-message="Help resources are not connected yet.">Help</button>
                <button class="nav-link" type="button" data-message="Contact details will be provided by the system administrator.">Contact</button>
                <button class="nav-link" type="button" data-message="Support access is available for assigned users.">Support</button>
            </nav>
        </header>

        <main class="login-main">
            <section class="access-intro" aria-labelledby="access-title">
                <div class="access-icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64" role="img">
                        <path d="M16 10h22a6 6 0 0 1 6 6v18a16 16 0 0 0-8-2V16H16v34h13a16 16 0 0 0 4 8H16a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z"/>
                        <path d="M23 20h8v8h-8zM23 34h8v8h-8zM16 22h4v4h-4zM16 36h4v4h-4z"/>
                        <path d="M45 36a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm6.8 9.9-7.5 8.2a2 2 0 0 1-2.9.1l-4.1-4.1 2.8-2.8 2.6 2.6 6.1-6.7 3 2.7Z"/>
                    </svg>
                </div>
                <h1 id="access-title">Access the Strategic Planning Management System</h1>
                <p>For account access,<br>please contact your system administrator.</p>
            </section>

            <section class="login-card" aria-labelledby="signin-title">
                <div class="card-heading">
                    <h2 id="signin-title">Sign In</h2>
                    <p>Please sign in to continue...</p>
                </div>

                <form class="login-form" novalidate data-login-form>
                    <div class="field-group">
                        <label for="userAccount">User account</label>
                        <input
                            id="userAccount"
                            name="userAccount"
                            type="text"
                            autocomplete="username"
                            placeholder="Please sign in to continue..."
                            data-user-input
                        >
                        <p class="field-error" data-error-for="userAccount"></p>
                    </div>

                    <div class="field-group">
                        <label for="password">Password</label>
                        <div class="password-field">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autocomplete="current-password"
                                placeholder="Enter your password."
                                data-password-input
                            >
                            <button class="icon-button" type="button" aria-label="Show password" data-toggle-password>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 5c5.1 0 8.6 4.6 9.8 6.5a1 1 0 0 1 0 1C20.6 14.4 17.1 19 12 19s-8.6-4.6-9.8-6.5a1 1 0 0 1 0-1C3.4 9.6 6.9 5 12 5Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/>
                                </svg>
                            </button>
                        </div>
                        <p class="field-error" data-error-for="password"></p>
                    </div>

                    <div class="form-options">
                        <label class="remember-option">
                            <input type="checkbox" name="remember" data-remember-input>
                            <span>Remember Me</span>
                        </label>
                        <button class="text-button" type="button" data-forgot-password>Forgot Password?</button>
                    </div>

                    <button class="signin-button" type="submit" data-submit-button>Sign in</button>

                    <p class="form-status" role="status" aria-live="polite" data-form-status></p>

                    <p class="access-note">
                        Access is granted based on the user's assigned role and permissions.
                    </p>
                </form>
            </section>
        </main>

        <footer class="app-footer">
            <span>&copy; 2026 Strategic Planning Management System</span>
            <a href="#" data-message="Privacy Notice content is not connected yet.">Privacy Notice</a>
            <a href="#" data-message="Terms of Use content is not connected yet.">Terms of Use</a>
            <a href="#" data-message="Accessibility information is not connected yet.">Accessibility</a>
        </footer>
    </div>
</body>
</html>
