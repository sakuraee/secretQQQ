import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import KLineChart from './components/KLineChart'
import './App.css'

function App() {
  const [products, setProducts] = useState([])
  const [timeScales, setTimeScales] = useState([])
  const [product, setProduct] = useState('')
  const [timeScale, setTimeScale] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isReal, setIsReal] = useState(true)
  const [trades, setTrades] = useState('')
  const [initialAmount, setInitialAmount] = useState(10000)
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [savedCodes, setSavedCodes] = useState([])
  const [executionProgress, setExecutionProgress] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [code, setCode] = useState('')
  const [selectedCodeId, setSelectedCodeId] = useState(null)
  const splitContainerRef = useRef(null)
  const leftPanelRef = useRef(null)

  const saveCode = async (code, name) => {
    try {
      // 检查同名文档
      const existingCode = savedCodes.find(c => c.name === name)
      
      if (existingCode) {
        const shouldUpdate = window.confirm(`文档"${name}"已存在，是否更新？`)
        if (!shouldUpdate) return
        
        // 更新现有文档
        await axios.post('http://localhost:3000/kline/save-code', { 
          code, 
          name,
          id: existingCode.id // 传递ID表示更新
        })
      } else {
        // 创建新文档
        await axios.post('http://localhost:3000/kline/save-code', { code, name })
      }
      
      // 刷新列表
      const response = await axios.get('http://localhost:3000/kline/saved-codes')
      setSavedCodes(response.data)
      alert(existingCode ? '文档已更新' : '文档已保存')
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        alert('错误：同名文档已存在')
      } else {
        console.error('Error saving code:', error)
        alert('保存失败: ' + error.message)
      }
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
      setSelectedCodeId(id)
    } catch (error) {
      console.error('Error loading code:', error)
    }
  }

  const [klineData, setKlineData] = useState([])

  const runCode = async () => {
    try {
      if (!klineData.length) {
        alert('请等待K线数据加载完成')
        return
      }

      setIsExecuting(true)
      setExecutionProgress(0)

      const worker = new Worker(new URL('./worker.js', import.meta.url))
      
      worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          setExecutionProgress(e.data.progress)
        } else if (e.data.type === 'result') {
          if (e.data.trades.length) {
            setTrades(JSON.stringify(e.data.trades))
            alert('代码执行完成，共生成 ' + e.data.trades.length + ' 条交易记录')
          } else {
            alert('代码执行完成，但未产生任何交易动作')
          }
          worker.terminate()
          setIsExecuting(false)
        }
      }

      worker.postMessage({
        code,
        klineData
      })
    } catch (error) {
      console.error('执行代码出错:', error)
      alert('执行代码出错: ' + error.message)
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [productsRes, scalesRes, codesRes] = await Promise.all([
          fetch('http://localhost:3000/kline/products'),
          axios.get('http://localhost:3000/kline/bars'),
          axios.get('http://localhost:3000/kline/saved-codes')
        ])
        
        setSavedCodes(codesRes.data)
        setTimeScales(scalesRes.data)
        
        const productsData = await productsRes.json()
        setProducts(productsData)
        if (productsData.length > 0) {
          setProduct(productsData[0])
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInitialData()
  }, [])

  const handleQuery = () => {
    // 触发KLineChart重新加载数据
    setKlineData([])
  }

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

              <select
                value={timeScale}
                onChange={(e) => setTimeScale(e.target.value)}
              >
                <option value="">选择时间尺度</option>
                {timeScales.map(scale => (
                  <option key={scale} value={scale}>{scale}</option>
                ))}
              </select>

              <div>
                <label>开始时间: 
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label>结束时间: 
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label>初始金额: 
                  <input
                    type="number"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(Number(e.target.value))}
                  />
                </label>
              </div>

              <button onClick={handleQuery}>查询</button>
            </div>
          </div>
          
          <div className="bottom-section">
            <KLineChart 
              product={product} 
              timeScale={timeScale}
              startTime={startTime}
              endTime={endTime}
              isReal={isReal}
              trades={parsedTrades}
              initialAmount={initialAmount}
              onKlineDataLoaded={setKlineData}
              key={`${product}-${timeScale}-${startTime}-${endTime}-${isReal}`}
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
              if (name) saveCode(code, name)
            }}>保存代码</button>
            <button onClick={() => {
              if (!selectedCodeId) {
                alert('请先选择一个文件')
                return
              }
              const newName = prompt('请输入新文件名:')
              if (newName) renameCode(selectedCodeId, newName)
            }}>重命名</button>
            <button onClick={runCode} disabled={isExecuting}>
              {isExecuting ? `执行中 (${executionProgress}%)` : '运行代码'}
            </button>
          </div>
          <div className="code-editor">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder='输入交易策略代码'
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

// 现在运行代码之后好像有点问题了怎么页面直接没了
// 布局需要调整回去
