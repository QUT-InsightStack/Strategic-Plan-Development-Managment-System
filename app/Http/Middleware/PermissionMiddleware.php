<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    public function handle(
        Request $request,
        Closure $next,
        string ...$requiredPermissions
    ): Response {
        $user = Auth::guard('api')->user();

        if (! $user) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (empty($requiredPermissions)) {
            return $next($request);
        }

        $role = $user->role;

        if (! $role) {
            return new JsonResponse([
                'success' => false,
                'message' => 'This action is unauthorized.',
            ], 403);
        }

        if ($role->hasFullAccess()) {
            return $next($request);
        }

        $grantedPermissions = $role->permissions()
            ->whereIn('code', $requiredPermissions)
            ->pluck('code')
            ->all();

        $missingPermissions = array_diff(
            $requiredPermissions,
            $grantedPermissions
        );

        if ($missingPermissions !== []) {
            return new JsonResponse([
                'success' => false,
                'message' => 'This action is unauthorized.',
            ], 403);
        }

        return $next($request);
    }
}
