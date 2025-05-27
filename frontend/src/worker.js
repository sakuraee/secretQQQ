self.onmessage = function(e) {
  const { code, klineData: allKlineData, initialAmount } = e.data
  const trades = []
  let currentPosition = null
  const executeUserCode = new Function('index', 'klineData', 'currentPosition', 'lastTrade', code )
  
  // 获取所有时间点
  const products = Object.keys(allKlineData)
  const oneProduct = products[0]
  for(let i =0 ; i < allKlineData[oneProduct].length; i++) {
    for(let product of products) {
      if(currentPosition && currentPosition.product !== product) continue

      const point = allKlineData[product][i]
      try {
        const result = executeUserCode(i, allKlineData[product], currentPosition, trades.at(-1) || {})
  
        if (result && result.action && !currentPosition) {
          // 开仓
          currentPosition = {
            product: product, // 记录当前持仓产品
            type: result.action, // 'buy' or 'sell'
            openTime: point.timestamp,
            openPrice: point.close,
            closeTime: null,
            closePrice: null,
            profit: null,
            currentMoney: null,
            tradeAmount: result.amount , // 使用传入的金额或默认初始金额
            message: result.message
          }
        } else if (result && result.action && currentPosition) {
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
  
            trades.push(currentPosition)
            currentPosition = null
          }
        }
      } catch (err) {
        console.error(`执行用户代码出错(时间点: ${point.timestamp}):`, err)
      }
  
      // 每处理100个数据点发送一次进度
      // 进度报告
      if (i % 100 === 0) {
        self.postMessage({
          type: 'progress',
          progress: Math.floor((i / allKlineData[oneProduct].length) * 100)
        })
      }
    }


  }




  // 处理未平仓的头寸
  if (currentPosition) {
    // 获取当前产品的k线数据
    const currentProductData = allKlineData[currentPosition.product] || []
    trades.push({
      ...currentPosition,
      status: '未平仓',
      // 计算浮动盈亏
      floatingProfit: currentPosition.type === 'buy'
        ? (currentProductData[currentProductData.length - 1].close - currentPosition.openPrice) / currentPosition.openPrice * 100
        : (currentPosition.openPrice - currentProductData[currentProductData.length - 1].close) / currentPosition.openPrice * 100
    })
  }

  self.postMessage({
    type: 'result',
    trades
  })
}


// @index 当前的索引 @klineData 总的k线数据 @currentPosition 当前仓位 @lastTrade
// 指标计算工具函数
const technicalIndicators = {
  // EMA计算
  calculateEMA: (data, period, priceKey='close') => {
      const ema = [];
      const k = 2 / (period + 1);
      let sma = 0;
      
      // 计算SMA
      for(let i=0; i<period; i++) sma += data[i][priceKey];
      sma /= period;
      ema.push(...new Array(period-1).fill(null), sma);

      // 计算EMA
      for(let i=period; i<data.length; i++) {
          ema.push(data[i][priceKey] * k + ema[i-1] * (1 - k));
      }
      return ema;
  },

  // ATR计算
  calculateATR: (data, period) => {
      const atr = [];
      let trueRanges = [];
      
      for(let i=1; i<data.length; i++) {
          const tr = Math.max(
              data[i].high - data[i].low,
              Math.abs(data[i].high - data[i-1].close),
              Math.abs(data[i].low - data[i-1].close)
          );
          trueRanges.push(tr);
          
          if(i >= period) {
              const atrValue = trueRanges.slice(-period).reduce((a,b) => a+b) / period;
              atr.push(atrValue);
          } else {
              atr.push(null);
          }
      }
      return [null, ...atr]; // 对齐数据索引
  },

  // 布林带计算
  calculateBB: (data, period, devUp=2, devDn=2) => {
      const middle = [];
      const upper = [];
      const lower = [];
      
      for(let i=0; i<data.length; i++) {
          if(i < period-1) {
              middle.push(null);
              upper.push(null);
              lower.push(null);
              continue;
          }
          
          const slice = data.slice(i-period+1, i+1);
          const closes = slice.map(d => d.close);
          const mean = closes.reduce((a,b) => a+b) / period;
          const std = Math.sqrt(closes.map(c => Math.pow(c - mean, 2)).reduce((a,b) => a+b) / period);
          
          middle.push(mean);
          upper.push(mean + std * devUp);
          lower.push(mean - std * devDn);
      }
      return { upper, middle, lower };
  },

  // 成交量MA
  calculateVolMA: (data, period) => {
      const ma = [];
      for(let i=0; i<data.length; i++) {
          if(i < period-1) {
              ma.push(null);
              continue;
          }
          const sum = data.slice(i-period+1, i+1).reduce((a,b) => a + b.volCcyQuote, 0);
          ma.push(sum / period);
      }
      return ma;
  }
};

// 主策略函数
function generateSignal(index, kLineData) {
  if(index < 60) return null; // 确保足够数据
  
  // 预计算所有指标
  const ema20 = technicalIndicators.calculateEMA(kLineData, 20);
  const ema60 = technicalIndicators.calculateEMA(kLineData, 60);
  const atr = technicalIndicators.calculateATR(kLineData, 14);
  const bb = technicalIndicators.calculateBB(kLineData, 20);
  const volMA = technicalIndicators.calculateVolMA(kLineData, 20);
  
  // 获取当前K线数据
  const current = kLineData[index];
  const currentVolMA = volMA[index];
  
  // 趋势强度计算（简化版ADX）
  const trendStrength = Math.abs(ema20[index] - ema60[index]) / atr[index];

  // 动量指标计算
  const momentum = current.close - kLineData[index-10].close;

  // 信号条件判断
  const longCondition = (
      ema20[index] > ema60[index] &&          // 趋势向上
      trendStrength > 0.5 &&                  // 趋势强度
      current.close > bb.middle[index] &&     // 突破中轨
      current.volCcyQuote > currentVolMA * 1.2 && // 放量
      momentum > 0                           // 动量向上
  );

  const shortCondition = (
      ema20[index] < ema60[index] &&         // 趋势向下
      trendStrength > 0.5 &&                 
      current.close < bb.middle[index] &&    
      current.volCcyQuote > currentVolMA * 1.2 &&
      momentum < 0
  );

  // 生成信号对象
  const signal = {
      timestamp: current.timestamp || Date.now(),
      price: current.close,
      position: null,
      stopLoss: null,
      takeProfit: null
  };

  if(longCondition) {
      signal.position = 'long';
      signal.stopLoss = current.low - atr[index] * 1.5;
      signal.takeProfit = current.close + (current.close - signal.stopLoss) * 2;
  } else if(shortCondition) {
      signal.position = 'short';
      signal.stopLoss = current.high + atr[index] * 1.5;
      signal.takeProfit = current.close - (signal.stopLoss - current.close) * 2;
  }

  return signal;
}

generateSignal

/* 使用示例
const signals = [];
for(let i=0; i<kLineData.length; i++) {
  const signal = generateSignal(i, kLineData);
  if(signal) signals.push(signal);
}
*/
