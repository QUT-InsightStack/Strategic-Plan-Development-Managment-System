<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StrategicDocument extends Model
{
    use HasFactory;

    protected $table = 'tblstrategic_documents';
    protected $primaryKey = 'document_id';

    protected $fillable = [
        'strategic_plan_id', 'objective_id', 'uploaded_by', 'original_filename',
        'stored_path', 'mime_type', 'extension', 'size_bytes', 'sha256',
        'reference_level', 'content_category',
    ];

    public function plan()
    {
        return $this->belongsTo(Strategic::class, 'strategic_plan_id', 'record_id');
    }

    public function objective()
    {
        return $this->belongsTo(StrategicObjective::class, 'objective_id', 'objective_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by', 'user_id');
    }
}
