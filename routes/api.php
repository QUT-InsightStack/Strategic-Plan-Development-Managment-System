<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\FoundationsController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\PermissionController;
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

/*
|--------------------------------------------------------------------------
| Protected authentication routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::put(
        'auth/profile',
        [AuthController::class, 'updateProfile']
    );
});

/*
|--------------------------------------------------------------------------
| User account management
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->prefix('users')->group(function () {
    Route::get('/search', [UserController::class, 'search'])
    ->middleware('permission:users.view');

    Route::get('', [UserController::class, 'index'])
        ->middleware('permission:users.view');

    Route::post('', [UserController::class, 'store'])
        ->middleware('permission:users.create,users.assign_roles');

    Route::put('/{user}/role', [UserController::class, 'assignRole'])
        ->whereNumber('user')
        ->middleware('permission:users.assign_roles');

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
| Role and permission management
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api','auth.version',])->group(function () {
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

    Route::get(
        'logs',
        [LogController::class, 'index']
    )->middleware('permission:logs.view');
    
    Route::get(
        'logs/{log}',
        [LogController::class, 'show']
    )
        ->whereNumber('log')
        ->middleware('permission:logs.view');
    
    Route::apiResource(
        'plan-core-values',
        LinkController::class
    );
});












