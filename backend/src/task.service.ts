import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as CryptoJS from 'crypto-js';
import { Db, MongoClient } from 'mongodb';

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
      'BTC-USDT-SWAP',
      'BNB-USDT-SWAP',
      'DOGE-USDT-SWAP',
      'ADA-USDT-SWAP',
      'TRX-USDT-SWAP',
      'DOGE-USDT-SWAP',
    ];
    const bars = ['15m', '1H'];
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

  async sendSignedRequest(
    method: 'GET' | 'POST',
    requestPath: string,
    body?: any,
  ): Promise<{ code: string; msg: string; data: string[][] }> {
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
}
