# Introduction

This is NPM packaged version of [mil-sym-js](https://github.com/github/gitignore).

I modified core files from **dist** folder directly.

# Guide (build & deploy as NPM package)

### Detailed approach

1. Build [mil-sym-js](https://github.com/github/gitignore) following its guide.
2. Copy over **dist/sm-bc.js** to **src/sm-bc.js** in this project.
3. Make sure all constants in **build/index.js** is configured correctly.
4. Run `npm run build`. This will create TS file in **src/** and **dist/** folder. Keep in mind that created TS file will have TypeScript error. Just ignore it.
5. Upgrade version with command `npm version [patch | minor | major]` depending on your need.
6. Run `npm run package` to deploy.

<!-- ### Short approach -->

<!-- **The command `npm run deploy` will run:**

1. `npm run build`
2. `npm version patch`
3. `npm run package` -->
