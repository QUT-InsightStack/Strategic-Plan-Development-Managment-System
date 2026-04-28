<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::put('/users/{id}',    [UserController::class, 'update']);
Route::delete('/users/{id}', [UserController::class, 'destroy']);

