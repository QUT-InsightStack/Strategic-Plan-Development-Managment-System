<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\ManagementObjectiveComment;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ManagementObjectiveCommentService
{
    private const MANAGEMENT_ROLES = [
        'Management',
        'Executive',
        'Management / Executive',
        'Division Head',
    ];

    private const PLANNER_ROLES = [
        'Planning Officer',
        'Planner/Encoder',
        'Administrative Admin',
    'Administrative Administrator',
    ];

    private const VIEWER_ROLES = [
        ...self::MANAGEMENT_ROLES,
        ...self::PLANNER_ROLES,
        'Administrative Admin',
        'Administrative Administrator',
        'Administrator',
        'test',
    ];

    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicPlanAuthorizationService $plans,
        private readonly StrategicLogWriter $audit,
    ) {}

    private function authorize(
        User $actor,
        string $action,
        array $roles
    ): void {
        abort_unless(
            $actor->status === 'active'
                && in_array($actor->role?->role_name, $roles, true),
            403,
            'You are not authorised to perform this comment action.'
        );

        $this->permissions->ensureHasPermission(
            'management_objective_comments.'.$action,
            $actor
        );
    }

    public function query(User $actor): Builder
    {
        $this->authorize($actor, 'view', self::VIEWER_ROLES);
        $this->plans->ensureCanViewAny($actor);

        return ManagementObjectiveComment::query()
            ->whereIn(
                'strategic_plan_id',
                $this->plans->authorizedPlanIdsForListing($actor, ['deleted'])
            )
            ->whereHas('objective', fn (Builder $query) =>
                $query->where('status', '!=', 'deleted')
            )
            ->with([
                'strategicPlan:record_id,title,status,approval_status',
                'objective:objective_id,strategic_plan_id,objective_title,status',
            ]);
    }

    public function find(int $id, User $actor): ManagementObjectiveComment
    {
        $comment = ManagementObjectiveComment::findOrFail($id);

        abort_unless(
            $this->query($actor)->whereKey($comment->comment_id)->exists(),
            403,
            'This comment is outside your authorised scope.'
        );

        return $comment->load([
            'strategicPlan:record_id,title,status,approval_status',
            'objective:objective_id,strategic_plan_id,objective_title,status',
        ]);
    }

    private function lockContext(int $objectiveId, User $actor): array
    {
        $planId = StrategicObjective::whereKey($objectiveId)
            ->value('strategic_plan_id');

        $plan = Strategic::where('level', 'strategic_plan')
            ->where('status', '!=', 'deleted')
            ->lockForUpdate()
            ->findOrFail($planId);

        $objective = StrategicObjective::where('strategic_plan_id', $plan->record_id)
            ->where('status', '!=', 'deleted')
            ->lockForUpdate()
            ->findOrFail($objectiveId);

        $actor = User::with('role')
            ->lockForUpdate()
            ->findOrFail($actor->user_id);

        $this->plans->ensureCanViewPlan($plan, $actor);

        return [$plan, $objective, $actor];
    }

    private function ensureOpen(Strategic $plan, StrategicObjective $objective): void
    {
        if (
            ! in_array($plan->status, ['draft', 'finished'], true)
            || ! in_array($objective->status, ['draft', 'published'], true)
        ) {
            throw ValidationException::withMessages([
                'comment' => [
                    'Archived or deleted content cannot receive comment actions.',
                ],
            ]);
        }
    }

    private function record(
        string $event,
        ManagementObjectiveComment $comment,
        User $actor
    ): void {
        $this->audit->write('management_objective_comment.'.$event, [
            'actor_user_id' => $actor->user_id,
            'resource_type' => 'management_objective_comment',
            'resource_id' => $comment->comment_id,
            'strategic_plan_id' => $comment->strategic_plan_id,
            'objective_id' => $comment->objective_id,
            'acknowledgement_status' => $comment->acknowledgement_status,
            'completion_status' => $comment->completion_status,
        ]);
    }

    public function create(
        int $objectiveId,
        string $content,
        User $actor
    ): ManagementObjectiveComment {
        return DB::transaction(function () use ($objectiveId, $content, $actor) {
            [$plan, $objective, $actor] = $this->lockContext($objectiveId, $actor);

            $this->authorize($actor, 'create', self::MANAGEMENT_ROLES);
            $this->ensureOpen($plan, $objective);

            $validated = Validator::make(
                ['content' => trim($content)],
                ['content' => ['required', 'string', 'max:10000', 'regex:/\S/u']]
            )->validate();

            $comment = ManagementObjectiveComment::create([
                'strategic_plan_id' => $plan->record_id,
                'objective_id' => $objective->objective_id,
                'author_id' => $actor->user_id,
                'author_name' => $actor->name,
                'content' => $validated['content'],
                'acknowledgement_status' => 'not_acknowledged',
                'completion_status' => 'open',
            ]);

            $this->record('created', $comment, $actor);

            return $comment->refresh();
        }, 3);
    }
    public function acknowledge(
    int $id,
    User $actor
): ManagementObjectiveComment {
    return DB::transaction(function () use ($id, $actor) {
        $existing = ManagementObjectiveComment::findOrFail($id);

        [$plan, $objective, $actor] = $this->lockContext(
            $existing->objective_id,
            $actor
        );

        $this->authorize($actor, 'acknowledge', self::PLANNER_ROLES);
        $this->ensureOpen($plan, $objective);

        $comment = ManagementObjectiveComment::lockForUpdate()
            ->findOrFail($id);

        abort_unless(
            (int) $comment->strategic_plan_id === (int) $plan->record_id,
            409,
            'The comment context has changed. Refresh and try again.'
        );

        if (
            $comment->acknowledgement_status !== 'not_acknowledged'
            || $comment->completion_status !== 'open'
        ) {
            throw ValidationException::withMessages([
                'comment' => [
                    'Only an unacknowledged, open comment can be acknowledged.',
                ],
            ]);
        }

        $comment->acknowledgement_status = 'acknowledged';
        $comment->acknowledged_by = $actor->user_id;
        $comment->acknowledger_name = $actor->name;
        $comment->acknowledged_at = now();
        $comment->saveOrFail();

        $this->record('acknowledged', $comment, $actor);

        return $comment->refresh();
    }, 3);
}

public function close(
    int $id,
    string $outcome,
    string $remarks,
    User $actor
): ManagementObjectiveComment {
    return DB::transaction(function () use ($id, $outcome, $remarks, $actor) {
        $existing = ManagementObjectiveComment::findOrFail($id);

        [$plan, $objective, $actor] = $this->lockContext(
            $existing->objective_id,
            $actor
        );

        $this->authorize($actor, 'close', self::MANAGEMENT_ROLES);
        $this->ensureOpen($plan, $objective);

        $comment = ManagementObjectiveComment::lockForUpdate()
            ->findOrFail($id);

        abort_unless(
            (int) $comment->strategic_plan_id === (int) $plan->record_id,
            409,
            'The comment context has changed. Refresh and try again.'
        );

        abort_unless(
            $comment->author_id !== null
                && (int) $comment->author_id === (int) $actor->user_id,
            403,
            'Only the Management author can close this comment.'
        );

        if (
            $comment->acknowledgement_status !== 'acknowledged'
            || $comment->completion_status !== 'open'
        ) {
            throw ValidationException::withMessages([
                'comment' => [
                    'Only an acknowledged, open comment can be closed.',
                ],
            ]);
        }

        $validated = Validator::make(
            [
                'completion_status' => $outcome,
                'closing_remarks' => trim($remarks),
            ],
            [
                'completion_status' => ['required', 'in:completed,incomplete'],
                'closing_remarks' => [
                    'required',
                    'string',
                    'max:5000',
                    'regex:/\S/u',
                ],
            ]
        )->validate();

        $comment->completion_status = $validated['completion_status'];
        $comment->closing_remarks = $validated['closing_remarks'];
        $comment->closed_by = $actor->user_id;
        $comment->closer_name = $actor->name;
        $comment->closed_at = now();
        $comment->saveOrFail();

        $this->record('closed', $comment, $actor);

        return $comment->refresh();
    }, 3);
}

public function capabilities(
    ManagementObjectiveComment $comment,
    User $actor
): array {
    $activeContent = in_array(
        $comment->strategicPlan?->status,
        ['draft', 'finished'],
        true
    ) && in_array(
        $comment->objective?->status,
        ['draft', 'published'],
        true
    );

    $permissions = $this->permissions->userPermissionCodes($actor);
    $open = $comment->completion_status === 'open';
    $active = $actor->status === 'active' && $activeContent;

    return [
        'can_acknowledge' => $active
            && $open
            && $comment->acknowledgement_status === 'not_acknowledged'
            && in_array($actor->role?->role_name, self::PLANNER_ROLES, true)
            && $permissions->contains(
                'management_objective_comments.acknowledge'
            ),

        'can_close' => $active
            && $open
            && $comment->acknowledgement_status === 'acknowledged'
            && in_array($actor->role?->role_name, self::MANAGEMENT_ROLES, true)
            && $comment->author_id !== null
            && (int) $comment->author_id === (int) $actor->user_id
            && $permissions->contains('management_objective_comments.close'),
    ];
}
}
