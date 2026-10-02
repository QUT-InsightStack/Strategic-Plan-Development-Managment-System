<?php

use App\Http\Controllers\LoginHistoryController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\FoundationsController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PdpChapterController;
use App\Http\Controllers\PlanCreationController;
use App\Http\Controllers\RelationController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RolePremissionController;
use App\Http\Controllers\StrategicController;
use App\Http\Controllers\StrategicObjectiveController;
use App\Http\Controllers\ResponsibleUnitController;
use App\Http\Controllers\ObjectiveCommentController;
use App\Http\Controllers\ImplementationInputController;
use App\Http\Controllers\ImplementationInputScopeController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\SystemSettingsController;
use App\Http\Controllers\StrategicDocumentController;
use App\Http\Controllers\PresidentialAgendaItemController;
use App\Http\Controllers\StrategicObjectiveAlignmentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:api', 'auth.version', 'permission:system_monitoring.view'])
    ->prefix('system-monitoring')->group(function (): void {
        Route::get('events', [\App\Http\Controllers\SystemMonitoringController::class, 'events']);
        Route::get('events/{id}', [\App\Http\Controllers\SystemMonitoringController::class, 'event'])->whereNumber('id');
        Route::get('alerts', [\App\Http\Controllers\SystemMonitoringController::class, 'alerts']);
        Route::get('trends', [\App\Http\Controllers\SystemMonitoringController::class, 'trends']);
        Route::get('summary', [\App\Http\Controllers\SystemMonitoringController::class, 'summary']);
        Route::get('requests', [\App\Http\Controllers\SystemMonitoringController::class, 'requests']);
        Route::get('health', [\App\Http\Controllers\SystemMonitoringController::class, 'health']);
        Route::get('checks', [\App\Http\Controllers\SystemMonitoringController::class, 'checks']);
    });

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
Route::middleware(['auth:api','auth.version', 'auth.session', 'system.available',])->group(function () {
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

Route::middleware(['auth:api','auth.version','auth.session','system.available',])->prefix('users')->group(function () {
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
| Manual database backups
|--------------------------------------------------------------------------
|
| A backup contains every user record and password hash in the system, so
| creating one, listing them and downloading one are three separate
| permissions. Downloads are audited by BackupService.
|
*/
Route::middleware(['auth:api','auth.version', 'auth.session','system.available',])->prefix('backups')->group(function () {
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

Route::middleware(['auth:api','auth.version','auth.session','system.available',])->group(function () {
   

    Route::get('pdp-chapters', [PdpChapterController::class, 'index']);
    
    Route::get('pdp-chapters/{chapter}', [PdpChapterController::class, 'show'])
        ->whereNumber('chapter');

    Route::patch('pdp-chapters/{chapter}/archive', [PdpChapterController::class, 'archive'])
        ->whereNumber('chapter')
        ->middleware('permission:pdp_chapters.archive');
    

    Route::post('pdp-chapters', [PdpChapterController::class, 'store'])
        ->middleware('permission:pdp_chapters.manage');

    Route::put('pdp-chapters/{chapter}', [PdpChapterController::class, 'update'])
        ->whereNumber('chapter')
        ->middleware('permission:pdp_chapters.manage');

    Route::patch('pdp-chapters/{chapter}/status', [PdpChapterController::class, 'updateStatus'])
        ->whereNumber('chapter')
        ->middleware('permission:pdp_chapters.archive');

    Route::delete('pdp-chapters/{chapter}', [PdpChapterController::class, 'delete'])
        ->whereNumber('chapter')
        ->middleware('permission:pdp_chapters.delete');


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

Route::middleware(['auth:api', 'auth.version','auth.session','system.available',])->group(function () {
    Route::get('approval-workflow', [\App\Http\Controllers\ApprovalWorkflowController::class, 'show']);
    Route::put('approval-workflow', [\App\Http\Controllers\ApprovalWorkflowController::class, 'update']);
    Route::get('plan-reviews', [\App\Http\Controllers\PlanApprovalController::class, 'index']);
    Route::get('workflow-notifications', [\App\Http\Controllers\WorkflowNotificationController::class, 'index']);
    Route::patch('workflow-notifications/{notification}/read', [\App\Http\Controllers\WorkflowNotificationController::class, 'read'])->whereNumber('notification');
    Route::post('strategic-plans/{plan}/resubmit', [\App\Http\Controllers\PlanApprovalController::class, 'resubmit'])->whereNumber('plan');
    Route::get('strategic-plans/{plan}/approval-status', [\App\Http\Controllers\PlanApprovalController::class, 'tracking'])->whereNumber('plan');
    Route::post('strategic-plans/{plan}/submit', [\App\Http\Controllers\PlanApprovalController::class, 'submit'])->whereNumber('plan');
    Route::get('strategic-plans/{plan}/approval-preparation', [\App\Http\Controllers\PlanApprovalController::class, 'preparation'])->whereNumber('plan');
    Route::get('strategic-plans/{plan}/approval', [\App\Http\Controllers\PlanApprovalController::class, 'show'])->whereNumber('plan');
    Route::post('strategic-plans/{plan}/approval/decision', [\App\Http\Controllers\PlanApprovalController::class, 'decide'])->whereNumber('plan');
    Route::get('plan-submissions/{submission}/documents/{document}', [\App\Http\Controllers\PlanApprovalController::class, 'document'])
        ->whereNumber('submission')->whereNumber('document');
    Route::get('strategic-plans/{plan}/documents', [StrategicDocumentController::class, 'planIndex'])
        ->whereNumber('plan')->middleware('permission:strategic_documents.view');
    Route::post('strategic-plans/{plan}/documents', [StrategicDocumentController::class, 'storeForPlan'])
        ->whereNumber('plan')->middleware('permission:strategic_documents.upload');
    Route::get('strategic-objectives/{objective}/documents', [StrategicDocumentController::class, 'objectiveIndex'])
        ->whereNumber('objective')->middleware('permission:strategic_documents.view');
    Route::post('strategic-objectives/{objective}/documents', [StrategicDocumentController::class, 'storeForObjective'])
        ->whereNumber('objective')->middleware('permission:strategic_documents.upload');
    Route::get('strategic-documents/{document}/download', [StrategicDocumentController::class, 'download'])
        ->whereNumber('document')->middleware('permission:strategic_documents.download');

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
    Route::get('strategic-objective-progress', [\App\Http\Controllers\ObjectiveProgressController::class, 'index']);
    Route::get('strategic-objectives/{objective}/progress-history', [\App\Http\Controllers\ObjectiveProgressController::class, 'history'])->whereNumber('objective');
    Route::patch('strategic-objectives/{objective}/progress', [\App\Http\Controllers\ObjectiveProgressController::class, 'update'])->whereNumber('objective');
    Route::put(
        'strategic-objectives/{id}/alignments',
        [StrategicObjectiveController::class, 'updateAlignments']
    )->whereNumber('id');

    Route::post(
        'strategic-objectives/{id}/alignments',
        [StrategicObjectiveController::class, 'storeAlignments']
    )->whereNumber('id');

    Route::patch(
        'strategic-objectives/{id}/alignments/{type}/{referenceId}/archive',
        [StrategicObjectiveAlignmentController::class, 'archive']
    )
        ->whereNumber('id')
        ->whereNumber('referenceId')
        ->where('type', 'pdp-chapter|presidential-agenda')
        ->middleware('permission:strategic_alignments.archive');

    Route::delete(
        'strategic-objectives/{id}/alignments/{type}/{referenceId}',
        [StrategicObjectiveAlignmentController::class, 'destroy']
    )
        ->whereNumber('id')
        ->whereNumber('referenceId')
        ->where('type', 'pdp-chapter|presidential-agenda')
        ->middleware('permission:strategic_alignments.delete');    

    Route::get('responsible-units', [ResponsibleUnitController::class, 'index']);
    Route::put('strategic-objectives/responsible-unit', [ResponsibleUnitController::class, 'assign']);
    Route::put('strategic-objectives/{id}/responsible-unit', [ResponsibleUnitController::class, 'assign'])->whereNumber('id');
    Route::get('strategic-objectives/{objectiveId}/comments', [ObjectiveCommentController::class, 'index'])->whereNumber('objectiveId');
    Route::post('strategic-objectives/{objectiveId}/comments', [ObjectiveCommentController::class, 'store'])->whereNumber('objectiveId');
    Route::get('implementation-inputs', [ImplementationInputController::class, 'index'])->defaults('read_only', true);
    Route::get('implementation-inputs/{inputId}', [ImplementationInputController::class, 'show'])->whereNumber('inputId')->defaults('read_only', true);
    Route::post('implementation-inputs/{inputId}/review', [ImplementationInputController::class, 'review'])->whereNumber('inputId');
    Route::get('strategic-plans/{planId}/input-scope', [ImplementationInputScopeController::class, 'show'])->whereNumber('planId')->defaults('read_only', true);
    Route::put('strategic-plans/{planId}/input-scope', [ImplementationInputScopeController::class, 'update'])->whereNumber('planId');
    Route::get('strategic-objectives/{objectiveId}/inputs', [ImplementationInputController::class, 'index'])->whereNumber('objectiveId')->defaults('read_only', true);
    Route::post('strategic-objectives/{objectiveId}/inputs', [ImplementationInputController::class, 'store'])->whereNumber('objectiveId');
    Route::get('strategic-plans/{planId}/inputs', [ImplementationInputController::class, 'index'])->whereNumber('planId')->defaults('read_only', true);
    Route::post('strategic-plans/{planId}/inputs', [ImplementationInputController::class, 'store'])->whereNumber('planId');

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
   Route::patch(
        'strategic-objectives/{id}/status',
        [StrategicObjectiveController::class, 'updateStatus']
    )->whereNumber('id');

    Route::apiResource(
        'strategic-objectives',
        StrategicObjectiveController::class
    );

    Route::apiResource(
        'relations',
        RelationController::class
    );

    //Presidential Agenda routes
    Route::get('presidential-agenda', [PresidentialAgendaItemController::class, 'index'])
    ->middleware('permission:presidential_agenda.view');

    Route::post('presidential-agenda', [PresidentialAgendaItemController::class, 'store'])
        ->middleware('permission:presidential_agenda.manage');

    Route::get('presidential-agenda/{agendaItem}', [PresidentialAgendaItemController::class, 'show'])
        ->whereNumber('agendaItem')
        ->middleware('permission:presidential_agenda.view');

    Route::put('presidential-agenda/{agendaItem}', [PresidentialAgendaItemController::class, 'update'])
        ->whereNumber('agendaItem')
        ->middleware('permission:presidential_agenda.manage');

    Route::patch(
        'presidential-agenda/{agendaItem}/archive',
        [PresidentialAgendaItemController::class, 'archive']
    )
        ->whereNumber('agendaItem')
        ->middleware('permission:presidential_agenda.archive');

    Route::delete(
        'presidential-agenda/{agendaItem}',
        [PresidentialAgendaItemController::class, 'delete']
    )
        ->whereNumber('agendaItem')
        ->middleware('permission:presidential_agenda.delete');

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

/*
|--------------------------------------------------------------------------
| Login history
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:api',
    'auth.version',
    'auth.session',
    'system.available',
])->group(function () {
    Route::get(
        'login-history/me',
        [LoginHistoryController::class, 'me']
    );

    Route::get(
        'login-history',
        [LoginHistoryController::class, 'index']
    )->middleware('permission:login_history.view');

    Route::get(
        'login-history/{loginHistory}',
        [LoginHistoryController::class, 'show']
    )
        ->whereNumber('loginHistory')
        ->middleware('permission:login_history.view');
});


/*
|--------------------------------------------------------------------------
| System Settings
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:api',
    'auth.version',
    'auth.session',
    'system.available',
])->prefix('settings')->group(function (): void {
    Route::get('', [SystemSettingsController::class, 'show'])
        ->middleware('permission:settings.view');

    Route::patch('', [SystemSettingsController::class, 'update'])
        ->middleware('permission:settings.manage');
});

