<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RelationController;
use App\Http\Controllers\StrategicController;
use App\Http\Controllers\StrategicObjectiveController;
use App\Http\Controllers\FoundationsController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\RolePremissionController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\PlanCreationController;
use Illuminate\Support\Facades\Route;

// ╔═══════════════════════════════════════════════════════════════════╗
// ║  AUTH ROUTES (public + protected)                                ║
// ╚═══════════════════════════════════════════════════════════════════╝

// Public — rate-limited to 5 attempts per minute per email+IP
Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');


// Requires a valid (possibly expired) token — handled inside controller
Route::post('auth/refresh', [AuthController::class, 'refresh']);


// Requires a valid, non-expired token
Route::middleware('auth:api')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',     [AuthController::class, 'me']);
    Route::put('auth/profile',       [AuthController::class, 'updateProfile']);
});





// ╔═══════════════════════════════════════════════════════════════════╗
// ║  PROTECTED RESOURCE ROUTES                                       ║
// ║  TODO: wrap these in auth:api once frontend auth flow is ready   ║
// ╚═══════════════════════════════════════════════════════════════════╝


// Auth routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('jwt.auth');
Route::post('/refresh', [AuthController::class, 'refresh'])->middleware('jwt.refresh');
Route::get('/me', [AuthController::class, 'me'])->middleware('jwt.auth');
Route::put('/profile', [AuthController::class, 'updateProfile'])->middleware('jwt.auth');

// Use resource routes to define complete CRUD operations
// Laravel's Route::resource automatically creates the following routes for UserController:
// GET /users -> index() method, list all users
// GET /users/{id} -> show() method, display a single user
// POST /users -> store() method, create a new user
// PUT/PATCH /users/{id} -> update() method, update a user
// DELETE /users/{id} -> destroy() method, delete a user
Route::middleware('jwt.auth')->group(function () {
    Route::get('strategic-plans', [PlanCreationController::class, 'index']);
    Route::post('strategic-plans', [PlanCreationController::class, 'store']);
    Route::post('strategic-plans/{id}/copy', [PlanCreationController::class, 'copy'])->whereNumber('id');
    Route::patch('strategic-plans/{id}/status', [PlanCreationController::class, 'updateStatus'])->whereNumber('id');
    Route::get('strategic-plans/{id}', [PlanCreationController::class, 'show'])->whereNumber('id');
    Route::put('strategic-plans/{id}', [PlanCreationController::class, 'update'])->whereNumber('id');
    Route::delete('strategic-plans/{id}', [PlanCreationController::class, 'destroy'])->whereNumber('id');
    Route::resource('users', UserController::class);
    Route::resource('roles', RoleController::class);
    Route::get('roles/{roleId}/permissions', [RolePremissionController::class, 'byRole']);
    Route::put('roles/{roleId}/permissions', [RolePremissionController::class, 'syncPermissions']);
    Route::get('strategic-records/{recordId}/relations', [RelationController::class, 'byRecord']);
    Route::put('strategic-records/{recordId}/relations', [RelationController::class, 'syncParents']);
    Route::get('strategic-records/{planId}/core-values', [LinkController::class, 'byPlan']);
    Route::put('strategic-records/{planId}/core-values', [LinkController::class, 'syncCoreValues']);
    Route::get('strategic-plans/{planId}/objectives', [StrategicObjectiveController::class, 'byPlan']);
    Route::apiResource('permissions', PermissionController::class);
    Route::apiResource('strategic-foundations', FoundationsController::class);
    Route::apiResource('strategic-records', StrategicController::class);
    Route::apiResource('strategic-objectives',StrategicObjectiveController::class);
    Route::apiResource('relations', RelationController::class);
    Route::apiResource('logs', LogController::class);
    Route::apiResource('role-premissions', RolePremissionController::class);
    Route::apiResource('plan-core-values', LinkController::class);
});
