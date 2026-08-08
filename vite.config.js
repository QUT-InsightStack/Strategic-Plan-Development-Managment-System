import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/css/login.css',
                'resources/css/office.css',
                'resources/css/profile.css',
                'resources/css/strategic-plan.css',
                'resources/css/user-roles.css',
                'resources/css/user-search.css',
                'resources/js/app.js',
                'resources/js/dashboard-app.js',
                'resources/js/login-app.js',
                'resources/js/office.js',
                'resources/js/profile-app.js',
                'resources/js/resource-app.js',
                'resources/js/resource-form-app.js',
                'resources/js/strategic-plan-app.js',
                'resources/js/user-roles-app.js',
                'resources/js/user-search-app.js',
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
