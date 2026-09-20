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
        'status',
        'effective_date',
        'note',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date:Y-m-d',
        ];
    }

    public function strategicObjectives(): BelongsToMany
    {
        return $this->belongsToMany(
            StrategicObjective::class,
            'tblobjective_presidential_agenda',
            'agenda_id',
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
