import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import debounce from 'lodash.debounce';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography
} from '@mui/material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

export default function KLineChart({ product, trades: propTrades = [], initialAmount = 10000 }) {
  const [trades, setTrades] = useState(propTrades);
  const [summary, setSummary] = useState({
    totalTrades: 0,
    totalProfit: 0,
    winRate: 0,
    maxProfit: 0,
    maxLoss: 0
  });
  const [uploadStatus, setUploadStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [isReal, setIsReal] = useState(true);
  const [uploadResult, setUploadResult] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploadStatus('上传中...');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:3000/kline/upload', formData, {
        params: { isReal },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadStatus('上传成功！');
      setUploadResult(response.data.data);
      setOpenDialog(true);
      setFile(null);
      // 清空文件输入
      document.getElementById('file-upload').value = '';
    } catch (error) {
      setUploadStatus('上传失败: ' + error.message);
      setUploadResult(null);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const chartRef = useRef(null);
  const [timeRange, setTimeRange] = useState('');

  const [klineData, setKlineData] = useState([]);

  useEffect(() => {
    if (propTrades && propTrades.length > 0 && klineData.length > 0) {
      let position = null;
      const processedTrades = [];
      let totalProfit = 0;
      let winCount = 0;
      let maxProfit = 0;
      let maxLoss = 0;
      let currentBalance = initialAmount;

      for (const trade of propTrades) {
        const [time, action] = trade;
        const tradeTime = new Date(time);
        
        // 在K线数据中查找最接近的时间点
        const findKline = (time) => {
          return klineData.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(prev.timestamp) - time);
            const currDiff = Math.abs(new Date(curr.timestamp) - time);
            return currDiff < prevDiff ? curr : prev;
          });
        };

        const kline = findKline(tradeTime);
        
        if (action === 'buy' && !position) {
          position = {
            buyTime: kline.timestamp,
            buyPrice: kline.open, // 买入使用开盘价
            sellTime: null,
            sellPrice: null,
            profit: null
          };
        } else if (action === 'sell' && position) {
          position.sellTime = kline.timestamp;
          position.sellPrice = kline.close; // 卖出使用收盘价
          position.profit = ((position.sellPrice - position.buyPrice) / position.buyPrice) * 100;
          totalProfit += position.profit;
          
          if (position.profit > 0) winCount++;
          if (position.profit > maxProfit) maxProfit = position.profit;
          if (position.profit < maxLoss) maxLoss = position.profit;
          
          processedTrades.push(position);
          position = null;
        }
      }

      setTrades(processedTrades);
      setSummary({
        totalTrades: processedTrades.length,
        totalProfit,
        winRate: processedTrades.length > 0 ? (winCount / processedTrades.length * 100) : 0,
        maxProfit,
        maxLoss
      });
    }
  }, [propTrades]);

  useEffect(() => {
    const chart = echarts.init(chartRef.current);
    
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/kline', {
          params: { product, isReal }
        });
        
        const klineData = response.data;
        setKlineData(klineData); // 保存K线数据用于交易处理
        const dates = klineData.map(item => new Date(item.timestamp));
        
        if (dates.length > 0) {
          setTimeRange(`${dates[0].toLocaleString()} - ${dates[dates.length - 1].toLocaleString()}`);
        }

        // 计算y轴范围
        const allValues = klineData.flatMap(item => [item.open, item.close, item.low, item.high]);
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        // 10% padding (计算但不使用，保留计算逻辑)
        const _padding = (maxVal - minVal) * 0.1;

        const option = {
          title: {
            text: `${product} K线图 (${isReal ? '实盘' : '模拟'})`,
            subtext: `数据时间范围: ${timeRange}`,
            left: 'center'
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'cross'
            }
          },
          xAxis: {
            type: 'category',
            data: dates.map(d => d.toLocaleString()),
            axisPointer: {
              snap: true
            }
          },
          yAxis: {
            type: 'value',
            scale: true,
            boundaryGap: [0.1, 0.1]
          },
          dataZoom: [
            {
              type: 'inside',
              start: 0,
              end: 100
            },
            {
              start: 0,
              end: 100
            }
          ],
          toolbox: {
            feature: {
              dataZoom: {
                yAxisIndex: 'none'
              },
              restore: {},
              saveAsImage: {}
            }
          },
          series: [{
            type: 'candlestick',
            data: klineData.map(item => [
              item.open,
              item.close,
              item.low,
              item.high
            ]),
            itemStyle: {
              color: '#ef232a',
              color0: '#14b143',
              borderColor: '#ef232a',
              borderColor0: '#14b143'
            }
          }]
        };
        
        chart.setOption(option);
        
        // 添加防抖的dataZoom事件监听器
        const handleDataZoom = debounce(function() {
          setIsLoading(true);
          
          const option = chart.getOption();
          const startValue = option.dataZoom[0].startValue;
          const endValue = option.dataZoom[0].endValue;
          
          // 计算当前可视范围内的数据
          const visibleData = klineData.slice(startValue, endValue + 1);
          const visibleValues = visibleData.flatMap(item => [item.open, item.close, item.low, item.high]);
          const visibleMin = Math.min(...visibleValues);
          const visibleMax = Math.max(...visibleValues);
          const visiblePadding = (visibleMax - visibleMin) * 0.1;
          
          // 更新y轴范围
          chart.setOption({
            yAxis: {
              min: visibleMin - visiblePadding,
              max: visibleMax + visiblePadding
            }
          }, { silent: true });
          
          setIsLoading(false);
        }, 300);
        
        chart.on('dataZoom', handleDataZoom);
      } catch (error) {
        console.error('Error fetching kline data:', error);
      }
    };

    fetchData();
    
    return () => chart.dispose();
  }, [product, isReal, timeRange]);

  const [code, setCode] = useState('');
  const [savedCodes, setSavedCodes] = useState([]);

  const handleSaveCode = async () => {
    try {
      await axios.post('http://localhost:3000/kline/save-code', { code });
      const response = await axios.get('http://localhost:3000/kline/saved-codes');
      setSavedCodes(response.data);
    } catch (error) {
      console.error('Error saving code:', error);
    }
  };

  const handleLoadCode = async (id) => {
    try {
      const response = await axios.get(`http://localhost:3000/kline/code/${id}`);
      setCode(response.data.code);
    } catch (error) {
      console.error('Error loading code:', error);
    }
  };

  const handleRunCode = () => {
    try {
      // 这里可以添加代码执行逻辑
      console.log('Running code:', code);
    } catch (error) {
      console.error('Error running code:', error);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', gap: '20px' }}>
      <div style={{ flex: 1 }}>
      <div style={{ 
        marginBottom: '20px', 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        backgroundColor: '#f5f5f5',
        color: '#333'
      }}>
        <h3 style={{ marginTop: 0, color: '#222' }}>上传K线数据</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '15px', color: '#333' }}>
            <input 
              type="radio" 
              checked={isReal}
              onChange={() => setIsReal(true)}
            />
            实盘数据
          </label>
          <label style={{ color: '#333' }}>
            <input 
              type="radio" 
              checked={!isReal}
              onChange={() => setIsReal(false)}
            />
            模拟数据
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input 
            id="file-upload"
            type="file" 
            onChange={handleFileChange}
            style={{ 
              flex: 1, 
              marginRight: '10px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button 
            onClick={handleUpload} 
            disabled={!file}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            上传
          </button>
        </div>
        {uploadStatus && <p style={{ marginTop: '10px', color: '#333' }}>{uploadStatus}</p>}
      </div>
      <div style={{ margin: '20px 0' }}>
        <Typography variant="h6" gutterBottom>
          交易汇总
        </Typography>
        <TableContainer component={Paper} style={{ marginBottom: '20px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>总交易次数</TableCell>
                <TableCell>总收益率(%)</TableCell>
                <TableCell>胜率(%)</TableCell>
                <TableCell>最大盈利(%)</TableCell>
                <TableCell>最大亏损(%)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{summary.totalTrades}</TableCell>
                <TableCell>{summary.totalProfit.toFixed(2)}</TableCell>
                <TableCell>{summary.winRate.toFixed(2)}</TableCell>
                <TableCell>{summary.maxProfit.toFixed(2)}</TableCell>
                <TableCell>{summary.maxLoss.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="h6" gutterBottom>
          交易明细
        </Typography>
        <TableContainer component={Paper} style={{ marginBottom: '20px', maxHeight: '400px', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>买入时间</TableCell>
                <TableCell>买入价</TableCell>
                <TableCell>卖出时间</TableCell>
                <TableCell>卖出价</TableCell>
                <TableCell>收益率(%)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(trade.buyTime).toLocaleString()}</TableCell>
                  <TableCell>{trade.buyPrice.toFixed(4)}</TableCell>
                  <TableCell>{new Date(trade.sellTime).toLocaleString()}</TableCell>
                  <TableCell>{trade.sellPrice.toFixed(4)}</TableCell>
                  <TableCell style={{ color: trade.profit >= 0 ? 'green' : 'red' }}>
                    {trade.profit.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            onChange={(e) => handleLoadCode(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="">加载历史代码</option>
            {savedCodes.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
          <button 
            onClick={handleSaveCode}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            保存代码
          </button>
          <button 
            onClick={handleRunCode}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#14b143',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            运行代码
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            flex: 1,
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minHeight: '500px'
          }}
        />
      </div>
      <div style={{ position: 'relative' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255,255,255,0.8)',
            padding: '10px 20px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            加载中...
          </div>
        )}
        <div ref={chartRef} style={{ width: '100%', height: '500px' }} />
      </div>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>上传结果</DialogTitle>
        <DialogContent>
          {uploadResult && (
            <>
              <DialogContentText>产品: {uploadResult.product}</DialogContentText>
              <DialogContentText>
                时间范围: {new Date(uploadResult.timeRange.start).toLocaleString()} 至 {new Date(uploadResult.timeRange.end).toLocaleString()}
              </DialogContentText>
              <DialogContentText>总数据: {uploadResult.stats.total}条</DialogContentText>
              <DialogContentText>成功插入: {uploadResult.stats.inserted}条</DialogContentText>
              <DialogContentText>重复数据: {uploadResult.stats.duplicates}条</DialogContentText>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>关闭</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
