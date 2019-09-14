const Koa = require('koa')
const ccxt = require('ccxt')
const bodyParser = require('koa-bodyparser')
const _ = require('lodash')

const app = new Koa()
// msleep 函数
let msleep = (ms) => new Promise(resolve => setTimeout (resolve, ms))

let log = console.log
let host = _.get(process.argv, 2, '0.0.0.0')
let port = Number(_.get(process.argv, 3, 3000))

// {
//   'binance': {'BTC/USDT': exchange}
//   ...
// }
g_ccxt_exchanges = {}

g_exchange_name_dict = {
  'huobi': 'huobipro',
  'hitbtc': 'hitbtc2',
}

function norm_name(name) {
  let n = _.toLower(name)
  return _.get(g_exchange_name_dict, n, n)
}

function norm_symbol(symbol) {
  let s = _.replace(symbol, '_', '/')
  return _.toUpper(s)
}

function split_symbol(symbol) {
  let s = norm_symbol(symbol)
  let li = _.split(s, '/')
  if (li.length < 2) {
    return [li[0], li[0]]
  } else {
    return _.slice(li, 0, 2)
  }
}

async function getCcxtExchange(name, symbol, apiKey, secret,
                               password='', uid='', reload=false) {
  name = norm_name(name)
  symbol = norm_symbol(symbol)
  let d0 = {}
  if (g_ccxt_exchanges.hasOwnProperty(name)) {
    d0 = g_ccxt_exchanges[name]
  }

  if (reload && d0.hasOwnProperty(symbol)) {
    await d0[symbol].close()
    delete d0[symbol]
  }

  let exchange
  if (d0.hasOwnProperty(symbol)) {
    exchange = d0[symbol]
  } else {
    try {
      exchange = eval(`new ccxt.${name}()`)
    } catch (e) {
      throw ('Unsupported Exchange: ' + name)
    }
  }

  // 初始化
  //exchange.timeout = 1000 * 55    # milliseconds, default 10000
  d0[symbol] = exchange
  exchange.apiKey = apiKey
  exchange.secret = secret
  exchange.password = password
  exchange.uid = uid
  return exchange
}

/*
 * {
 *    'access_key': '',
 *    'secret_key': '',
 *    'passwd_key': '',
 *    'uid_key': '',
 *    'nonce': '',
 *    'method': '',
 *    'timeout': 10000, # 单位为毫秒
 *    'params': {
 *      'symbol': 'ETH_BTC',
 *      'reload': false,
 *      'limit': -1,
 *      'contract_type': 'this_week',
 *    },
 * }
 *
 * 转化为 ccxt 标准结构
 * apiKey
 * secret
 * password
 * uid
 * timeout
 * reload
 * symbol
 * method
 * # 特定于 method 的参数
 * params {
 *  limit
 * }
 *
 */
function normRequest(data) {
  // 如果有这个 key, 就直接使用新风格
  if (data.hasOwnProperty('apiKey')) {
    return data
  }
  return {
    'apiKey': _.get(data, 'access_key'),
    'secret': _.get(data, 'secret_key'),
    'password': _.get(data, 'passwd_key'),
    'uid': _.get(data, 'uid_key'),
    'symbol': _.get(data, 'params.symbol'),
    'method': _.get(data, 'method'),
    'timeout': _.get(data, 'timeout', 10.0) * 1000,
    'params': {
      'limit': _.get(data, 'params.limit'),
      'id': _.get(data, 'params.id'),
      'stmt': _.get(data, 'params.stmt'),
    }
  }
}

async function handleRequest(name, req) {
  // 规范化符号
  req.symbol = norm_symbol(req.symbol)
  let ex = await getCcxtExchange(name, req.symbol, req.apiKey, req.secret,
                                 req.password, req.uid, req.reload)
  // 重新设置 timeout, 默认 10 秒
  ex.timeout = _.get(req, 'timeout', 10000)
  let result = {}
  let ret
  try {
    switch (req.method) {
      case 'fetchTicker':
        ret = await ex.fetchTicker(req.symbol)
        break
      case 'depth': // 兼容老代码
      case 'fetchOrderBook':
        if (req.params.limit < 0) {
          ret = await ex.fetchOrderBook(req.symbol)
        } else {
          ret = await ex.fetchOrderBook(req.symbol, req.params.limit)
        }
        break
      case 'fetchBalance':
        ret = await ex.fetchBalance()
        break
      case 'fetchOrder':
        ret = await ex.fetchOrder(req.params.id, req.symbol)
        break
      case 'fetchOpenOrders':
        ret = await ex.fetchOpenOrders(req.symbol)
        break
      case 'limitBuy':
        ret = await ex.createOrder(req.symbol, 'limit', 'buy', req.params.amount, req.params.price)
        break
      case 'limitSell':
        ret = await ex.createOrder(req.symbol, 'limit', 'sell', req.params.amount, req.params.price)
        break
      case 'cancelOrder':
        ret = await ex.cancelOrder(req.params.id, req.symbol)
        break
      case 'eval':
        // NOTE: 务必使用新风格的 req
        // NOTE: 这个时候, params 直接就是函数的 params
        ret = await ex[req.function](...req.params)
        break
      default:
        throw new Error('Not Implemented')
    }
    result = {
      'code': 0,
      //'error': '',
      'data': ret,
    }
  } catch (e) {
    log(e)
    result = {
      'code': 1,
      'error': e.toString(),
    }
  }
  return result
}

async function postHandler(ctx) {
  if (ctx.request.path === '/') {
    ctx.response.body = 'Hello POST'
    return
  }

  // http://localhost:3000/{name}
  let name = ctx.request.path.substr(1)
  let body = ctx.request.rawBody
  let data = {}

  // 处理 body 出错
  try {
    data = JSON.parse(body)
  } catch (e) {
    ctx.response.body = JSON.stringify({
      'code': 1,
      'error': 'body parse error: ' + body,
    })
    return
  }

  let req = normRequest(data)
  let result = await handleRequest(name, req)
  log(result)
  ctx.response.body = JSON.stringify(result)
}

async function getHandler(ctx) {
  ctx.response.body = 'Hello GET'
}

const main = async function(ctx) {
  if (ctx.request.method === 'GET') {
    await getHandler(ctx)
  } else if (ctx.request.method == 'POST') {
    await postHandler(ctx)
  }
}

app.use(bodyParser({
  enableTypes: ['json', 'form', 'text'],
}))
app.use(main)
app.listen(port, host, () => {
  console.log(`======== Running on http://${host}:${port} ========`)
  console.log('(Press CTRL+C to quit)')
})
