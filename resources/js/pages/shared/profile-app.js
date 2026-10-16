import { createPageRoot } from '../../navigation/page-root.js';
import defaultAvatar from '../../../images/profile-avatar.svg';
import { BrandLogo } from '../../brand-logo.js';
import { logout, guardAgainstBackNavigation } from '../../auth-session.js';
import { LogoutButton } from '../../components/LogoutButton.js';
import { myLoginHistory } from '../../api/login-history-api.js';
import { PHOTO_ACCEPT, checkPhoto, removeProfilePhoto, uploadProfilePhoto } from '../../api/profile-photo-api.js';
import { getCurrentUser, updateProfile } from '../../api/auth-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { dashboardHrefFor } from '../../access/navigation.js';
import { getAccessSession } from '../../access/access-session.js';
import { displayRoleName } from '../../access/role-labels.js';

const { useRef, useState, useEffect } = React;

const rootElement = document.getElementById('root');
const dashboardUrl = dashboardHrefFor(getAccessSession()?.roleName);

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
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic Plan Development Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic Plan Development Management System')
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

// Avatar with a camera button for uploading, shown in the profile card's identity row.
function ProfileAvatar({ avatar, name = '', onAvatarSelect, onMessage }) {
    const fileInputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [photoError, setPhotoError] = useState('');

    const hasPhoto = Boolean(avatar) && avatar !== defaultAvatar;
    // Without an uploaded photo the avatar shows the person's initials.
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';

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
        if (!window.confirm('Remove your profile photo?')) {
            return;
        }

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

    return React.createElement(
        'div',
        { className: 'profile-avatar' },
        React.createElement(
            'div',
            { className: 'profile-avatar__frame' },
            hasPhoto
                ? React.createElement('img', { className: 'profile-avatar__image', src: avatar, alt: 'Profile photo' })
                : React.createElement('span', { className: 'profile-avatar__initials', role: 'img', 'aria-label': `${name || 'Profile'} initials` }, initials),
            React.createElement('button', { className: 'profile-avatar__upload', type: 'button', onClick: openFilePicker, disabled: busy, 'aria-label': busy ? 'Uploading photo' : 'Change profile photo', title: 'Change profile photo' },
                React.createElement('i', { className: `bi ${busy ? 'bi-hourglass-split' : 'bi-pencil'}`, 'aria-hidden': 'true' })),
            React.createElement('input', {
                ref: fileInputRef,
                type: 'file',
                accept: PHOTO_ACCEPT,
                hidden: true,
                onChange: handleFileChange,
            })
        ),
        React.createElement(
            'div',
            { className: 'profile-avatar__notes' },
            photoError
                ? React.createElement('p', { className: 'photo-error', role: 'alert' }, photoError)
                : React.createElement('p', { className: 'photo-hint' }, 'JPG, PNG or WebP, up to 2 MB.'),
            hasPhoto
                ? React.createElement('button', { className: 'profile-link-button', type: 'button', onClick: handleRemove, disabled: busy }, 'Remove photo')
                : null
        )
    );
}

function TextField({ id, label, value, error, type = 'text', helperText, onHelperClick, onChange, disabled = false }) {
    return React.createElement(
        'div',
        { className: `field-group ${error ? 'has-error' : ''}` },
        React.createElement('label', { className: 'field-label', htmlFor: id }, label),
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
            // Ties the message below to the input, so a screen reader reads
            // the reason rather than just announcing the field as invalid.
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': error ? `${id}-error` : undefined,
            onChange: (event) => onChange(event.target.value),
        }),
        error
            ? React.createElement('p', { id: `${id}-error`, className: 'field-error', role: 'alert' }, error)
            : null
    );
}

function ProfileForm({ status, setStatus, onAvatarChange, avatar, onAvatarSelect }) {
    const [profile, setProfile] = useState(initialProfile);
    const [originalProfile, setOriginalProfile] = useState(initialProfile);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
        window.addEventListener('app:before-navigate', warn);
        return () => {
            window.removeEventListener('beforeunload', warn);
            window.removeEventListener('app:before-navigate', warn);
        };
    }, [dirty]);

    function loadProfile() {
        getCurrentUser()
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

        if (profile.designation && profile.designation.trim().length > 255) {
            nextErrors.designation = 'Designation must be 255 characters or fewer.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function handleSave(event) {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!validate()) {
            setStatus('Please check the highlighted fields and try again.', 'error');
            return;
        }

        setSaving(true);
        setStatus('Saving...', 'info');

        updateProfile({
                first_name: profile.first_name.trim(),
                last_name: profile.last_name.trim(),
                email: profile.email.trim(),
                mobile: profile.mobile.trim(),
                address: profile.address.trim(),
                designation: profile.designation.trim(),
        })
        .then(() => {
            setErrors({});
            setOriginalProfile(profile);
            setStatus('Profile updated successfully!', 'success');
        })
        .catch(error => {
            if (error.errors && typeof error.errors === 'object') {
                setErrors(Object.fromEntries(
                    Object.entries(error.errors).map(([field, messages]) => [
                        field,
                        Array.isArray(messages) ? messages[0] : messages,
                    ])
                ));
            }
            console.error('Error updating profile:', error);
            setStatus(error.message || 'Failed to update profile.', 'error');
        })
        .finally(() => {
            setSaving(false);
        });
    }

    function handleCancel() {
        if (!dirty) {
            setErrors({});
            setStatus('There were no changes to discard.', 'info');
            return;
        }

        if (!window.confirm('Discard your unsaved changes?')) {
            return;
        }

        setProfile(originalProfile);
        setErrors({});
        setStatus('Changes were cancelled.', 'info');
    }

    if (loading) {
        return React.createElement(
            'section',
            { className: 'profile-card profile-main-card' },
            React.createElement('div', { className: 'profile-banner', 'aria-hidden': 'true' }),
            React.createElement('p', { className: 'profile-loading', role: 'status' }, 'Loading profile…')
        );
    }

    const fullName = [originalProfile.first_name, originalProfile.last_name].filter(Boolean).join(' ') || 'Your profile';
    const roleName = displayRoleName(getAccessSession()?.roleName, '');

    const field = (props) => React.createElement(TextField, props);
    return React.createElement(
        'section',
        { className: 'profile-card profile-main-card', 'aria-labelledby': 'profile-form-title' },
        React.createElement('div', { className: 'profile-banner', 'aria-hidden': 'true' }),

        // Identity: photo, name, sign-in email and role, with account actions on the right.
        React.createElement(
            'div',
            { className: 'profile-identity' },
            React.createElement(ProfileAvatar, { avatar, name: fullName === 'Your profile' ? '' : fullName, onAvatarSelect, onMessage: setStatus }),
            React.createElement(
                'div',
                { className: 'profile-identity__copy' },
                React.createElement('h2', { id: 'profile-form-title' }, fullName),
                React.createElement('p', null, originalProfile.email || 'No email recorded'),
                roleName ? React.createElement('span', { className: 'ui-badge ui-badge--info profile-role' }, React.createElement('i', { className: 'bi bi-person-badge', 'aria-hidden': 'true' }), roleName) : null
            ),
            React.createElement(
                'div',
                { className: 'profile-identity__actions' },
                React.createElement('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: '/change-password' },
                    React.createElement('i', { className: 'bi bi-shield-lock', 'aria-hidden': 'true' }), 'Change Password')
            )
        ),

        React.createElement(
            'form',
            { className: 'profile-form', noValidate: true, onSubmit: handleSave },
            React.createElement('h3', { className: 'profile-section-title' }, 'Personal details'),
            React.createElement(
                'div',
                { className: 'profile-field-grid' },
                field({ id: 'first_name', label: 'First Name', value: profile.first_name, error: errors.first_name, onChange: (value) => updateField('first_name', value) }),
                field({ id: 'last_name', label: 'Last Name', value: profile.last_name, error: errors.last_name, onChange: (value) => updateField('last_name', value) }),
                field({ id: 'designation', label: 'Designation', value: profile.designation, error: errors.designation, onChange: (value) => updateField('designation', value) }),
                field({ id: 'mobile', label: 'Phone', type: 'tel', value: profile.mobile, error: errors.mobile, onChange: (value) => updateField('mobile', value) }),
                field({ id: 'user_id', label: 'Employee ID', value: profile.user_id, disabled: true, onChange: () => {} }),
                field({ id: 'address', label: 'Address', value: profile.address, error: errors.address, onChange: (value) => updateField('address', value) })
            ),

            React.createElement('h3', { className: 'profile-section-title' }, 'My email address'),
            React.createElement(
                'div',
                { className: 'profile-email' },
                React.createElement('span', { className: 'profile-email__icon', 'aria-hidden': 'true' }, React.createElement('i', { className: 'bi bi-envelope-fill' })),
                React.createElement(
                    'div',
                    { className: 'profile-email__field' },
                    field({ id: 'email', label: 'Sign-in email', type: 'email', value: profile.email, error: errors.email, onChange: (value) => updateField('email', value) }),
                    React.createElement('p', { className: 'profile-email__note' }, 'Used to sign in and to receive workflow notifications.')
                )
            ),

            React.createElement(
                'div',
                { className: 'profile-form__footer' },
                React.createElement(
                    'p',
                    {
                        className: `form-status modern-status is-${status.type}`,
                        role: 'status',
                        'aria-live': 'polite',
                    },
                    status.message || (dirty ? 'You have unsaved changes.' : '')
                ),
                React.createElement(
                    'div',
                    { className: 'profile-form__actions' },
                    React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: saving, onClick: handleCancel }, 'Reset'),
                    React.createElement(
                        'button',
                        {
                            className: 'ui-button ui-button--primary',
                            type: 'submit',
                            // Nothing to save until something actually changes, which
                            // also stops a second submit while the first is in flight.
                            disabled: saving || !dirty,
                        },
                        saving ? 'Saving…' : 'Save Changes'
                    )
                )
            )
        )
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
                            React.createElement('span', { className: 'sign-ins__when' }, formatWhen(entry.attempted_at)),
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
        React.createElement('span', null, String.fromCharCode(169), ' 2026 Strategic Plan Development Management System'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.privacy); } }, 'Privacy Notice'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.terms); } }, 'Terms of Use'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.accessibility); } }, 'Accessibility')
    );
}

function ProfileApp() {
    const [avatar, setAvatar] = useState(defaultAvatar);
    const [status, setStatusState] = useState({ message: '', type: 'info' });
    const [loggingOut, setLoggingOut] = useState(false);

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
        React.createElement(AppSidebar),
        React.createElement(
            'main',
            { className: 'app-shell-main profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(PageHeader, { section: 'Profile', title: 'Profile Settings', subtitle: 'Manage your account information and contact details.' }),
                React.createElement(
                    'div',
                    { className: 'profile-page-stack' },
                    React.createElement(ProfileForm, { status, setStatus, onAvatarChange: setAvatar, avatar, onAvatarSelect: handleAvatarSelect }),
                    React.createElement(RecentSignIns, null)
                )
            )
        ),
        React.createElement(Footer, { onMessage: (message) => setStatus(message, 'info') })
    );
}

createPageRoot(rootElement).render(React.createElement(ProfileApp));
