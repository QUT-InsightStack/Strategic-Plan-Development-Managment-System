<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PdpChapter extends Model
{
    protected $table = 'tblpdp_chapters';
    protected $primaryKey = 'chapter_id';

    protected $fillable = [
        'chapter_title',
        'chapter_description',
        'created_by',
        'updated_by',
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
