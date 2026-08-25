const loginPage = document.querySelector('[data-login-page]');

if (loginPage) {
    const form = loginPage.querySelector('[data-login-form]');
    const userInput = loginPage.querySelector('[data-user-input]');
    const passwordInput = loginPage.querySelector('[data-password-input]');
    const rememberInput = loginPage.querySelector('[data-remember-input]');
    const passwordToggle = loginPage.querySelector('[data-toggle-password]');
    const forgotPassword = loginPage.querySelector('[data-forgot-password]');
    const submitButton = loginPage.querySelector('[data-submit-button]');
    const statusText = loginPage.querySelector('[data-form-status]');
    const messageTriggers = loginPage.querySelectorAll('[data-message]');

    const savedAccount = window.localStorage.getItem('spms.rememberedAccount');

    if (savedAccount) {
        userInput.value = savedAccount;
        rememberInput.checked = true;
    }

    const setStatus = (message, type = 'info') => {
        statusText.textContent = message;
        statusText.className = `form-status is-${type}`;
    };

    const setError = (fieldName, message) => {
        const errorText = loginPage.querySelector(`[data-error-for="${fieldName}"]`);
        const fieldGroup = errorText.closest('.field-group');

        errorText.textContent = message;
        fieldGroup.classList.toggle('has-error', Boolean(message));
    };

    const clearErrors = () => {
        setError('userAccount', '');
        setError('password', '');
    };

    passwordToggle.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';

        passwordInput.type = isHidden ? 'text' : 'password';
        passwordToggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        passwordInput.focus();
    });

    forgotPassword.addEventListener('click', () => {
        setStatus('Please contact your system administrator to reset your password.', 'info');
    });

    messageTriggers.forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            setStatus(trigger.dataset.message, 'info');
        });
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearErrors();

        const userAccount = userInput.value.trim();
        const password = passwordInput.value.trim();
        let hasError = false;

        if (!userAccount) {
            setError('userAccount', 'Please enter your user account.');
            hasError = true;
        }

        if (!password) {
            setError('password', 'Please enter your password.');
            hasError = true;
        }

        if (hasError) {
            setStatus('Check the highlighted fields and try again.', 'error');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';
        setStatus('Checking your sign in details...', 'info');

        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                email: userAccount,
                password: password,
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Invalid credentials');
            }
            return response.json();
        })
        .then(data => {
            if (data.token) {
                // Store token
                localStorage.setItem('auth_token', data.token);
                if (rememberInput.checked) {
                    localStorage.setItem('spms.rememberedAccount', userAccount);
                } else {
                    localStorage.removeItem('spms.rememberedAccount');
                }
                setStatus('Login successful! Redirecting...', 'success');
                // Redirect to dashboard or profile
                window.location.href = '/profile';
            } else {
                throw new Error(data.error || 'Login failed');
            }
        })
        .catch(error => {
            setStatus(error.message, 'error');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign in';
        });
    });
}
