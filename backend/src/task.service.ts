/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as CryptoJS from 'crypto-js';
import { Db, MongoClient } from 'mongodb';
import * as path from 'path';

const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const DB_NAME = 'crypto_web';
@Injectable()
export class TaskService {
  private client: MongoClient;
  private db: Db;
  constructor() {
    this.client = new MongoClient(DB_URL);
    this.db = this.client.db(DB_NAME);
  }
  async initDatabase() {
    const kLineDataCollection = this.db.collection('KLineData');
    //TODO : 注意这里要小心
    await kLineDataCollection.deleteMany({});
    await kLineDataCollection.createIndex(
      {
        product: 1,
        bar: 1,
        timestamp: 1,
        isReal: 1,
      } as const,
      {
        unique: true,
      },
    );
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
    const bars = ['15m', '1H', '1m', "5m"];
    for (const instId of instIds) {
      for (const bar of bars) {
        let before: string | undefined = undefined;
        let totalNum = 0;
        while (true) {
          const res = await this.getHistoryIndexCandles(
            instId,
            before,
            undefined,
            bar,
          );
          await Promise.resolve(
            new Promise((resolve) => setTimeout(resolve, 50)),
          );
          console.log(
            `从${new Date(parseInt(res.data[0][0]))}, 到${new Date(parseInt(res.data[res.data.length - 1][0] || ''))} 共 ${res.data.length}条数据`,
          );
          totalNum += res.data.length;
          // 转换数据格式并插入数据库
          const documents = res.data
            .map((item) => {
              if (item[8] === '1')
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
                };
            })
            .filter((item) => item !== undefined);

          if (documents.length > 0) {
            await kLineDataCollection.insertMany(documents);
            console.log(`成功插入 ${documents.length} 条数据`);
          }

          before = res.data[res.data.length - 1][0];
          if (res.data.length == 0 || totalNum > 10000) break;
        }
      }
    }
  }

  async getHistoryIndexCandles(
    instId: string,
    after?: string,
    before?: string,
    bar?: string,
    limit?: string,
  ): Promise<{ code: string; msg: string; data: string[][] }> {
    // 构建查询参数
    const params = new URLSearchParams();
    params.append('instId', instId);
    if (after) params.append('after', after);
    if (before) params.append('before', before);
    if (bar) params.append('bar', bar);
    if (limit) params.append('limit', limit);

    const requestPath = `/api/v5/market/history-candles?${params.toString()}`;
    const res = await this.sendSignedRequest('GET', requestPath);
    return res;
  }

  async getIndexCandles(
    instId: string,
    after?: string,
    before?: string,
    bar?: string,
    limit?: string,
  ): Promise<{ code: string; msg: string; data: string[][] }> {
    // 构建查询参数
    const params = new URLSearchParams();
    params.append('instId', instId);
    if (after) params.append('after', after);
    if (before) params.append('before', before);
    if (bar) params.append('bar', bar);
    if (limit) params.append('limit', limit);

    const requestPath = `/api/v5/market/candles?${params.toString()}`;
    const res = await this.sendSignedRequest('GET', requestPath);
    return res;
  }

  async fetchCurrentOneData(instId: string, bar?: string) {
    const res = await this.getIndexCandles(instId, undefined, undefined, bar);
    console.log(res.data[0]);
  }

  async fetchCurrentData() {
    const kLineDataCollection = this.db.collection('KLineData');
    const instIds = [
      'BTC-USDT-SWAP',
      'ETH-USDT-SWAP',
      'LTC-USDT-SWAP',
      'SOL-USDT-SWAP',
      'XRP-USDT-SWAP',
    ];
    const bars = ['15m', '1H'];
    for (const instId of instIds) {
      for (const bar of bars) {
        const res = await this.getHistoryIndexCandles(
          instId,
          undefined,
          undefined,
          bar,
        );
        const documents = res.data
          .map((item) => {
            if (item[8] === '1')
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
              };
          })
          .filter((item) => item !== undefined);

        if (documents.length > 0) {
          try {
            await kLineDataCollection.insertMany(documents);
            console.log(`成功插入 ${documents.length} 条数据`);
          } catch (err) {
            console.error(`插入数据失败: ${err}, 重试中...`);
            break;
          }
        } else {
          break;
        }
      }
    }
  }

  async sendSignedRequest(
    method: 'GET' | 'POST',
    requestPath: string,
    body?: any,
  ): Promise<{ code: string; msg: string; data: string[][] | any[] }> {
    // 从环境变量获取API凭证
    const apiKey = process.env.OKX_API_KEY;
    const secretKey = process.env.OKX_SECRET_KEY;
    const passphrase = process.env.OKX_PASSPHRASE;

    if (!apiKey || !secretKey) {
      throw new Error('Missing API credentials in environment variables');
    }

    // 生成时间戳
    const timestamp = new Date().toISOString();

    // 构建签名字符串
    let signString = timestamp + method + requestPath;
    if (body && method === 'POST') {
      signString += JSON.stringify(body);
    }

    // 生成签名
    const signature = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(signString, secretKey),
    );

    // 设置请求头
    const headers = {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    };

    // 发送请求
    try {
      const config = {
        method,
        url: `https://www.okx.com${requestPath}`,
        headers,
      };

      if (body && method === 'POST') {
        config['data'] = body;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(
          `API request failed: ${error.response.status} - ${JSON.stringify(
            error.response.data,
          )}`,
        );
      }
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async processSignal() {
    const instIds = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'];
    const bar = '1H';
    for (const instId of instIds) {
      const currentData = await this.fetchCurrentOneData(instId, bar);
      const kLineDataCollection = this.db.collection('KLineData');
      const latestData = await kLineDataCollection
        .find({
          product: instId,
          bar: bar,
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      const kLineData = [...latestData, currentData[0]];
      const worker = new Worker(path.resolve(__dirname, './worker.js'));

      // 参照前端进行一直跑嘛，

      // 然后接收信息，使用当前的一个价格进行下单

      // 将整个流程进行记录下来存库。
    }
  }

  async makeOrder(
    instId: string,
    money: number,
    price: number,
    side: string,
    leverage: number,
  ) {
    // 计算下单数量
    const getInstrumentPath = `/api/v5/account/instruments?instType=SWAP`;
    const getInstrument = await this.sendSignedRequest(
      'GET',
      getInstrumentPath,
    );
    const currentInstrument = getInstrument.data.filter(
      (item: any) => item.instId === instId,
    )[0];
    const ctVal = currentInstrument.ctVal;
    const lotSz = currentInstrument.lotSz;
    const size =
      Math.round((money * leverage) / (price * parseFloat(ctVal)) / lotSz) *
      lotSz;
    console.log(size);

    const setLeveragePath = `/api/v5/account/set-leverage`;
    const setLeverageBody = {
      mgnMode: 'isolated',
      lever: leverage,
      instId,
      posSide: side === 'buy' ? 'long' : 'short',
    };

    const setLeverageRes = await this.sendSignedRequest(
      'POST',
      setLeveragePath,
      setLeverageBody,
    );
    console.log(setLeverageRes);
    const body = {
      ordType: 'limit',
      tdMode: 'isolated',
      side,
      sz: size,
      px: price,
      posSide: side === 'buy' ? 'long' : 'short',
      instId: instId,
      clOrdId: 'b15',
      ccy: 'USDT',
    };
    const requestPath = `/api/v5/trade/order`;
    const res = await this.sendSignedRequest('POST', requestPath, body);
    console.log(res);
  }
}

// 每5m获取一下历史的 ，并且获取这个最新的加上去 ，我先试一下不加上止盈止损行不行，不行的话再加，并且修改一下参考一下多获取一点点数据获取到个1m
