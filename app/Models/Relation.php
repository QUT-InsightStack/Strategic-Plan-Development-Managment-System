<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Relation extends Model
{
    use HasFactory;

    protected $table = 'tblrelation_map';
    protected $primaryKey = 'relation_id';

    protected $fillable = [
        'record_id',
        'parent_id',
        'created_by',
        'status',
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

    public function record()
    {
        return $this->belongsTo(Strategic::class, 'record_id', 'record_id');
    }

    public function parent()
    {
        return $this->belongsTo(Strategic::class, 'parent_id', 'record_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }
}
