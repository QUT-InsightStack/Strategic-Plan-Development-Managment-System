<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::view('/login', 'pages.login')->name('login');
Route::view('/dashboard', 'pages.dashboard')->name('dashboard');
Route::view('/profile', 'pages.profile')->name('profile');
Route::view('/change-password', 'pages.change-password')->name('change-password');
Route::view('/resource', 'pages.resource')->name('resource.index');
Route::view('/resource-form', 'pages.resource-form')->name('resource.form');
Route::view('/strategic-plans', 'pages.strategic-plans.index')->name('strategic-plans.index');
Route::view('/strategic-plans/create', 'pages.strategic-plan')->name('strategic-plans.create');
Route::get('/strategic-plans/{id}/edit', function (int $id) {
    return view('pages.strategic-plans.edit', ['planId' => $id]);
})->name('strategic-plans.edit');
Route::get('/strategic-plans/{id}/objectives', function (int $id) {
    return view('pages.strategic-plans.objectives', ['planId' => $id]);
})->name('strategic-plans.objectives');
Route::redirect('/strategic-plan', '/strategic-plans/create')->name('strategic-plan');
Route::view('/strategic-objectives', 'pages.strategic-objectives.index')->name('strategic-objectives.index');
Route::view('/office', 'pages.office')->name('office');
Route::view('/role-management', 'pages.role-management')->name('role-management.index');
Route::view('/access-denied', 'pages.access-denied')->name('access-denied');

Route::redirect('/login.html', '/login');
Route::redirect('/dashboard.html', '/dashboard');
Route::redirect('/profile.html', '/profile');
Route::redirect('/strategic-plan.html', '/strategic-plans/create');
Route::redirect('/office.html', '/office');
Route::get('/resource.html', function (Request $request) {
    $query = $request->getQueryString();
    return redirect()->to('/resource' . ($query ? "?{$query}" : ''));
});
Route::get('/resource-form.html', function (Request $request) {
    $query = $request->getQueryString();
    return redirect()->to('/resource-form' . ($query ? "?{$query}" : ''));
});
