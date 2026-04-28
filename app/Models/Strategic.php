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
        'content',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }
}