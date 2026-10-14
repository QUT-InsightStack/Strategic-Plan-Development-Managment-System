<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\PasswordAssistanceRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PasswordAssistanceService
{
    public function __construct(
        private readonly StrategicLogWriter $auditWriter,
        private readonly UserService $userService,
        private readonly PermissionAuthorizationService $permissions,
    ) {}

    public function ensureAdministrator(?User $actor = null): User
    {
        $actor = $this->permissions->ensureHasPermission(
            'users.update',
            $actor
        );

        abort_unless(in_array($actor->role?->role_name, [
            'Technical Administrator',
            'Technical Admin',
            'Administrator',
            'test',
        ], true), 403, 'You cannot manage password assistance requests.');

        return $actor;
    }

    public function submit(string $email): void
    {
        DB::transaction(function () use ($email): void {
            $user = User::query()
                ->where('email', trim($email))
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            // The public response never reveals whether an account exists.
            if (! $user) {
                return;
            }

            if (PasswordAssistanceRequest::query()
                ->where('user_id', $user->user_id)
                ->open()
                ->exists()) {
                return;
            }

            $request = PasswordAssistanceRequest::create([
                'user_id' => $user->user_id,
            ]);

            $this->auditWriter->write('password_assistance.requested', [
                'resource_type' => 'password_assistance_request',
                'resource_id' => $request->id,
                'user_id' => $user->user_id,
            ]);
        }, 3);
    }

    public function accept(int $id, User $actor): PasswordAssistanceRequest
    {
        $actor = $this->ensureAdministrator($actor);

        return DB::transaction(function () use ($id, $actor) {
            $request = PasswordAssistanceRequest::query()
                ->lockForUpdate()
                ->findOrFail($id);

            if ($request->status === PasswordAssistanceRequest::ACCEPTED
                && (int) $request->accepted_by === (int) $actor->user_id) {
                return $request;
            }

            $this->requireStatus($request, PasswordAssistanceRequest::PENDING);

            $request->status = PasswordAssistanceRequest::ACCEPTED;
            $request->accepted_by = $actor->user_id;
            $request->accepted_at = now();
            $request->saveOrFail();

            $this->audit($request, $actor, 'accepted');

            return $request;
        }, 3);
    }

    public function ignore(int $id, User $actor): PasswordAssistanceRequest
    {
        $actor = $this->ensureAdministrator($actor);

        return DB::transaction(function () use ($id, $actor) {
            $request = PasswordAssistanceRequest::query()
                ->lockForUpdate()
                ->findOrFail($id);

            abort_unless(
                $request->status === PasswordAssistanceRequest::PENDING
                || (
                    $request->status === PasswordAssistanceRequest::ACCEPTED
                    && (int) $request->accepted_by === (int) $actor->user_id
                ),
                409,
                'This request has already been handled or accepted by another administrator.'
            );

            $request->status = PasswordAssistanceRequest::IGNORED;
            $request->open_slot = null;
            $request->handled_by = $actor->user_id;
            $request->handled_at = now();
            $request->saveOrFail();

            $this->audit($request, $actor, 'ignored');

            return $request;
        }, 3);
    }

    public function reset(
        int $id,
        string $password,
        User $actor
    ): PasswordAssistanceRequest {
        $actor = $this->ensureAdministrator($actor);

        return DB::transaction(function () use ($id, $password, $actor) {
            $target = PasswordAssistanceRequest::query()->findOrFail($id);

            // Match the user-lock order used when submitting requests.
            $user = User::query()
                ->lockForUpdate()
                ->findOrFail($target->user_id);

            $request = PasswordAssistanceRequest::query()
                ->lockForUpdate()
                ->findOrFail($id);

            $this->requireStatus($request, PasswordAssistanceRequest::ACCEPTED);

            abort_unless(
                (int) $request->accepted_by === (int) $actor->user_id,
                403,
                'Only the administrator who accepted this request can reset it.'
            );

            abort_unless(
                $user->status === 'active',
                422,
                'Password assistance is available only for active accounts.'
            );

            $this->userService->updateByAdministrator(
                (int) $user->user_id,
                ['password' => $password],
                $actor
            );

            $request->status = PasswordAssistanceRequest::ACTED_ON;
            $request->open_slot = null;
            $request->handled_by = $actor->user_id;
            $request->handled_at = now();
            $request->saveOrFail();

            $this->audit($request, $actor, 'acted_on');

            return $request;
        }, 3);
    }

    private function requireStatus(
        PasswordAssistanceRequest $request,
        string $status
    ): void {
        if ($request->status !== $status) {
            throw ValidationException::withMessages([
                'status' => ['This request is no longer available for this action.'],
            ]);
        }
    }

    private function audit(
        PasswordAssistanceRequest $request,
        User $actor,
        string $action
    ): void {
        $this->auditWriter->write('password_assistance.'.$action, [
            'actor_user_id' => $actor->user_id,
            'resource_type' => 'password_assistance_request',
            'resource_id' => $request->id,
            'user_id' => $request->user_id,
        ]);
    }
}