import { apiRequest } from '../api/api-client.js';
import { createAccessSession, saveAccessSession } from './access-session.js';
let request;
export function loadAccessSession() {
    if (!request) request = apiRequest('/api/auth/me').then(payload => {
        if (!payload.data) throw new Error('Unable to load account permissions.');
        return saveAccessSession(createAccessSession(payload.data));
    }).catch(error => { request = null; throw error; });
    return request;
}
export function useAccessSession() {
    const [session, setSession] = React.useState(null);
    const [error, setError] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);
    React.useEffect(() => {
        let active = true;
        setError('');
        loadAccessSession().then(value => { if (active) setSession(value); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [attempt]);
    return { session, error, retry: () => { request = null; setAttempt(value => value + 1); } };
}
