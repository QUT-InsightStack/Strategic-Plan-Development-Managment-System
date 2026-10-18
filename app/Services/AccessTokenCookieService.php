<?php

namespace App\Services;

use Symfony\Component\HttpFoundation\Cookie;

class AccessTokenCookieService
{
    public function make(string $token): Cookie
    {
        return cookie(
            'access_token',
            $token,
            (int) config('security.session_absolute_lifetime_minutes', 10080),
            '/',
            null,
            (bool) config('security.cookie.secure', false),
            true,
            false,
            'Lax'
        );
    }

    public function forget(): Cookie
    {
        return cookie(
            'access_token',
            '',
            -1,
            '/',
            null,
            (bool) config('security.cookie.secure', false),
            true,
            false,
            'Lax'
        );
    }
}