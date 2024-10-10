const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const CWD = process.cwd();
const READ_FILE_PATH = path.join(CWD, "src", "sm-bc.js");
const WRITE_FILE_PATH = path.join(CWD, "src", "index.ts");
const DIST_DIR_PATH = (() => {
  const tsconfigPath = path.join(CWD, "tsconfig.json");
  const content = fs.readFileSync(tsconfigPath, "utf8");
  const contentWithoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/\/\/.*$/gm, ""); // Remove single-line comments
  const json = JSON.parse(contentWithoutComments);
  const outDir = json.outDir || "dist";
  const distDirPath = path.join(CWD, outDir);
  return distDirPath;
})();

main();

/**
 * Actually convert the file.
 **/
async function main() {
  try {
    await fsp.rm(DIST_DIR_PATH, { recursive: true, force: true });

    const { exportableNames, exportSyntax } =
      await showExportableFunctionNames();

    await fsp.copyFile(READ_FILE_PATH, WRITE_FILE_PATH);

    await fsp.appendFile(WRITE_FILE_PATH, `\n\n${exportSyntax}`);
  } catch (error) {
    throw error;
  }
}

/**
 * Just to see what's exportable.
 **/
async function showExportableFunctionNames() {
  let exportSyntax = "export {";
  // Split the file into lines
  const exportableNames = {
    functions: [],
    vars: [],
  };
  try {
    const data = await fsp.readFile(READ_FILE_PATH, "utf8");
    const lines = data.split("\n");

    lines.forEach((line) => {
      // Check for exportable functions
      if (line.startsWith("function ") && !line.includes("export")) {
        const match = line.match(/function\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\(/);
        if (!match) return;
        const functionName = match[1];
        if (exportableNames.functions.includes(functionName)) return;

        exportableNames.functions.push(match[1]);
      }

      // Check for exportable vars
      if (line.startsWith("var ") && !line.includes("export")) {
        const match = line.match(/var\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/);
        if (!match) return;
        const varName = match[1];
        if (exportableNames.vars.includes(varName)) return;

        exportableNames.vars.push(varName);
      }
    });

    // Collect all names into a single array
    //  const allNames = [].concat(...Object.values(exportableNames));
    const allNames = new Set(
      [...Object.values(exportableNames)].flat(Infinity)
    );

    allNames.forEach((ename, index) => {
      exportSyntax += `${ename}, `;
      // if (index === allNames.length - 1) exportSyntax += "}";
    });
    exportSyntax += "}";

    console.log("Exportable function and var names:", exportableNames);

    console.log("Export syntax:", exportSyntax);
  } catch (error) {
    console.error(error);
  }

  return { exportableNames, exportSyntax };
}
