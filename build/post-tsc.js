/**
 * Run this after tsc command is ran (this script will be the very final step after dist/ is emitted).
 **/
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const DIST_DIR_PATH = require("./pre-tsc.js").DIST_DIR_PATH;

const OUTPUT_FILENAME = "index.js";
const OUTPUT_FILE_PATH = path.join(DIST_DIR_PATH, OUTPUT_FILENAME);

function main() {
  removeDuplicateExportLine();
}

//////////////////////////////////
//////////////////////////////////
//////////////////////////////////

function removeDuplicateExportLine() {
  if (!fs.existsSync(OUTPUT_FILE_PATH)) {
    const errmsg = `Output file ${OUTPUT_FILE_PATH} does not exist!`;
    throw new Error(errmsg);
  }

  const fileContent = fs.readFileSync(OUTPUT_FILE_PATH, "utf8");

  const lines = fileContent.split("\n");

  //   const trackedExportVarLines = [];
  const includedExports = [];
  const filteredLines = lines.filter((line) => {
    //   const match = line.match(/^exports\./);
    //   const match = line.match(/^exports\.[a-zA-Z_$][0-9a-zA-Z_$]*\s*=\s*[a-zA-Z_$][0-9a-zA-Z_$]*\s*;?$/);
    //>> Match `exports.* = *` <<//
    const match = line.match(
      /^exports\.[a-zA-Z_$][0-9a-zA-Z_$]*\s*=\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*;?$/
    );
    if (!match) return true;

    const exportVarLine = match[0]; // The captured export line
    const exportVarName = match[1]; // The captured variable name

    const includedExportsVarLines = includedExports.map((obj) => obj.varLine);

    //>> If not included in final content yet <<//
    if (!includedExportsVarLines.includes(exportVarLine)) {
      includedExports.push({
        varLine: exportVarLine,
        varName: exportVarName,
      });

      return true;
    }

    //>> If already included, do not include in final content <<//
    return false;
  });

  //>> List of var names to skip removing line <<//
  const SKIP_VAR_NAMES = ['armyc2', 'java', 'vincenty', 'android']
  const moreFilteredLines = filteredLines.filter((line) => {
    //  const match = line.match(/^var\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=/);
    const match = line.match(
      /^var\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*\1(\s*.*)?$/
    );
    if (!match) return true;
    //  console.log("match", match);

    const varName = match[1];
    //  const varLine = line;
    const varLine = match[0];
    console.log("varLine", varLine);

    //>> Check if this variable already exported via `exports.*` <<//
    const foundIncludedExport = includedExports.find(
      (ie) => ie.varName === varName
    );

    if (!foundIncludedExport) return true;

    //>> Check 

    if (foundIncludedExport) return false;
    return true;
  });

  const newFileContent = moreFilteredLines.join("\n");

  fs.writeFileSync(OUTPUT_FILE_PATH, newFileContent, "utf8");
}

module.exports = {
  main,
};
