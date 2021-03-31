module.exports = "module.exports.version = "+JSON.stringify(
    child_process.execSync("git describe --always --tags --dirty").toString(),
) + ";\nmodule.exports.log = "+JSON.stringify(
    child_process.execSync("git log -n 10").toString(),
) + ";\n";