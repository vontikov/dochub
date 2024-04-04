
export default (template, vars) => {
    var func = new Function(...Object.keys(vars),  `return \`${template}\`;`);
    return func(...Object.values(vars));
};
