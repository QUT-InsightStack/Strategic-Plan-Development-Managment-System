import defaultAvatar from '../images/profile-avatar.svg';

const { useRef, useState, useEffect } = React;

const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const loginUrl = '/login';
const logoUrl = new URL('../images/logo.png', import.meta.url).href;

const apiConfig = {
    profileUrl: rootElement?.dataset?.profileUrl || '/api/me',
    updateUrl: rootElement?.dataset?.updateUrl || '/api/profile',
};

const initialProfile = {
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    address: '',
    profile_picture: '',
};

const messages = {
    help: 'Help resources are not connected yet.',
    contact: 'Contact details will be provided by the system administrator.',
    support: 'Support access is available for assigned users.',
    privacy: 'Privacy Notice content is not connected yet.',
    terms: 'Terms of Use content is not connected yet.',
    accessibility: 'Accessibility information is not connected yet.',
};

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic planning Management System home' },
        React.createElement('img', {
            className: 'brand-logo',
            src: logoUrl,
            alt: 'Strategic Planning Management System logo',
        }),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage, onLogout }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = dashboardUrl }, 'Dashboard'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.support) }, 'Support'),
            React.createElement('button', { className: 'nav-link logout-link', type: 'button', onClick: onLogout }, 'Logout')
        )
    );
}

function Icon({ type }) {
    const paths = {
        employee: 'M4 5h5V3h6v2h5v16H4V5Zm7 0h2V4h-2v1Zm-4 6h10V9H7v2Zm0 4h7v-2H7v2Z',
        lock: 'M7 10V8a5 5 0 0 1 10 0v2h1v10H6V10h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z',
        email: 'M3 5h18v14H3V5Zm9 7.1L5.8 7H5v.9l7 5.7 7-5.7V7h-.8L12 12.1Z',
    };

    return React.createElement(
        'span',
        { className: 'field-icon', 'aria-hidden': 'true' },
        React.createElement(
            'svg',
            { viewBox: '0 0 24 24' },
            React.createElement('path', { d: paths[type] })
        )
    );
}

function ProfileSideCard({ avatar, onAvatarSelect }) {
    const fileInputRef = useRef(null);

    function openFilePicker() {
        fileInputRef.current.click();
    }

    function handleFileChange(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        // For now, just create a data URL. In production, you'd upload to server
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            onAvatarSelect(dataUrl);
        };
        reader.readAsDataURL(file);
    }

    return React.createElement(
        'aside',
        { className: 'profile-side-card', 'aria-label': 'Profile photo panel' },
        React.createElement(
            'div',
            { className: 'avatar-frame' },
            React.createElement('img', { className: 'avatar-image', src: avatar || defaultAvatar, alt: 'Profile avatar preview' })
        ),
        React.createElement(
            'div',
            { className: 'upload-row' },
            React.createElement('button', { className: 'upload-button', type: 'button', onClick: openFilePicker, 'aria-label': 'Upload profile photo' }, '+'),
            React.createElement('button', { className: 'upload-action', type: 'button', onClick: openFilePicker }, 'Update your photo'),
            React.createElement('input', {
                ref: fileInputRef,
                type: 'file',
                accept: 'image/*',
                hidden: true,
                onChange: handleFileChange,
            })
        ),
        React.createElement('p', { className: 'side-copy' }, 'Manage your contact details', React.createElement('br'), 'and account information')
    );
}

function TextField({ id, label, value, error, type = 'text', icon, helperText, onHelperClick, onChange, disabled = false }) {
    return React.createElement(
        'div',
        { className: `field-group ${error ? 'has-error' : ''}` },
        React.createElement(
            'div',
            { className: 'field-label-row' },
            icon ? React.createElement(Icon, { type: icon }) : null,
            React.createElement('label', { htmlFor: id }, label)
        ),
        helperText
            ? React.createElement('button', { className: 'field-helper', type: 'button', onClick: onHelperClick }, helperText)
            : null,
        React.createElement('input', {
            className: 'field-input',
            id,
            name: id,
            type,
            value,
            disabled,
            onChange: (event) => onChange(event.target.value),
        }),
        React.createElement('p', { className: 'field-error' }, error || '')
    );
}

function ProfileForm({ status, setStatus, avatar, onAvatarChange }) {
    const [profile, setProfile] = useState(initialProfile);
    const [originalProfile, setOriginalProfile] = useState(initialProfile);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        // Sync profile_picture with avatar when avatar changes (e.g., from image upload)
        if (avatar && avatar !== defaultAvatar && avatar !== profile.profile_picture) {
            updateField('profile_picture', avatar);
        }
    }, [avatar]);

    function loadProfile() {
        fetch(apiConfig.profileUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            },
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    window.location.href = loginUrl;
                }
                throw new Error('Failed to load profile');
            }
            return response.json();
        })
        .then(data => {
            if (data.success === false) {
                throw new Error(data.message || 'Failed to load profile data.');
            }

            const payload = data?.data || data?.user || data;
            const profileData = {
                user_id: payload.user_id || payload.id || '',
                first_name: payload.first_name || '',
                last_name: payload.last_name || '',
                email: payload.email || '',
                mobile: payload.mobile || payload.phone || '',
                address: payload.address || '',
                profile_picture: payload.profile_picture || '',
            };

            setProfile(profileData);
            setOriginalProfile(profileData);

            if (profileData.profile_picture) {
                onAvatarChange(profileData.profile_picture);
            }

            setLoading(false);
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            setStatus('Failed to load profile data.', 'error');
            setLoading(false);
        });
    }

    function updateField(field, value) {
        setProfile((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function validate() {
        const nextErrors = {};

        if (!profile.first_name.trim()) {
            nextErrors.first_name = 'First name is required.';
        }

        if (!profile.last_name.trim()) {
            nextErrors.last_name = 'Last name is required.';
        }

        if (!profile.email.trim()) {
            nextErrors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
            nextErrors.email = 'Enter a valid email address.';
        }

        if (profile.mobile && !/^[\d\s\-\+\(\)]+$/.test(profile.mobile.trim())) {
            nextErrors.mobile = 'Enter a valid phone number.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function handleSave(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus('Please check the highlighted fields and try again.', 'error');
            return;
        }

        setStatus('Saving...', 'info');

        fetch(apiConfig.updateUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                first_name: profile.first_name.trim(),
                last_name: profile.last_name.trim(),
                email: profile.email.trim(),
                mobile: profile.mobile.trim(),
                address: profile.address.trim(),
                profile_picture: profile.profile_picture,
            }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    if (data.errors && typeof data.errors === 'object') {
                        setErrors(data.errors);
                    }
                    throw new Error(data.message || 'Failed to update profile');
                });
            }
            return response.json();
        })
        .then(data => {
            setOriginalProfile(profile);
            setStatus('Profile updated successfully!', 'success');
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            setStatus(error.message || 'Failed to update profile.', 'error');
        });
    }

    function handleCancel() {
        setProfile(originalProfile);
        setErrors({});
        setStatus('Changes were cancelled.', 'info');
    }

    if (loading) {
        return React.createElement(
            'section',
            { className: 'profile-card' },
            React.createElement('p', null, 'Loading profile...')
        );
    }

return React.createElement(
    'section',
    { className: 'profile-card modern-card', 'aria-labelledby': 'profile-form-title' },

    // HEADER
    React.createElement(
        'div',
        { className: 'profile-card-header' },
        React.createElement(
            'div',
            { className: 'header-copy' },
            React.createElement('h2', { id: 'profile-form-title' }, 'Edit Profile'),
            React.createElement('p', { className: 'subtitle' }, 'Update your personal and account details')
        )
    ),

    // FORM
    React.createElement(
        'form',
        { className: 'profile-form', noValidate: true, onSubmit: handleSave },

        // TWO COLUMN LAYOUT
        React.createElement(
            'div',
            { className: 'form-columns' },

            // ACCOUNT SECTION
            React.createElement(
                'div',
                { className: 'form-section' },
                React.createElement('h3', null, 'Account Information'),

                React.createElement(
                    'div',
                    { className: 'field-stack' },

                    React.createElement(TextField, {
                        id: 'user_id',
                        label: 'Employee ID',
                        icon: 'employee',
                        value: profile.user_id,
                        disabled: true,
                        onChange: () => {},
                    }),

                    React.createElement(TextField, {
                        id: 'email',
                        label: 'Email',
                        type: 'email',
                        icon: 'email',
                        value: profile.email,
                        error: errors.email,
                        onChange: (value) => updateField('email', value),
                    })
                )
            ),

            // PERSONAL SECTION
            React.createElement(
                'div',
                { className: 'form-section personal-section' },
                React.createElement('h3', null, 'Personal Information'),

                React.createElement(
                    'div',
                    { className: 'field-stack' },
                    React.createElement(TextField, {
                        id: 'first_name',
                        label: 'First Name',
                        value: profile.first_name,
                        error: errors.first_name,
                        onChange: (value) => updateField('first_name', value),
                    }),

                    React.createElement(TextField, {
                        id: 'last_name',
                        label: 'Last Name',
                        value: profile.last_name,
                        error: errors.last_name,
                        onChange: (value) => updateField('last_name', value),
                    }),

                    React.createElement(TextField, {
                        id: 'mobile',
                        label: 'Phone',
                        type: 'tel',
                        value: profile.mobile,
                        error: errors.mobile,
                        onChange: (value) => updateField('mobile', value),
                    })
                )
            )
        ),

        // ADDRESS FULL WIDTH
        React.createElement(
            'div',
            { className: 'address-field modern-field' },
            React.createElement(TextField, {
                id: 'address',
                label: 'Address',
                value: profile.address,
                error: errors.address,
                onChange: (value) => updateField('address', value),
            })
        ),

        // ACTION BUTTONS
        React.createElement(
            'div',
            { className: 'form-actions modern-actions' },

            React.createElement(
                'button',
                {
                    className: 'action-button secondary',
                    type: 'button',
                    onClick: handleCancel,
                },
                'Reset'
            ),

            React.createElement(
                'button',
                {
                    className: 'action-button primary',
                    type: 'submit',
                },
                'Save Changes'
            )
        ),

        // STATUS MESSAGE
        React.createElement(
            'p',
            {
                className: `form-status modern-status is-${status.type}`,
                role: 'status',
            },
            status.message
        )
    )
);
}

function Footer({ onMessage }) {
    return React.createElement(
        'footer',
        { className: 'app-footer' },
        React.createElement('span', null, String.fromCharCode(169), ' 2026 Strategic Planning Management System'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.privacy); } }, 'Privacy Notice'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.terms); } }, 'Terms of Use'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.accessibility); } }, 'Accessibility')
    );
}

function ProfileApp() {
    const [avatar, setAvatar] = useState(defaultAvatar);
    const [status, setStatusState] = useState({ message: '', type: 'info' });

    function setStatus(message, type = 'info') {
        setStatusState({ message, type });
    }

    function handleLogout() {
        fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            },
        })
        .then(() => {
            localStorage.removeItem('auth_token');
            window.location.href = loginUrl;
        })
        .catch(() => {
            // Even if logout fails, clear token and redirect
            localStorage.removeItem('auth_token');
            window.location.href = loginUrl;
        });
    }

    function handleAvatarSelect(avatarUrl) {
        setAvatar(avatarUrl);
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: (message) => setStatus(message, 'info'), onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, 'Profile Settings'),
                    React.createElement('p', null, 'Manage your account information and contact details.')
                ),
                React.createElement(
                    'div',
                    { className: 'profile-layout' },
                    React.createElement(ProfileSideCard, { avatar, onAvatarSelect: handleAvatarSelect }),
                    React.createElement(ProfileForm, { status, setStatus, avatar, onAvatarChange: setAvatar })
                )
            )
        ),
        React.createElement(Footer, { onMessage: (message) => setStatus(message, 'info') })
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(ProfileApp));
