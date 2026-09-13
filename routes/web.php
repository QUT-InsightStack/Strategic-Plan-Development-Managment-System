<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::view('/login', 'pages.login')->name('login');
Route::view('/forgot-password', 'pages.forgot-password')->name('forgot-password');
Route::get('/reset-password/{token}', function (string $token, Request $request) {
    return view('pages.reset-password', [
        'token' => $token,
        'email' => (string) $request->query('email', ''),
    ]);
})->name('password.reset');
Route::view('/dashboard', 'pages.dashboard')->name('dashboard');
Route::view('/administrative-admin/reference-data', 'pages.reference-data')
    ->name('administrative-admin.reference-data');
Route::view('/administrative-admin/reference-data/agenda/create', 'pages.reference-data')
    ->name('administrative-admin.reference-data.agenda.create');
Route::view('/administrative-admin/reference-data/agenda/{agenda}/edit', 'pages.reference-data')
    ->where('agenda', '[A-Za-z0-9-]+')
    ->name('administrative-admin.reference-data.agenda.edit');
Route::view('/administrative-admin/templates', 'pages.reference-data')
    ->name('administrative-admin.templates');
Route::view('/administrative-admin/templates/create', 'pages.reference-data')
    ->name('administrative-admin.templates.create');
Route::view('/administrative-admin/templates/{template}/edit', 'pages.reference-data')
    ->where('template', '[A-Za-z0-9-]+')
    ->name('administrative-admin.templates.edit');
Route::view('/profile', 'pages.profile')->name('profile');
Route::view('/change-password', 'pages.change-password')->name('change-password');
Route::get('/resource', function (Request $request) {
    if ($request->query('resource') === 'users') {
        return redirect('/user-management');
    }

    return view('pages.resource');
})->name('resource.index');
Route::view('/resource-form', 'pages.resource-form')->name('resource.form');
Route::view('/create-user', 'pages.create-user')->name('users.create');
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
Route::view('/pdp-chapters', 'pages.pdp-chapters', ['mode' => 'view'])->name('pdp-chapters.index');
Route::view('/pdp-chapters/manage', 'pages.pdp-chapters', ['mode' => 'manage'])->name('pdp-chapters.manage');
Route::view('/pdp-chapters/{chapter}', 'pages.pdp-chapters', ['mode' => 'detail'])
    ->whereNumber('chapter')
    ->name('pdp-chapters.show');
Route::view('/office', 'pages.office')->name('office');
Route::view('/role-management', 'pages.role-management')->name('role-management.index');
Route::view('/user-management', 'pages.user-management')->name('user-management.index');
Route::view('/login-history', 'pages.login-history')->name('login-history.index');
Route::view('/manual-backup', 'pages.manual-backup')->name('manual-backup.index');
Route::view(
    '/workflow-configuration',
    'pages.workflow-configuration'
)->name('workflow-configuration.index');
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
