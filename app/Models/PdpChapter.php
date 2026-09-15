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
    ];

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
}
