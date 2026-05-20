<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Office Page - Strategic Planning System</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">

    <!-- Custom CSS -->
    @vite(['resources/css/office.css', 'resources/js/office.js'])
</head>

<body>

    <!-- Sidebar -->
    <div class="sidebar" id="sidebar">
        <h5 class="sidebar-title">Menu</h5>

        <a href="#" class="sidebar-item active">Planner/encoder</a>
        <a href="#" class="sidebar-item">Add reference</a>
        <a href="#" class="sidebar-item">Check records</a>
        <a href="#" class="sidebar-item">Pending draft</a>
        <a href="#" class="sidebar-item">View mapping</a>

        <button class="collapse-btn" onclick="toggleSidebar()">
            <i class="bi bi-chevron-left"></i>
        </button>
    </div>

    <!-- Main Content -->
    <div class="main-content" id="mainContent">

        <h3 class="page-title">Pending draft</h3>

        <!-- Filters -->
        <div class="filter-box shadow-sm">
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">Unit</label>
                    <select class="form-select">
                        <option>Select Unit</option>
                    </select>
                </div>

                <div class="col-md-4">
                    <label class="form-label">Report Type</label>
                    <select class="form-select">
                        <option>Select Report Type</option>
                    </select>
                </div>

                <div class="col-md-4">
                    <label class="form-label">Creation Date</label>
                    <input type="date" class="form-control">
                </div>
            </div>

            <div class="mt-3 d-flex justify-content-between">
                <button class="btn btn-primary">Go</button>
                <a href="#" class="text-primary small">Adapt Filters (1)</a>
            </div>
        </div>

        <!-- Task Cards -->
        <div class="row mt-4 g-3">
            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>

            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>

            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>

            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>

            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>

            <div class="col-md-4">
                <div class="task-card shadow-sm">
                    <p><strong>Task:</strong> Publish oS3 Investor Relations Website v6 (CMO)</p>
                    <p><strong>Platform:</strong> F.6.3 Marketing</p>
                    <p><strong>Process:</strong> F.6.3.0 IR Website...</p>
                </div>
            </div>
        </div>

        <!-- Save Button -->
        <div class="text-end mt-4">
            <button class="btn btn-primary px-4">Save</button>
        </div>

    </div>

</body>
</html>
