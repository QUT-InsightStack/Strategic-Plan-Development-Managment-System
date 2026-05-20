window.toggleSidebar = function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
    document.getElementById('mainContent')?.classList.toggle('expanded');
};
