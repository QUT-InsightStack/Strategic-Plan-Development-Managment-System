<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ResponsibleUnit extends Model
{
    protected $table = 'tblresponsible_units';

    protected $primaryKey = 'responsible_unit_id';

    protected $fillable = ['responsible_office_agency', 'name_key', 'is_active'];

    protected $hidden = ['name_key'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public static function nameKey(string $name): string
    {
        return hash('sha256', mb_strtolower(trim($name), 'UTF-8'));
    }

    public function objectives(): BelongsToMany
    {
        return $this->belongsToMany(StrategicObjective::class, 'tblobjective_responsible_units',
            'responsible_unit_id', 'objective_id')->withPivot('assigned_by')->withTimestamps();
    }
}
