// 接收一下 instIds , bars , codes , 最后返回出来
// 从数据库中获取历史数据，从service 中获取最近一期的数据，
// 把code跑一下 获取结果，进行操作
// TODO: 平仓似乎没有调研怎么弄
import { MongoClient } from 'mongodb';
import { sendEmail  , makeOrder } from '../../utils/index.js';

// 先把单产品的做了
let instIds = ""
let bars = "1H"

// 子进程或者或者说是部署着的名字
let codeName = ""
let code = ""
// 从主进程获取最新的未完结的kline
let currentKline = null

// 但是有个问题这个code 可能会被编辑,可能今天运行了明天改了然后再运行,这一块可能后续需要优化一下
const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const DB_NAME = 'crypto_web';
const client = new MongoClient(DB_URL);
const db = client.db(DB_NAME)
const kLineDataCollection = db.collection('KLineData');
const deployedTradeInfo = db.collection('deployedTradeInfo');
const SavedCodes = db.collection('SavedCodes');

function getCurrentMinute() {
    const now = new Date();
    return now.getMinutes();
}


process.on('message', async (msg) => {
    try{
        if (msg.codeName && msg.instIds && msg.bars) {
            // 直接应该传CODENAME
            codeName = msg.codeName
            instIds = msg.instIds
            bars = msg.bars
            

            const document = await SavedCodes.findOne({name:codeName})
            code =document.code

        }
        if (msg.currentData) {
            const allCurrentKline = JSON.parse(msg.currentData)
            currentKline = allCurrentKline[`${instIds}-${bars}`]
    
        }
    }catch (error) {
        process.send({
            type: 'output',
            data: JSON.stringify(error) +  "启动就有问题捏",
        });
    }
    
})
process.on('exit', () => {
    if (global.intervalId) {
        clearInterval(global.intervalId);
        console.log('定时器已清除');
    }
    // 清理工作
    if (global.intervalId) {
        clearInterval(global.intervalId);
        console.log('定时器已清除');
    }
    process.exit();
    return;
}
);


global.intervalId = setInterval(async () => {
    // 并且获取一下当前时间,现在默认成都是一个小时的吧 , 每个小时的59分算一下现在的因子是否要开仓或者平仓
    // 获取当前的一个为你
    try {
        if (code && instIds && bars && getCurrentMinute() == 59) {
        // if (code && instIds && bars && currentKline) {
            
            const executeUserCode = new Function('index', 'klineData', 'currentPosition', 'lastTrade', code)
            // 从数据库中获取历史数据 
            const cursor =await kLineDataCollection.find({
                    product: instIds,
                    bar: bars
            }).sort({ timestamp: -1 }).limit(100);
            
            const latestData = await cursor.toArray();


            // TODO 这里需要确认顺序
            let klineData = latestData.toReversed()
            //从主进程中获取最后一条的数据合在一起

        
            // currentKline
            klineData.push(currentKline)

            // index应该直接就算最后一条即可
            const index = klineData.length - 1

            const tradeInfo = deployedTradeInfo.find({
                where: {
                    codeName: codeName,
                    bar: bars,
                    instId: instIds
                }
            }).sort({
                createTime: -1
            })
            // currentPosition 是当前未闭合的最后一条记录
            // lastTrade 是最近一次已经闭合了的交易记录
            let currentPosition = {}
            let lastTrade = {}
            for (let i = 0; i < tradeInfo.length; i++) {
                if (tradeInfo[i].closePrice) {
                    lastTrade = tradeInfo[i]
                    break;
                }
            }

            for (let i = 0; i < tradeInfo.length; i++) {
                if ((!tradeInfo[i].closePrice) && tradeInfo[i].openPrice) {
                    currentPosition = tradeInfo[i]
                    break;
                }
            }

            

            // 执行code 
            const result = executeUserCode(index, klineData, currentPosition, lastTrade || {})

            
            

            process.send({
                type: 'output',
                data: `${codeName}-${instIds}-${bars} 当前时间${(new Date()).toLocaleString()} Result: ${JSON.stringify(result)}`,
            });
            // 参照前端回测的逻辑 ,只是多一步将数据插入库中
            // 加入一些额外的字段 运行的代码名称 ,  选中监控的INSTID , 时间尺度 , 你插入这条数据的时间

            if (result && result.action && !currentPosition) {
                // 开仓
                sendEmail(`${codeName}-${instIds}-${bars} 当前时间${(new Date()).toLocaleString()} Result: ${JSON.stringify(result)}`)
                currentPosition = {
                    product: product, // 记录当前持仓产品
                    type: result.action, // 'buy' or 'sell'
                    openTime: point.timestamp,
                    openPrice: point.close,
                    closeTime: null,
                    closePrice: null,
                    profit: null,
                    currentMoney: null,
                    tradeAmount: result.amount, // 使用传入的金额或默认初始金额
                    message: result.message,
                    // 运行代码的相关信息
                    instId: instIds,
                    bar: bars,
                    createTime: (new Date()).getTime(),
                    codeName: codeName,
                }

                deployedTradeInfo.insertOne(currentPosition)

            } else if (result && result.action && currentPosition) {
                sendEmail(`${codeName}-${instIds}-${bars} 当前时间${(new Date()).toLocaleString()} Result: ${JSON.stringify(result)}`)
                // 平仓 - 做多平仓是sell，做空平仓是buy
                if ((currentPosition.type === 'buy' && result.action === 'sell') ||
                    (currentPosition.type === 'sell' && result.action === 'buy')) {

                    currentPosition.closeTime = point.timestamp
                    currentPosition.closePrice = point.close
                    currentPosition.message += " // " + result.message
                    // 利润计算：做多=(平仓价-开仓价)/开仓价，做空=(开仓价-平仓价)/开仓价
                    currentPosition.profit = currentPosition.type === 'buy'
                        ? (currentPosition.closePrice - currentPosition.openPrice) / currentPosition.openPrice * 100
                        : (currentPosition.openPrice - currentPosition.closePrice) / currentPosition.openPrice * 100

                    // TODO ：这里应该要加上手续费扣除
                    currentPosition.currentMoney = trades.length > 0
                        ? trades[trades.length - 1].currentMoney + (currentPosition.tradeAmount * currentPosition.profit / 100)
                        : initialAmount + (currentPosition.tradeAmount * currentPosition.profit / 100)

                    deployedTradeInfo.updateOne({
                        where: {
                            _id: currentPosition._id
                        },
                        data: currentPosition
                    })

                }

            }
        }// 输出: Result: 35
    } catch (error) {
        process.send({
            type: 'output',
            data: JSON.stringify(error) +  "'Error executing dynamic code:', ",
        });
    }
}, 1000 * 60 * 50 )

// TODO 试验一下平仓接口怎么写  也应该参照使用node-scheduler 来定时执行