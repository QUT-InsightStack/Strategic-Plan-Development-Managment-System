import defaultAvatar from '../images/profile-avatar.svg';
import { BrandLogo } from './brand-logo.js';
import { logout, guardAgainstBackNavigation } from './auth-session.js';
import { LogoutButton } from './components/LogoutButton.js';
import { AppDialog } from './components/AppDialog.js';
import { myLoginHistory } from './api/login-history-api.js';
import { PHOTO_ACCEPT, checkPhoto, removeProfilePhoto, uploadProfilePhoto } from './api/profile-photo-api.js';

const { useRef, useState, useEffect } = React;

const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const loginUrl = '/login';

const apiConfig = {
    profileUrl: rootElement?.dataset?.profileUrl || '/api/auth/me',
    updateUrl: rootElement?.dataset?.updateUrl || '/api/auth/profile',
};

// The fields this form owns. profile_picture is deliberately absent: it is a
// file, handled by the photo endpoint, and the profile endpoint now rejects it.
const EDITABLE_FIELDS = ['first_name', 'last_name', 'email', 'mobile', 'address', 'designation'];

const initialProfile = {
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    address: '',
    designation: '',
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
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic Planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic Planning Management System')
    );
}

function Header({ onMessage, onLogout, loggingOut }) {
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
            React.createElement(LogoutButton)
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

function ProfileSideCard({ avatar, identity, onAvatarSelect, onMessage }) {
    const fileInputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(false);

    const hasPhoto = Boolean(avatar) && avatar !== defaultAvatar;

    function openFilePicker() {
        fileInputRef.current.click();
    }

    async function handleFileChange(event) {
        const file = event.target.files[0];

        // Cleared straight away so choosing the same file twice — after a
        // failure, say — still fires a change event.
        event.target.value = '';

        if (!file) {
            return;
        }

        const problem = checkPhoto(file);
        if (problem) {
            setPhotoError(problem);
            return;
        }

        setPhotoError('');
        setBusy(true);

        try {
            const payload = await uploadProfilePhoto(file);
            onAvatarSelect(payload.data?.profile_picture || defaultAvatar);
            onMessage('Photo updated successfully.', 'success');
        } catch (error) {
            setPhotoError(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleRemove() {
        setConfirmRemove(false);
        setPhotoError('');
        setBusy(true);

        try {
            await removeProfilePhoto();
            onAvatarSelect(defaultAvatar);
            onMessage('Photo removed successfully.', 'success');
        } catch (error) {
            setPhotoError(error.message);
        } finally {
            setBusy(false);
        }
    }

    const fullName = [identity?.first_name, identity?.last_name].filter(Boolean).join(' ');

    return React.createElement(
        'aside',
        { className: 'profile-side-card', 'aria-label': 'Your profile summary' },
        React.createElement(
            'div',
            { className: 'avatar-frame' },
            React.createElement('img', { className: 'avatar-image', src: avatar || defaultAvatar, alt: fullName ? `Profile photo of ${fullName}` : 'Profile photo' })
        ),
        React.createElement(
            'div',
            { className: 'profile-identity' },
            React.createElement('strong', { className: 'profile-identity__name' }, fullName || 'Your profile'),
            identity?.designation ? React.createElement('span', { className: 'profile-identity__role' }, identity.designation) : null,
            identity?.email ? React.createElement('span', { className: 'profile-identity__email' }, identity.email) : null
        ),
        React.createElement(
            'div',
            { className: 'photo-actions' },
            React.createElement('button', { className: 'action-button secondary photo-change', type: 'button', onClick: openFilePicker, disabled: busy, 'aria-describedby': photoError ? 'photo-error' : 'photo-hint' },
                React.createElement('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, React.createElement('path', { d: 'M9 4h6l1.5 2H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5L9 4Zm3 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z' })),
                busy ? 'Working…' : hasPhoto ? 'Change photo' : 'Upload photo'),
            hasPhoto
                ? React.createElement('button', { className: 'photo-remove', type: 'button', onClick: () => setConfirmRemove(true), disabled: busy }, 'Remove photo')
                : null,
            React.createElement('input', {
                ref: fileInputRef,
                type: 'file',
                accept: PHOTO_ACCEPT,
                hidden: true,
                onChange: handleFileChange,
            })
        ),
        photoError
            ? React.createElement('p', { className: 'photo-error', id: 'photo-error', role: 'alert' }, photoError)
            : React.createElement('p', { className: 'photo-hint', id: 'photo-hint' }, 'JPG, PNG or WebP, up to 2 MB.'),
        React.createElement(
            'div',
            { className: 'profile-security' },
            React.createElement('h3', null, 'Security'),
            React.createElement('p', null, 'Change your password regularly and never share it.'),
            React.createElement(
                'a',
                { className: 'action-button secondary profile-password-button', href: '/change-password' },
                'Change password'
            )
        ),
        React.createElement(AppDialog, {
            open: confirmRemove,
            variant: 'danger',
            title: 'Remove your photo?',
            message: 'Your profile will show the default avatar until you upload a new photo.',
            confirmLabel: 'Remove photo',
            cancelLabel: 'Keep photo',
            onConfirm: handleRemove,
            onCancel: () => setConfirmRemove(false),
        })
    );
}

function TextField({ id, label, value, error, type = 'text', icon, helperText, onHelperClick, onChange, disabled = false, required = false, hint = '', autoComplete }) {
    return React.createElement(
        'div',
        { className: `field-group ${error ? 'has-error' : ''}` },
        React.createElement(
            'div',
            { className: 'field-label-row' },
            icon ? React.createElement(Icon, { type: icon }) : null,
            React.createElement('label', { htmlFor: id }, label, required ? React.createElement('span', { className: 'field-required', 'aria-hidden': 'true' }, ' *') : null)
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
            required,
            autoComplete,
            'aria-required': required ? 'true' : undefined,
            // Ties the message below to the input, so a screen reader reads
            // the reason rather than just announcing the field as invalid.
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined,
            onChange: (event) => onChange(event.target.value),
        }),
        hint && !error
            ? React.createElement('p', { id: `${id}-hint`, className: 'field-hint' }, hint)
            : null,
        error
            ? React.createElement('p', { id: `${id}-error`, className: 'field-error', role: 'alert' }, error)
            : null
    );
}

function ProfileForm({ status, setStatus, onAvatarChange, onProfileLoaded }) {
    const [profile, setProfile] = useState(initialProfile);
    const [originalProfile, setOriginalProfile] = useState(initialProfile);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const formRef = useRef(null);

    // The photo is no longer part of this form. It is uploaded as a file by
    // the side card and saved by its own endpoint, so nothing here has to
    // keep `profile_picture` in step with the avatar.
    const dirty = EDITABLE_FIELDS.some((field) => profile[field] !== originalProfile[field]);

    useEffect(() => {
        loadProfile();
    }, []);

    // Unsaved edits are easy to lose on a page with a sidebar full of links.
    useEffect(() => {
        if (!dirty) return undefined;

        function warn(event) {
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    function loadProfile() {
        setLoading(true);
        setLoadError('');
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
                designation: payload.designation || '',
                profile_picture: payload.profile_picture || '',
            };

            setProfile(profileData);
            setOriginalProfile(profileData);
            onProfileLoaded?.(profileData);

            if (profileData.profile_picture) {
                onAvatarChange(profileData.profile_picture);
            }

            setLoading(false);
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            // Without the saved values the form would show blanks that could
            // be saved over real data, so it is not shown at all.
            setLoadError('Your profile could not be loaded. Check your connection and try again.');
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

        if (profile.designation && profile.designation.trim().length > 255) {
            nextErrors.designation = 'Designation must be 255 characters or fewer.';
        }

        setErrors(nextErrors);
        focusFirstError(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function focusFirstError(nextErrors) {
        const order = ['email', 'designation', 'first_name', 'last_name', 'mobile', 'address'];
        const first = order.find((field) => nextErrors[field]);
        if (first) window.setTimeout(() => formRef.current?.querySelector(`#${first}`)?.focus(), 0);
    }

    function handleSave(event) {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!validate()) {
            setStatus('Please fix the highlighted fields and try again.', 'error');
            return;
        }

        setSaving(true);
        setStatus('Saving...', 'info');

        fetch(apiConfig.updateUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            // profile_picture is not sent: the endpoint rejects it, and the
            // photo has already been saved by its own upload.
            body: JSON.stringify({
                first_name: profile.first_name.trim(),
                last_name: profile.last_name.trim(),
                email: profile.email.trim(),
                mobile: profile.mobile.trim(),
                address: profile.address.trim(),
                designation: profile.designation.trim(),
            }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    if (data.errors && typeof data.errors === 'object') {
                        // Laravel returns each field's errors as an array;
                        // the form fields expect a single string.
                        const fieldErrors = Object.fromEntries(
                            Object.entries(data.errors).map(([field, messages]) => [
                                field,
                                Array.isArray(messages) ? messages[0] : messages,
                            ])
                        );
                        setErrors(fieldErrors);
                        focusFirstError(fieldErrors);
                        throw new Error('Please fix the highlighted fields and try again.');
                    }
                    throw new Error(data.message || 'Your changes could not be saved. Please try again.');
                });
            }
            return response.json();
        })
        .then(() => {
            setErrors({});
            setOriginalProfile(profile);
            onProfileLoaded?.(profile);
            setStatus('Your profile has been updated.', 'success');
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            setStatus(error.message || 'Failed to update profile.', 'error');
        })
        .finally(() => {
            setSaving(false);
        });
    }

    function handleCancel() {
        if (!dirty) return;
        setConfirmDiscard(true);
    }

    function discardChanges() {
        setConfirmDiscard(false);
        setProfile(originalProfile);
        setErrors({});
        setStatus('Your unsaved changes were discarded.', 'info');
    }

    if (loading) {
        return React.createElement(
            'section',
            { className: 'profile-card profile-card--state', 'aria-busy': 'true' },
            React.createElement('p', { className: 'ui-visually-hidden', role: 'status' }, 'Loading your profile…'),
            React.createElement('div', { className: 'profile-skeleton', 'aria-hidden': 'true' },
                [1, 2, 3, 4, 5].map((key) => React.createElement('span', { key })))
        );
    }

    if (loadError) {
        return React.createElement(
            'section',
            { className: 'profile-card profile-card--state' },
            React.createElement('div', { className: 'profile-load-error', role: 'alert' },
                React.createElement('p', null, loadError),
                React.createElement('button', { className: 'action-button primary', type: 'button', onClick: loadProfile }, 'Try again'))
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
        { className: 'profile-form', noValidate: true, onSubmit: handleSave, ref: formRef },

        status.message
            ? React.createElement(
                'div',
                {
                    className: `profile-status is-${status.type}`,
                    role: status.type === 'error' ? 'alert' : 'status',
                    'aria-live': status.type === 'error' ? 'assertive' : 'polite',
                },
                React.createElement('span', { className: 'profile-status__icon', 'aria-hidden': 'true' }, status.type === 'success' ? '\u2713' : status.type === 'error' ? '!' : 'i'),
                React.createElement('p', null, status.message),
                React.createElement('button', { type: 'button', className: 'profile-status__close', onClick: () => setStatus('', 'info'), 'aria-label': 'Dismiss message' }, '\u00d7')
            )
            : null,

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
                        hint: 'Assigned by your administrator and cannot be changed.',
                        disabled: true,
                        onChange: () => {},
                    }),

                    React.createElement(TextField, {
                        id: 'email',
                        label: 'Email',
                        type: 'email',
                        icon: 'email',
                        required: true,
                        autoComplete: 'email',
                        value: profile.email,
                        error: errors.email,
                        onChange: (value) => updateField('email', value),
                    }),

                    React.createElement(TextField, {
                        id: 'designation',
                        label: 'Designation',
                        icon: 'employee',
                        value: profile.designation,
                        error: errors.designation,
                        onChange: (value) => updateField('designation', value),
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
                        required: true,
                        autoComplete: 'given-name',
                        value: profile.first_name,
                        error: errors.first_name,
                        onChange: (value) => updateField('first_name', value),
                    }),

                    React.createElement(TextField, {
                        id: 'last_name',
                        label: 'Last Name',
                        required: true,
                        autoComplete: 'family-name',
                        value: profile.last_name,
                        error: errors.last_name,
                        onChange: (value) => updateField('last_name', value),
                    }),

                    React.createElement(TextField, {
                        id: 'mobile',
                        label: 'Phone',
                        type: 'tel',
                        autoComplete: 'tel',
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
                autoComplete: 'street-address',
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
                    disabled: saving || !dirty,
                    onClick: handleCancel,
                },
                'Discard changes'
            ),

            React.createElement(
                'button',
                {
                    className: 'action-button primary',
                    type: 'submit',
                    // Nothing to save until something actually changes, which
                    // also stops a second submit while the first is in flight.
                    disabled: saving || !dirty,
                },
                saving ? React.createElement('span', { className: 'profile-spinner', 'aria-hidden': 'true' }) : null,
                saving ? 'Saving…' : 'Save changes'
            )
        ),

        dirty
            ? React.createElement('p', { className: 'form-dirty-note' }, 'You have unsaved changes.')
            : null
    ),

    React.createElement(AppDialog, {
        open: confirmDiscard,
        variant: 'danger',
        title: 'Discard your changes?',
        message: 'Your edits will be lost and the form will go back to your saved details.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        onConfirm: discardChanges,
        onCancel: () => setConfirmDiscard(false),
    })
);
}

/**
 * The person's own recent sign-ins, so they can spot access they do not
 * recognise. Read-only, and never shows anyone else's activity — the server
 * takes the account from the session token.
 */
function RecentSignIns() {
    const [entries, setEntries] = useState([]);
    const [failures, setFailures] = useState(0);
    const [state, setState] = useState('loading');

    useEffect(() => {
        let cancelled = false;

        myLoginHistory(5)
            .then((payload) => {
                if (cancelled) return;
                setEntries(payload.data || []);
                setFailures(payload.meta?.recent_failures || 0);
                setState('ready');
            })
            .catch(() => {
                if (!cancelled) setState('error');
            });

        return () => { cancelled = true; };
    }, []);

    function formatWhen(value) {
        if (!value) return 'Unknown';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';

        return date.toLocaleString(undefined, {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    return React.createElement(
        'section',
        { className: 'profile-card sign-ins', 'aria-labelledby': 'sign-ins-title' },
        React.createElement('h2', { id: 'sign-ins-title', className: 'sign-ins__title' },
            React.createElement('i', { className: 'bi bi-clock-history', 'aria-hidden': 'true' }),
            ' Recent sign-ins'
        ),
        React.createElement('p', { className: 'sign-ins__intro' }, 'If you do not recognise one of these, change your password and tell an administrator.'),

        failures > 0
            ? React.createElement('p', { className: 'sign-ins__alert', role: 'status' },
                React.createElement('i', { className: 'bi bi-exclamation-triangle-fill', 'aria-hidden': 'true' }),
                ` ${failures} failed sign-in ${failures === 1 ? 'attempt' : 'attempts'} on your account in the last 30 days.`
            )
            : null,

        state === 'loading'
            ? React.createElement('p', { className: 'sign-ins__empty' }, 'Loading your sign-in history…')
            : state === 'error'
                ? React.createElement('p', { className: 'sign-ins__empty' }, 'Your sign-in history could not be loaded.')
                : entries.length === 0
                    ? React.createElement('p', { className: 'sign-ins__empty' }, 'No sign-ins recorded yet.')
                    : React.createElement('ul', { className: 'sign-ins__list' },
                        entries.map((entry) => React.createElement('li', { key: entry.login_history_id, className: 'sign-ins__item' },
                            React.createElement('span', { className: 'sign-ins__when' }, formatWhen(entry.created_at)),
                            React.createElement('span', { className: 'sign-ins__meta' },
                                entry.ip_address || 'Unknown address',
                                entry.device_label ? ` · ${entry.device_label}` : ''
                            ),
                            entry.outcome !== 'success'
                                ? React.createElement('span', { className: 'sign-ins__failed' }, 'Failed attempt')
                                : null
                        ))
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
    const [loggingOut, setLoggingOut] = useState(false);
    const [identity, setIdentity] = useState(null);

    // Success and info messages clear themselves; errors stay until dismissed
    // or fixed so they are not missed.
    useEffect(() => {
        if (!status.message || status.type === 'error') return undefined;
        const timer = window.setTimeout(() => setStatusState({ message: '', type: 'info' }), 6000);
        return () => window.clearTimeout(timer);
    }, [status]);

    useEffect(() => {
        guardAgainstBackNavigation();
    }, []);

    function setStatus(message, type = 'info') {
        setStatusState({ message, type });
    }

    function handleLogout() {
        logout({
            onStart: () => setLoggingOut(true),
        });
    }

    function handleAvatarSelect(avatarUrl) {
        setAvatar(avatarUrl);
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: (message) => setStatus(message, 'info'), onLogout: handleLogout, loggingOut }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, 'My Profile'),
                    React.createElement('p', null, 'Review and update your account information, contact details and photo.')
                ),
                React.createElement(
                    'div',
                    { className: 'profile-layout' },
                    React.createElement(ProfileSideCard, { avatar, identity, onAvatarSelect: handleAvatarSelect, onMessage: setStatus }),
                    React.createElement(
                        'div',
                        { className: 'profile-column' },
                        React.createElement(ProfileForm, { status, setStatus, onAvatarChange: setAvatar, onProfileLoaded: setIdentity }),
                        React.createElement(RecentSignIns, null)
                    )
                )
            )
        ),
        React.createElement(Footer, { onMessage: (message) => setStatus(message, 'info') })
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(ProfileApp));
