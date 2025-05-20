import { useState, useEffect, useMemo } from 'react'
import KLineChart from './components/KLineChart'
import './App.css'

function App() {
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState('')
  const [isReal, setIsReal] = useState(true)
  const [trades, setTrades] = useState('')
  const [initialAmount, setInitialAmount] = useState(10000)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('http://localhost:3000/kline/products')
        const data = await response.json()
        setProducts(data)
        if (data.length > 0) {
          setProduct(data[0])
        }
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const parsedTrades = useMemo(() => {
    try {
      return JSON.parse(trades)
    } catch {
      return []
    }
  }, [trades])

  if (loading) {
    return <div className="app">Loading...</div>
  }

  return (
    <div className="app">
      <h1>K线图表</h1>
      <div className="controls">
        <select 
          value={product} 
          onChange={(e) => setProduct(e.target.value)}
        >
          {products.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
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
