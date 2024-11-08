const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const CWD = process.cwd();
const LIBRARY_FILE_NAME = "sm-bc.modified.js";
const READ_DIR = path.join(CWD, "src");
const READ_FILE_PATH = path.join(READ_DIR, LIBRARY_FILE_NAME);
const WRITE_DIR = path.join(CWD, "src");
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

    console.log(
      `=> Duplicating original library file "${path.basename(
        READ_FILE_PATH
      )}" to "${path.basename(WRITE_FILE_PATH)}"...`
    );
    await fsp.copyFile(READ_FILE_PATH, WRITE_FILE_PATH);

    console.log(
      `=> Fixing missing variable declarations in "${path.basename(
        WRITE_FILE_PATH
      )}"...`
    );
    await fixMissingVariableDeclarations(WRITE_FILE_PATH);

    console.log("=> Force adding declaration to variables...");
    await forceAddVariableDeclaration(WRITE_FILE_PATH);

    console.log("=> Resolving export syntax...");
    const { exportableNames, exportSyntax } =
      await showExportableFunctionNames();

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

/**
 * Append 'var ' or 'window.' in front of missing ones.
 * This step is needed for Vue router error.
 **/
async function fixMissingVariableDeclarations(targetFilePath) {
  const MISSING_DECLARATION_VARS = ["Double", "Integer", "System"];

  try {
    const data = await fsp.readFile(targetFilePath, "utf8");
    const lines = data.split("\n");

    const modifiedLines = lines.map((line) => {
      let isMissingVar = false;

      for (let i = 0; i < MISSING_DECLARATION_VARS.length; i++) {
        const varName = MISSING_DECLARATION_VARS[i];

        // Check if the line starts with the variable name and is followed by either a space or an '=' sign
        const regex = new RegExp(`^${varName}[ =]`);
        if (regex.test(line)) {
          isMissingVar = true;
          break;
        }
      }

      if (!isMissingVar) return line; // No missing declaration found, return the line unchanged

      console.log("-- missing var line", line);

      // Add 'var' at the beginning of the line
      line = `var ${line}`;
      return line;
    });

    const modifiedData = modifiedLines.join("\n");

    await fsp.writeFile(targetFilePath, modifiedData, "utf8");

    return;
  } catch (error) {
    console.log(error);
  }
}

/**
 * Forcefully append missing variable and its declaration.
 **/
async function forceAddVariableDeclaration(targetFilePath) {
  try {
    const fileContent = await fsp.readFile(targetFilePath, "utf8");
    const lines = fileContent.split("\n");

    const problematicVariableNames = [];
    let prependFileContent = "var";

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("(")) {
        if (trimmedLine.charAt(1) === "_") {
          const equalsIndex = trimmedLine.indexOf("=", 2); // Search after the underscore (position 2 onward)

          if (equalsIndex !== -1) {
            // Extract the substring between "_" (at index 1) and "=" (at equalsIndex)

            // Extract the variable name between "(" and "_"
            const detectedVariableName = trimmedLine
              .substring(1, equalsIndex)
              .trim();

            if (!detectedVariableName) return;

            problematicVariableNames.push(detectedVariableName);
            prependFileContent += ` ${detectedVariableName},`;
          }
        }
      }
    });

    if (!problematicVariableNames.length) return;

    const newFileContent = `${prependFileContent}\n\n${fileContent}`;
    await fsp.writeFile(targetFilePath, newFileContent, "utf8");
  } catch (error) {
    console.log(error);
  }
}
// async function forceAddVariableDeclaration(targetFilePath) {
//   //   const VARIABLES = [
//   //     "_TwoLabelOnly",
//   //     "_friendlyUnitFillColor",
//   //     "_hostileUnitFillColor",
//   //     "_neutralUnitFillColor",
//   //     "_unknownUnitFillColor",
//   //     "_friendlyGraphicFillColor",
//   //     "_hostileGraphicFillColor",
//   //     "_neutralGraphicFillColor",
//   //     "_unknownGraphicFillColor",
//   //     "_friendlyUnitLineColor",
//   //     "_hostileUnitLineColor",
//   //     "_neutralUnitLineColor",
//   //     "_unknownUnitLineColor",
//   //     "_friendlyGraphicLineColor",
//   //     "_hostileGraphicLineColor",
//   //     "_neutralGraphicLineColor",
//   //     "_unknownGraphicLineColor",
//   //   ];

//   try {
//     const data = await fsp.readFile(targetFilePath, "utf8");
//     const lines = data.split("\n");

//     const modifiedLines = lines.map((line) => {
//       const trimmedLine = line.trim();
//       /**
//        * trimmedLine starts with "("
//        * after "(", it starts with "_"
//        * the line includes "=" at some point after "_"
//        **/
//       if (trimmedLine.startsWith("(")) {
//         // Check if the line starts with "(" and is followed immediately by "_"
//         if (trimmedLine.charAt(1) === "_") {
//           // Find the index of "=" after the "_"
//           const equalsIndex = trimmedLine.indexOf("=", 2); // Search after the underscore (position 2 onward)

//           if (equalsIndex !== -1) {
//             // Extract the substring between "_" (at index 1) and "=" (at equalsIndex)
//             const nameBetweenUnderscoreAndEquals = trimmedLine
//               .substring(2, equalsIndex)
//               .trim();

//             // Extract the variable name between "(" and "_"
//             const detectedVariableName = trimmedLine
//               .substring(1, equalsIndex)
//               .trim();

//             // Preserve the indentation before the parenthesis
//             const indentation = trimmedLine.slice(0, trimmedLine.indexOf("("));

//             // Create the modified line with `var` prepended right after the "("
//             const modifiedLine = `${indentation}( var ${detectedVariableName} ${trimmedLine.substring(
//               equalsIndex
//             )}`;

//             line = modifiedLine;
//           }
//         }
//       }

//       // Add 'var' at the beginning of the line
//       return line;
//     });

//     const modifiedData = modifiedLines.join("\n");

//     await fsp.writeFile(targetFilePath, modifiedData, "utf8");

//     return;
//   } catch (error) {
//     console.log(error);
//   }
// }
