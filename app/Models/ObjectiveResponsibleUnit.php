<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObjectiveResponsibleUnit extends Model
{
    protected $table = 'tblobjective_responsible_units';

    protected $primaryKey = 'objective_id';

    public $incrementing = false;

    protected $fillable = ['objective_id', 'responsible_unit_id', 'assigned_by'];

    public function responsibleUnit(): BelongsTo
    {
        return $this->belongsTo(ResponsibleUnit::class, 'responsible_unit_id');
    }
}
