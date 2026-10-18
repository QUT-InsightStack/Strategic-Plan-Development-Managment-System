<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class JwtCookieMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        Log::debug('JWT cookie diagnostic', [
            'raw_cookie_header' => $request->header('Cookie'),
            'parsed_cookie_present' => $request->cookie('access_token') !== null,
            'authorization_present' => $request->hasHeader('Authorization'),
        ]);
     
        
        $token = $request->cookie('access_token');

        if (
            is_string($token)
            && $token !== ''
            && ! $request->hasHeader('Authorization')
        ) {
            $request->headers->set(
                'Authorization',
                'Bearer ' . $token
            );
        }

        return $next($request);
    }
}