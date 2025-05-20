import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

export default function KLineChart({ product, initialAmount = 10000 }) {
  const [uploadStatus, setUploadStatus] = useState('');
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

  useEffect(() => {
    const chart = echarts.init(chartRef.current);
    
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/kline', {
          params: { product, isReal }
        });
        
        const klineData = response.data;
        const dates = klineData.map(item => new Date(item.timestamp));
        
        if (dates.length > 0) {
          setTimeRange(`${dates[0].toLocaleString()} - ${dates[dates.length - 1].toLocaleString()}`);
        }

        // 计算y轴范围
        const allValues = klineData.flatMap(item => [item.open, item.close, item.low, item.high]);
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const padding = (maxVal - minVal) * 0.1; // 10% padding

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
            min: minVal - padding,
            max: maxVal + padding,
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
      } catch (error) {
        console.error('Error fetching kline data:', error);
      }
    };

    fetchData();
    
    return () => chart.dispose();
  }, [product, isReal, timeRange]);

  return (
    <div style={{ width: '100%' }}>
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
      <div ref={chartRef} style={{ width: '100%', height: '500px' }} />

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
