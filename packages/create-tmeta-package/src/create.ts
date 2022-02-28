import {prompt} from "enquirer";
import {promises as fs} from "fs";

const create_tmeta_package_root = __dirname + "/../../create-tmeta-package";
const templates_root = create_tmeta_package_root + "/template";
const tmeta_packages_root = create_tmeta_package_root + "/../../packages";

void (async () => {
    const project_name = process.argv[2] ?? await prompt({
        type: "input",
        name: "project_name",
        message: "Project Name",
    });
    if(project_name == null || !project_name.match(/^[a-z-]+$/g)) {
        throw new Error("bad project name");
    }

    const project_dir = tmeta_packages_root + "/" + project_name;
    try {
        await fs.mkdir(project_dir);
    } catch(e) {
        console.log(e);
        throw new Error("failed to make dir (maybe it already exists?)");
    }

    for(const template_name of [".eslintrc.js", "package.json", "tsconfig.json"]) {
        const template_content = await fs.readFile(templates_root + "/template_"+template_name+"_template", "utf-8");
        const final_content = template_content.split("{{PROJECT_NAME}}").join(project_name);
        await fs.writeFile(project_dir + "/" + template_name, final_content, "utf-8");
    }
    await fs.mkdir(project_dir + "/src");
    console.log("Done!");
})();

// TODO:
// make the lint script just something like `tmeta lint` eg
// that could be fun
// and then there's one dependency it's `tmeta` that depends on
// "eslint": "^7.29.0",
// "eslint-config-tmeta": "^1.0.0",
// "tsconfig-tmeta": "^1.0.0",
// "typescript": "^4.5.5"
// and you still need to have .eslintrc.js and tsconfig.json files in the root
// of all the reops unfortunately