import cache from "../storage/cache.mjs";
import path from "path";

export async function getCurrentRuleId(rules) {
    if(rules.length === 0) return 'default';

    const ids = [];

    const {URI} =  global.$roles;
    const url = new URL(URI);
    const response = await cache.request(url, '/');

    const manifest = response && (typeof response.data === 'object'
        ? response.data
        : JSON.parse(response.data));


    for(let rule in rules) {
        for(let nRule in manifest?.roles) {
            if(rules[rule] === nRule) {
                ids.push(nRule)
            }
        }
    }

    return ids.sort((a,b) => {return a.localeCompare(b);}).join('');
}

export async function getCurrentRules(rules) {
    if(rules.length === 0) return [];

    const result = [];
    const {URI} =  global.$roles;
    const url = new URL(URI);
    const response = await cache.request(url, '/');

    const manifest = response && (typeof response.data === 'object'
        ? response.data
        : JSON.parse(response.data));

    for(let rule in rules) {
        for(let nRule in manifest?.roles) {
            if(rules[rule] === nRule) {
                result.push(nRule);
            }
        }
    }
    return result;
}


