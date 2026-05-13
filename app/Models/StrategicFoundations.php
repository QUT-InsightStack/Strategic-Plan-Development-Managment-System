<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicFoundations extends Model
{
    use HasFactory;

    protected $table = 'tblstrategic_foundations';
    protected $primaryKey = 'foundation_id';

    protected $fillable = [
        'created_by',
        'updated_by',
        'type',
        'content',
        'version',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public function missionRecords()
    {
        return $this->hasMany(Strategic::class, 'mission_id', 'foundation_id');
    }

    public function visionRecords()
    {
        return $this->hasMany(Strategic::class, 'vision_id', 'foundation_id');
    }

    public function coreValueLinks()
    {
        return $this->hasMany(Link::class, 'core_value_id', 'foundation_id');
    }

    public function coreValuePlans()
    {
        return $this->belongsToMany(
            Strategic::class,
            'tblplan_core_value',
            'core_value_id',
            'plan_id'
        )->withPivot(['created_by', 'updated_by'])->withTimestamps();
    }
}
