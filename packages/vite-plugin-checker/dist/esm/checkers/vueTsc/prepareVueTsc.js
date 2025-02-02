import fsExtra from 'fs-extra'
import { createRequire } from 'module'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFile, access, readFile, rm } from 'fs/promises'
const { copy, mkdir } = fsExtra
const _require = createRequire(import.meta.url)
const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)
let proxyApiPath = _require.resolve('@volar/typescript/lib/node/proxyCreateProgram')
let runExtensions = ['.vue']
async function prepareVueTsc() {
  const targetTsDir = path.resolve(_dirname, 'typescript-vue-tsc')
  const vueTscFlagFile = path.resolve(targetTsDir, 'vue-tsc-resolve-path')
  const currTsVersion = _require('typescript/package.json').version
  let shouldBuildFixture = true
  try {
    await access(targetTsDir)
    const targetTsVersion = _require(path.resolve(targetTsDir, 'package.json')).version
    await access(vueTscFlagFile)
    const fixtureFlagContent = await readFile(vueTscFlagFile, 'utf8')
    if (targetTsVersion === currTsVersion && fixtureFlagContent === proxyApiPath) {
      shouldBuildFixture = false
    }
  } catch (e) {
    shouldBuildFixture = true
  }
  if (shouldBuildFixture) {
    await rm(targetTsDir, { force: true, recursive: true })
    await mkdir(targetTsDir)
    const sourceTsDir = path.resolve(_require.resolve('typescript'), '../..')
    await copy(sourceTsDir, targetTsDir)
    await writeFile(vueTscFlagFile, proxyApiPath)
    await overrideTscJs(_require.resolve(path.resolve(targetTsDir, 'lib/typescript.js')))
  }
  return { targetTsDir }
}
async function overrideTscJs(tscJsPath) {
  const languagePluginsFile = path.resolve(_dirname, 'languagePlugins.cjs')
  let tsc = await readFile(tscJsPath, 'utf8')
  const extsText = runExtensions.map((ext) => `"${ext}"`).join(', ')
  tsc = replace(tsc, /supportedTSExtensions = .*(?=;)/, (s) => s + `.concat([[${extsText}]])`)
  tsc = replace(tsc, /supportedJSExtensions = .*(?=;)/, (s) => s + `.concat([[${extsText}]])`)
  tsc = replace(tsc, /allSupportedExtensions = .*(?=;)/, (s) => s + `.concat([[${extsText}]])`)
  tsc = replace(
    tsc,
    /function createProgram\(.+\) {/,
    (s) =>
      `var createProgram = require(${JSON.stringify(proxyApiPath)}).proxyCreateProgram(` +
      [
        `new Proxy({}, { get(_target, p, _receiver) { return eval(p); } } )`,
        `_createProgram`,
        `require(${JSON.stringify(languagePluginsFile)}).getLanguagePlugins`,
      ].join(', ') +
      `);
` +
      s.replace('createProgram', '_createProgram')
  )
  function replace(_text, ...[search, replace2]) {
    const before = _text
    const text = _text.replace(search, replace2)
    const after = text
    if (after === before) {
      throw 'Search string not found: ' + JSON.stringify(search.toString())
    }
    return after
  }
  await writeFile(tscJsPath, tsc)
}
export { prepareVueTsc }
//# sourceMappingURL=prepareVueTsc.js.map
