import { readFileSync } from 'node:fs'
import { Client } from 'ssh2'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const script = readFileSync(join(__dirname, 'server-apply-seed.sh'), 'utf8')

const host = process.env.DOJO_SSH_HOST || '129.226.147.77'
const username = process.env.DOJO_SSH_USER || 'root'
const password = process.env.DOJO_SSH_PASSWORD || ''

if (!password) {
  console.error('请设置环境变量 DOJO_SSH_PASSWORD')
  process.exit(1)
}

const conn = new Client()

conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
  finish(prompts.map(() => password))
})

conn
  .on('ready', () => {
    console.log('SSH connected, running server-apply-seed.sh ...')
    conn.exec(`bash -s`, (err, stream) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      stream
        .on('close', (code) => {
          conn.end()
          process.exit(code ?? 0)
        })
        .on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.end(script)
    })
  })
  .on('error', (err) => {
    console.error('SSH error:', err.message)
    process.exit(1)
  })
  .connect({
    host,
    port: 22,
    username,
    password,
    tryKeyboard: true,
    readyTimeout: 30000,
    algorithms: {
      kex: [
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group14-sha1',
        'diffie-hellman-group-exchange-sha1',
        'diffie-hellman-group1-sha1'
      ]
    }
  })
