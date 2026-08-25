<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Change Password | Strategic Planning Management System</title>

    @vite([
        'resources/css/change-password.css',
        'resources/js/change-password-app.js'
    ])
</head>

<body>
    <div
        id="root"
        data-me-url="/api/me"
        data-change-password-url="/api/change-password">
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