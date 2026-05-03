<?php

use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RelationController;
use App\Http\Controllers\StrategicController;
use App\Http\Controllers\FoundationsController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\RolePremissionController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

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
Route::resource('users', UserController::class);
Route::resource('roles', RoleController::class);
Route::get('roles/{roleId}/permissions', [RolePremissionController::class, 'byRole']);
Route::put('roles/{roleId}/permissions', [RolePremissionController::class, 'syncPermissions']);
Route::get('strategic-records/{recordId}/relations', [RelationController::class, 'byRecord']);
Route::put('strategic-records/{recordId}/relations', [RelationController::class, 'syncParents']);
Route::get('strategic-records/{planId}/core-values', [LinkController::class, 'byPlan']);
Route::put('strategic-records/{planId}/core-values', [LinkController::class, 'syncCoreValues']);
Route::apiResource('strategic-foundations', FoundationsController::class);
Route::apiResource('strategic-records', StrategicController::class);
Route::apiResource('relations', RelationController::class);
Route::apiResource('logs', LogController::class);
Route::apiResource('role-premissions', RolePremissionController::class);
Route::apiResource('plan-core-values', LinkController::class);
