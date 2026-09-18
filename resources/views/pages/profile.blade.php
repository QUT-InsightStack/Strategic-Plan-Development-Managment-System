<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile Settings | Strategic Planning Management System</title>
    @vite(['resources/css/profile.css', 'resources/js/pages/shared/profile-app.js'])
</head>
<body>
    <div id="root" data-profile-url="/api/auth/me" data-update-url="/api/auth/profile"></div>

    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
</body>
</html>
