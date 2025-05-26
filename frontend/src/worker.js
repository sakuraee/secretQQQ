self.onmessage = function(e) {
  const { code, klineData: allKlineData, initialAmount } = e.data
  const trades = []
  let currentPosition = null
  const executeUserCode = new Function('index', 'klineData', 'currentPosition', 'lastTrade', code )
  
  // 获取所有时间点
  const allPoints = []
  for (const [product, klineData] of Object.entries(allKlineData)) {
    klineData.forEach(point => {
      allPoints.push({...point, product})
    })
  }
  
  // 按时间排序
  allPoints.sort((a, b) => a.timestamp - b.timestamp)
  
  // 按时间点处理
  allPoints.forEach((point, index) => {
    // 如果有持仓且不是当前产品则跳过其他产品检查
    if (currentPosition && point.product !== currentPosition.product) return
    try {
      const result = executeUserCode(index, allKlineData[point.product], currentPosition, trades.at(-1) || {})

      if (result && result.action && !currentPosition) {
        // 开仓
        currentPosition = {
          product: point.product, // 记录当前持仓产品
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
    if (index % 100 === 0) {
      self.postMessage({
        type: 'progress',
        progress: Math.floor((index / allPoints.length) * 100)
      })
    }
  })

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
