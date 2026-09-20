<?php

namespace App\Notifications;

use App\Models\SystemAlert;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SystemAlertNotification extends Notification
{
    public function __construct(public readonly SystemAlert $alert, public readonly bool $recovered) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(($this->recovered ? 'Recovered: ' : 'System alert: ').$this->alert->condition)
            ->line('Condition: '.$this->alert->condition)
            ->line('Status: '.($this->recovered ? 'resolved' : 'open'))
            ->line('Alert ID: '.$this->alert->id)
            ->line('Occurred at: '.($this->recovered ? $this->alert->resolved_at : $this->alert->opened_at)->toIso8601String());
    }
}
