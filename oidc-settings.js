import {Log, UserManager} from 'oidc-client-ts';

Log.setLogger(console);
Log.setLevel(Log.ERROR);

const url = window.location.origin;

export const settings = {
    authority: process.env.VUE_APP_DOCHUB_AUTHORITY_SERVER,
    client_id: process.env.VUE_APP_DOCHUB_AUTHORITY_CLIENT_ID,
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
