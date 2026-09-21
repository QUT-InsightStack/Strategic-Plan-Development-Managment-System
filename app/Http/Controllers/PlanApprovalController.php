<?php

namespace App\Http\Controllers;

use App\Models\ImplementationInput;
use App\Models\PlanSubmission;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Services\PlanApprovalService;
use App\Services\StrategicDocumentService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlanApprovalController extends Controller
{
    public function __construct(private PlanApprovalService $service) {}

    public function submit(Request $request, int $plan)
    {
        return response()->json(['data' => $this->service->submit($plan, $request->user('api'))], 201);
    }

    public function preparation(Request $request, int $plan, StrategicPlanAuthorizationService $access)
    {
        $actor = $request->user('api');
        abort_unless(in_array($actor->role?->role_name, ['Planning Officer', 'Administrator'], true), 403);
        $record = Strategic::findOrFail($plan);
        $access->ensureCanUpdatePlan($record, $actor);

        return response()->json(['data' => [
            'pending_inputs' => $record->inputs()->where('review_status', ImplementationInput::PENDING_REVIEW)->count(),
        ]]);
    }

    public function show(Request $request, int $plan)
    {
        return response()->json(['data' => $this->service->review($plan, $request->user('api'))]);
    }

    public function index(Request $request)
    {
        $actor = $request->user('api');
        $data = $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $submissions = PlanSubmission::where('status', 'under_approval')
            ->whereHas('stages', fn ($query) => $query->where('status', 'current')
                ->whereHas('reviewers', fn ($query) => $query->where('tblusers.user_id', $actor->user_id)))
            ->with(['stages.reviewers', 'history'])->orderBy('submitted_at')->paginate($data['per_page'] ?? 25);

        return response()->json($submissions);
    }

    public function decide(Request $request, int $plan)
    {
        $data = $request->validate([
            'submission_id' => ['required', 'integer'], 'stage_id' => ['required', 'integer'],
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'comment' => ['required_if:decision,reject', 'nullable', 'string', 'max:5000'],
        ]);

        return response()->json(['data' => $this->service->decide($plan, $data, $request->user('api'))]);
    }

    public function document(Request $request, int $submission, int $document, StrategicDocumentService $documents)
    {
        $record = PlanSubmission::findOrFail($submission);
        $this->service->authorizeParticipant($record, $request->user('api'));
        $snapshot = $record->plan_snapshot;
        $attachments = collect($snapshot['documents'])->concat(collect($snapshot['objectives'])->flatMap(fn ($objective) => $objective['documents']));
        $attachment = $attachments->firstWhere('document_id', $document);
        abort_unless($attachment, 404, 'Document not included in this submission.');
        $file = StrategicDocument::findOrFail($document);
        $path = $documents->pathFor($file);
        abort_unless($path && hash_file('sha256', $path) === $attachment['sha256'], 404, 'The submitted document is unavailable.');

        return response()->download($path, $attachment['original_filename'], ['X-Content-Type-Options' => 'nosniff']);
    }
}
