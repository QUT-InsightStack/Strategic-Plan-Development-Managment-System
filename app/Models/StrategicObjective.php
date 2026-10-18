<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class StrategicObjective extends Model
{
    use HasFactory;

    protected $table = 'tblstrategic_objectives';

    protected $primaryKey = 'objective_id';

    protected $fillable = [
        'strategic_plan_id',
        'created_by',
        'updated_by',
        'objective_title',
        'objective_description',
        'expected_outcome',
        'indicator',
        'target',
        'responsible_office_agency',
        'status',
        'status_before_archive',
        'archived_at',
        'archived_by',
        'deleted_at',
    ];

    protected function casts(): array
    {
        return [
            'progress_percentage' => 'integer',
            'progress_updated_at' => 'datetime',
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function strategicPlan()
    {
        return $this->belongsTo(Strategic::class, 'strategic_plan_id', 'record_id');
    }

        /**
     * Active mappings only. Used by API responses and approval snapshots.
     */
    public function pdpChapters(): BelongsToMany
    {
        return $this->pdpChaptersWithArchived()
            ->wherePivot('status', 'active');
    }

    /**
     * Active mappings only. Used by API responses and approval snapshots.
     */
    public function presidentialAgendaItems(): BelongsToMany
    {
        return $this->presidentialAgendaItemsWithArchived()
            ->wherePivot('status', 'active');
    }

    /**
     * Historical read access, including archived mappings. Never use this
     * for active views, calculations, or plan validation.
     */
    public function pdpChaptersWithArchived(): BelongsToMany
    {
        return $this->belongsToMany(
            PdpChapter::class,
            'tblobjective_pdp_chapter',
            'objective_id',
            'chapter_id'
        )
            ->withPivot(['status', 'archived_at', 'archived_by', 'reference_details'])
            ->withTimestamps()
            ->orderBy('tblpdp_chapters.chapter_id');
    }

    /**
     * Historical read access, including archived mappings. Never use this
     * for active views, calculations, or plan validation.
     */
    public function presidentialAgendaItemsWithArchived(): BelongsToMany
    {
        return $this->belongsToMany(
            PresidentialAgendaItem::class,
            'tblobjective_presidential_agenda',
            'objective_id',
            'agenda_id'
        )
            ->withPivot(['status', 'archived_at', 'archived_by', 'reference_details'])
            ->withTimestamps()
            ->orderBy('tblpresidential_agenda_items.agenda_id');
    }
    
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function responsibleUnitAssignment()
    {
        return $this->hasOne(ObjectiveResponsibleUnit::class, 'objective_id', 'objective_id');
    }

    public function comments()
    {
        return $this->hasMany(ObjectiveComment::class, 'objective_id', 'objective_id');
    }

    public function inputs()
    {
        return $this->hasMany(ImplementationInput::class, 'objective_id', 'objective_id');
    }

    public function documents()
    {
        return $this->hasMany(StrategicDocument::class, 'objective_id', 'objective_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public function progressUpdater()
    {
        return $this->belongsTo(User::class, 'progress_updated_by', 'user_id');
    }

    public function progressUpdates()
    {
        return $this->hasMany(ObjectiveProgressUpdate::class, 'objective_id', 'objective_id');
    }
}
