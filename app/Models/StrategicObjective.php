<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicObjective extends Model
{
    use HasFactory;

    protected $table = 'tblstrategic_objectives';

    protected $primaryKey = 'objective_id';

    protected $fillable = [
        'strategic_plan_id',
        'created_by',
        'updated_by',
        'objective_title',
        'objective_description',
        'expected_outcome',
        'indicator',
        'target',
        'responsible_office_agency',
        'status',
        'status_before_archive',
        'archived_at',
        'archived_by',
        'deleted_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function strategicPlan()
    {
        return $this->belongsTo(Strategic::class, 'strategic_plan_id', 'record_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function responsibleUnitAssignment()
    {
        return $this->hasOne(ObjectiveResponsibleUnit::class, 'objective_id', 'objective_id');
    }

    public function comments()
    {
        return $this->hasMany(ObjectiveComment::class, 'objective_id', 'objective_id');
    }

    public function inputs()
    {
        return $this->hasMany(ImplementationInput::class, 'objective_id', 'objective_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }
}
