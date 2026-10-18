<?php

return [
    'session_absolute_lifetime_minutes' => 10080,

    'login_lockout_minutes' => 15,

    'login_failure_window_minutes' => 15,

    'blocked_passwords' => [
        'password',
        'password123',
        'password123456789',
        '123456789012345',
        '12345678901234567890',
        'qwertyuiopasdfgh',
        'administrator123',
        'letmeinletmeinletmein',
        'thisisapassword',
        'thisisapassword123',
    ],

    /*
     * Used only for missing-user timing mitigation, not a real account.
     * A bcrypt hash is checked with password_verify independently of the
     * configured account hash driver.
     */
    'dummy_password_hash' =>
        '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi',

    'cookie' => [
        'secure' => env('JWT_COOKIE_SECURE', env('APP_ENV') === 'production'),
    ],

    /*
     * exact trusted origins for cookie-authenticated state-changing calls.
     * Set FRONTEND_URL when React/Vite uses another origin.
     */
    'trusted_origins' => array_values(array_filter([
        env('APP_URL'),
        env('FRONTEND_URL'),
    ])),
];