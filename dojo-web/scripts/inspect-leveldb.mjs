import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2] || '.tmp-leveldb'
const all = Buffer.concat(
  fs.readdirSync(root).map((f) => fs.readFileSync(path.join(root, f)))
)

function findAll(buf, needle) {
  const hits = []
  let i = 0
  while (true) {
    const j = buf.indexOf(needle, i)
    if (j < 0) break
    hits.push(j)
    i = j + 1
  }
  return hits
}

const n8 = Buffer.from('dojo:v1:projects')
const n16 = Buffer.from('dojo:v1:projects', 'utf16le')
console.log('utf8 hits', findAll(all, n8).slice(0, 10))
console.log('utf16 hits', findAll(all, n16).slice(0, 10))

for (const i of findAll(all, n8).slice(0, 3)) {
  console.log('--- utf8 @', i)
  console.log(all.slice(i, i + 200).toString('hex'))
  console.log(JSON.stringify(all.slice(i, i + 120).toString('latin1')))
}
for (const i of findAll(all, n16).slice(0, 3)) {
  console.log('--- utf16 @', i)
  console.log(all.slice(i, i + 80).toString('hex'))
  console.log(JSON.stringify(all.slice(i, i + 160).toString('utf16le')))
}

const v16 = Buffer.from('{"version":', 'utf16le')
const v8 = Buffer.from('{"version":')
console.log('version utf16 hits', findAll(all, v16).length)
console.log('version utf8 hits', findAll(all, v8).length)
if (findAll(all, v16).length) {
  const i = findAll(all, v16)[0]
  console.log(JSON.stringify(all.slice(i, i + 300).toString('utf16le')))
}
if (findAll(all, v8).length) {
  const i = findAll(all, v8)[0]
  console.log(JSON.stringify(all.slice(i, i + 300).toString('utf8')))
}

// dump unique ascii-ish strings containing dojo:v1
const latin = all.toString('latin1')
const re = /dojo:v1:[A-Za-z0-9_]{2,40}/g
const set = new Set()
let m
while ((m = re.exec(latin))) set.add(m[0])
console.log('ascii keys', [...set])
