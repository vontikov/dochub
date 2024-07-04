export default {
    login() {
        window.OidcUserManager.signinRedirect()
            .then(() => {
                // eslint-disable-next-line no-console
                console.log('User logged in');
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error(error);
            });
    },
    logout() {
        window.OidcUserManager.signoutRedirect()
            .then(() => {
                // eslint-disable-next-line no-console
                console.log('User logged out');
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error(error);
            });
    },
    async signinCallback() {
        if (window.location.hash) {
            await window.OidcUserManager.signinCallback();
            window.location.hash = '';
        } else {
            window.location = window.origin + '/main';
        }
    },
    async getAccessToken() {
      return (await window.OidcUserManager.getUser())?.access_token;
    }
};
