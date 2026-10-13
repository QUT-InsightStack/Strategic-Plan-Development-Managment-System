<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Reset Password | Strategic Planning Management System</title>

    @vite([
        'resources/css/login.css',
        'resources/js/pages/auth/reset-password-app.js'
    ])
    <meta name="app-page-entry" content="{{ Vite::asset('resources/js/pages/auth/reset-password-app.js') }}">
</head>

<body>
    <div
        id="root"
        data-reset-password-url="/api/reset-password"
        data-token="{{ $token }}"
        data-email="{{ $email }}">
    </div>

    <script
        src="https://unpkg.com/react@18/umd/react.development.js"
        crossorigin>
    </script>

    <script
        src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"
        crossorigin>
    </script>
</body>
</html>
