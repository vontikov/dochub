import { KJUR } from "jsrsasign";

export function getRoles(headers) {
    if (headers?.authorization) {
        const jwt = headers.authorization.slice(7);
        if(KJUR.jws.JWS.verifyJWT(jwt, process.env.VUE_APP_DOCHUB_AUTH_PUBLIC_KEY, {alg: ['RS256']})) {
            return KJUR.jws.JWS.parse(jwt)?.payloadObj?.roles || [];
        } else {
            console.warn(`Verification error: jwt: ${jwt}`);
        }
    }
    return [];
}
