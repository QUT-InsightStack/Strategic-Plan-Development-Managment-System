<?php

namespace App\Http\Requests;

use App\Services\PermissionAuthorizationService;

class StoreObjectiveCommentRequest extends StoreObjectiveFeedbackRequest
{
    public function authorize(): bool
    {
        app(PermissionAuthorizationService::class)->ensureHasPermission('objective_comments.create');

        return true;
    }

    public function rules(): array
    {
        return $this->feedbackRules();
    }
}
