const { useRef, useState } = React;

const rootElement = document.getElementById('root');

const apiConfig = {
    profileUrl: rootElement.dataset.profileUrl || '/api/user',
};

const initialProfile = {
    employeeId: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
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
        { className: 'brand', href: './login.html', 'aria-label': 'Strategic planning Management System home' },
        React.createElement(
            'span',
            { className: 'brand-mark', 'aria-hidden': 'true' },
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span')
        ),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.support) }, 'Support')
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

        onAvatarSelect(URL.createObjectURL(file));
    }

    return React.createElement(
        'aside',
        { className: 'profile-side-card', 'aria-label': 'Profile photo panel' },
        React.createElement(
            'div',
            { className: 'avatar-frame' },
            React.createElement('img', { className: 'avatar-image', src: avatar, alt: 'Profile avatar preview' })
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

function TextField({ id, label, value, error, type = 'text', icon, helperText, onHelperClick, onChange }) {
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
            onChange: (event) => onChange(event.target.value),
        }),
        React.createElement('p', { className: 'field-error' }, error || '')
    );
}

function ProfileForm({ status, setStatus }) {
    const [profile, setProfile] = useState(() => {
        const savedProfile = window.localStorage.getItem('spms.profileDraft');
        return savedProfile ? JSON.parse(savedProfile) : initialProfile;
    });
    const [savedProfile, setSavedProfile] = useState(profile);
    const [errors, setErrors] = useState({});

    function updateField(field, value) {
        setProfile((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function validate() {
        const nextErrors = {};

        if (!profile.employeeId.trim()) {
            nextErrors.employeeId = 'Employee ID is required.';
        }

        if (!profile.email.trim()) {
            nextErrors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
            nextErrors.email = 'Enter a valid email address.';
        }

        if (!profile.firstName.trim()) {
            nextErrors.firstName = 'First name is required.';
        }

        if (!profile.lastName.trim()) {
            nextErrors.lastName = 'Last name is required.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function handleSave(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus('Check the highlighted fields and try again.', 'error');
            return;
        }

        window.localStorage.setItem('spms.profileDraft', JSON.stringify(profile));
        setSavedProfile(profile);
        setStatus(`Profile is ready to save through ${apiConfig.profileUrl}.`, 'success');
    }

    function handleCancel() {
        setProfile(savedProfile);
        setErrors({});
        setStatus('Changes were cancelled.', 'info');
    }

    return React.createElement(
        'section',
        { className: 'profile-card', 'aria-labelledby': 'profile-form-title' },
        React.createElement(
            'div',
            { className: 'profile-card-header' },
            React.createElement('h2', { id: 'profile-form-title' }, 'Personal an Account Information'),
            React.createElement('p', null, 'update your details below')
        ),
        React.createElement(
            'form',
            { className: 'profile-form', noValidate: true, onSubmit: handleSave },
            React.createElement(
                'div',
                { className: 'form-columns' },
                React.createElement(
                    'div',
                    { className: 'form-section' },
                    React.createElement('h3', null, 'Account information'),
                    React.createElement(
                        'div',
                        { className: 'field-stack' },
                        React.createElement(TextField, {
                            id: 'employeeId',
                            label: 'Employee ID',
                            icon: 'employee',
                            value: profile.employeeId,
                            error: errors.employeeId,
                            onChange: (value) => updateField('employeeId', value),
                        }),
                        React.createElement(TextField, {
                            id: 'password',
                            label: 'Password',
                            type: 'password',
                            icon: 'lock',
                            helperText: 'Change password ?',
                            value: profile.password,
                            error: errors.password,
                            onHelperClick: () => setStatus('Password changes should be connected to a secure backend endpoint.', 'info'),
                            onChange: (value) => updateField('password', value),
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
                React.createElement(
                    'div',
                    { className: 'form-section personal-section' },
                    React.createElement('h3', null, 'Personal Information'),
                    React.createElement(
                        'div',
                        { className: 'field-stack' },
                        React.createElement(TextField, {
                            id: 'firstName',
                            label: 'First Name',
                            value: profile.firstName,
                            error: errors.firstName,
                            onChange: (value) => updateField('firstName', value),
                        }),
                        React.createElement(TextField, {
                            id: 'lastName',
                            label: 'Last Name',
                            value: profile.lastName,
                            error: errors.lastName,
                            onChange: (value) => updateField('lastName', value),
                        }),
                        React.createElement(TextField, {
                            id: 'phone',
                            label: 'phone',
                            type: 'tel',
                            value: profile.phone,
                            error: errors.phone,
                            onChange: (value) => updateField('phone', value),
                        })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'address-field' },
                React.createElement(TextField, {
                    id: 'address',
                    label: 'Address',
                    value: profile.address,
                    error: errors.address,
                    onChange: (value) => updateField('address', value),
                })
            ),
            React.createElement(
                'div',
                { className: 'form-actions' },
                React.createElement('button', { className: 'action-button secondary', type: 'button', onClick: handleCancel }, 'cancel'),
                React.createElement('button', { className: 'action-button', type: 'submit' }, 'Save changes')
            ),
            React.createElement('p', { className: `form-status is-${status.type}`, role: 'status', 'aria-live': 'polite' }, status.message)
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
    const [avatar, setAvatar] = useState('./images/profile-avatar.svg');
    const [status, setStatusState] = useState({ message: '', type: 'info' });

    function setStatus(message, type = 'info') {
        setStatusState({ message, type });
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: (message) => setStatus(message, 'info') }),
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
                    React.createElement(ProfileSideCard, { avatar, onAvatarSelect: setAvatar }),
                    React.createElement(ProfileForm, { status, setStatus })
                )
            )
        ),
        React.createElement(Footer, { onMessage: (message) => setStatus(message, 'info') })
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(ProfileApp));
