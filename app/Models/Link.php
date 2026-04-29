<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Link extends Model
{
    use HasFactory;

    protected $table = 'tblplan_core_value';
    protected $primaryKey = 'link_id';

    protected $fillable = [
        'core_value_id',
        'plan_id',
        'created_by',
        'updated_by',
    ];

    public function coreValue()
    {
        return $this->belongsTo(StrategicFoundations::class, 'core_value_id', 'foundation_id');
    }

    public function plan()
    {
        return $this->belongsTo(Strategic::class, 'plan_id', 'record_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }
}
