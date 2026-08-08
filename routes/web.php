<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::view('/login', 'pages.login')->name('login');
Route::view('/dashboard', 'pages.dashboard')->name('dashboard');
Route::view('/profile', 'pages.profile')->name('profile');
Route::view('/resource', 'pages.resource')->name('resource.index');
Route::view('/resource-form', 'pages.resource-form')->name('resource.form');
Route::view('/user-search', 'pages.user-search')->name('users.search');
Route::view('/user-roles', 'pages.user-roles')->name('users.roles');
Route::view('/strategic-plan', 'pages.strategic-plan')->name('strategic-plan');
Route::view('/office', 'pages.office')->name('office');

Route::redirect('/login.html', '/login');
Route::redirect('/dashboard.html', '/dashboard');
Route::redirect('/profile.html', '/profile');
Route::redirect('/strategic-plan.html', '/strategic-plan');
Route::redirect('/office.html', '/office');
Route::get('/resource.html', function (Request $request) {
    $query = $request->getQueryString();
    return redirect()->to('/resource' . ($query ? "?{$query}" : ''));
});
Route::get('/resource-form.html', function (Request $request) {
    $query = $request->getQueryString();
    return redirect()->to('/resource-form' . ($query ? "?{$query}" : ''));
});
