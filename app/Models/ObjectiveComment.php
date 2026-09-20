<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObjectiveComment extends Model
{
    protected $table = 'tblobjective_comments';

    protected $primaryKey = 'comment_id';

    public $timestamps = false;

    protected $fillable = ['objective_id', 'responsible_unit_id', 'submitted_by',
        'responsible_office_agency', 'submitter_name', 'content', 'submitted_at'];

    protected function casts(): array
    {
        return ['submitted_at' => 'immutable_datetime'];
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(StrategicObjective::class, 'objective_id');
    }
}
