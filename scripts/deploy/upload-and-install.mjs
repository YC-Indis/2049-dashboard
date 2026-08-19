import { Client } from 'ssh2'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tarballTgz = join(__dirname, '../../release/dojo-web-release.tgz')
const tarballGz = join(__dirname, '../../release/dojo-web-release.tar.gz')
const tarball = existsSync(tarballTgz) ? tarballTgz : tarballGz
const remoteTar = '/root/dojo-web-release.tgz'

const host = process.env.DOJO_SSH_HOST || ''
const username = process.env.DOJO_SSH_USER || 'root'
const password = process.env.DOJO_SSH_PASSWORD || ''

if (!host) {
  console.error('请设置环境变量 DOJO_SSH_HOST（目标服务器地址）')
  process.exit(1)
}
if (!password) {
  console.error('请设置环境变量 DOJO_SSH_PASSWORD')
  process.exit(1)
}
if (!existsSync(tarball)) {
  console.error(`找不到发布包，请先运行 pack-release：${tarballTgz}`)
  process.exit(1)
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      stream.on('data', (d) => process.stdout.write(d))
      stream.stderr.on('data', (d) => process.stderr.write(d))
      stream.on('close', (code) => {
        if (code === 0) resolve(undefined)
        else reject(new Error(`exit ${code}: ${cmd}`))
      })
    })
  })
}

const conn = new Client()

conn.on('keyboard-interactive', (_n, _i, _l, prompts, finish) => {
  finish(prompts.map(() => password))
})

conn
  .on('ready', () => {
    console.log('SSH connected')
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      console.log(`Uploading ${tarball} -> ${remoteTar}`)
      sftp.fastPut(tarball, remoteTar, (putErr) => {
        if (putErr) {
          console.error('upload failed:', putErr.message)
          conn.end()
          process.exit(1)
        }
        console.log('Upload done, installing...')
        exec(conn, `tar -xzf ${remoteTar} -C /tmp && bash /tmp/dojo-web-release/install-on-server.sh`)
          .then(() => {
            console.log('\nDeploy complete')
            conn.end()
          })
          .catch((e) => {
            console.error(e.message)
            conn.end()
            process.exit(1)
          })
      })
    })
  })
  .on('error', (err) => {
    console.error('SSH error:', err.message)
    process.exit(1)
  })
  .connect({
    host,
    port: Number(process.env.DOJO_SSH_PORT || 22),
    username,
    password,
    tryKeyboard: true,
    readyTimeout: 60000
  })
