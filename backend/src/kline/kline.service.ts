import { Injectable } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';

interface SavedCode {
  _id: ObjectId;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CodeResult {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const DB_NAME = 'crypto_web';

@Injectable()
export class KlineService {
  private client: MongoClient;

  constructor() {
    this.client = new MongoClient(DB_URL);
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async processKlineFile(
    file: Express.Multer.File,
    isReal: boolean,
  ): Promise<{
    stats: { total: number; inserted: number; duplicates: number };
    timeRange: { start: string; end: string };
    product: string;
  }> {
    const stats = { total: 0, inserted: 0, duplicates: 0 };
    let product = '';
    let minTime: Date | null = null;
    let maxTime: Date | null = null;

    try {
      if (!file.buffer) {
        throw new Error('上传文件内容为空');
      }
      const fileContent = file.buffer.toString('utf-8');
      const harData = JSON.parse(fileContent);

      for (const entry of harData.log.entries) {
        const request = entry.request;
        const url = request.url;

        if (url.includes('candles?')) {
          const response = entry.response;
          if (!response.content.text) continue;

          const responseJson = JSON.parse(response.content.text);
          for (const dataRow of responseJson.data) {
            stats.total++;
            const timestamp = new Date(parseInt(dataRow[0]));

            // 从URL解析产品名称和bar
            const db = this.client.db(DB_NAME);
            const collection = db.collection('KLineData');

            if (!product) {
              const instIdMatch = url.match(/instId=([^&]+)/);
              if (instIdMatch) {
                product = instIdMatch[1].replace('-', '');
              }
            }
            const barMatch = url.match(/bar=([^&]+)/);
            if (!barMatch) {
              throw new Error('URL中缺少bar参数');
            }
            const bar = barMatch[1];

            // 更新时间范围
            if (!minTime || timestamp < minTime) {
              minTime = timestamp;
            }
            if (!maxTime || timestamp > maxTime) {
              maxTime = timestamp;
            }

            // 检查是否已存在相同product、isReal和timestamp的记录
            const existing = await collection.findOne({
              product,
              isReal,
              timestamp,
            });

            if (existing) {
              stats.duplicates++;
              continue;
            }

            await collection.insertOne({
              product,
              bar,
              isReal,
              timestamp,
              open: parseFloat(dataRow[1]),
              high: parseFloat(dataRow[2]),
              low: parseFloat(dataRow[3]),
              close: parseFloat(dataRow[4]),
              volume: parseFloat(dataRow[5]),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            stats.inserted++;
          }
        }
      }

      if (!product) {
        throw new Error('无法从HAR文件中解析产品名称');
      }
      if (!minTime || !maxTime) {
        throw new Error('未找到有效的时间数据');
      }

      return {
        stats,
        timeRange: {
          start: minTime.toISOString(),
          end: maxTime.toISOString(),
        },
        product,
      };
    } catch (error) {
      console.error('Error processing kline file:', error);
      throw error;
    }
  }

  async getKlines(
    product?: string,
    isReal?: boolean,
    startTime?: Date,
    endTime?: Date,
    bar? :string 
  ) {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('KLineData');

    const query: any = {};
    if (product) query.product = product;
    if (isReal !== undefined) query.isReal = isReal;
    if (bar !== undefined) query.bar = bar;
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = startTime;
      if (endTime) query.timestamp.$lte = endTime;
    }

    const results = await collection
      .find(query)
      .sort({ timestamp: 1 })
      .toArray();

    return results.map((doc) => ({
      product: doc.product,
      bar: doc.bar,
      isReal: doc.isReal,
      timestamp: doc.timestamp,
      open: doc.open,
      high: doc.high,
      low: doc.low,
      close: doc.close,
      volume: doc.volume,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      _id: doc._id.toString(),
    }));
  }

  async getAllProducts() {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('KLineData');
    const products = await collection.distinct('product');
    return products;
  }

  async getAllBars() {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('KLineData');
    const bars = await collection.distinct('bar');
    return bars;
  }

  async saveCode(code: string, name?: string) {
    if (!name) {
      name = `Untitled-${Date.now()}`;
    }

    const db = this.client.db(DB_NAME);
    const collection = db.collection('SavedCodes');
    
    // 检查同名文档是否存在
    const existingDoc = await collection.findOne({ name });
    
    if (existingDoc) {
      // 更新现有文档
      const result = await collection.updateOne(
        { _id: existingDoc._id },
        { $set: { code, updatedAt: new Date() } }
      );
      return existingDoc._id.toString();
    } else {
      // 创建新文档
      const doc = {
        name,
        code,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await collection.insertOne(doc);
      return result.insertedId.toString();
    }
  }

  async renameCode(id: string, newName: string) {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('SavedCodes');
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { name: newName, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }


  async getSavedCodes() {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('SavedCodes');
    const codes = await collection.find().sort({ updatedAt: -1 }).toArray();
    return codes.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      code: doc.code,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));
  }

  async getCode(id: string) {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('SavedCodes');
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      throw new Error('Code not found');
    }
    return {
      id: doc._id.toString(),
      name: doc.name,
      code: doc.code,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  async deleteCode(id: string) {
    const db = this.client.db(DB_NAME);
    const collection = db.collection('SavedCodes');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}
