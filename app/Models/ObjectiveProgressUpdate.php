<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ObjectiveProgressUpdate extends Model
{
    protected $table = 'tblobjective_progress_updates';

    protected $primaryKey = 'progress_update_id';

    public $timestamps = false;

    protected $guarded = ['progress_update_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'is_correction' => 'boolean', 'previous_percentage' => 'integer', 'new_percentage' => 'integer'];
    }
}
