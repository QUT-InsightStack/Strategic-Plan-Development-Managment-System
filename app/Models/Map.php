<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Map extends Model
{
    use HasFactory;

    protected $table = 'tblrelation_map';
    protected $primaryKey = 'relation_id';

    protected $fillable = [
        'record_id',
        'parent_id',
        'created_by',
    ];

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