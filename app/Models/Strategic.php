<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Strategic extends Model
{
    use HasFactory;

    protected $table = 'tblstrategic_record';
    protected $primaryKey = 'record_id';

    protected $fillable = [
        'created_by',
        'updated_by',
        'level',
        'title',
        'description',
        'status',
        'archived_at',
        'archived_by',
        'deleted_at',
        'file_path',
        'mission_id',
        'vision_id',

    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public function missionFoundation()
    {
        return $this->belongsTo(StrategicFoundations::class, 'mission_id', 'foundation_id')
            ->where('status', '!=', 'deleted');
    }

    public function visionFoundation()
    {
        return $this->belongsTo(StrategicFoundations::class, 'vision_id', 'foundation_id')
            ->where('status', '!=', 'deleted');
    }

    public function parents()
    {
        return $this->belongsToMany(
            Strategic::class,
            'tblrelation_map',
            'record_id',
            'parent_id'
        )->withPivot(['created_by', 'status', 'archived_at', 'archived_by', 'deleted_at'])->withTimestamps()
            ->wherePivot('status', '!=', 'deleted');
    }

    public function children()
    {
        return $this->belongsToMany(
            Strategic::class,
            'tblrelation_map',
            'parent_id',
            'record_id'
        )->withPivot(['created_by', 'status', 'archived_at', 'archived_by', 'deleted_at'])->withTimestamps()
            ->wherePivot('status', '!=', 'deleted');
    }

    public function parentRelations()
    {
        return $this->hasMany(Relation::class, 'record_id', 'record_id');
    }

    public function childRelations()
    {
        return $this->hasMany(Relation::class, 'parent_id', 'record_id');
    }

    public function coreValueLinks()
    {
        return $this->hasMany(Link::class, 'plan_id', 'record_id');
    }

    public function coreValues()
    {
        return $this->belongsToMany(
            StrategicFoundations::class,
            'tblplan_core_value',
            'plan_id',
            'core_value_id'
        )->withPivot(['created_by', 'updated_by', 'status', 'archived_at', 'archived_by', 'deleted_at'])->withTimestamps()
            ->where('tblstrategic_foundations.status', '!=', 'deleted')
            ->wherePivot('status', '!=', 'deleted');
    }

    public function objectives()
    {
        return $this->hasMany(StrategicObjective::class, 'strategic_plan_id', 'record_id')
            ->where('status', '!=', 'deleted');
    }
}
