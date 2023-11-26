import {Log, UserManager} from 'oidc-client-ts';

Log.setLogger(console);
Log.setLevel(Log.ERROR);

const url = window.location.origin;

export const settings = {
    authority: 'http://localhost:8099/realms/dochub',
    client_id: 'dochub',
    redirect_uri: new URL('/login', url),
    post_logout_redirect_uri: new URL('/logout', url),
    response_type: 'code',
    scope: 'openid',
    response_mode: 'fragment',
    automaticSilentRenew: true
};

export {
    Log,
    UserManager
};
