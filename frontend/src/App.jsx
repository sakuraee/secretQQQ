import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import KLineChart from './components/KLineChart'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'
import './App.css'
import {
  Snackbar,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TableSortLabel
} from '@mui/material'

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
  const [code, setCode] = useState('// @index 当前的索引 @klineData 总的k线数据')
  const [selectedCodeId, setSelectedCodeId] = useState(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  })
  const splitContainerRef = useRef(null)
  const leftPanelRef = useRef(null)

  const [selectedProducts, setSelectedProducts] = useState([]) // 存储格式: {product: string, timeScale: string}
  const [allKlineData, setAllKlineData] = useState({})


  // 初始化数据
  
  const showMessage = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    })
  }

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  const saveCode = async (code, name) => {
    try {
      // 检查同名文档
      const existingCode = savedCodes.find(c => c.name === name)

      if (existingCode) {
        // 直接更新现有文档
        await axios.post('http://localhost:3000/kline/save-code', {
          code,
          name,
          id: existingCode.id // 传递ID表示更新
        })
        showMessage('文档已自动更新保存')
      } else {
        // 创建新文档
        await axios.post('http://localhost:3000/kline/save-code', { code, name })
        showMessage('文档已保存')
      }

      // 刷新列表
      const response = await axios.get('http://localhost:3000/kline/saved-codes')
      setSavedCodes(response.data)
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        showMessage('错误：同名文档已存在', 'error')
      } else {
        console.error('Error saving code:', error)
        showMessage('保存失败: ' + error.message, 'error')
      }
    }
  }

  // 定时保存
  useEffect(() => {
    const interval = setInterval(() => {
      if (code && selectedCodeId) {
        const selectedCode = savedCodes.find(c => c.id === selectedCodeId)
        if (selectedCode) {
          saveCode(code, selectedCode.name)
        }
      }
    }, 10000) // 每5分钟保存一次

    return () => clearInterval(interval)
  }, [code, selectedCodeId, savedCodes])

  // 页面关闭前保存
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (code && selectedCodeId) {
        e.preventDefault()
        e.returnValue = ''
        const selectedCode = savedCodes.find(c => c.id === selectedCodeId)
        if (selectedCode) {
          saveCode(code, selectedCode.name)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [code, selectedCodeId, savedCodes])

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
    if (!id) {
      setCode('')
      setSelectedCodeId(null)
      return
    }
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
      if (!allKlineData) {
        alert('请等待K线数据加载完成')
        return
      }
      console.log(allKlineData)
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
        klineData: allKlineData ,
        initialAmount
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

  // 添加产品图表
  const handleAddProduct = async () => {
    if (!product) return
    
    try {
      // 获取K线数据
      const params = {
        product,
        isReal
      }
      if (timeScale) params.bar = timeScale
      if (startTime) params.startTime = new Date(startTime).toISOString()
      if (endTime) params.endTime = new Date(endTime).toISOString()

      const response = await axios.get('http://localhost:3000/kline', { params })
      const data = response.data

      // 更新状态
      setSelectedProducts([...selectedProducts, {product, timeScale}])
      setAllKlineData(prev => ({...prev, [`${product}`]: data}))

      // 清空当前选择
      setProduct('')
      setTimeScale('')
      setStartTime('')
      setEndTime('')
    } catch (error) {
      console.error('添加产品失败:', error)
    }
  }

  // 移除产品
  const handleRemoveProduct = (index) => {
    const newSelectedProducts = [...selectedProducts]
    newSelectedProducts.splice(index, 1)
    setSelectedProducts(newSelectedProducts)

    const newAllKlineData = {...allKlineData}
    delete newAllKlineData[selectedProducts[index].product]
    setAllKlineData(newAllKlineData)
  }


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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>产品</InputLabel>
                  <Select
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    label="产品"
                  >
                    {products.map(p => (
                      <MenuItem key={p} value={p}>{p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isReal}
                      onChange={(e) => setIsReal(e.target.checked)}
                    />
                  }
                  label="实盘数据"
                />

                <FormControl fullWidth size="small">
                  <InputLabel>时间尺度</InputLabel>
                  <Select
                    value={timeScale}
                    onChange={(e) => setTimeScale(e.target.value)}
                    label="时间尺度"
                  >
                    <MenuItem value="">选择时间尺度</MenuItem>
                    {timeScales.map(scale => (
                      <MenuItem key={scale} value={scale}>{scale}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="开始时间"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="结束时间"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  fullWidth
                />

                <TextField
                  label="初始金额"
                  type="number"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(Number(e.target.value))}
                  size="small"
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleAddProduct}
                  fullWidth
                  disabled={!product}
                >
                  添加产品图表
                </Button>
              </Box>


            </div>
          </div>

          <div className="bottom-section">
            {trades && (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>产品</TableCell>
                      <TableCell>类型</TableCell>
                      <TableCell>开仓时间</TableCell>
                      <TableCell align="right">开仓价</TableCell>
                      <TableCell>平仓时间</TableCell>
                      <TableCell align="right">平仓价</TableCell>
                      <TableCell align="right">利润(%)</TableCell>
                      <TableCell align="right">当前资金</TableCell>
                      <TableCell align="right">下单量</TableCell>
                      <TableCell>消息</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {JSON.parse(trades).map((trade, index) => (
                      <TableRow key={index}>
                        <TableCell>{trade.product}</TableCell>
                        <TableCell>{trade.type}</TableCell>
                        <TableCell>{new Date(trade.openTime).toLocaleString()}</TableCell>
                        <TableCell align="right">{trade.openPrice.toLocaleString()}</TableCell>
                        <TableCell>{trade.closeTime ? new Date(trade.closeTime).toLocaleString() : "-"}</TableCell>
                        <TableCell align="right">{trade.closePrice}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ color: trade.profit >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {trade.profit ? trade.profit.toFixed(2) + "%" : " - "}
                        </TableCell>
                        <TableCell align="right">
                          {trade.currentMoney ? trade.currentMoney.toFixed(2) : " - "}
                        </TableCell>
                        <TableCell align="right">
                          {trade.tradeAmount ? trade.tradeAmount.toFixed(2) : " - "}
                        </TableCell>
                        <TableCell>{trade.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {selectedProducts.map((product, index) => (
              <div key={`${product}-${index}`} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{product.product} ({product.timeScale || '默认'}) K线图</h3>
                  <Button 
                    variant="outlined" 
                    color="error"
                    size="small"
                    onClick={() => handleRemoveProduct(index)}
                  >
                    移除
                  </Button>
                </div>
                <KLineChart 
                  product={product.product}
                  timeScale={timeScale}
                  isReal={isReal}
                  klineData={allKlineData[product.product] || []}
                  key={`${product.product}-${product.timeScale}-${isReal}`}
                />
              </div>
            ))}
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
              if (selectedCodeId) {
                const selectedCode = savedCodes.find(c => c.id === selectedCodeId)
                if (selectedCode) {
                  saveCode(code, selectedCode.name)
                  return
                }
              }
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
            <button onClick={() => {
              if (!selectedCodeId) {
                alert('请先选择一个文件')
                return
              }
              const confirmDelete = window.confirm('确定要删除此文件吗？')
              if (confirmDelete) {
                axios.post('http://localhost:3000/kline/delete-code', { id: selectedCodeId })
                  .then(() => {
                    setSavedCodes(savedCodes.filter(c => c.id !== selectedCodeId))
                    setSelectedCodeId(null)
                    setCode('')
                  })
                  .catch(error => {
                    console.error('Error deleting code:', error)
                    alert('删除失败: ' + error.message)
                  })
              }
            }}>
              删除
            </button>
          </div>
          <div className="code-editor">
            <Editor
              value={code}
              onValueChange={(code) => setCode(code)}
              highlight={(code) => highlight(code, languages.javascript, 'javascript')}
              padding={10}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 14,
                backgroundColor: '#f5f5f5',
                minHeight: '300px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
              placeholder='输入交易策略代码...'
            />
          </div>
        </div>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </div>
    </div>
  )
}

export default App
