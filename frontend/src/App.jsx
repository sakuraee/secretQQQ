import { useState, useMemo } from 'react'
import KLineChart from './components/KLineChart'
import './App.css'

function App() {
  const [product, setProduct] = useState('BTC/USDT')
  const [isReal, setIsReal] = useState(true)
  const [trades, setTrades] = useState('')
  const [initialAmount, setInitialAmount] = useState(10000)

  const parsedTrades = useMemo(() => {
    try {
      return JSON.parse(trades)
    } catch {
      return []
    }
  }, [trades])

  return (
    <div className="app">
      <h1>K线图表</h1>
      <div className="controls">
        <select 
          value={product} 
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="BTC/USDT">BTC/USDT</option>
          <option value="ETH/USDT">ETH/USDT</option>
          <option value="BNB/USDT">BNB/USDT</option>
        </select>
        
        <label>
          <input
            type="checkbox"
            checked={isReal}
            onChange={(e) => setIsReal(e.target.checked)}
          />
          实盘数据
        </label>

        <div>
          <label>初始金额: 
            <input
              type="number"
              value={initialAmount}
              onChange={(e) => setInitialAmount(Number(e.target.value))}
            />
          </label>
        </div>

        <div>
          <label>交易数据(JSON格式): 
            <textarea
              value={trades}
              onChange={(e) => setTrades(e.target.value)}
              placeholder='例如: [["2025-05-15T10:00:00", "buy"], ["2025-05-15T12:00:00", "sell"]]'
            />
          </label>
        </div>
      </div>
      
      <KLineChart 
        product={product} 
        isReal={isReal}
        trades={parsedTrades}
        initialAmount={initialAmount}
      />
    </div>
  )
}

export default App
