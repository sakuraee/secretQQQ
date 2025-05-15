import { useState } from 'react'
import KLineChart from './components/KLineChart'
import './App.css'

function App() {
  const [product, setProduct] = useState('BTC/USDT')
  const [isReal, setIsReal] = useState(true)

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
      </div>
      
      <KLineChart product={product} isReal={isReal} />
    </div>
  )
}

export default App
