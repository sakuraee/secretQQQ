self.onmessage = function(e) {
  const { code, klineData, initialAmount } = e.data
  const trades = []
  let currentPosition = null
  const executeUserCode = new Function('index', 'klineData', 'currentPosition', 'lastTrade', code )
  
  klineData.forEach((point, index) => {
    try {
      const result = executeUserCode(index, klineData , currentPosition  , trades.at(-1) || {} )

      if (result && result.action && !currentPosition) {
        // 开仓
        currentPosition = {
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
    if (index % 100 === 0) {
      self.postMessage({
        type: 'progress',
        progress: Math.floor((index / klineData.length) * 100)
      })
    }
  })

  // 处理未平仓的头寸
  if (currentPosition) {
    trades.push({
      ...currentPosition,
      status: '未平仓',
      // 计算浮动盈亏
      floatingProfit: currentPosition.type === 'buy'
        ? (klineData[klineData.length - 1].close - currentPosition.openPrice) / currentPosition.openPrice * 100
        : (currentPosition.openPrice - klineData[klineData.length - 1].close) / currentPosition.openPrice * 100
    })
  }

  self.postMessage({
    type: 'result',
    trades
  })
}
