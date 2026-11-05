// Verify the downloadable gallery and reopen the packaged canvases in the actual app.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import os from 'node:os'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { startDaemon } from '../src/server/daemon.js'
const root = path.resolve('evaluations/2026-11-05/project-samples')
const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-download-check-'))
execFileSync('python3', ['-m', 'zipfile', '-e', path.join(root, 'vibeprint-project-samples.zip'), extracted])
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url?.split('?')[0] ?? '/'))
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return }
  const target = file === root ? path.join(root, 'index.html') : file
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', target.endsWith('.html') ? 'text/html' : target.endsWith('.png') ? 'image/png' : 'application/octet-stream')
  fs.createReadStream(target).pipe(res)
})
await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve))
const browser = await chromium.launch()
const results: unknown[] = []
try {
  const page = await browser.newPage()
  for (const width of [1194,390]) {
    await page.setViewportSize({width,height:834})
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}/`)
    const size = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}))
    assert.ok(size.scroll <= width+1, `Gallery overflows at ${width}`)
    await page.locator('img').evaluateAll(async imgs => { await Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode() })) })
    const links = await page.locator('a[href]').evaluateAll(as => [...new Set(as.map(a => (a as HTMLAnchorElement).href).filter(h=>!h.includes('#')))])
    for (const url of links) assert.ok((await page.request.get(url)).ok(),url)
    results.push({galleryWidth:width,images:await page.locator('img').count(),links:links.length})
  }
  for (const project of ['threadline','offstage','libra']) {
    const sampleRoot = path.join(extracted,project)
    let daemon: { port: number; close: () => Promise<void> }
    const cli = process.env.VIBEPRINT_VERIFY_CLI
    if (cli) {
      const child = spawn(process.execPath,[cli,'serve','--root',sampleRoot,'--port','0','--host','127.0.0.1','--no-commit','--no-relay'],{env:{...process.env,VIBEPRINT_MAPPER:'off',VIBEPRINT_RELAY:'off'},stdio:['ignore','pipe','pipe']})
      const port = await new Promise<number>((resolve,reject)=>{
        let output=''
        const timer=setTimeout(()=>{child.kill();reject(new Error('Packaged CLI startup timed out'))},20000)
        child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/laptop\s+http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]))}})
        child.once('error',error=>{clearTimeout(timer);reject(error)})
        child.once('exit',code=>{clearTimeout(timer);reject(new Error('Packaged CLI exited '+code))})
      })
      daemon={port,close:()=>new Promise<void>(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',()=>resolve());child.kill('SIGTERM')})}
    } else daemon=await startDaemon({root:sampleRoot,port:0,host:'127.0.0.1',quiet:true,commit:false,mapper:null,claude:{available:false,model:'unused'}})
    const errors: string[] = []
    const tab = await browser.newPage({viewport:{width:1194,height:834}})
    tab.on('pageerror',e=>errors.push(e.message))
    try {
      await tab.goto(`http://127.0.0.1:${daemon.port}/?view=pad`)
      await tab.waitForFunction(()=>(window as any).editor?.status==='live')
      const health = await (await tab.request.get(`http://127.0.0.1:${daemon.port}/api/health`)).json(); assert.equal(health.version,'0.9.1')
      const views = await tab.evaluate(()=>(window as any).editor.mapViews())
      assert.ok(views.length>=2,`${project}: expected separate views`)
      for(const view of views) { await tab.getByLabel('Diagram view',{exact:true}).selectOption(view.id); await tab.waitForFunction(id => (window as any).editor.activeMapView()?.id === id, view.id); assert.equal(await tab.locator('.vp-map-reading').count(),1) }
      await tab.setViewportSize({width:390,height:844})
      const overflow=await tab.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)
      assert.equal(overflow,false,`${project}: mobile overflow`)
      assert.deepEqual(errors,[])
      results.push({project,packageVersion:health.version,packagedCli:!!cli,packagedCanvasOpened:true,views:views.length,browserErrors:errors,mobileOverflow:overflow})
    } finally {await tab.close();await daemon.close()}
  }
  const result={verifiedAt:new Date().toISOString(),checks:results}
  fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify(result,null,2))
} finally {await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
