self.onmessage = function(e) {
  const { code, klineData } = e.data
  const trades = []
  let currentPosition = null
  const executeUserCode = new Function('index', 'klineData',  code)
  
  klineData.forEach((point, index) => {
    try {
      const result = executeUserCode(index, klineData)
      
      if (result && result.action === 'buy' && !currentPosition) {
        // 开仓
        currentPosition = {
          buyTime: point.timestamp,
          buyPrice: point.close,
          sellTime: null,
          sellPrice: null,
          profit: null
        }
      } else if (result && result.action === 'sell' && currentPosition) {
        // 平仓
        currentPosition.sellTime = point.timestamp
        currentPosition.sellPrice = point.close
        currentPosition.profit = (currentPosition.sellPrice - currentPosition.buyPrice) / currentPosition.buyPrice *  100 
        trades.push(currentPosition)
        currentPosition = null
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
      status: '未平仓'
    })
  }

  self.postMessage({
    type: 'result',
    trades
  })
}
