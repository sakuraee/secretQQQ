/* eslint-disable */
import { sendSignedRequest } from '../../utils/index.js';
import { Db, MongoClient } from 'mongodb';
import * as nodeSchedule  from 'node-schedule';
const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const DB_NAME = 'crypto_web';

const client = new MongoClient(DB_URL);

const db = client.db(DB_NAME)
const kLineDataCollection = db.collection('KLineData');

process.on('message', async (msg) => {
  if (msg.action === 'stop') {
    // 清理工作
    if (global.intervalId) {
      clearInterval(global.intervalId);
      console.log('定时器已清除');
    }
    process.exit();
    return;
  }
});
async function main() {
  try {
    process.send({
      type: 'output',
      data: '子进程已启动，开始执行数据监控任务',
    });
    // // 执行传入的函数
    // // const func = eval(`(${msg.funcStr})`);

    const instIds = [
      'BTC-USDT-SWAP',
      'ETH-USDT-SWAP',
      'LTC-USDT-SWAP',
      'SOL-USDT-SWAP',
      'XRP-USDT-SWAP',
      'BNB-USDT-SWAP',
      'DOGE-USDT-SWAP',
      'ADA-USDT-SWAP',
      'TRX-USDT-SWAP',
    ];
    // const bars = ['15m', '1H' , '1m', "5m"];
    const bars = ['15m', '1H'];
    let finalRes = {};
    for (let instId of instIds) {
      for (let bar of bars) {
        const params = new URLSearchParams();
        params.append('instId', instId);
        params.append('bar', bar);
        const requestPath = `/api/v5/market/candles?${params.toString()}`;
        const res = await sendSignedRequest('GET', requestPath);
        const data = res.data;
        const document =data.filter(item => item[8] == '1').map(item=>{
          return {
            product: instId,
            bar: bar,
            timestamp: new Date(parseInt(item[0])),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            vol: parseFloat(item[5]),
            volCcy: parseFloat(item[6]),
            volCcyQuote: parseFloat(item[7]),
            isReal: true,
          }
        })
        try{
          await kLineDataCollection.insertMany(document)
        }catch(e){
        }
        let temp = {
          product: instId,
          bar: bar,
          timestamp: new Date(parseInt(data[0][0])),
          open: parseFloat(data[0][1]),
          high: parseFloat(data[0][2]),
          low: parseFloat(data[0][3]),
          close: parseFloat(data[0][4]),
          vol: parseFloat(data[0][5]),
          volCcy: parseFloat(data[0][6]),
          volCcyQuote: parseFloat(data[0][7]),
          isReal: true,
        }
        finalRes[`${instId}-${bar}`]  = temp

        // data.filter(item=> item);
        // .then((res) => {
        //   process.send({
        //     type: 'output',
        //     data: instId + ' ' + bar + ' ' + res.data[0],
        //   });
        // });
      }
    }
    process.send({ type: 'result', data: JSON.stringify(finalRes) });
    process.send({ type: 'output', data: "已上传最新未完结k线数据" });
  } catch (error) {
    process.send({ type: 'output', data: error.message });
  }
}

nodeSchedule.scheduleJob('55 * * * * *', function(){
  main();
});


