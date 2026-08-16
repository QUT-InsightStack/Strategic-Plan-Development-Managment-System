<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;

class NullStrategicLogWriter implements StrategicLogWriter
{
    public function write(string $event, array $context = []): void
    {
        // Placeholder until the dedicated log implementation is provided.
    }
}
