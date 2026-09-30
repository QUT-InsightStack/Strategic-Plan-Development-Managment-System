<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PresidentialAgendaItem extends Model
{
    protected $table = 'tblpresidential_agenda_items';

    protected $primaryKey = 'agenda_id';

    protected $fillable = [
        'code',
        'title',
        'description',
        'effective_date',
        'note',
        'created_by',
        'updated_by',
        // Lifecycle fields are intentionally excluded.
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date:Y-m-d',
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function strategicObjectives(): BelongsToMany
    {
        return $this->belongsToMany(
            StrategicObjective::class,
            'tblobjective_presidential_agenda',
            'agenda_id',
            'objective_id'
        )
            ->withPivot(['status', 'archived_at', 'archived_by'])
            ->wherePivot('status', 'active')
            ->withTimestamps();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public function archiver()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    public function deleter()
    {
        return $this->belongsTo(User::class, 'deleted_by', 'user_id');
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