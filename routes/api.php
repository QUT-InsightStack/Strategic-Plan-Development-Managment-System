<?php

use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Use resource routes to define complete CRUD operations
// Laravel's Route::resource automatically creates the following routes for UserController:
// GET /users -> index() method, list all users
// GET /users/{id} -> show() method, display a single user
// POST /users -> store() method, create a new user
// PUT/PATCH /users/{id} -> update() method, update a user
// DELETE /users/{id} -> destroy() method, delete a user
Route::resource('users', UserController::class);
Route::resource('roles', RoleController::class);

