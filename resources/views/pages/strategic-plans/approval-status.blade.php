<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Approval Status | Strategic Planning Management System</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    @vite([
    'resources/css/strategic-plan-review.css',
    'resources/css/strategic-plans-list.css',
    'resources/css/approval-status.css',
    'resources/js/pages/planner/approval-status-app.js'
])
</head>
<body>
    <div id="root" data-plan-id="{{ $planId }}"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
</body>
</html>
