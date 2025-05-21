import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import KLineChart from './components/KLineChart'
import './App.css'

function App() {
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState('')
  const [isReal, setIsReal] = useState(true)
  const [trades, setTrades] = useState('')
  const [initialAmount, setInitialAmount] = useState(10000)
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [savedCodes, setSavedCodes] = useState([])
  const [code, setCode] = useState('')
  const [selectedCodeId, setSelectedCodeId] = useState(null)
  const splitContainerRef = useRef(null)
  const leftPanelRef = useRef(null)

  const saveCode = async (code, name) => {
    try {
      await axios.post('http://localhost:3000/kline/save-code', { code, name })
      const response = await axios.get('http://localhost:3000/kline/saved-codes')
      setSavedCodes(response.data)
    } catch (error) {
      console.error('Error saving code:', error)
    }
  }

  const renameCode = async (id, newName) => {
    try {
      await axios.post('http://localhost:3000/kline/rename-code', { id, newName })
      const response = await axios.get('http://localhost:3000/kline/saved-codes')
      setSavedCodes(response.data)
    } catch (error) {
      console.error('Error renaming code:', error)
    }
  }

  const loadCode = async (id) => {
    try {
      const response = await axios.get(`http://localhost:3000/kline/code/${id}`)
      setCode(response.data.code)
      setTrades(response.data.code)
      setSelectedCodeId(id)
    } catch (error) {
      console.error('Error loading code:', error)
    }
  }

  const runCode = () => {
    try {
      // 这里可以添加代码执行逻辑
      console.log('Running code:', code)
    } catch (error) {
      console.error('Error running code:', error)
    }
  }

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('http://localhost:3000/kline/products')
        const response1 = await axios.get('http://localhost:3000/kline/saved-codes')
        setSavedCodes(response1.data)
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

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      
      const containerRect = splitContainerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const newLeftWidth = (e.clientX - containerRect.left) / containerWidth * 100
      
      // 限制最小宽度
      const minWidth = 20
      const maxWidth = 80
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth))
      
      leftPanelRef.current.style.flex = `0 0 ${clampedWidth}%`
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (loading) {
    return <div className="app">Loading...</div>
  }

  return (
    <div className="app">
      <div className="split-container" ref={splitContainerRef}>
        <div className="left-panel">
          <div className="top-section">
            <h2>交易收益明细</h2>
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
            </div>
          </div>
          
          <div className="bottom-section">
            <KLineChart 
              product={product} 
              isReal={isReal}
              trades={parsedTrades}
              initialAmount={initialAmount}
            />
          </div>
        </div>
        
        
        <div className="right-panel" ref={leftPanelRef}>
          <h1>代码编辑器</h1>
          <div className="code-actions">
            <select 
              onChange={(e) => loadCode(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px' }}
            >
              <option value="">加载历史代码</option>
              {savedCodes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || new Date(item.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
            <button onClick={() => {
              const name = prompt('请输入文件名:')
              if (name) saveCode(trades, name)
            }}>保存代码</button>
            <button onClick={() => {
              if (!selectedCodeId) {
                alert('请先选择一个文件')
                return
              }
              const newName = prompt('请输入新文件名:')
              if (newName) renameCode(selectedCodeId, newName)
            }}>重命名</button>
            <button onClick={runCode}>运行代码</button>
          </div>
          <div className="code-editor">
            <textarea
              value={trades}
              onChange={(e) => setTrades(e.target.value)}
              placeholder='输入交易数据JSON格式，例如: [["2025-05-15T10:00:00", "buy"], ["2025-05-15T12:00:00", "sell"]]'
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
