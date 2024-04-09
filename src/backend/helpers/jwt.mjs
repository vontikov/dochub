import { KJUR } from "jsrsasign";

export function getRoles(headers) {
    console.log('headers', headers);
    const jwt = headers?.authorization?.slice(7);

    if (!!jwt && typeof jwt === "string" && !jwt.includes('undefined')) {
        try {
            console.log('headers.authorization', jwt);
            console.log('KJUR.jws.JWS.parse(jwt)',KJUR.jws.JWS.parse(jwt));
            if(KJUR.jws.JWS.verifyJWT(jwt, process.env.VUE_APP_DOCHUB_AUTH_PUBLIC_KEY, {alg: ['RS256']})) {
                return KJUR.jws.JWS.parse(jwt)?.payloadObj?.realm_access?.roles || [];
            } else {
                console.warn(`Verification error: jwt: ${jwt}`);
            }
        } catch (e) {
            console.error('Error getting user groups!');
            // eslint-disable-next-line no-console
            console.error(e);
            return [];
        }
    }
    return [];
}
