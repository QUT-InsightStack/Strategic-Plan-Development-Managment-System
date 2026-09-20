<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PdpChapter extends Model
{
    protected $table = 'tblpdp_chapters';
    protected $primaryKey = 'chapter_id';

    protected $fillable = [
        'chapter_title',
        'chapter_description',
        'created_by',
        'updated_by',
        // status/archived_at/archived_by/deleted_at/deleted_by intentionally
        // excluded — they change only through archive()/delete(), never via
        // generic create/update, same principle as rejecting role_id on
        // generic user updates.

    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
    ];
    }

    public function strategicObjectives(): BelongsToMany
    {
        return $this->belongsToMany(
            StrategicObjective::class,
            'tblobjective_pdp_chapter',
            'chapter_id',
            'objective_id'
        )->withTimestamps();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public function deleter()
    {
        return $this->belongsTo(User::class, 'deleted_by', 'user_id');
    }


    public function archiver()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeArchived($query)
    {
        return $query->where('status', 'archived');
    }

    public function scopeNotDeleted($query)
    {
        return $query->where('status', '!=', 'deleted');
    }

}