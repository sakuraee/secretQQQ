import { Injectable } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class TaskService {
  async initDatabase(){
    const instId = []
    const bars = []  
  } 

  async getHistoryIndexCandles(
    instId: string,
    after?: string,
    before?: string,
    bar?: string,
    limit?: string,
  ) {
    // 构建查询参数
    const params = new URLSearchParams();
    params.append('instId', instId);
    if (after) params.append('after', after);
    if (before) params.append('before', before);
    if (bar) params.append('bar', bar);
    if (limit) params.append('limit', limit);

    const requestPath = `/api/v5/market/history-candles?${params.toString()}`;
    const res =  await this.sendSignedRequest('GET', requestPath);
    console.log(res)
    return res
  }

  async sendSignedRequest(
    method: 'GET' | 'POST',
    requestPath: string,
    body?: any,
  ) {
    // 从环境变量获取API凭证
    const apiKey = process.env.OKX_API_KEY;
    const secretKey = process.env.OKX_SECRET_KEY;
    const passphrase = process.env.OKX_PASSPHRASE;

    if (!apiKey || !secretKey ) {
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