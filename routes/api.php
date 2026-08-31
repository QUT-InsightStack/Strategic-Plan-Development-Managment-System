<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\FoundationsController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\LoginHistoryController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PdpChapterController;
use App\Http\Controllers\PlanCreationController;
use App\Http\Controllers\RelationController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RolePremissionController;
use App\Http\Controllers\StrategicController;
use App\Http\Controllers\StrategicObjectiveController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public authentication routes
|--------------------------------------------------------------------------
*/

// Limited to five attempts per minute by the configured login rate limiter.
Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

// Token refresh is handled inside AuthController, including expired tokens.
Route::post('auth/refresh', [AuthController::class, 'refresh']);
Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
    ->middleware('throttle:5,1');
Route::post('reset-password', [AuthController::class, 'resetPassword'])
    ->middleware('throttle:5,1');

/*
|--------------------------------------------------------------------------
| Protected authentication routes
|--------------------------------------------------------------------------
*/

// Logout is intentionally outside auth:api. It is idempotent and must stay
// reachable with an expired or already-blacklisted token, so that repeated
// logout attempts still clear the cookie instead of returning 401.
Route::post('auth/logout', [AuthController::class, 'logout']);

// Requires a valid, non-expired token
Route::middleware(['auth:api', 'auth.version'])->group(function () {
    Route::get('auth/me',     [AuthController::class, 'me']);
    Route::put('auth/profile',       [AuthController::class, 'updateProfile']);
    Route::put('change-password', [AuthController::class, 'changePassword']);

    // Takes a file rather than JSON, so it cannot go through updateProfile.
    Route::post('auth/profile/photo', [AuthController::class, 'uploadPhoto']);
    Route::delete('auth/profile/photo', [AuthController::class, 'removePhoto']);
});

/*
|--------------------------------------------------------------------------
| User account management
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->prefix('users')->group(function () {
    Route::get('/search', [UserController::class, 'search'])
    ->middleware('permission:users.view');

    Route::get('/search-filters', [UserController::class, 'searchFilterOptions'])
        ->middleware('permission:users.view');

    Route::get('', [UserController::class, 'index'])
        ->middleware('permission:users.view');

    Route::post('', [UserController::class, 'store'])
        ->middleware('permission:users.create,users.assign_roles');

    Route::put('/{user}/role', [UserController::class, 'assignRole'])
        ->whereNumber('user')
        ->middleware('permission:users.assign_roles');

    Route::patch('/{user}/status', [UserController::class, 'updateStatus'])
        ->whereNumber('user')
        ->middleware('permission:users.update');

    Route::get('{user}', [UserController::class, 'show'])
        ->whereNumber('user')
        ->middleware('permission:users.view');

    Route::match(['put', 'patch'], '{user}', [UserController::class, 'update'])
        ->whereNumber('user')
        ->middleware('permission:users.update');

    Route::delete('{user}', [UserController::class, 'destroy'])
        ->whereNumber('user')
        ->middleware('permission:users.delete');
});

/*
|--------------------------------------------------------------------------
| Login history
|--------------------------------------------------------------------------
|
| Two views of the same table. `me` is any authenticated user's own history
| and takes the account from the token, so it cannot be aimed at anyone else.
| The list across all accounts is a security log and is gated accordingly.
|
*/
Route::middleware(['auth:api', 'auth.version'])->prefix('login-history')->group(function () {
    Route::get('me', [LoginHistoryController::class, 'mine']);

    Route::get('', [LoginHistoryController::class, 'index'])
        ->middleware('permission:logs.view');
});

/*
|--------------------------------------------------------------------------
| Manual database backups
|--------------------------------------------------------------------------
|
| A backup contains every user record and password hash in the system, so
| creating one, listing them and downloading one are three separate
| permissions. Downloads are audited by BackupService.
|
*/
Route::middleware(['auth:api', 'auth.version'])->prefix('backups')->group(function () {
    Route::get('', [BackupController::class, 'index'])
        ->middleware('permission:backups.view');

    Route::post('', [BackupController::class, 'store'])
        ->middleware('permission:backups.create');

    Route::get('{backup}/download', [BackupController::class, 'download'])
        ->whereNumber('backup')
        ->middleware('permission:backups.download');

    Route::post('{backup}/restore', [BackupController::class, 'restore'])
        ->whereNumber('backup')
        ->middleware('permission:backups.restore');
});

/*
|--------------------------------------------------------------------------
| Role and permission management
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->group(function () {
    Route::get('pdp-chapters', [PdpChapterController::class, 'index']);
    Route::get('pdp-chapters/{chapter}', [PdpChapterController::class, 'show'])
        ->whereNumber('chapter');
    Route::post('pdp-chapters', [PdpChapterController::class, 'store'])
        ->middleware('permission:pdp_chapters.manage');
    Route::put('pdp-chapters/{chapter}', [PdpChapterController::class, 'update'])
        ->whereNumber('chapter')
        ->middleware('permission:pdp_chapters.manage');

    // Roles
    Route::get('roles', [RoleController::class, 'index'])
        ->middleware('permission:roles.view');

    Route::post('roles', [RoleController::class, 'store'])
        ->middleware('permission:roles.manage');

    Route::get('roles/{role}', [RoleController::class, 'show'])
        ->whereNumber('role')
        ->middleware('permission:roles.view');

    Route::match(['put', 'patch'], 'roles/{role}', [RoleController::class, 'update'])
        ->whereNumber('role')
        ->middleware('permission:roles.manage');

    Route::delete('roles/{role}', [RoleController::class, 'destroy'])
        ->whereNumber('role')
        ->middleware('permission:roles.manage');

    // Permissions assigned to a role
    Route::get(
        'roles/{roleId}/permissions',
        [RolePremissionController::class, 'byRole']
    )
        ->whereNumber('roleId')
        ->middleware('permission:roles.view');

    Route::put(
        'roles/{roleId}/permissions',
        [RolePremissionController::class, 'syncPermissions']
    )
        ->whereNumber('roleId')
        ->middleware('permission:roles.manage');

    // Permission catalog
    Route::get('permissions', [PermissionController::class, 'index'])
        ->middleware('permission:permissions.view');

    Route::post('permissions', [PermissionController::class, 'store'])
        ->middleware('permission:permissions.manage');

    Route::get(
        'permissions/{permission}',
        [PermissionController::class, 'show']
    )
        ->whereNumber('permission')
        ->middleware('permission:permissions.view');

    Route::match(
        ['put', 'patch'],
        'permissions/{permission}',
        [PermissionController::class, 'update']
    )
        ->whereNumber('permission')
        ->middleware('permission:permissions.manage');

    Route::delete(
        'permissions/{permission}',
        [PermissionController::class, 'destroy']
    )
        ->whereNumber('permission')
        ->middleware('permission:permissions.manage');

    // Legacy direct role-permission pivot endpoints
    Route::apiResource(
        'role-premissions',
        RolePremissionController::class
    )
        ->only([
            'index',
            'show',
        ])
        ->middleware('permission:roles.view');
    
});

/*
|--------------------------------------------------------------------------
| Protected strategic planning resources
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->group(function () {
    // Strategic plan management
    Route::get('strategic-plans', [PlanCreationController::class, 'index']);
    Route::post('strategic-plans', [PlanCreationController::class, 'store']);
    Route::post('strategic-plans/{id}/copy', [PlanCreationController::class, 'copy'])
        ->whereNumber('id');
    Route::patch('strategic-plans/{id}/status', [PlanCreationController::class, 'updateStatus'])
        ->whereNumber('id');
    Route::get('strategic-plans/{id}', [PlanCreationController::class, 'show'])
        ->whereNumber('id');
    Route::put('strategic-plans/{id}', [PlanCreationController::class, 'update'])
        ->whereNumber('id');
    Route::delete('strategic-plans/{id}', [PlanCreationController::class, 'destroy'])
        ->whereNumber('id');

    // Strategic record parent relations
    Route::get(
        'strategic-records/{recordId}/relations',
        [RelationController::class, 'byRecord']
    )->whereNumber('recordId');

    Route::put(
        'strategic-records/{recordId}/relations',
        [RelationController::class, 'syncParents']
    )->whereNumber('recordId');

    // Strategic plan core values
    Route::get(
        'strategic-records/{planId}/core-values',
        [LinkController::class, 'byPlan']
    )->whereNumber('planId');

    Route::put(
        'strategic-records/{planId}/core-values',
        [LinkController::class, 'syncCoreValues']
    )->whereNumber('planId');

    // Strategic objectives, including plan-filtered listing
    Route::get(
        'strategic-plans/{planId}/objectives',
        [StrategicObjectiveController::class, 'byPlan']
    )->whereNumber('planId');

    Route::apiResource(
        'strategic-foundations',
        FoundationsController::class
    );

    Route::apiResource(
        'strategic-records',
        StrategicController::class
    );

    Route::apiResource(
        'strategic-objectives',
        StrategicObjectiveController::class
    );

    Route::apiResource(
        'relations',
        RelationController::class
    );

    Route::apiResource(
        'logs',
        LogController::class
    );

    Route::apiResource(
        'plan-core-values',
        LinkController::class
    );
});
