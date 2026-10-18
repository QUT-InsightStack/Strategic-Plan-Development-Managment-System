<?php

namespace App\Contracts;

interface StrategicLogWriter
{
    public function write(string $event, array $context = []): void;
}
