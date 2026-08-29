import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/css/create-user.css',
                'resources/css/login.css',
                'resources/css/office.css',
                'resources/css/profile.css',
                'resources/css/pdp-chapters.css',
                'resources/css/strategic-plan.css',
                'resources/css/strategic-plans-list.css',
                'resources/css/strategic-objectives.css',
                'resources/css/strategic-objectives-list.css',
                'resources/css/role-management.css',
                'resources/css/user-management.css',
                'resources/css/login-history.css',
                'resources/css/manual-backup.css',
                'resources/css/access-denied.css',
                'resources/js/app.js',
                'resources/js/create-user-app.js',
                'resources/js/dashboard-app.js',
                'resources/js/login-app.js',
                'resources/js/office.js',
                'resources/js/profile-app.js',
                'resources/js/resource-app.js',
                'resources/js/resource-form-app.js',
                'resources/js/strategic-plan-app.js',
                'resources/js/pages/strategic-plan-list-app.js',
                'resources/js/pages/strategic-plan-edit-app.js',
                'resources/js/pages/strategic-objectives-app.js',
                'resources/js/pages/strategic-objectives-list-app.js',
                'resources/js/pages/role-management-app.js',
                'resources/js/pages/user-management-app.js',
                'resources/js/pages/login-history-app.js',
                'resources/js/pages/manual-backup-app.js',
                'resources/js/pages/pdp-chapters-app.js',
                'resources/js/pages/access-denied-app.js',
            ],
            refresh: true,
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
