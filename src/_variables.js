const child_process = require("child_process");

const commit_data = {
    hash: "%h",
    hash_full: "%H",
    author_name: "%aN",
    author_email: "%aE",
    date: "%at000",
    commit_title: "%s",
    commit_body: "%B",
};

const commit_sep = "«<!!COMMIT-SEPARATOR!!>»";
const entry_sep = "«<!!ENTRY-SEPARATOR!!>»";
const key_sep = "«<!!KEY-SEPARATOR!!>»";

const log_command = ""
 + 'git log -n 10 --pretty=format:"'
 + Object.entries(commit_data).map(([key, fmt]) =>
     key+key_sep+fmt+entry_sep
 ).join("") + commit_sep
 + '"'
;

const git_log = child_process.execSync(log_command)
    .toString()
    .split(commit_sep)
    .filter(v => v)
    .map(commit_log =>
        Object.fromEntries(commit_log
            .trim()
            .split(entry_sep)
            .filter(v => v)
            .map(entry => entry.split(key_sep))
        )
    )
;

const out_obj = {
    version: child_process.execSync("git describe --always --tags --dirty").toString(),
    log: git_log,
    build_time: Date.now(),
};

module.exports = "module.exports = "+JSON.stringify(out_obj);

if(require.main === module) {
    console.log(out_obj);
}