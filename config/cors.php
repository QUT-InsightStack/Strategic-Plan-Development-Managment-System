<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SPMS CORS Configuration
    |--------------------------------------------------------------------------
    | supports_credentials must be true for HttpOnly cookie-based JWT auth.
    | The frontend origin is read from .env — never hardcoded.
    |  '*' is deliberately not used anywhere in this config.
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
    ],

    'exposed_headers' => [],

    'max_age' => 86400,

    /*
    |--------------------------------------------------------------------------
    | supports_credentials
    |--------------------------------------------------------------------------
    | must be true for the browser to send HttpOnly cookies on cross-origin
    | requests. Without this, JWT cookie auth will silently fail — the browser
    | will refuse to attach cookies to the API request.
    */
    'supports_credentials' => true,

];
