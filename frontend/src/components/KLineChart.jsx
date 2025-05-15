import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import axios from 'axios';

export default function KLineChart({ product, isReal }) {
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = echarts.init(chartRef.current);
    
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/kline', {
          params: { product, isReal }
        });
        
        const option = {
          xAxis: {
            type: 'category',
            data: response.data.map(item => new Date(item.time).toLocaleString())
          },
          yAxis: { type: 'value' },
          series: [{
            type: 'candlestick',
            data: response.data.map(item => [
              item.open,
              item.close,
              item.low,
              item.high
            ])
          }]
        };
        
        chart.setOption(option);
      } catch (error) {
        console.error('Error fetching kline data:', error);
      }
    };

    fetchData();
    
    return () => chart.dispose();
  }, [product, isReal]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
}
