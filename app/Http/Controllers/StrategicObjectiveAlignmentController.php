<?php

namespace App\Http\Controllers;

use App\Http\Requests\ArchiveStrategicAlignmentRequest;
use App\Services\StrategicAlignmentArchiveService;
use App\Http\Requests\DeleteStrategicAlignmentRequest;
use App\Services\StrategicAlignmentDeleteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\Strategic;
use App\Models\PdpChapter;
use App\Models\PresidentialAgendaItem;
use App\Models\PlanSubmission;
use App\Models\ResponsibleUnit;
use App\Models\User;
use App\Services\StrategicAlignmentLifecycleService;
use App\Services\StrategicObjectiveAlignmentService;
use App\Services\StrategicPlanAuthorizationService;
use App\Services\PermissionAuthorizationService;

class StrategicObjectiveAlignmentController extends Controller
{
    public function __construct(
        private readonly StrategicAlignmentArchiveService $archives,
        private readonly StrategicAlignmentDeleteService $deletions,
    ) {}

    public function index(Request $request, int $planId, StrategicPlanAuthorizationService $access, PermissionAuthorizationService $permissions): JsonResponse
    {
        $actor = $request->user('api');
        $permissions->ensureHasPermission('strategic_objectives.view', $actor);
        $plan = Strategic::where('status', '!=', 'deleted')->findOrFail($planId);
        $access->ensureCanViewPlan($plan, $actor);
        $has = fn ($code) => $actor->role?->hasFullAccess() || $permissions->userPermissionCodes($actor)->contains($code);
        $mutable = in_array($plan->status, StrategicObjectiveAlignmentService::MUTABLE_PLAN_STATUSES, true)
            && in_array($plan->approval_status, StrategicObjectiveAlignmentService::MUTABLE_APPROVAL_STATUSES, true);
        $deleteRoles = ['Administrator', 'Technical Administrator', 'Management'];
        if (app()->environment(['local', 'testing'])) {
            $deleteRoles[] = 'test';
        }
        $capabilities = [
            'create' => $mutable && $has('strategic_objectives.update'),
            'reference' => $mutable && $has('strategic_objectives.update'),
            'archive' => $mutable && $has('strategic_alignments.archive'),
            'restore' => $mutable && $has('strategic_alignments.archive'),
            'delete' => $plan->status === 'draft' && $plan->approval_status === 'not_submitted'
                && $has('strategic_alignments.delete') && in_array($actor->role?->role_name, $deleteRoles, true)
                && ! PlanSubmission::where('plan_id', $planId)->exists(),
        ];
        $objectives = $plan->objectives();
        if (in_array($actor->role?->role_name, ['Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'], true)) {
            $unit = ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey((string) $actor->office))
                ->where('is_active', true)->first();
            $objectives->whereHas('responsibleUnitAssignment', fn ($assignment) =>
                $assignment->where('responsible_unit_id', $unit?->responsible_unit_id));
        }
        $objectives = $objectives->with(['pdpChaptersWithArchived', 'presidentialAgendaItemsWithArchived'])->get();
        $rows = [];
        foreach ($objectives as $objective) {
            foreach (['pdp-chapter' => $objective->pdpChaptersWithArchived, 'presidential-agenda' => $objective->presidentialAgendaItemsWithArchived] as $type => $references) {
                foreach ($references as $reference) {
                    $rows[] = [
                        'id' => $objective->objective_id.':'.$type.':'.$reference->getKey(),
                        'plan_id' => $planId, 'objective_id' => $objective->objective_id,
                        'objective_title' => $objective->objective_title, 'objective_status' => $objective->status,
                        'responsible_office_agency' => $objective->responsible_office_agency,
                        'type' => $type, 'reference_id' => $reference->getKey(),
                        'reference_title' => $reference->chapter_title ?? $reference->title,
                        'reference_status' => $reference->status,
                        'status' => $reference->pivot->status, 'archived_at' => $reference->pivot->archived_at,
                        'archived_by' => $reference->pivot->archived_by,
                        'reference_details' => json_decode($reference->pivot->reference_details ?? '{}', true),
                    ];
                }
            }
        }
        $archivers = User::whereIn('user_id', array_column($rows, 'archived_by'))->get()->keyBy('user_id');
        foreach ($rows as &$row) {
            $archiver = $archivers->get($row['archived_by']);
            $row['archived_by_name'] = $archiver ? trim($archiver->first_name.' '.$archiver->last_name) : null;
        }
        unset($row);
        return response()->json(['success' => true, 'data' => $rows, 'meta' => [
            'plan' => $plan->only(['record_id', 'title', 'status', 'approval_status']),
            'capabilities' => $capabilities,
            'objectives' => $objectives->map(fn ($objective) => $objective->only(['objective_id', 'objective_title', 'status'])),
            'catalog' => $capabilities['create'] ? [
                'pdp_chapters' => PdpChapter::where('status', 'active')->get(['chapter_id', 'chapter_title']),
                'presidential_agenda' => PresidentialAgendaItem::where('status', 'active')->get(['agenda_id', 'code', 'title']),
            ] : ['pdp_chapters' => [], 'presidential_agenda' => []],
        ]]);
    }

    public function restore(ArchiveStrategicAlignmentRequest $request, int $id, string $type, int $referenceId, StrategicAlignmentLifecycleService $lifecycle): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Mapping restored.',
            'data' => $lifecycle->restore($id, $type, $referenceId, $request->user('api'))]);
    }

    public function reference(Request $request, int $id, string $type, int $referenceId, StrategicAlignmentLifecycleService $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'document_id' => ['required', 'integer', 'min:1'],
            'reference_section' => ['required_without:section', 'string'],
            'section' => ['required_without:reference_section', 'string'],
            'page_paragraph' => ['nullable', 'string'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        return response()->json(['success' => true, 'message' => 'Reference saved.',
            'data' => $lifecycle->reference($id, $type, $referenceId, $data, $request->user('api'))]);
    }

    public function archive(
        ArchiveStrategicAlignmentRequest $request,
        int $id,
        string $type,
        int $referenceId
    ): JsonResponse {
        $mapping = $this->archives->archive(
            $id,
            $type,
            $referenceId,
            $request->user('api')
        );

        return response()->json([
            'success' => true,
            'message' => 'Strategic alignment mapping archived successfully.',
            'data' => $mapping,
        ]);
    }

    public function destroy(
        DeleteStrategicAlignmentRequest $request,
        int $id,
        string $type,
        int $referenceId
    ): JsonResponse {
        $this->deletions->delete(
            $id,
            $type,
            $referenceId,
            $request->validated('reason'),
            $request->user('api')
        );
    
        return response()->json([
            'success' => true,
            'message' => 'Strategic alignment mapping permanently deleted successfully.',
        ]);
    }

    
}
