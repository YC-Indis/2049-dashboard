import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../public/dojo-seed.json')

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.method === 'POST' && req.url === '/seed') {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks).toString('utf8')
    const dump = JSON.parse(body)
    fs.writeFileSync(outPath, JSON.stringify(dump, null, 2))
    const keys = Object.keys(dump)
    console.log('saved', outPath, 'keys', keys.length, keys)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`ok keys=${keys.length} bytes=${fs.statSync(outPath).size}`)
    return
  }
  res.writeHead(404)
  res.end('no')
})

server.listen(9876, '127.0.0.1', () => {
  console.log('seed receiver on http://127.0.0.1:9876/seed')
})
