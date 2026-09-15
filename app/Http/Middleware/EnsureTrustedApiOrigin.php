<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTrustedApiOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        /*
         * Login is intentionally excluded because it is a public endpoint
         * and normally has no access_token cookie yet.
         *
         * Cookie-authenticated mutation requests are still protected.
         * Bearer/API clients without a cookie are also allowed.
         */
        if (! $request->cookies->has('access_token')) {
            return $next($request);
        }

        $origin = $request->header('Origin');

        if (! $origin) {
            $referer = $request->header('Referer');

            $origin = is_string($referer)
                ? $this->originOf($referer)
                : null;
        }

        $trustedOrigins = array_values(array_filter(array_map(
            fn (string $url): ?string => $this->originOf($url),
            config('security.trusted_origins', [])
        )));

        $normalizedOrigin = is_string($origin)
            ? $this->originOf($origin)
            : null;

        if (
            ! $normalizedOrigin
            || ! in_array($normalizedOrigin, $trustedOrigins, true)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The request origin is not trusted.',
            ], 403);
        }

        return $next($request);
    }

    private function originOf(string $url): ?string
    {
        $parts = parse_url($url);

        if (
            ! is_array($parts)
            || ! isset($parts['scheme'], $parts['host'])
            || ! in_array(
                strtolower((string) $parts['scheme']),
                ['http', 'https'],
                true
            )
            || isset($parts['user'], $parts['pass'])
        ) {
            return null;
        }

        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower((string) $parts['host']);
        $port = $parts['port'] ?? null;

        $defaultPort = $scheme === 'https' ? 443 : 80;

        return $scheme . '://' . $host
            . (
                $port !== null && $port !== $defaultPort
                    ? ':' . $port
                    : ''
            );
    }
}