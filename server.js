const Koa = require('koa')
const ccxt = require('ccxt')

const app = new Koa()
// msleep 函数
let msleep = (ms) => new Promise(resolve => setTimeout (resolve, ms))

var log = console.log
var host = '0.0.0.0'
var port = 3000

var i = 0

const main = async function(ctx) {
  let body = ctx.request.body
  if (ctx.request.path !== '/') {
    ctx.response.type = 'text'
    let name = ctx.request.path.substr(1)
    let result = {}
    try {
    } catch (err) {
    }

    ctx.response.body = JSON.stringify(result)
  } else {
    ctx.response.body = 'Hello World'
  }
}

app.use(main)
app.listen(port)
console.log(`======== Running on http://${host}:${port} ========`)
console.log('(Press CTRL+C to quit)')
