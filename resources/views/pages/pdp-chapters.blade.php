<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $mode === 'manage' ? 'Manage PDP Chapters' : ($mode === 'detail' ? 'PDP Chapter Details' : 'PDP Chapters') }} | Strategic Planning Management System</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    @vite(['resources/css/pdp-chapters.css', 'resources/js/pages/shared/pdp-chapters-app.js'])
    <meta name="app-page-entry" content="{{ Vite::asset('resources/js/pages/shared/pdp-chapters-app.js') }}">
</head>
<body>
    <div id="root" data-mode="{{ $mode }}" data-chapter-id="{{ request()->route('chapter') }}"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
</body>
</html>
