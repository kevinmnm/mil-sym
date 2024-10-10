const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const CWD = process.cwd();
const READ_DIR = path.join(CWD, "src");
const READ_FILE_PATH = path.join(READ_DIR, "sm-bc.js");
const WRITE_DIR = path.join(CWD, "src");
// const WRITE_FILE_PATH = path.join(WRITE_DIR, "sm-bc.ts");
const WRITE_FILE_PATH = (() => {
  const packageJsonPath = path.join(CWD, "package.json");
  const content = fs.readFileSync(packageJsonPath, "utf8");
  const json = JSON.parse(content);
  const main = json.main;
  const mainFileName = path.basename(main);
  const writeFilePath = path.join(WRITE_DIR, mainFileName);
  const final = writeFilePath.replace(".js", ".ts");
  return final;
})();
console.warn("WRITE_FILE_PATH", WRITE_FILE_PATH);
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
const ASSET_DIRS = [path.join(CWD, "src", "assets")];

main();

/**
 * Actually convert the file.
 **/
async function main() {
  try {
    console.log("=> Removing existing dist...");
    await fsp.rm(DIST_DIR_PATH, { recursive: true, force: true });

    console.log("=> Creating empty dist...");
    await fsp.mkdir(DIST_DIR_PATH);

    console.log("=> Resolving export syntax...");
    const { exportableNames, exportSyntax } =
      await showExportableFunctionNames();

    console.log(
      `=> Duplicating original library file "${path.basename(
        READ_FILE_PATH
      )}" to "${path.basename(WRITE_FILE_PATH)}"...`
    );
    await fsp.copyFile(READ_FILE_PATH, WRITE_FILE_PATH);

    console.log("=> Appending exports in duplicated file...");
    await fsp.appendFile(WRITE_FILE_PATH, `\n\n${exportSyntax}`);

    console.log("=> Copying over assets files...");
    ASSET_DIRS.forEach((assetDir) => {
      fs.cpSync(assetDir, path.join(CWD, "dist", "assets"), {
        recursive: true,
      });
    });
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

    //  console.log("Exportable function and var names:", exportableNames);

    //  console.log("Export syntax:", exportSyntax);
  } catch (error) {
    console.error(error);
  }

  return { exportableNames, exportSyntax };
}

// async function copyDirectory(source, destination) {
//   try {
//     // Create the destination directory
//     await fsp.mkdir(destination, { recursive: true });

//     // Read the contents of the source directory
//     const items = await fsp.readdir(source);

//     // Loop through each item in the source directory
//     for (const item of items) {
//       const sourcePath = path.join(source, item);
//       const destPath = path.join(destination, item);

//       // Get stats of the item to check if it's a file or a directory
//       const stat = await fsp.stat(sourcePath);

//       if (stat.isDirectory()) {
//         // Recursively copy the directory
//         await copyDirectory(sourcePath, destPath);
//       } else {
//         // Copy the file
//         await fsp.copyFile(sourcePath, destPath);
//       }
//     }

//     console.log(`Copied ${source} to ${destination}`);
//   } catch (err) {
//     console.error("Error copying directory:", err);
//   }
// }
